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

export type BullpenRole = 'CL' | 'SU' | 'MR' | 'LR';

export interface PitcherIn {
  id: string;
  throws: 'L' | 'R';
  stuff: number;
  command: number;
  breaking: number;
  stamina: number;
  /** Pitch count at which the manager starts looking to pull him today (fatigue already applied). */
  pitchLimit: number;
}

export interface RelieverIn extends PitcherIn {
  role: BullpenRole;
}

export interface TeamIn {
  teamId: string;
  lineup: BatterIn[]; // nine batters in batting order
  starter: PitcherIn;
  bullpen: RelieverIn[]; // available arms, best first within each role
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

export interface BattingLine {
  id: string;
  pos: FieldPos;
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
