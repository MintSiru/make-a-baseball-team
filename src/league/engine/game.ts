/* One game, plate appearance by plate appearance.

   Each PA draws walk / hit-by-pitch / strikeout / home run from logit-linear rates (tuning.ts ENGINE),
   then resolves a ball in play: error, hit (single/double/triple) or out (ground ball with possible
   double play, fly ball with possible sacrifice fly). Runners carry the pitcher responsible for them,
   so runs and earned runs are charged the way official scoring does, and W/L/SV/HLD follow KBO rules
   in simplified form (see decide()).

   Determinism: every draw comes from the `r` passed in, in a fixed order. Changing the order of draws
   changes results and needs a SIM_VERSION bump. */
import { ENGINE as E, Z, Zr } from '../tuning';
import { emptySplit, type BattingLine, type BatterIn, type BullpenRole, type GameIn, type GameOut, type PitcherIn, type PitchingLine, type RelieverIn, type Split, type TeamBox, type TeamIn } from './types';

type R = () => number;

const logit = (p: number) => Math.log(p / (1 - p));
const inv = (x: number) => 1 / (1 + Math.exp(-x));
const normal = (r: R) => (r() + r() + r() - 1.5) / 1.5;

interface Runner {
  bat: number; // index into the batting side's lineup
  resp: number; // index into the fielding side's appearances: the pitcher charged if he scores
  unearned: boolean;
}

interface Appearance {
  arm: PitcherIn;
  role: 'SP' | BullpenRole;
  line: PitchingLine;
  /** Lead of his team when he entered; runners on and outs then. */
  entryLead: number;
  entryRunners: number;
  minLead: number;
  exitLead: number;
}

interface Side {
  team: TeamIn;
  box: TeamBox;
  bat: BattingLine[];
  apps: Appearance[];
  pen: RelieverIn[];
  next: number; // lineup index of the next batter
  fieldZ: number; // team fielding z
  catcherZ: number;
}

// Position weights for team fielding: the middle of the diamond matters most.
const FIELD_WEIGHT: Record<string, number> = { C: 0.6, '1B': 0.5, '2B': 1.1, '3B': 0.9, SS: 1.3, LF: 0.7, CF: 1.1, RF: 0.8, DH: 0 };

function emptyBatting(b: BatterIn): BattingLine {
  return { id: b.id, pos: b.pos, split: { L: emptySplit(), R: emptySplit() }, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, k: 0, r: 0, rbi: 0, sb: 0, cs: 0, sf: 0, sh: 0, gdp: 0 };
}

function emptyPitching(id: string, starter: boolean): PitchingLine {
  return { id, split: { L: emptySplit(), R: emptySplit() }, gs: starter ? 1 : 0, outs: 0, bf: 0, h: 0, hr: 0, bb: 0, hbp: 0, k: 0, r: 0, er: 0, pitches: 0, w: 0, l: 0, sv: 0, hld: 0, qs: 0 };
}

function makeSide(team: TeamIn): Side {
  let w = 0,
    sum = 0;
  for (const b of team.lineup) {
    const fw = FIELD_WEIGHT[b.pos] ?? 0;
    w += fw;
    sum += fw * Z(b.defense);
  }
  const catcher = team.lineup.find((b) => b.pos === 'C');
  const box: TeamBox = { teamId: team.teamId, runs: 0, hits: 0, errors: 0, lineScore: [], batting: [], pitching: [] };
  const side: Side = {
    team,
    box,
    bat: team.lineup.map(emptyBatting),
    apps: [],
    pen: [...team.bullpen],
    next: 0,
    fieldZ: (w ? sum / w : 0) + (team.fieldBonus ?? 0),
    catcherZ: catcher ? Z(catcher.defense) : 0,
  };
  side.apps.push({ arm: team.starter, role: 'SP', line: emptyPitching(team.starter.id, true), entryLead: 0, entryRunners: 0, minLead: 0, exitLead: 0 });
  return side;
}

/** Everything that happens in one game. */
export function simulateGame(game: GameIn, r: R): GameOut {
  const home = makeSide(game.home),
    away = makeSide(game.away);
  const parkHr = Math.log(game.park) * 1.4,
    parkBabip = Math.log(game.park) * 0.6;
  // The last lead change: pitcher of record for the team that went ahead, and the pitcher charged with the go-ahead run.
  const state: { goAhead: { winnerApp: number; loserApp: number } | null } = { goAhead: null };
  let inning = 0;
  let over = false;

  const lead = (s: Side) => (s === home ? home.box.runs - away.box.runs : away.box.runs - home.box.runs);

  function halfInning(bat: Side, field: Side, isHome: boolean) {
    let outs = 0;
    // Official scoring rebuilds the inning as if errors were outs: runs after that third "out" are unearned.
    let errorOuts = 0;
    const bases: [Runner | null, Runner | null, Runner | null] = [null, null, null];
    let runsThisHalf = 0;
    const runnersOn = () => (bases[0] ? 1 : 0) + (bases[1] ? 1 : 0) + (bases[2] ? 1 : 0);
    const current = () => field.apps[field.apps.length - 1]!;

    // The plate appearance in progress, credited to both players' platoon splits once it is over.
    let open: { bl: BattingLine; pl: PitchingLine; vsPitcher: 'L' | 'R'; vsBatter: 'L' | 'R'; before: Split } | null = null;
    const counts = (l: BattingLine): Split => ({ pa: l.pa, ab: l.ab, h: l.h, tb: l.h + l.d + 2 * l.t + 3 * l.hr, hr: l.hr, bb: l.bb, hbp: l.hbp, k: l.k, sf: l.sf });
    const closePA = () => {
      if (!open) return;
      const now = counts(open.bl);
      const into = [open.bl.split![open.vsPitcher], open.pl.split![open.vsBatter]];
      for (const k of Object.keys(now) as (keyof Split)[]) for (const s of into) s[k] += now[k] - open.before[k];
      open = null;
    };

    const score = (runner: Runner, rbiTo: BattingLine | null) => {
      const before = lead(bat);
      bat.box.runs++;
      runsThisHalf++;
      bat.bat[runner.bat]!.r++;
      if (rbiTo) rbiTo.rbi++;
      const charged = field.apps[runner.resp]!.line;
      charged.r++;
      if (!runner.unearned && outs + errorOuts < 3) charged.er++;
      const after = lead(bat);
      const pitching = current();
      pitching.minLead = Math.min(pitching.minLead, -after);
      if (before <= 0 && after > 0) state.goAhead = { winnerApp: bat.apps.length - 1, loserApp: runner.resp };
      if (isHome && inning >= 9 && after > 0) over = true; // walk-off
    };

    const pitchChange = () => {
      const app = current();
      const line = app.line;
      const myLead = lead(field);
      let pull = false;
      const upNext = game[isHome ? 'home' : 'away'].lineup[bat.next]!;
      // A left-handed hitter up late in a close game: the lefty specialist comes in for him.
      const lefty =
        inning >= 6 && Math.abs(myLead) <= 2 && upNext.bats === 'L' && app.arm.throws === 'R' && app.role !== 'CL' && app.role !== 'LO' && field.pen.some((p) => p.role === 'LO');
      if (app.role === 'SP') {
        const limit = app.arm.pitchLimit;
        if (line.pitches >= limit) pull = true;
        else if (line.r >= E.starter.runsBeforeHook) pull = true;
        else if (inning <= E.starter.earlyHookInning && line.r >= E.starter.earlyHookRuns && line.pitches > 50 && runnersOn() > 0) pull = true;
        else if (inning >= 9 && outs === 0 && runnersOn() === 0 && r() > E.starter.completeGameChance) pull = true;
        else if (lefty && line.pitches >= E.reliever.lefty.starterPitches && runnersOn() > 0) pull = true;
      } else {
        const long = app.role === 'LR';
        const mopUp = app.role === 'MU';
        const maxOuts = long ? E.reliever.maxOutsLong : mopUp ? E.reliever.maxOutsMopUp : E.reliever.maxOutsShort;
        const pitchLimit = long ? E.reliever.pitchLimitLong : mopUp ? E.reliever.pitchLimitMopUp : E.reliever.pitchLimitShort;
        const fresh = outs === 0 && runnersOn() === 0;
        if (line.pitches >= pitchLimit || line.outs >= maxOuts) pull = true;
        // The specialist's job ends when the lefties do.
        else if (app.role === 'LO' && line.bf >= 1 && upNext.bats !== 'L') pull = true;
        else if (lefty && line.bf >= 1) pull = true;
        else if (fresh && line.outs >= 3 && !(app.role === 'CL' && myLead > 0 && inning >= 9)) pull = true;
        // Trouble late in a close game: two on and already a run in → the next arm.
        else if (inning >= 6 && !long && !mopUp && runnersOn() >= 2 && line.r >= 1 && Math.abs(myLead) <= 3 && line.bf >= 3) pull = true;
      }
      if (!pull || field.pen.length === 0) return;
      const want: BullpenRole[] = [];
      const close = myLead >= 0 && myLead <= 3;
      if (lefty) want.push('LO');
      if (inning >= 9 && myLead > 0 && myLead <= 3) want.push('CL', 'SU', 'HL');
      else if (inning >= 9 && myLead === 0) want.push('CL', 'SU', 'HL');
      else if (inning === 8 && close) want.push('SU', 'HL');
      else if (inning >= 6 && close) want.push('HL', 'SU');
      else if (inning <= 5) want.push('LR', 'MU');
      else if (myLead < 0 && myLead >= -3) want.push('MU', 'HL');
      else want.push('MU', 'LR');
      want.push('MU', 'LR', 'HL', 'SU', 'LO', 'CL');
      let pick = -1;
      for (const role of want) {
        pick = field.pen.findIndex((p) => p.role === role);
        if (pick >= 0) break;
      }
      if (pick < 0) return;
      const arm = field.pen.splice(pick, 1)[0]!;
      app.exitLead = myLead;
      field.apps.push({ arm, role: arm.role, line: emptyPitching(arm.id, false), entryLead: myLead, entryRunners: runnersOn(), minLead: myLead, exitLead: myLead });
    };

    while (outs < 3 && !over) {
      closePA();
      pitchChange();
      const app = current();
      const p = app.arm,
        pl = app.line;
      const batter = game[isHome ? 'home' : 'away'].lineup[bat.next]!;
      const bl = bat.bat[bat.next]!;
      const fatigue = Math.max(0, pl.pitches - p.pitchLimit) * 0.18;
      const stuff = Zr(p.stuff - fatigue),
        command = Zr(p.command - fatigue),
        breaking = Zr(p.breaking - fatigue * 0.5);

      // Stolen base attempt before the pitch: runner on first, second base open.
      const runner1 = bases[0];
      if (runner1 && !bases[1] && outs < 3) {
        const rs = game[isHome ? 'home' : 'away'].lineup[runner1.bat]!;
        if (rs.speed >= E.steal.minSpeed && r() < inv(logit(E.steal.attempt.base) + E.steal.attempt.speed * Z(rs.speed) + (bat.team.smallBall ? E.smallBall.steal : 0))) {
          const ok = r() < inv(logit(E.steal.success.base) + E.steal.success.speed * Z(rs.speed) + E.steal.success.catcher * field.catcherZ);
          bases[0] = null;
          if (ok) {
            bases[1] = runner1;
            bat.bat[runner1.bat]!.sb++;
          } else {
            bat.bat[runner1.bat]!.cs++;
            outs++;
            pl.outs++;
            continue;
          }
        }
      }
      // Wild pitch: every runner moves up.
      if (runnersOn() > 0 && r() < inv(logit(E.wildPitch.base) + E.wildPitch.command * command)) {
        if (bases[2]) {
          score(bases[2], null);
          bases[2] = null;
          if (over) break;
        }
        bases[2] = bases[1];
        bases[1] = bases[0];
        bases[0] = null;
      }

      // Sacrifice bunt: weak hitter, nobody out, runner on first or second, close game.
      const weak = (batter.contact + batter.power) / 2 < E.sacBunt.maxBatterGrade;
      if (outs === 0 && (bases[0] || bases[1]) && !bases[2] && weak && Math.abs(lead(bat)) <= 2 && r() < E.sacBunt.rate * (bat.team.smallBall ? E.smallBall.bunt : 1)) {
        bl.pa++;
        bl.sh++;
        pl.bf++;
        pl.pitches += 2;
        pl.outs++;
        outs++;
        if (bases[1]) bases[2] = bases[1];
        bases[1] = bases[0];
        bases[0] = null;
        bat.next = (bat.next + 1) % 9;
        continue;
      }

      const same = batter.bats !== 'S' && batter.bats === p.throws ? (p.platoon ?? 1) : 0;
      const hb = isHome ? 1 : 0;
      const b = E.batter,
        q = E.pitcher;
      const zc = Zr(batter.contact),
        zp = Zr(batter.power),
        ze = Zr(batter.eye),
        zs = Zr(batter.speed);
      const pBB = inv(logit(E.base.bb) + b.bb.eye * ze + b.bb.contact * zc + q.bb.command * command + q.bb.stuff * stuff + E.platoon.bb * same);
      const pHBP = inv(logit(E.base.hbp) + q.hbp.command * command);
      const pK = inv(logit(E.base.k) + b.k.contact * zc + b.k.power * zp + b.k.eye * ze + q.k.stuff * stuff + q.k.breaking * breaking + q.k.command * command + E.platoon.k * same);
      const pHR = inv(
        logit(E.base.hr) + b.hr.power * zp + b.hr.contact * zc + q.hr.stuff * stuff + q.hr.command * command + q.hr.breaking * breaking + E.platoon.hr * same + E.home.hr * hb + parkHr,
      );

      const hitsFrom = batter.bats === 'S' ? (p.throws === 'L' ? 'R' : 'L') : batter.bats;
      open = { bl, pl, vsPitcher: p.throws, vsBatter: hitsFrom, before: counts(bl) };
      bl.pa++;
      pl.bf++;
      const u = r();
      let pitches = E.pitches.perPa + normal(r) * E.pitches.noise;
      bat.next = (bat.next + 1) % 9;
      const me: Runner = { bat: (bat.next + 8) % 9, resp: field.apps.length - 1, unearned: false };

      if (u < pBB + pHBP) {
        const hbp = u >= pBB;
        if (hbp) {
          bl.hbp++;
          pl.hbp++;
        } else {
          bl.bb++;
          pl.bb++;
          pitches += E.pitches.bb;
        }
        // Force advance.
        if (bases[0]) {
          if (bases[1]) {
            if (bases[2]) score(bases[2], bl);
            bases[2] = bases[1];
          }
          bases[1] = bases[0];
        }
        bases[0] = me;
      } else if (u < pBB + pHBP + pK) {
        bl.ab++;
        bl.k++;
        pl.k++;
        pl.outs++;
        outs++;
        pitches += E.pitches.k;
      } else if (u < pBB + pHBP + pK + pHR) {
        bl.ab++;
        bl.h++;
        bl.hr++;
        pl.h++;
        pl.hr++;
        bat.box.hits++;
        for (let i = 2; i >= 0; i--) {
          const x = bases[i];
          if (x) score(x, bl);
          bases[i] = null;
        }
        score(me, bl);
      } else {
        // Ball in play.
        bl.ab++;
        if (r() < inv(logit(E.errorPerBip) + E.fielding.error * field.fieldZ)) {
          field.box.errors++;
          errorOuts++;
          me.unearned = true;
          // Runs that score because of the error are unearned.
          if (bases[2]) score({ ...bases[2], unearned: true }, null);
          bases[2] = bases[1];
          bases[1] = bases[0];
          bases[0] = me;
        } else {
          const pHit = inv(
            logit(E.base.babip) + b.babip.contact * zc + b.babip.speed * zs + q.babip.stuff * stuff + q.babip.breaking * breaking + E.fielding.babip * field.fieldZ +
              E.platoon.babip * same + E.home.babip * hb + parkBabip,
          );
          if (r() < pHit) {
            bl.h++;
            pl.h++;
            bat.box.hits++;
            const T = E.hitTypes;
            const pTriple = inv(logit(T.triple.base) + T.triple.speed * zs + T.triple.power * zp);
            const pDouble = inv(logit(T.double.base) + T.double.power * zp + T.double.speed * zs);
            const v = r();
            const A = E.advance;
            if (v < pTriple) {
              bl.t++;
              for (let i = 2; i >= 0; i--) {
                const x = bases[i];
                if (x) score(x, bl);
                bases[i] = null;
              }
              bases[2] = me;
            } else if (v < pTriple + pDouble) {
              bl.d++;
              if (bases[2]) score(bases[2], bl);
              if (bases[1]) score(bases[1], bl);
              bases[2] = null;
              bases[1] = null;
              const first = bases[0];
              bases[0] = null;
              if (first) {
                const rsp = game[isHome ? 'home' : 'away'].lineup[first.bat]!.speed;
                if (r() < inv(logit(A.firstScoresOnDouble.base) + A.firstScoresOnDouble.speed * Z(rsp))) score(first, bl);
                else bases[2] = first;
              }
              bases[1] = me;
            } else {
              if (bases[2]) score(bases[2], bl);
              bases[2] = null;
              const second = bases[1],
                first = bases[0];
              bases[1] = null;
              bases[0] = null;
              if (second) {
                const rsp = game[isHome ? 'home' : 'away'].lineup[second.bat]!.speed;
                if (r() < inv(logit(A.secondScoresOnSingle.base) + A.secondScoresOnSingle.speed * Z(rsp) - (outs === 2 ? -0.8 : 0))) score(second, bl);
                else bases[2] = second;
              }
              if (first) {
                const rsp = game[isHome ? 'home' : 'away'].lineup[first.bat]!.speed;
                if (!bases[2] && r() < inv(logit(A.firstToThirdOnSingle.base) + A.firstToThirdOnSingle.speed * Z(rsp))) bases[2] = first;
                else bases[1] = first;
              }
              bases[0] = me;
            }
          } else {
            // Out in play.
            pitches -= 0.4;
            const O = E.outs;
            const ground = r() < O.groundShare;
            if (ground) {
              if (bases[0] && outs < 2 && r() < inv(logit(O.doublePlay.base) + O.doublePlay.speed * zs)) {
                bl.gdp++;
                pl.outs += 2;
                outs += 2;
                bases[0] = null;
                if (outs < 3) {
                  // Lead runners move up on the double play; a run from third scores with fewer than 3 outs.
                  if (bases[2]) {
                    score(bases[2], null);
                    bases[2] = null;
                  }
                  if (bases[1]) {
                    bases[2] = bases[1];
                    bases[1] = null;
                  }
                }
              } else {
                pl.outs++;
                outs++;
                if (outs < 3) {
                  if (bases[2] && (bases[1] && bases[0] ? true : r() < O.groundScoreFromThird)) {
                    score(bases[2], bl);
                    bases[2] = null;
                  }
                  if (bases[1] && !bases[2]) {
                    bases[2] = bases[1];
                    bases[1] = null;
                  }
                  if (bases[0] && !bases[1]) {
                    bases[1] = bases[0];
                    bases[0] = null;
                  }
                }
              }
            } else {
              pl.outs++;
              outs++;
              if (outs < 3 && bases[2] && r() < inv(logit(O.sacFly.base) + O.sacFly.speed * Z(game[isHome ? 'home' : 'away'].lineup[bases[2].bat]!.speed))) {
                bl.ab--;
                bl.sf++;
                score(bases[2], bl);
                bases[2] = null;
              }
              if (outs < 3 && bases[1] && !bases[2] && r() < O.flyAdvanceSecond) {
                bases[2] = bases[1];
                bases[1] = null;
              }
            }
          }
        }
      }
      pl.pitches += Math.max(1, Math.round(pitches));
    }
    closePA();
    return runsThisHalf;
  }

  while (!over) {
    inning++;
    away.box.lineScore.push(halfInning(away, home, false));
    if (inning >= 9 && home.box.runs > away.box.runs) {
      break; // home team does not bat in the bottom half
    }
    home.box.lineScore.push(halfInning(home, away, true));
    if (over) break;
    if (inning >= 9 && home.box.runs !== away.box.runs) break;
    if (game.maxInnings !== null && inning >= game.maxInnings) break;
  }

  const result: GameOut['result'] = home.box.runs > away.box.runs ? 'home' : away.box.runs > home.box.runs ? 'away' : 'tie';
  for (const s of [home, away]) {
    const last = s.apps[s.apps.length - 1]!;
    last.exitLead = lead(s);
  }
  if (result !== 'tie' && state.goAhead) decide(result === 'home' ? home : away, result === 'home' ? away : home, state.goAhead);
  for (const s of [home, away]) {
    const sp = s.apps[0]!.line;
    if (sp.outs >= 18 && sp.er <= 3) sp.qs = 1;
    s.box.batting = s.bat;
    s.box.pitching = s.apps.map((a) => a.line);
  }
  return { gameId: game.gameId, innings: inning, home: home.box, away: away.box, result };
}

/** Wins, losses, saves and holds (simplified official scoring). */
function decide(winner: Side, loser: Side, goAhead: { winnerApp: number; loserApp: number }) {
  let w = goAhead.winnerApp;
  // A starter needs five innings for the win; otherwise it goes to the reliever who got the most outs.
  if (w === 0 && winner.apps[0]!.line.outs < 15 && winner.apps.length > 1) {
    w = 1;
    for (let i = 2; i < winner.apps.length; i++) if (winner.apps[i]!.line.outs > winner.apps[w]!.line.outs) w = i;
  }
  winner.apps[w]!.line.w = 1;
  loser.apps[goAhead.loserApp]!.line.l = 1;

  // Save: finished the win without being the winner, never gave up the lead, and entered with a lead of
  // three or less and got three outs, or with the tying run on base/at bat/on deck, or pitched three innings.
  const finisher = winner.apps.length - 1;
  const tyingRunClose = (a: Appearance) => a.entryLead <= a.entryRunners + 2;
  const saveSituation = (a: Appearance) => a.entryLead > 0 && (a.entryLead <= 3 || tyingRunClose(a));
  const fin = winner.apps[finisher]!;
  if (finisher !== w && finisher > 0 && fin.entryLead > 0 && fin.minLead > 0 && ((fin.entryLead <= 3 && fin.line.outs >= 3) || tyingRunClose(fin) || fin.line.outs >= 9))
    fin.line.sv = 1;
  for (const s of [winner, loser]) {
    s.apps.forEach((a, i) => {
      if (i === 0 || a.line.w || a.line.l || a.line.sv) return;
      if (s === winner && i === finisher) return;
      if (saveSituation(a) && a.line.outs >= 1 && a.minLead > 0 && a.exitLead > 0) a.line.hld = 1;
    });
  }
}
