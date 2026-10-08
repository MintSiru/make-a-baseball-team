/* The market screen: trades, releases and unattached players, foreign replacements, league moves. */
import { useMemo, useState } from 'preact/hooks';
import type { Action } from '../league/actions';
import { usdTotal } from '../league/contracts';
import { usd } from '../league/foreign';
import { kboLine, poolEntry } from '../league/foreignpool';
import { deadMoney, projectedPayroll } from '../league/market';
import { eulreul } from '../league/josa';
import { ageIn, isForeign } from '../league/players';
import { firstTeamIds, orgPlayers, registeredIds, type LeagueState } from '../league/state';
import { booksOf } from '../league/foreigncap';
import {
  canRelease,
  canReplaceForeign,
  canSignFromPool,
  cashValue,
  checkTrade,
  pickValue,
  tradablePicks,
  tradeDraftYear,
  foreignMarket,
  foreignPriceNow,
  foreignWindow,
  poolAsk,
  releaseCost,
  tradeValue,
  tradeWindow,
} from '../league/trade';
import { positionLabel, shortName } from '../league/views';
import type { Player, PlayerId, TeamId } from '../model/types';
import { money } from './format';
import { clubStrategy, MODE_LABEL, SPOT_LABEL } from '../league/strategy';
import { gradeClass } from './grades';
import { positionKey, useSort } from './sort';
import { Help } from './Help';
import { PlayerSearch, type PosFilter } from './PlayerSearch';
import { TRADES } from '../league/tuning';

type View = 'trade' | 'search' | 'release' | 'foreign' | 'news';

export function Market({
  league,
  onPlayer,
  onAct,
  intent,
}: {
  league: LeagueState;
  onPlayer: (id: string) => void;
  onAct: (a: Action) => void;
  /** 1.5.0: opened from the briefing at a view (and a position for the search). */
  intent?: { view: View; spot?: string };
}) {
  const [view, setView] = useState<View>(intent?.view ?? 'trade');
  // A player picked in the search goes straight into a trade proposal with his club (0.10.1).
  const [target, setTarget] = useState<{ teamId: TeamId; id: PlayerId } | null>(null);
  const u = league.user!;
  return (
    <section aria-labelledby="market-title">
      <div class="page-head">
        <div>
          <h2 id="market-title">이적시장</h2>
          <p class="muted">
            {league.year}년 연봉 {money(projectedPayroll(league, u.teamId, league.year))} / 예산 {money(u.payrollBudget)} · 방출 선수 잔여 연봉 {money(deadMoney(league, league.year))} · 구단 자금{' '}
            {money(u.fund)}
          </p>
        </div>
        <div class="segmented" role="group" aria-label="이적시장 보기">
          {(
            [
              ['trade', '트레이드'],
              ['search', '선수 찾기'],
              ['release', '방출 · 자유계약'],
              ['foreign', '외국인 교체'],
              ['news', '이적 소식'],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'trade' && <Trade key={target ? `${target.teamId}-${target.id}` : 'trade'} league={league} onPlayer={onPlayer} onAct={onAct} initial={target} />}
      {view === 'search' && (
        <PlayerSearch
          league={league}
          initialPos={intent?.spot as PosFilter | undefined}
          onPlayer={onPlayer}
          onAct={onAct}
          onTrade={(teamId, id) => {
            setTarget({ teamId, id });
            setView('trade');
          }}
        />
      )}
      {view === 'release' && <Release league={league} onPlayer={onPlayer} onAct={onAct} />}
      {view === 'foreign' && <Foreign league={league} onPlayer={onPlayer} onAct={onAct} />}
      {view === 'news' && <News league={league} />}
    </section>
  );
}

/** A compact, sortable list of players with a checkbox (or a button) per row. */
function PickList({
  league,
  players,
  selected,
  toggle,
  onPlayer,
  extra,
  action,
}: {
  league: LeagueState;
  players: Player[];
  selected?: Set<PlayerId>;
  toggle?: (id: PlayerId) => void;
  onPlayer: (id: string) => void;
  extra?: { title: string; value: (p: Player) => string; sort: (p: Player) => number };
  action?: (p: Player) => preact.ComponentChildren;
}) {
  const { sorted, th } = useSort(
    players,
    {
      name: { value: (p) => p.name },
      pos: { value: (p) => positionKey(positionLabel(p)), first: 1 },
      age: { value: (p) => ageIn(p, league.year), first: 1 },
      current: { value: (p) => p.scouting.current },
      future: { value: (p) => p.scouting.futureValue },
      extra: { value: (p) => extra?.sort(p) ?? 0 },
    },
    extra ? { key: 'extra', dir: -1 } : undefined,
  );
  if (!players.length) return <p class="empty">선수가 없습니다.</p>;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table pick-table">
        <thead>
          <tr>
            {toggle && <th aria-label="선택" />}
            {th('name', '이름')}
            {th('pos', '포지션')}
            {th('age', '나이', true)}
            {th('current', '현재', true)}
            {th('future', '미래', true)}
            {extra && th('extra', extra.title, true)}
            {action && <th aria-label="관리" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} class="player-row" aria-selected={selected?.has(p.id)}>
              {toggle && (
                <td>
                  <input type="checkbox" checked={selected?.has(p.id)} onChange={() => toggle(p.id)} aria-label={`${p.name} 선택`} />
                </td>
              )}
              <td>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>
                {p.contract?.kind === 'development' && <span class="tag">육성</span>}
              </td>
              <td>{positionLabel(p)}</td>
              <td class="num">{ageIn(p, league.year)}</td>
              <td class={`num ${gradeClass(p.scouting.current)}`}>{p.scouting.current}</td>
              <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{p.scouting.futureValue}</td>
              {extra && <td class="num">{extra.value(p)}</td>}
              {action && <td>{action(p)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Trades ───────────────────────────────────────────────────────────────────────────────────────

const CASH_STEPS = [0, 10_000, 20_000, 30_000, 50_000, 70_000, 100_000, 150_000, 200_000];

function Trade({ league, onPlayer, onAct, initial }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void; initial?: { teamId: TeamId; id: PlayerId } | null }) {
  const u = league.user!;
  const clubs = league.teams.filter((t) => t.id !== u.teamId && league.rosters[t.id]);
  const [teamId, setTeamId] = useState<TeamId>(initial?.teamId ?? clubs[0]?.id ?? '');
  const [give, setGive] = useState<Set<PlayerId>>(new Set());
  const [get, setGet] = useState<Set<PlayerId>>(new Set(initial ? [initial.id] : []));
  const [sent, setSent] = useState<number | null>(null);
  // Cash (만 원) and draft picks (rounds of the coming draft) in the deal (V0.7.8).
  const [cashOut, setCashOut] = useState(0);
  const [cashIn, setCashIn] = useState(0);
  const [picksOut, setPicksOut] = useState<Set<number>>(new Set());
  const [picksIn, setPicksIn] = useState<Set<number>>(new Set());
  const ownPicks = tradablePicks(league, u.teamId);
  const theirPicks = tradablePicks(league, teamId);
  const draft = tradeDraftYear(league) + 1;
  const tradable = (id: string) =>
    registeredIds(league, id)
      .map((x) => league.players[x]!)
      .filter((p) => !isForeign(p) && p.proSince <= league.year && !(p.origin.pickVia && p.proSince >= league.year));
  const ours = useMemo(() => tradable(u.teamId), [league, u.teamId]);
  const theirs = useMemo(() => tradable(teamId), [league, teamId]);
  const flip = (set: Set<PlayerId>, id: PlayerId) => {
    const s = new Set(set);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  };
  const closed = tradeWindow(league);
  const extras = { cashOut, cashIn, picksOut: [...picksOut], picksIn: [...picksIn] };
  const anything = give.size || get.size || cashOut || cashIn || picksOut.size || picksIn.size;
  const check = anything ? checkTrade(league, teamId, [...give], [...get], extras) : null;
  const value = { title: '가치', value: (p: Player) => tradeValue(league, p).toFixed(1), sort: (p: Player) => tradeValue(league, p) };
  const sum = (ids: Set<PlayerId>) => [...ids].reduce((a, id) => a + tradeValue(league, league.players[id]!), 0);
  const sideValue = (ids: Set<PlayerId>, cash: number, picks: Set<number>, club: TeamId) => sum(ids) + cashValue(cash) + [...picks].reduce((a, r) => a + pickValue(league, club, r), 0);
  const side = (ids: Set<PlayerId>, cash: number, picks: Set<number>) =>
    [ids.size ? `선수 ${ids.size}명` : '', cash ? `현금 ${money(cash)}` : '', picks.size ? `지명권 ${[...picks].sort((a, b) => a - b).map((r) => `${r}R`).join('·')}` : ''].filter(Boolean).join(' + ') || '없음';
  const toggleRound = (set: Set<number>, r: number) => {
    const next = new Set(set);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    return next;
  };
  const lastLog = sent !== null ? (u.log ?? []).slice(sent) : [];
  return (
    <>
      <Help title="트레이드 규칙">
        정규시즌 중에는 7월 31일까지, 그 뒤로는 한국시리즈가 끝난 다음부터 트레이드할 수 있습니다. 상대 구단은 공개 평가(현재·미래 가치, 나이, 계약 기간, 연봉)로 판단하고, 받는 가치가 주는 가치보다
        조금 더 커야 받아들입니다. 외국인과 올해 뽑은 신인은 트레이드할 수 없습니다. 현금(한쪽만, {money(TRADES.cash.max)}까지, 1억 = 가치 약 1)과 다가오는 드래프트의 신인 지명권(선수와 함께만, 구단당 한 해 2장까지 —
        KBO 규정)을 붙일 수 있습니다. 지명권 가치는 라운드와 예상 지명 순서(성적이 나쁜 구단일수록 앞)로 매기고, 넘겨받은 지명권으로 뽑은 선수는 입단 첫해에 트레이드할 수 없습니다. 구단마다 계획이
        있습니다: 상위권은 우승 도전(당장 쓸 선수를 높이, 지명권을 낮게), 하위권에 주축이 늙었거나 가을야구에서 멀어진 구단은 리빌딩(젊은 선수·지명권·현금을 높이, 30세 이상을 낮게), 나머지는 균형.
        부족한 자리를 채워 주는 선수는 더 높이 보고, 마지막 포수·선발투수를 내주거나 샐러리캡을 넘기는 제안은 거절합니다.
      </Help>
      {closed && <p class="notice">{closed}</p>}
      <div class="team-chips" role="group" aria-label="상대 구단">
        {clubs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === teamId}
            onClick={() => {
              setTeamId(t.id);
              setGet(new Set());
              setPicksIn(new Set());
            }}
          >
            {t.short}
          </button>
        ))}
      </div>
      <div class="trade-extras">
        <label>
          우리가 줄 현금
          <select value={cashOut} onChange={(e) => setCashOut(Number((e.currentTarget as HTMLSelectElement).value))}>
            {CASH_STEPS.map((v) => (
              <option key={v} value={v}>
                {v ? money(v) : '없음'}
              </option>
            ))}
          </select>
        </label>
        <label>
          받을 현금
          <select value={cashIn} onChange={(e) => setCashIn(Number((e.currentTarget as HTMLSelectElement).value))}>
            {CASH_STEPS.map((v) => (
              <option key={v} value={v}>
                {v ? money(v) : '없음'}
              </option>
            ))}
          </select>
        </label>
        <div class="pick-chips" role="group" aria-label="우리 지명권">
          <span class="muted small">우리 {draft} 신인 지명권</span>
          {ownPicks.length ? (
            ownPicks.map((r) => (
              <button key={r} type="button" aria-pressed={picksOut.has(r)} onClick={() => setPicksOut((x) => toggleRound(x, r))} title={`가치 ${pickValue(league, u.teamId, r).toFixed(1)}`}>
                {r}R
              </button>
            ))
          ) : (
            <span class="muted small">넘길 수 있는 지명권 없음</span>
          )}
        </div>
        <div class="pick-chips" role="group" aria-label={`${shortName(league, teamId)} 지명권`}>
          <span class="muted small">
            {shortName(league, teamId)} {draft} 신인 지명권
          </span>
          {theirPicks.length ? (
            theirPicks.map((r) => (
              <button key={r} type="button" aria-pressed={picksIn.has(r)} onClick={() => setPicksIn((x) => toggleRound(x, r))} title={`가치 ${pickValue(league, teamId, r).toFixed(1)}`}>
                {r}R
              </button>
            ))
          ) : (
            <span class="muted small">받을 수 있는 지명권 없음</span>
          )}
        </div>
      </div>
      <div class="trade-bar">
        <span>
          보냄: {side(give, cashOut, picksOut)} (가치 {sideValue(give, cashOut, picksOut, u.teamId).toFixed(1)}) ↔ 받음: {side(get, cashIn, picksIn)} (가치 {sideValue(get, cashIn, picksIn, teamId).toFixed(1)})
        </span>
        {check?.problem && <span class="notice inline">{check.problem}</span>}
        {check && !check.problem && <span class={check.accepted ? 'plus' : 'muted'}>{check.accepted ? '상대 구단이 받아들일 만한 제안입니다' : '상대 구단은 가치가 부족하다고 볼 것 같습니다'}</span>}
        <button
          type="button"
          class="primary"
          disabled={!check || !!check.problem}
          onClick={() => {
            setSent((u.log ?? []).length);
            onAct({ kind: 'trade', teamId, give: [...give], get: [...get], extras });
            setGive(new Set());
            setGet(new Set());
            setCashOut(0);
            setCashIn(0);
            setPicksOut(new Set());
            setPicksIn(new Set());
          }}
        >
          트레이드 제안
        </button>
      </div>
      {check?.reasons && check.reasons.length > 0 && (
        <ul class="trade-reasons muted small" aria-label="상대 구단의 판단">
          {check.reasons.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {!check && <TradePlan league={league} teamId={teamId} />}
      {lastLog.length > 0 && <p class="notice">{lastLog.map((l) => l.text).join(' · ')}</p>}
      <div class="two-col">
        <div>
          <h3>우리 선수 (보낼 선수)</h3>
          <PickList league={league} players={ours} selected={give} toggle={(id) => setGive((s) => flip(s, id))} onPlayer={onPlayer} extra={value} />
        </div>
        <div>
          <h3>{shortName(league, teamId)} 선수 (받을 선수)</h3>
          <PickList league={league} players={theirs} selected={get} toggle={(id) => setGet((s) => flip(s, id))} onPlayer={onPlayer} extra={value} />
        </div>
      </div>
    </>
  );
}

// ── Releases and unattached players ──────────────────────────────────────────────────────────────

function Release({ league, onPlayer, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void }) {
  const u = league.user!;
  const ours = orgPlayers(league, u.teamId).filter((p) => !isForeign(p));
  const pool = (league.pool ?? []).map((id) => league.players[id]!).filter(Boolean);
  const release = (p: Player) => {
    const cost = releaseCost(league, p);
    const later = cost.later.reduce((a, x) => a + x.amount, 0);
    const text = `${eulreul(p.name)} 방출할까요? ${league.phase === 'regular' ? '7일 동안 웨이버에 오르고, 데려가는 구단이 없으면 자유계약선수가 됩니다. ' : ''}남은 연봉 ${money(cost.now + later)}은 계속 우리 연봉 예산에 잡힙니다 (다른 구단이 데려가면 없어짐).`;
    if (window.confirm(text)) onAct({ kind: 'release', id: p.id });
  };
  return (
    <>
      <p class="muted">
        방출한 선수는 정규시즌 중이면 7일 동안 웨이버에 올라 성적이 낮은 구단부터 데려갈 수 있고, 아무도 데려가지 않으면 자유계약선수가 됩니다. 자유계약선수는 어느 구단이든 계약할 수 있습니다.
      </p>
      {(league.waivers ?? []).length > 0 && (
        <>
          <h3>웨이버 공시 중</h3>
          <ul class="club-log">
            {(league.waivers ?? []).map((w) => (
              <li key={w.id}>
                {league.players[w.id]?.name} <span class="muted">({shortName(league, w.from)}, {w.until}까지)</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>자유계약선수</h3>
      <PickList
        league={league}
        players={pool}
        onPlayer={onPlayer}
        extra={{ title: '요구 연봉', value: (p) => money(poolAsk(league, p)), sort: (p) => poolAsk(league, p) }}
        action={(p) => (
          <button type="button" disabled={!!canSignFromPool(league, p.id)} title={canSignFromPool(league, p.id) ?? ''} onClick={() => onAct({ kind: 'signPool', id: p.id })}>
            계약
          </button>
        )}
      />
      <h3>우리 선수 방출</h3>
      {(u.deadMoney ?? []).length > 0 && (
        <p class="muted">잔여 연봉: {(u.deadMoney ?? []).map((x) => `${x.season} ${x.label} ${money(x.amount)}`).join(' · ')}</p>
      )}
      <PickList
        league={league}
        players={ours}
        onPlayer={onPlayer}
        extra={{ title: '연봉', value: (p) => money(p.contract?.salaries.find((x) => x.season === league.year)?.amount ?? 0), sort: (p) => p.contract?.salaries.find((x) => x.season === league.year)?.amount ?? 0 }}
        action={(p) => (
          <button type="button" disabled={!!canRelease(league, p.id)} title={canRelease(league, p.id) ?? ''} onClick={() => release(p)}>
            방출
          </button>
        )}
      />
    </>
  );
}

// ── Foreign players ──────────────────────────────────────────────────────────────────────────────

function Foreign({ league, onPlayer, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void }) {
  const u = league.user!;
  const mine = registeredIds(league, u.teamId).map((id) => league.players[id]!).filter(isForeign);
  const market = useMemo(() => foreignMarket(league, u.teamId), [league, league.foreignChanges?.[u.teamId]]);
  const [out, setOut] = useState<PlayerId | null>(null);
  const [inId, setIn] = useState<string | null>(null);
  const closed = foreignWindow(league, u.teamId);
  const problem = out && inId ? canReplaceForeign(league, u.teamId, out, inId) : null;
  const used = league.foreignChanges?.[u.teamId] ?? 0;
  // The foreign salary cap this season (V0.7.8): what is on the books and what the pick would add.
  const inFirst = firstTeamIds(league).includes(u.teamId);
  const books = inFirst && league.phase === 'regular' ? booksOf(league, u.teamId) : null;
  const incoming = inId ? market.find((p) => p.id === inId) : undefined;
  const adds = incoming && !incoming.origin.asiaQuota ? foreignPriceNow(league, incoming) : 0;
  return (
    <>
      {books && (
        <p class={books.spent + adds > books.cap ? 'notice warn' : 'muted'}>
          {league.year}년 외국인 샐러리캡: 쓴 돈 {usd(books.spent)}
          {adds ? ` + 이번 영입 ${usd(adds)}` : ''} / 상한 {usd(books.cap)} (옵션은 시즌 뒤 실지급액으로 더함, 아시아쿼터 별도)
          {books.spent + adds > books.cap ? ' — 넘으면 시즌 뒤 초과분의 50% 제재금 (2년 연속이면 100% + 2라운드 지명권 9순위 하락)' : ''}
        </p>
      )}
      <Help title="외국인 교체 규칙">
        시즌 중 외국인 선수를 2번까지 바꿀 수 있습니다 (8월 15일까지). 내보낸 선수의 남은 보장액은 계속 나가고, 새 선수는 남은 시즌만큼 줄어든 금액으로 계약합니다. 올해 {used}번 썼습니다. 다른 구단이 방출하거나 재계약하지 않은 KBO 경력 외국인도 명단에
        있습니다 (방출 뒤 재취업은 신규 계약이라 100만 달러 상한).
      </Help>
      {closed && <p class="notice">{closed}</p>}
      <h3>내보낼 선수</h3>
      <div class="choice-grid">
        {mine.map((p) => (
          <button key={p.id} type="button" class="choice" aria-pressed={out === p.id} onClick={() => setOut(p.id)}>
            <strong>{p.name}</strong>
            <span class="muted">
              {positionLabel(p)} · {p.origin.asiaQuota ? '아시아쿼터' : '외국인'} · 현재 {p.scouting.current} · {usd(usdTotal(p.contract))}
            </span>
          </button>
        ))}
      </div>
      <h3>데려올 선수</h3>
      <PickList
        league={league}
        players={market}
        onPlayer={(id) => poolEntry(league, id) && onPlayer(id)}
        extra={{
          title: '지금 계약 (총액)',
          value: (p) => `${usd(foreignPriceNow(league, p))} · ${p.origin.asiaQuota ? '아시아 · ' : ''}${p.archetype} · ${poolEntry(league, p.id) ? kboLine(league, p) : (p.origin.background?.text ?? '')}`,
          sort: (p) => foreignPriceNow(league, p),
        }}
        action={(p) => (
          <button type="button" aria-pressed={inId === p.id} onClick={() => setIn(p.id)}>
            {inId === p.id ? '선택됨' : '선택'}
          </button>
        )}
      />
      <div class="trade-bar">
        {problem && <span class="notice inline">{problem}</span>}
        <button type="button" class="primary" disabled={!out || !inId || !!problem || !!closed} onClick={() => out && inId && onAct({ kind: 'foreignSwap', out, in: inId })}>
          외국인 교체
        </button>
      </div>
    </>
  );
}

function News({ league }: { league: LeagueState }) {
  const items = [...(league.transactions ?? [])].reverse().slice(0, 80);
  if (!items.length) return <p class="empty">아직 이적 소식이 없습니다.</p>;
  return (
    <ul class="club-log">
      {items.map((t, i) => (
        <li key={i}>
          <span class="num muted">{t.date}</span> {t.text}
        </li>
      ))}
    </ul>
  );
}

/** The other club's plan before anything is on the table (1.6.0). */
function TradePlan({ league, teamId }: { league: LeagueState; teamId: TeamId }) {
  const plan = clubStrategy(league, teamId);
  return (
    <p class="muted small">
      {shortName(league, teamId)} · {MODE_LABEL[plan.mode]}: {plan.why}
      {plan.needs.length ? ` 부족한 자리: ${plan.needs.map((k) => SPOT_LABEL[k]).join(', ')}.` : ''} 주축 평균 {plan.age.toFixed(1)}세 · 샐러리캡 여유 {plan.room > 0 ? money(plan.room) : '없음'}
    </p>
  );
}
