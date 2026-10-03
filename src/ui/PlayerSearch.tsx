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

type PosFilter = 'all' | 'SP' | 'RP' | 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'IF' | 'OF';
const POS_FILTERS: [PosFilter, string][] = [
  ['all', '전체'],
  ['P', '투수 전체'],
  ['SP', '선발투수'],
  ['RP', '불펜투수'],
  ['C', '포수'],
  ['1B', '1루수'],
  ['2B', '2루수'],
  ['3B', '3루수'],
  ['SS', '유격수'],
  ['LF', '좌익수'],
  ['CF', '중견수'],
  ['RF', '우익수'],
  ['IF', '내야수'],
  ['OF', '외야수'],
];
const INFIELD = ['1B', '2B', '3B', 'SS'];
const OUTFIELD = ['LF', 'CF', 'RF'];
const LIMIT = 150;

/** Which club a search covers: every other club, one club, ours, or the unattached players. */
type ClubFilter = 'others' | 'pool' | TeamId;

export function PlayerSearch({
  league,
  onPlayer,
  onAct,
  onTrade,
}: {
  league: LeagueState;
  onPlayer: (id: string) => void;
  onAct: (a: Action) => void;
  onTrade: (teamId: TeamId, id: PlayerId) => void;
}) {
  const u = league.user!;
  const [pos, setPos] = useState<PosFilter>('all');
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
      {label}
      <select value={value} aria-label={label} onChange={(e) => set(Number((e.currentTarget as HTMLSelectElement).value))}>
        {options.map((n) => (
          <option key={n} value={n}>
            {n === 0 || n === 99 ? none : n}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div class="player-search">
      <div class="search-filters">
        <label>
          이름
          <input value={name} aria-label="이름" placeholder="이름 일부" onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label>
          포지션
          <select value={pos} aria-label="포지션" onChange={(e) => setPos((e.currentTarget as HTMLSelectElement).value as PosFilter)}>
            {POS_FILTERS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          구단
          <select value={club} aria-label="구단" onChange={(e) => setClub((e.currentTarget as HTMLSelectElement).value)}>
            <option value="others">다른 구단 전체</option>
            {clubs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === u.teamId ? `${t.short} (우리)` : t.short}
              </option>
            ))}
            <option value="pool">자유계약 선수</option>
          </select>
        </label>
        {number(maxAge, setMaxAge, [99, 23, 25, 27, 30, 33, 35], '나이 (이하)', '제한 없음')}
        {number(minNow, setMinNow, [0, 40, 45, 50, 55, 60, 65], '현재 (이상)', '제한 없음')}
        {number(minFuture, setMinFuture, [0, 45, 50, 55, 60, 65, 70], '미래 (이상)', '제한 없음')}
        <label class="check">
          <input type="checkbox" checked={also} onChange={(e) => setAlso((e.currentTarget as HTMLInputElement).checked)} /> 그 포지션도 볼 수 있는 선수 포함
        </label>
        <label class="check">
          <input type="checkbox" checked={tradable} onChange={(e) => setTradable((e.currentTarget as HTMLInputElement).checked)} /> 트레이드할 수 있는 선수만
        </label>
      </div>
      <p class="muted small">
        {rows.length}명{rows.length > LIMIT ? ` (위에서 ${LIMIT}명만 표시 — 조건을 좁혀 보세요)` : ''}. 이름을 누르면 선수 정보, 오른쪽 버튼으로 바로 트레이드 제안이나 계약을 합니다. 성적은 올 시즌(뛰었다면) 또는 지난
        1군 시즌, WAR는 지난 시즌입니다.
      </p>
      {shown.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table search-table">
            <thead>
              <tr>
                <th aria-label="관리" />
                {th('name', '이름')}
                {th('club', '구단')}
                {th('pos', '포지션')}
                {th('age', '나이', true)}
                {th('current', '현재', true)}
                {th('future', '미래', true)}
                <th>성적</th>
                {th('war', 'WAR', true)}
                {th('pay', '연봉', true)}
                <th class="num">계약</th>
                {th('value', '가치', true)}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const line = statLine(league, p);
                const extra = !isPitcher(p) ? secondaryPositions(league, p) : [];
                const pool = !p.teamId;
                const mine = p.teamId === u.teamId;
                const signProblem = pool ? canSignFromPool(league, p.id) : null;
                return (
                  <tr key={p.id} class="player-row">
                    <td>
                      {pool ? (
                        <button type="button" disabled={!!signProblem} title={signProblem ?? ''} onClick={() => onAct({ kind: 'signPool', id: p.id })}>
                          계약
                        </button>
                      ) : mine ? null : (
                        <button type="button" disabled={!canTrade(p)} title={canTrade(p) ? '' : '외국인·육성선수·올해 신인은 트레이드할 수 없습니다.'} onClick={() => onTrade(p.teamId!, p.id)}>
                          트레이드
                        </button>
                      )}
                    </td>
                    <td>
                      <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                        {p.name}
                      </button>
                      {p.contract?.kind === 'development' && <span class="tag">육성</span>}
                      {isForeign(p) && <span class="tag">외국인</span>}
                    </td>
                    <td>{pool ? '자유계약' : shortName(league, p.teamId!)}</td>
                    <td>
                      {positionLabel(p)}
                      {extra.length > 0 && (
                        <span class="muted small">
                          {' '}
                          +{extra.slice(0, 3).map((x) => POSITION_SHORT[x]).join('·')}
                          {extra.length > 3 ? ' 등' : ''}
                        </span>
                      )}
                    </td>
                    <td class="num">{ageIn(p, season)}</td>
                    <td class={`num ${gradeClass(p.scouting.current)}`}>{p.scouting.current}</td>
                    <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{p.scouting.futureValue}</td>
                    <td class="small nowrap">{line ? `${line.year === league.year && league.phase === 'regular' ? '' : `${line.year} `}${line.text}` : '-'}</td>
                    <td class="num">{lastWar(p)?.toFixed(1) ?? '-'}</td>
                    <td class="num">{pool ? `${moneyShort(poolAsk(league, p))}*` : moneyShort(pay(p))}</td>
                    <td class="num">{pool ? '-' : yearsLeft(p) > 1 ? `${yearsLeft(p)}년` : p.contract?.kind === 'development' ? '육성' : '1년'}</td>
                    <td class="num">{tradeValue(league, p).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="empty">조건에 맞는 선수가 없습니다.</p>
      )}
      {club === 'pool' && <p class="muted small">* 자유계약 선수는 요구 연봉</p>}
    </div>
  );
}
