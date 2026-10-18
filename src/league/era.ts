/* The game's calendar (1.6.0). A game normally starts in 2026; the scenario 「백 투 더 패스트」 starts it ten years
   earlier. Everything the rules, the money and the attendance know by year (the salary cap, the minimum salary,
   ticket prices, broadcast money, the attendance boom, the roster rules that came in 2026) is read as of the usual
   calendar, so a game from 2016 is the 2026 game played ten years earlier: same rules, same economy, other years
   on the page. The history before the start stays fictional either way.

   One league at a time: the shift is set whenever a league is made or acted on (createLeague, apply) and when
   the page shows one. */
export const USUAL_START = 2026;
/** 1.9.5, scenario 레거시: the KBO's first season, and the era shift that makes 1982 the usual 2026 for the money. */
export const LEGACY_START = 1982;
export const LEGACY_ERA = LEGACY_START - USUAL_START;

let shift = 0;
/** 1.9.4: a league that plays the KBO's own history (the 1982 legacy start, 1.9.5) reads the year-by-year rules
    before 2015 (rules/history.ts); every other game plays today's rules in every year, as before. */
let historical = false;

/** 1.9.9 (board.ts): the rules the board has changed, each from a season on. */
let board: readonly { from: number; item: string; value: number }[] = [];

/** Sets the calendar from a league (its `era`, 0 when missing, and whether it plays history) or a shift in years. */
export function setEra(from: { era?: number; historical?: boolean; board?: { changes: { from: number; item: string; value: number }[] } } | number | null | undefined) {
  shift = typeof from === 'number' ? from : (from?.era ?? 0);
  historical = typeof from === 'object' && !!from?.historical;
  board = (typeof from === 'object' && from?.board?.changes) || [];
}

/** 2.0.13 (board.ts setRule): the board's changes alone, for a moment, keeping the calendar. */
export function setEraBoard(changes: readonly { from: number; item: string; value: number }[]) {
  board = changes;
}

/** 1.9.9: the value the board set for `item` in force in `season` (the latest voted when omitted: a winter's signings
    are for the season the change starts), or undefined when it never changed it. */
export function boardValue(item: string, season = Infinity): number | undefined {
  let out: number | undefined;
  for (const c of board) if (c.item === item && c.from <= season) out = c.value;
  return out;
}

/** The league plays the KBO's own history (1.9.4). */
export const playsHistory = () => historical;

/** Years before the usual calendar (−10 for a game from 2016). */
export const era = () => shift;
/** The year the game starts: the founding summer. */
export const startYear = () => USUAL_START + shift;
/** A year as the rules and tables know it. */
export const ruleYear = (year: number) => year - shift;

/** Texts written for the usual calendar ("2027년 퓨처스리그"), with their years moved to this game's. */
export const shiftYears = (text: string) => (shift ? text.replace(/\b(20[2-4]\d)(년|~|\)| 시즌)/g, (m, y: string, tail: string) => (Number(y) >= USUAL_START ? `${Number(y) + shift}${tail}` : m)) : text);
