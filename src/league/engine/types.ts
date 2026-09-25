/* Game engine inputs and outputs. The engine knows nothing about contracts or rosters: the AI manager
   hands it a lineup, a starter and a bullpen, and it returns a box score. Abilities are hidden
   (continuous 20–80) values; the engine may read them, the UI may not. */

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
}

/** 마무리 · 셋업맨 · 필승조 · 추격조 · 롱릴리프 · 원 포인트 (left-handed specialist). */
export type BullpenRole = 'CL' | 'SU' | 'HL' | 'MU' | 'LR' | 'LO';

export interface PitcherIn {
  id: string;
  throws: 'L' | 'R';
  stuff: number;
  command: number;
  breaking: number;
  stamina: number;
  /** Pitch count at which the manager starts looking to pull him today (fatigue already applied). */
  pitchLimit: number;
  /** Size of his same-side advantage (1 = league norm; his repertoire decides it). */
  platoon?: number;
}

export interface RelieverIn extends PitcherIn {
  role: BullpenRole;
}

export interface TeamIn {
  teamId: string;
  lineup: BatterIn[]; // nine batters in batting order
  starter: PitcherIn;
  bullpen: RelieverIn[]; // available arms, best first within each role
  /** Analytics: positioning adds to team fielding (z units). */
  fieldBonus?: number;
  /** The manager bunts and steals more. */
  smallBall?: boolean;
}

export interface GameIn {
  gameId: string;
  home: TeamIn;
  away: TeamIn;
  /** Last inning before a tie is declared (KBO regular season: 11). Null for postseason (play on). */
  maxInnings: number | null;
  /** Park run factor, 1 = neutral. */
  park: number;
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
}

export const emptySplit = (): Split => ({ pa: 0, ab: 0, h: 0, tb: 0, hr: 0, bb: 0, hbp: 0, k: 0, sf: 0 });

export interface BattingLine {
  id: string;
  pos: FieldPos;
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
}

export interface TeamBox {
  teamId: string;
  runs: number;
  hits: number;
  errors: number;
  lineScore: number[];
  batting: BattingLine[];
  pitching: PitchingLine[];
}

export interface GameOut {
  gameId: string;
  innings: number;
  home: TeamBox;
  away: TeamBox;
  /** 'home' | 'away' | 'tie' */
  result: 'home' | 'away' | 'tie';
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
    }
  | { k: 'pitch'; i: number; top: boolean; p: string; out: string };
