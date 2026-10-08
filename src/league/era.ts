/* The game's calendar (1.6.0). A game normally starts in 2026; the scenario 「백 투 더 패스트」 starts it ten years
   earlier. Everything the rules, the money and the attendance know by year (the salary cap, the minimum salary,
   ticket prices, broadcast money, the attendance boom, the roster rules that came in 2026) is read as of the usual
   calendar, so a game from 2016 is the 2026 game played ten years earlier: same rules, same economy, other years
   on the page. The history before the start stays fictional either way.

   One league at a time: the shift is set whenever a league is made or acted on (createLeague, apply) and when
   the page shows one. */
export const USUAL_START = 2026;

let shift = 0;

/** Sets the calendar from a league (its `era`, 0 when missing) or a shift in years. */
export function setEra(from: { era?: number } | number | null | undefined) {
  shift = typeof from === 'number' ? from : (from?.era ?? 0);
}

/** Years before the usual calendar (−10 for a game from 2016). */
export const era = () => shift;
/** The year the game starts: the founding summer. */
export const startYear = () => USUAL_START + shift;
/** A year as the rules and tables know it. */
export const ruleYear = (year: number) => year - shift;

/** Texts written for the usual calendar ("2027년 퓨처스리그"), with their years moved to this game's. */
export const shiftYears = (text: string) => (shift ? text.replace(/\b(20[2-4]\d)(년|~|\)| 시즌)/g, (m, y: string, tail: string) => (Number(y) >= USUAL_START ? `${Number(y) + shift}${tail}` : m)) : text);
