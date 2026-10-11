import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Player search (0.10.1): every player in the league in one list, filtered by position (main or one he can
   handle), club, age and grades, with this season's (or last season's) numbers. A player of another club goes
   straight into a trade proposal; an unattached one can be signed. */
import { useMemo, useState } from 'preact/hooks';
import type { Action } from '../league/actions';
import { salaryIn } from '../league/contracts';
import { ageIn, isForeign, isPitcher } from '../league/players';
import { POSITION_SHORT, secondaryPositions } from '../league/positions';
import { orgIds, type LeagueState } from '../league/state';
import { canSignFromPool, poolAsk, tradeValue } from '../league/trade';
import { positionLabel, shortName, statLine } from '../league/views';
import type { Player, PlayerId, TeamId } from '../model/types';
import { moneyShort } from './format';
import { gradeClass } from './grades';
import { positionKey, useSort } from './sort';

export type PosFilter = 'all' | 'SP' | 'RP' | 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'IF' | 'OF';
const POS_FILTERS: [PosFilter, string][] = [
  ['all', __i18n_k("ui.playerSearch.pOS_FILTERS.934dd25e")],
  ['P', __i18n_k("ui.playerSearch.pOS_FILTERS.6491cbc9")],
  ['SP', __i18n_k("ui.playerSearch.pOS_FILTERS.cd036b1a")],
  ['RP', __i18n_k("ui.playerSearch.pOS_FILTERS.ac3cc00a")],
  ['C', __i18n_k("ui.playerSearch.pOS_FILTERS.5f31470d")],
  ['1B', '1루수'],
  ['2B', '2루수'],
  ['3B', '3루수'],
  ['SS', __i18n_k("ui.playerSearch.pOS_FILTERS.3e24c7f1")],
  ['LF', __i18n_k("ui.playerSearch.pOS_FILTERS.73836db2")],
  ['CF', __i18n_k("ui.playerSearch.pOS_FILTERS.56780b2a")],
  ['RF', __i18n_k("ui.playerSearch.pOS_FILTERS.a28a0ef8")],
  ['IF', __i18n_k("ui.playerSearch.pOS_FILTERS.d7fc242c")],
  ['OF', __i18n_k("ui.playerSearch.pOS_FILTERS.7435120b")],
];
const INFIELD = ['1B', '2B', '3B', 'SS'];
const OUTFIELD = ['LF', 'CF', 'RF'];
const LIMIT = 150;

/** Which club a search covers: every other club, one club, ours, or the unattached players. */
type ClubFilter = 'others' | 'pool' | TeamId;

export function PlayerSearch({
  league,
  initialPos,
  onPlayer,
  onAct,
  onTrade,
}: {
  league: LeagueState;
  /** 1.5.0: opened from the briefing for one position. */
  initialPos?: PosFilter;
  onPlayer: (id: string) => void;
  onAct: (a: Action) => void;
  onTrade: (teamId: TeamId, id: PlayerId) => void;
}) {
  const u = league.user!;
  const [pos, setPos] = useState<PosFilter>(initialPos ?? 'all');
  const [also, setAlso] = useState(true);
  const [club, setClub] = useState<ClubFilter>('others');
  const [maxAge, setMaxAge] = useState(99);
  const [minNow, setMinNow] = useState(0);
  const [minFuture, setMinFuture] = useState(0);
  const [name, setName] = useState('');
  const [tradable, setTradable] = useState(false);
  const season = league.phase === 'offseason' ? (league.offseason?.year ?? league.year) + 1 : league.year;
  const clubs = league.teams.filter((t) => league.rosters[t.id]);

  const matchesPos = (p: Player) => {
    if (pos === 'all') return true;
    if (pos === 'P') return isPitcher(p);
    if (pos === 'SP' || pos === 'RP') return isPitcher(p) && p.role === pos;
    if (isPitcher(p) || !p.position) return false;
    const can = [p.position, ...(also ? secondaryPositions(league, p) : [])];
    if (pos === 'IF') return can.some((x) => INFIELD.includes(x));
    if (pos === 'OF') return can.some((x) => OUTFIELD.includes(x));
    return can.includes(pos);
  };

  // Trade rules (trade.ts): registered domestic players, not this year's draftees or development players.
  const canTrade = (p: Player) => !isForeign(p) && p.contract?.kind !== 'development' && p.proSince <= league.year && !(p.origin.pickVia && p.proSince >= league.year);

  const rows = useMemo(() => {
    const ids =
      club === 'pool'
        ? (league.pool ?? [])
        : club === 'others'
          ? clubs.filter((t) => t.id !== u.teamId).flatMap((t) => orgIds(league, t.id))
          : orgIds(league, club);
    const q = name.trim();
    return ids
      .map((id) => league.players[id])
      .filter((p): p is Player => !!p && p.status === 'active')
      .filter((p) => (!q || p.name.includes(q)) && ageIn(p, season) <= maxAge && p.scouting.current >= minNow && p.scouting.futureValue >= minFuture && matchesPos(p))
      .filter((p) => !tradable || canTrade(p));
  }, [league, pos, also, club, maxAge, minNow, minFuture, name, tradable]);

  const lastWar = (p: Player) => p.career.filter((c) => !c.level).at(-1)?.war ?? null;
  const pay = (p: Player) => salaryIn(p, season) || salaryIn(p, season - 1);
  const yearsLeft = (p: Player) => {
    const last = Math.max(0, ...(p.contract?.salaries ?? []).map((x) => x.season));
    return last >= season ? last - season + 1 : 0;
  };
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (p) => p.name },
      club: { value: (p) => shortName(league, p.teamId ?? '') },
      pos: { value: (p) => positionKey(positionLabel(p)), first: 1 },
      age: { value: (p) => ageIn(p, season), first: 1 },
      current: { value: (p) => p.scouting.current },
      future: { value: (p) => p.scouting.futureValue },
      war: { value: (p) => lastWar(p) ?? -99 },
      pay: { value: (p) => pay(p) },
      value: { value: (p) => tradeValue(league, p) },
    },
    { key: 'current', dir: -1 },
  );
  const shown = sorted.slice(0, LIMIT);
  const number = (value: number, set: (n: number) => void, options: number[], label: string, none: string) => (
    <label>
      {__i18n_display(label)}
      <select value={value} aria-label={__i18n_displayText(label)} onChange={(e) => set(Number((e.currentTarget as HTMLSelectElement).value))}>
        {__i18n_display(options.map((n) => (
          <option key={n} value={n}>
            {__i18n_display(n === 0 || n === 99 ? none : n)}
          </option>
        )))}
      </select>
    </label>
  );

  return (
    <div class="player-search">
      <div class="search-filters">
        <label>
          이름
          <input value={name} aria-label={__i18n_t("ui.playerSearch.playerSearch.9aa18e50")} placeholder={__i18n_t("ui.playerSearch.playerSearch.5ef18109")} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label>
          포지션
          <select value={pos} aria-label={__i18n_t("ui.playerSearch.playerSearch.81922a91")} onChange={(e) => setPos((e.currentTarget as HTMLSelectElement).value as PosFilter)}>
            {__i18n_display(POS_FILTERS.map(([k, label]) => (
              <option key={k} value={k}>
                {__i18n_display(label)}
              </option>
            )))}
          </select>
        </label>
        <label>
          구단
          <select value={club} aria-label={__i18n_t("ui.playerSearch.playerSearch.58756112")} onChange={(e) => setClub((e.currentTarget as HTMLSelectElement).value)}>
            <option value="others">{__i18n_t("ui.playerSearch.playerSearch.7d90768e")}</option>
            {__i18n_display(clubs.map((t) => (
              <option key={t.id} value={t.id}>
                {__i18n_display(t.id === u.teamId ? __i18n_k("ui.playerSearch.playerSearch.24b5856a", { short: t.short }) : t.short)}
              </option>
            )))}
            <option value="pool">{__i18n_t("ui.playerSearch.playerSearch.450c3bcf")}</option>
          </select>
        </label>
        {__i18n_display(number(maxAge, setMaxAge, [99, 23, 25, 27, 30, 33, 35], __i18n_k("ui.playerSearch.playerSearch.f1bdb117"), __i18n_k("ui.playerSearch.playerSearch.4efeea41")))}
        {__i18n_display(number(minNow, setMinNow, [0, 40, 45, 50, 55, 60, 65], __i18n_k("ui.playerSearch.playerSearch.bf60247a"), __i18n_k("ui.playerSearch.playerSearch.4efeea41")))}
        {__i18n_display(number(minFuture, setMinFuture, [0, 45, 50, 55, 60, 65, 70], __i18n_k("ui.playerSearch.playerSearch.2cd3d327"), __i18n_k("ui.playerSearch.playerSearch.4efeea41")))}
        <label class="check">
          <input type="checkbox" checked={also} onChange={(e) => setAlso((e.currentTarget as HTMLInputElement).checked)} /> 그 포지션도 볼 수 있는 선수 포함
        </label>
        <label class="check">
          <input type="checkbox" checked={tradable} onChange={(e) => setTradable((e.currentTarget as HTMLInputElement).checked)} /> 트레이드할 수 있는 선수만
        </label>
      </div>
      <p class="muted small">{__i18n_t("ui.playerSearch.playerSearch.ea96807c", { length: rows.length, value: rows.length > LIMIT ? __i18n_k("ui.playerSearch.playerSearch.d2f41e03", { lIMIT: LIMIT }) : '' })}</p>
      {__i18n_display(shown.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table search-table">
            <thead>
              <tr>
                <th aria-label={__i18n_t("ui.playerSearch.playerSearch.c29fba5a")} />
                {__i18n_display(th('name', __i18n_k("ui.playerSearch.playerSearch.9aa18e50")))}
                {__i18n_display(th('club', __i18n_k("ui.playerSearch.playerSearch.58756112")))}
                {__i18n_display(th('pos', __i18n_k("ui.playerSearch.playerSearch.81922a91")))}
                {__i18n_display(th('age', __i18n_k("ui.playerSearch.playerSearch.6c620e5c"), true))}
                {__i18n_display(th('current', __i18n_k("ui.playerSearch.playerSearch.001e4be2"), true))}
                {__i18n_display(th('future', __i18n_k("ui.playerSearch.playerSearch.6e0caec5"), true))}
                <th>{__i18n_t("ui.playerSearch.playerSearch.d3bb3576")}</th>
                {__i18n_display(th('war', 'WAR', true))}
                {__i18n_display(th('pay', __i18n_k("ui.playerSearch.playerSearch.cbf383ec"), true))}
                <th class="num">{__i18n_t("ui.playerSearch.playerSearch.b4116369")}</th>
                {__i18n_display(th('value', __i18n_k("ui.playerSearch.playerSearch.1970ef0e"), true))}
              </tr>
            </thead>
            <tbody>
              {__i18n_display(shown.map((p) => {
                const line = statLine(league, p);
                const extra = !isPitcher(p) ? secondaryPositions(league, p) : [];
                const pool = !p.teamId;
                const mine = p.teamId === u.teamId;
                const signProblem = pool ? canSignFromPool(league, p.id) : null;
                return (
                  <tr key={p.id} class="player-row">
                    <td>
                      {__i18n_display(pool ? (
                        <button type="button" disabled={!!signProblem} title={__i18n_displayText(signProblem ?? '')} onClick={() => onAct({ kind: 'signPool', id: p.id })}>{__i18n_t("ui.playerSearch.playerSearch.b4116369")}</button>
                      ) : mine ? null : (
                        <button type="button" disabled={!canTrade(p)} title={__i18n_displayText(canTrade(p) ? '' : __i18n_k("ui.playerSearch.playerSearch.629e3590"))} onClick={() => onTrade(p.teamId!, p.id)}>{__i18n_t("ui.playerSearch.playerSearch.428749ee")}</button>
                      ))}
                    </td>
                    <td>
                      <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                        {__i18n_display(p.name)}
                      </button>
                      {__i18n_display(p.contract?.kind === 'development' && <span class="tag">{__i18n_t("ui.playerSearch.playerSearch.818f3b79")}</span>)}
                      {__i18n_display(isForeign(p) && <span class="tag">{__i18n_t("ui.playerSearch.playerSearch.5bd804b7")}</span>)}
                    </td>
                    <td>{__i18n_display(pool ? __i18n_k("ui.playerSearch.playerSearch.50b7405a") : shortName(league, p.teamId!))}</td>
                    <td>
                      {__i18n_display(positionLabel(p))}
                      {__i18n_display(extra.length > 0 && (
                        <span class="muted small">
                          {__i18n_display(' ')}
                          +{__i18n_display(extra.slice(0, 3).map((x) => POSITION_SHORT[x]).join('·'))}
                          {__i18n_display(extra.length > 3 ? __i18n_k("ui.playerSearch.playerSearch.e69b7fff") : '')}
                        </span>
                      ))}
                    </td>
                    <td class="num">{__i18n_display(ageIn(p, season))}</td>
                    <td class={`num ${gradeClass(p.scouting.current)}`}>{__i18n_display(p.scouting.current)}</td>
                    <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{__i18n_display(p.scouting.futureValue)}</td>
                    <td class="small nowrap">{__i18n_display(line ? `${line.year === league.year && league.phase === 'regular' ? '' : `${line.year} `}${line.text}` : '-')}</td>
                    <td class="num">{__i18n_display(lastWar(p)?.toFixed(1) ?? '-')}</td>
                    <td class="num">{__i18n_display(pool ? `${moneyShort(poolAsk(league, p))}*` : moneyShort(pay(p)))}</td>
                    <td class="num">{__i18n_display(pool ? '-' : yearsLeft(p) > 1 ? __i18n_k("ui.playerSearch.playerSearch.67e19f21", { yearsLeft: yearsLeft(p) }) : p.contract?.kind === 'development' ? __i18n_k("ui.playerSearch.playerSearch.818f3b79") : __i18n_k("ui.playerSearch.playerSearch.495b63c7"))}</td>
                    <td class="num">{__i18n_display(tradeValue(league, p).toFixed(1))}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="empty">{__i18n_t("ui.playerSearch.playerSearch.5ffbf057")}</p>
      ))}
      {__i18n_display(club === 'pool' && <p class="muted small">{__i18n_t("ui.playerSearch.playerSearch.8ba0d9f5")}</p>)}
    </div>
  );
}
