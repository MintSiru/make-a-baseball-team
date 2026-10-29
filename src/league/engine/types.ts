/* Game engine inputs and outputs. The engine knows nothing about contracts or rosters: the AI manager
   hands it a lineup, a starter and a bullpen, and it returns a box score. Abilities are hidden
   (continuous 20–80) values; the engine may read them, the UI may not. */
import type { BattedBall, BattedTotals } from '../battedball';
import type { FieldTotals } from '../fielding';

export type FieldPos = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';
export type Hand = 'L' | 'R' | 'S';

export interface BatterIn {
  id: string;
  bats: Hand;
  contact: number;
  power: number;
  eye: number;
  speed: number;
  /** Fielding at the position played, after any out-of-position penalty. */
  defense: number;
  pos: FieldPos;
  /** 2.0.1 (battedball.ts): where he hits the ball (−2 extreme pull … 2 extreme opposite field) and how high (−2
      extreme ground ball … 2 extreme fly ball). Absent: in the middle. */
  pull?: number;
  lift?: number;
  /** His lift beyond what his bat makes of it (battedball.ts BattingProfile.edge): what moves the plays. */
  edge?: number;
  /** 2.0.3 (fielding.ts): his fielding in parts at the position played (after any out-of-position penalty), and a
      catcher's game-calling. Absent: his `defense` for each. */
  range?: number;
  hands?: number;
  arm?: number;
  lead?: number;
  /** 2.0.17: a catcher's framing (counts only as far as the umpires call the pitches: GameIn `framing`). */
  frame?: number;
  /** 2.0.28 (traits.ts clutchEdge): grade points on his contact, power and eye with a runner on second or third. */
  clutch?: number;
}

/** 마무리 · 셋업맨 · 필승조 · 추격조 · 롱릴리프 · 원 포인트 (left-handed specialist). */
export type BullpenRole = 'CL' | 'SU' | 'HL' | 'MU' | 'LR' | 'LO';

export interface PitcherIn {
  id: string;
  throws: 'L' | 'R';
  stuff: number;
  command: number;
  /** 2.0.28 (traits.ts clutchEdge): grade points on his stuff and command with a runner on second or third. */
  clutch?: number;
  breaking: number;
  stamina: number;
  /** Pitch count at which the manager starts looking to pull him today (fatigue already applied). */
  pitchLimit: number;
  /** Size of his same-side advantage (1 = league norm; his repertoire decides it). */
  platoon?: number;
  /** 2.0.3: −2 extreme ground-ball pitcher … 2 extreme fly-ball pitcher (battedball.ts pitcherLift). */
  lift?: number;
}

export interface RelieverIn extends PitcherIn {
  role: BullpenRole;
}

/** 1.7.0: a player on the bench, with what he would field at each position (after any out-of-position penalty). */
export interface BenchIn extends BatterIn {
  defenseAt: Partial<Record<FieldPos, number>>;
}

export interface TeamIn {
  teamId: string;
  lineup: BatterIn[]; // nine batters in batting order
  /** 1.7.0: hitters on the bench for pinch hitting, pinch running and late defence. */
  bench?: BenchIn[];
  starter: PitcherIn;
  bullpen: RelieverIn[]; // available arms, best first within each role
  /** Analytics: positioning adds to team fielding (z units). */
  fieldBonus?: number;
  /** The manager bunts and steals more. */
  smallBall?: boolean;
  /** 1.9.8: how the manager of the era uses his pitchers (a league that plays history); absent: today's way. */
  usage?: PitchingUsage;
}

/** 1.9.8: the era's pitching usage (rules/history.ts eraUsage). */
export interface PitchingUsage {
  /** Chance a starter still dominant after eight innings is left in for the ninth. */
  completeGame: number;
  /** Runs a starter may give up before the hook. */
  runsBeforeHook: number;
  /** The closer comes in from this inning with a lead of one to three (9: today's one-inning closer). */
  closerFrom: number;
  /** A closer's outs and pitches at most. */
  closerOuts: number;
  closerPitches: number;
}

export interface GameIn {
  gameId: string;
  home: TeamIn;
  away: TeamIn;
  /** Last inning before a tie is declared (KBO regular season: 11). Null for postseason (play on). */
  maxInnings: number | null;
  /** Park run factor, 1 = neutral. */
  park: number;
  /** 1.9.9 (board.ts): extra innings from this one start with a runner on second (승부치기). */
  ghostFrom?: number;
  /** 1.9.9: a reliever faces three batters or ends the inning before he may be taken out. */
  threeBatter?: boolean;
  /** 2.0.1: the batted-ball stream (battedball.ts); given, every ball in play gets its flight, kept on the lines. */
  balls?: () => number;
  /** 2.0.2: the home park's fences (layout.ts): its home-run and gap effects in place of `park`'s, and a home run
      clears the fence where it goes. */
  layout?: import('../layout').ParkLayout;
  /** 2.0.17 (board.ts ABS): how much a catcher's framing counts — 1 with the umpires calling, 0.5 with challenges,
      absent or 0 with the full ABS. */
  framing?: number;
  /** 2.0.59 (weather.ts): the game is called after this half-inning (its top, or the whole inning) — rain. */
  stopAfter?: { inning: number; top: boolean };
}

/** One side of a platoon split: plate appearances against left- or right-handers. */
export interface Split {
  pa: number;
  ab: number;
  h: number;
  /** Total bases. */
  tb: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  sf: number;
}

/** Batters: by the pitcher's hand. Pitchers: by the hand the batter hit from. */
export interface Splits {
  L: Split;
  R: Split;
  /** 2.0.28: with a runner on second or third (득점권), from 2.0.28's games on. */
  S?: Split;
  /** 2.0.30: by situation (situation.ts: leverage, margin, runners), the counts in SPLIT_KEYS order. */
  X?: Record<string, number[]>;
}

export const emptySplit = (): Split => ({ pa: 0, ab: 0, h: 0, tb: 0, hr: 0, bb: 0, hbp: 0, k: 0, sf: 0 });

export interface BattingLine {
  id: string;
  pos: FieldPos;
  /** 1.7.0: how he came into the game (pinch hitter, pinch runner, defensive replacement); absent for a starter. */
  sub?: 'PH' | 'PR' | 'DEF';
  split?: Splits;
  pa: number;
  ab: number;
  h: number;
  d: number; // doubles
  t: number; // triples
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  r: number;
  rbi: number;
  sb: number;
  cs: number;
  sf: number;
  sh: number;
  gdp: number;
  /** 2.0.1: his balls in play (with a batted-ball stream). */
  bip?: BattedTotals;
  /** 2.0.3: his fielding in the game (with a batted-ball stream). */
  fld?: FieldTotals;
  /** 2.0.4: where his hits came down, three numbers each: direction (°, left field negative), distance (m) and the
      hit (0 single … 3 home run). */
  spray?: number[];
  /** 2.0.7: his at-bats in order, 1 for a home run (with a batted-ball stream). */
  hrSeq?: number[];
}

export interface PitchingLine {
  id: string;
  split?: Splits;
  gs: 0 | 1;
  outs: number;
  bf: number;
  h: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  r: number;
  er: number;
  pitches: number;
  w: 0 | 1;
  l: 0 | 1;
  sv: 0 | 1;
  hld: 0 | 1;
  qs: 0 | 1;
  /** 1.9.8: a complete game (the starter was his side's only pitcher). */
  cg?: 0 | 1;
  /** 2.0.1: the balls put in play against him. */
  bip?: BattedTotals;
}

export interface TeamBox {
  teamId: string;
  runs: number;
  hits: number;
  errors: number;
  lineScore: number[];
  batting: BattingLine[];
  pitching: PitchingLine[];
  /** 1.9.8: immaculate innings (three strikeouts on nine pitches) by this side's pitchers. */
  immaculate?: { pitcher: string; inning: number }[];
  /** 2.0.4: this side's batters against each pitcher ("batter|pitcher"): PA, AB, H, total bases, HR, BB+HBP, K
      (with a batted-ball stream). */
  vs?: Record<string, number[]>;
}

export interface GameOut {
  gameId: string;
  innings: number;
  home: TeamBox;
  away: TeamBox;
  /** 'home' | 'away' | 'tie' */
  result: 'home' | 'away' | 'tie';
  /** 2.0.59 (weather.ts): rain stopped it after this half-inning — a final score (강우 콜드), no game yet (노게임, played
      again), or to be finished another day (서스펜디드). Set by the season, not the engine. */
  called?: { inning: number; top: boolean; kind: 'final' | 'noGame' | 'suspended' };
}

/** Play-by-play (V0.7): one event per plate appearance or pitching change, recorded only on request. */
export type PlayResult = 'HR' | '3B' | '2B' | '1B' | 'BB' | 'HBP' | 'K' | 'DP' | 'SF' | 'SH' | 'E' | 'OUT';
export type PlayEvent =
  | {
      k: 'pa';
      i: number;
      top: boolean;
      b: string;
      p: string;
      res: PlayResult;
      /** Runs that scored during the plate appearance (steals and wild pitches before it included). */
      runs: number;
      rbi: number;
      outs: number;
      bases: [boolean, boolean, boolean];
      score: [number, number];
      /** 2.0.1: the ball in play's flight. */
      ball?: BattedBall;
    }
  | { k: 'pitch'; i: number; top: boolean; p: string; out: string }
  /** 1.7.0: a pinch hitter, pinch runner or defensive replacement (in for out, at his position). */
  | { k: 'sub'; i: number; top: boolean; sub: 'PH' | 'PR' | 'DEF'; in: string; out: string; pos: FieldPos | 'DH' };
