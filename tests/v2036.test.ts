/* 2.0.36 (the user's requests): knuckleballers, disciplinary demotions, social-media stories, more misconduct (players,
   staff, the front office) and rivalries between players. */
import { describe, expect, it } from 'vitest';
import { rng } from '../src/draftroom';
import { apply } from '../src/league/actions';
import { DISCIPLINE, disciplineDay, pushbackChance } from '../src/league/discipline';
import { canMove } from '../src/league/entry';
import { createLeague } from '../src/league/history';
import { learnable } from '../src/league/newpitch';
import { developPitches, isKnuckleballer, KNUCKLE, pitchGrades, repertoire, topVelocity } from '../src/league/pitches';
import { ageIn, isPitcher } from '../src/league/players';
import { drawRivals, rivalriesOf, RIVALS, rivalsMeet, rivalsOf } from '../src/league/rivals';
import { scandalDay } from '../src/league/scandals';
import { staffOf } from '../src/league/staff';
import { staffTrouble } from '../src/league/stafftrouble';
import type { LeagueState } from '../src/league/state';
import { trackingOf } from '../src/league/tracking';
import { SCANDAL } from '../src/league/tuning';
import { happen, VIRAL } from '../src/league/viral';
import { loadSave, playDays } from './helpers';

const save = () => loadSave('2.0.30');
const date = (s: LeagueState) => s.schedule[s.next]!.date;

describe('knuckleballers (2.0.36)', () => {
  it('throw the knuckleball most of the time, one or two weak pitches besides, a slow fastball, and keep to it', () => {
    const s = createLeague('kn-check');
    const kn = Object.values(s.players).filter((p) => isPitcher(p) && isKnuckleballer(p));
    expect(kn.length).toBeGreaterThan(0);
    for (const p of kn) {
      const rep = repertoire(p);
      expect(rep[0]!.type).toBe('KN');
      expect(rep[0]!.usage).toBeGreaterThanOrEqual(KNUCKLE.share.min);
      expect(rep.length - 1 - (p.learned?.length ?? 0)).toBeGreaterThanOrEqual(1);
      expect(rep.length - 1 - (p.learned?.length ?? 0)).toBeLessThanOrEqual(2);
      const grades = pitchGrades(p);
      for (const g of grades.slice(1)) expect(g.grade).toBeLessThan(grades[0]!.grade);
      const top = topVelocity(p)!;
      expect(top).toBeGreaterThanOrEqual(KNUCKLE.top.min);
      expect(top).toBeLessThanOrEqual(KNUCKLE.top.max);
      expect(learnable(p)).toEqual([]);
      developPitches(p, s.year, 28);
      expect(p.pitchDev).toBeUndefined();
      const t = trackingOf(p);
      if (t) {
        const k = t.pitches.find((x) => x.type === 'KN')!;
        expect(Math.abs(k.velocity - KNUCKLE.kmh)).toBeLessThanOrEqual(10);
      }
    }
    // Rare: a few in a league.
    expect(kn.length).toBeLessThan(10);
  });
});

describe('disciplinary demotions (2.0.36)', () => {
  it('the general manager sends one of ours down; he cannot come back before the date; then he is free again', () => {
    const s = save();
    const me = s.user!.teamId;
    const id = s.rosters[me]!.active.find((x) => !s.injuries[x])!;
    apply(s, { kind: 'discipline', id, days: 15 });
    expect(s.discipline?.[id]).toBeUndefined();
    apply(s, { kind: 'discipline', id, days: 10 });
    const d = s.discipline![id]!;
    expect(d.why).toBe('gm');
    expect(s.rosters[me]!.active).not.toContain(id);
    expect(s.rosters[me]!.futures).toContain(id);
    if ((s.user!.entry ?? 'auto') === 'manual') expect(canMove(s, id, 'active')).not.toBeNull();
    disciplineDay(s, d.until);
    expect(s.discipline?.[id]).toBeUndefined();
  });

  it('a hothead is likelier to answer back', () => {
    const s = save();
    const p = Object.values(s.players).find((x) => x.status === 'active' && x.hidden.traits)!;
    const calm = structuredClone(p),
      hot = structuredClone(p);
    calm.hidden.traits = { ...calm.hidden.traits!, controversy: 10, temper: 10 };
    hot.hidden.traits = { ...hot.hidden.traits!, controversy: 95, temper: 95 };
    expect(pushbackChance(hot)).toBeGreaterThan(pushbackChance(calm));
    expect(pushbackChance(hot)).toBeLessThanOrEqual(DISCIPLINE.pushback.max);
  });

  it('managers send slumping players down after a look at the last two weeks', () => {
    const s = save();
    const was = DISCIPLINE.chance.slump,
      star = DISCIPLINE.chance.star;
    DISCIPLINE.chance.slump = 1;
    DISCIPLINE.chance.star = 1;
    try {
      const day = date(s);
      disciplineDay(s, day);
      // A hitter who went 0-for-40 since the look.
      const team = s.teams.find((t) => t.id !== s.user!.teamId && s.rosters[t.id]?.active.length)!.id;
      const id = s.rosters[team]!.active.find((x) => !isPitcher(s.players[x]!) && s.lines[x]?.bat)!;
      const bat = s.lines[id]!.bat!;
      s.formMark = { date: day, lines: { ...s.formMark!.lines, [id]: [bat.pa - 40, bat.h + bat.bb + bat.hbp, bat.h + bat.d + 2 * bat.t + 3 * bat.hr, bat.ab + bat.bb + bat.hbp + bat.sf - 40, bat.ab - 40, 0, 0] } };
      const later = new Date(Date.parse(day) + 15 * 86400000).toISOString().slice(0, 10);
      disciplineDay(s, later);
      expect(s.discipline?.[id]?.why).toBe('slump');
      expect(s.rosters[team]!.active).not.toContain(id);
    } finally {
      DISCIPLINE.chance.slump = was;
      DISCIPLINE.chance.star = star;
    }
  });
});

describe('social-media stories (2.0.36)', () => {
  it('each kind writes a story about our players and leaves its mark', () => {
    const s = save();
    const me = s.user!.teamId;
    const day = date(s);
    for (const kind of ['otter', 'mukbang', 'challenge', 'coachRace', 'foreignFamily'] as const) happen(s, kind, day, rng(`t|${kind}`));
    const stories = (s.news ?? []).filter((n) => n.id.startsWith('viral-'));
    expect(stories.length).toBeGreaterThanOrEqual(3);
    for (const n of stories) for (const id of n.players) expect(s.players[id]!.teamId).toBe(me);
    // The bread errand needs a losing streak.
    happen(s, 'bread', day, rng('t|bread'));
    expect(s.news!.some((n) => n.id === `viral-bread-${day}`)).toBe(false);
    const other = s.teams.find((t) => t.id !== me)!.id;
    for (let i = 0; i < VIRAL.bread.streak; i++) s.scores.push({ id: `fake-${i}`, date: day, home: me, away: other, hs: 0, as: 5 } as (typeof s.scores)[number]);
    happen(s, 'bread', day, rng('t|bread'));
    const bread = s.news!.find((n) => n.id === `viral-bread-${day}`);
    expect(bread).toBeDefined();
    expect(ageIn(s.players[bread!.players[0]!]!, s.year)).toBeGreaterThanOrEqual(VIRAL.bread.minAge);
  });
});

describe('more misconduct (2.0.36)', () => {
  it('a coach let go for cause gives way to an interim', () => {
    const s = save();
    const me = s.user!.teamId;
    const before = Object.values(staffOf(s, me)).map((m) => m.id);
    const interest = s.clubs![me]!.interest;
    staffTrouble(s, 'assault', date(s), rng('t|staff'));
    const after = Object.values(staffOf(s, me));
    expect(after.filter((m) => !before.includes(m.id)).length).toBe(1);
    expect(after.find((m) => !before.includes(m.id))!.interim).toBe(true);
    expect(s.clubs![me]!.interest).toBeLessThan(interest);
  });

  it('drug use bans a player from the league', () => {
    const s = save();
    const rates = { ...SCANDAL.rare };
    for (const k of Object.keys(SCANDAL.rare) as (keyof typeof SCANDAL.rare)[]) SCANDAL.rare[k] = 0;
    SCANDAL.rare.drugs = 1e6;
    try {
      let day = date(s);
      for (let i = 0; i < 5 && !s.pending; i++) {
        scandalDay(s, day);
        day = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
      }
      const banned = Object.values(s.players).find((p) => p.life?.offenses?.drugs);
      expect(banned).toBeDefined();
      expect(banned!.status).toBe('retired');
    } finally {
      Object.assign(SCANDAL.rare, rates);
    }
  });
});

describe('rivalries between players (2.0.36)', () => {
  it('are drawn up each season, ours first, and last while both play', () => {
    const s = save();
    drawRivals(s, s.year);
    const list = rivalriesOf(s);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(RIVALS.max);
    const ids = list.flatMap((x) => [x.a, x.b]);
    expect(new Set(ids).size).toBe(ids.length);
    const me = s.user!.teamId;
    expect(list.filter((x) => s.players[x.a]!.teamId === me || s.players[x.b]!.teamId === me).length).toBeLessThanOrEqual(RIVALS.mine);
    const r = list[0]!;
    expect(rivalsOf(s, r.a)[0]!.id).toBe(r.b);
    expect(rivalsOf(s, r.b)[0]!.id).toBe(r.a);
    expect(rivalsMeet(s, s.players[r.a]!.teamId!, s.players[r.b]!.teamId!)).toBe(r.why === 'draft' && s.players[r.a]!.teamId === s.players[r.b]!.teamId ? false : true);
    drawRivals(s, s.year + 1);
    expect(rivalriesOf(s)).toEqual(expect.arrayContaining(list));
  });

  it('the season keeps going with all of it switched on', () => {
    const s = save();
    const next = s.next;
    playDays(s, 20);
    expect(s.next).toBeGreaterThan(next);
    expect(s.playerRivals?.year).toBe(s.year);
  });
});
