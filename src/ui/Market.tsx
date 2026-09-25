/* The market screen: trades, releases and unattached players, foreign replacements, league moves. */
import { useMemo, useState } from 'preact/hooks';
import type { Action } from '../league/actions';
import { usdTotal } from '../league/contracts';
import { usd } from '../league/foreign';
import { deadMoney, projectedPayroll } from '../league/market';
import { ageIn, isForeign } from '../league/players';
import { orgPlayers, registeredIds, type LeagueState } from '../league/state';
import {
  canRelease,
  canReplaceForeign,
  canSignFromPool,
  checkTrade,
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
import { positionKey, useSort } from './sort';

type View = 'trade' | 'release' | 'foreign' | 'news';

export function Market({ league, onPlayer, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void }) {
  const [view, setView] = useState<View>('trade');
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
      {view === 'trade' && <Trade league={league} onPlayer={onPlayer} onAct={onAct} />}
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
              <td class="num">{p.scouting.current}</td>
              <td class="num strong">{p.scouting.futureValue}</td>
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

function Trade({ league, onPlayer, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void }) {
  const u = league.user!;
  const clubs = league.teams.filter((t) => t.id !== u.teamId && league.rosters[t.id]);
  const [teamId, setTeamId] = useState<TeamId>(clubs[0]?.id ?? '');
  const [give, setGive] = useState<Set<PlayerId>>(new Set());
  const [get, setGet] = useState<Set<PlayerId>>(new Set());
  const [sent, setSent] = useState<number | null>(null);
  const tradable = (id: string) => registeredIds(league, id).map((x) => league.players[x]!).filter((p) => !isForeign(p) && p.proSince <= league.year);
  const ours = useMemo(() => tradable(u.teamId), [league, u.teamId]);
  const theirs = useMemo(() => tradable(teamId), [league, teamId]);
  const flip = (set: Set<PlayerId>, id: PlayerId) => {
    const s = new Set(set);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  };
  const closed = tradeWindow(league);
  const check = give.size || get.size ? checkTrade(league, teamId, [...give], [...get]) : null;
  const value = { title: '가치', value: (p: Player) => tradeValue(league, p).toFixed(1), sort: (p: Player) => tradeValue(league, p) };
  const sum = (ids: Set<PlayerId>) => [...ids].reduce((a, id) => a + tradeValue(league, league.players[id]!), 0);
  const lastLog = sent !== null ? (u.log ?? []).slice(sent) : [];
  return (
    <>
      <p class="muted">
        정규시즌 중에는 7월 31일까지, 그 뒤로는 한국시리즈가 끝난 다음부터 트레이드할 수 있습니다. 상대 구단은 공개 평가(현재·미래 가치, 나이, 계약 기간, 연봉)로 판단하고, 받는 가치가 주는 가치보다
        조금 더 커야 받아들입니다. 외국인과 올해 뽑은 신인은 트레이드할 수 없습니다.
      </p>
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
            }}
          >
            {t.short}
          </button>
        ))}
      </div>
      <div class="trade-bar">
        <span>
          보내는 선수 {give.size}명 (가치 {sum(give).toFixed(1)}) ↔ 받는 선수 {get.size}명 (가치 {sum(get).toFixed(1)})
        </span>
        {check?.problem && <span class="notice inline">{check.problem}</span>}
        {check && !check.problem && <span class={check.accepted ? 'plus' : 'muted'}>{check.accepted ? '상대 구단이 받아들일 만한 제안입니다' : '상대 구단은 가치가 부족하다고 볼 것 같습니다'}</span>}
        <button
          type="button"
          class="primary"
          disabled={!check || !!check.problem}
          onClick={() => {
            setSent((u.log ?? []).length);
            onAct({ kind: 'trade', teamId, give: [...give], get: [...get] });
            setGive(new Set());
            setGet(new Set());
          }}
        >
          트레이드 제안
        </button>
      </div>
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
    const text = `${p.name}을(를) 방출할까요? ${league.phase === 'regular' ? '7일 동안 웨이버에 오르고, 데려가는 구단이 없으면 자유계약선수가 됩니다. ' : ''}남은 연봉 ${money(cost.now + later)}은 계속 우리 연봉 예산에 잡힙니다 (다른 구단이 데려가면 없어짐).`;
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
  return (
    <>
      <p class="muted">
        시즌 중 외국인 선수를 2번까지 바꿀 수 있습니다 (8월 15일까지). 내보낸 선수의 남은 보장액은 계속 나가고, 새 선수는 남은 시즌만큼 줄어든 금액으로 계약합니다. 올해 {used}번 썼습니다.
      </p>
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
        onPlayer={() => undefined}
        extra={{ title: '지금 계약 (총액)', value: (p) => `${usd(foreignPriceNow(league, p))} · ${p.origin.asiaQuota ? '아시아' : ''}${p.origin.background?.text ?? ''}`, sort: (p) => foreignPriceNow(league, p) }}
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
