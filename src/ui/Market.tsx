import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
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
          <h2 id="market-title">{__i18n_t("ui.market.market.e11828a8")}</h2>
          <p class="muted">{__i18n_t("ui.market.market.b480efe3", { year: league.year, money: money(projectedPayroll(league, u.teamId, league.year)), money2: money(u.payrollBudget), money3: money(deadMoney(league, league.year)), value: ' ', money4: money(u.fund) })}</p>
        </div>
        <div class="segmented" role="group" aria-label={__i18n_t("ui.market.market.1015a89f")}>
          {__i18n_display((
            [
              ['trade', __i18n_k("ui.market.market.428749ee")],
              ['search', __i18n_k("ui.market.market.53215cdb")],
              ['release', __i18n_k("ui.market.market.44f14052")],
              ['foreign', __i18n_k("ui.market.market.c49c1d92")],
              ['news', __i18n_k("ui.market.market.fae81774")],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {__i18n_display(label)}
            </button>
          )))}
        </div>
      </div>
      {__i18n_display(view === 'trade' && <Trade key={target ? `${target.teamId}-${target.id}` : 'trade'} league={league} onPlayer={onPlayer} onAct={onAct} initial={target} />)}
      {__i18n_display(view === 'search' && (
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
      ))}
      {__i18n_display(view === 'release' && <Release league={league} onPlayer={onPlayer} onAct={onAct} />)}
      {__i18n_display(view === 'foreign' && <Foreign league={league} onPlayer={onPlayer} onAct={onAct} />)}
      {__i18n_display(view === 'news' && <News league={league} />)}
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
  if (!players.length) return <p class="empty">{__i18n_t("ui.market.pickList.8abc45cd")}</p>;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table pick-table">
        <thead>
          <tr>
            {__i18n_display(toggle && <th aria-label={__i18n_t("ui.market.pickList.08109e41")} />)}
            {__i18n_display(th('name', __i18n_k("ui.market.pickList.9aa18e50")))}
            {__i18n_display(th('pos', __i18n_k("ui.market.pickList.81922a91")))}
            {__i18n_display(th('age', __i18n_k("ui.market.pickList.6c620e5c"), true))}
            {__i18n_display(th('current', __i18n_k("ui.market.pickList.001e4be2"), true))}
            {__i18n_display(th('future', __i18n_k("ui.market.pickList.6e0caec5"), true))}
            {__i18n_display(extra && th('extra', extra.title, true))}
            {__i18n_display(action && <th aria-label={__i18n_t("ui.market.pickList.c29fba5a")} />)}
          </tr>
        </thead>
        <tbody>
          {__i18n_display(sorted.map((p) => (
            <tr key={p.id} class="player-row" aria-selected={selected?.has(p.id)}>
              {__i18n_display(toggle && (
                <td>
                  <input type="checkbox" checked={selected?.has(p.id)} onChange={() => toggle(p.id)} aria-label={__i18n_displayText(__i18n_k("ui.market.pickList.23814a70", { name: p.name }))} />
                </td>
              ))}
              <td>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {__i18n_display(p.name)}
                </button>
                {__i18n_display(p.contract?.kind === 'development' && <span class="tag">{__i18n_t("ui.market.pickList.818f3b79")}</span>)}
              </td>
              <td>{__i18n_display(positionLabel(p))}</td>
              <td class="num">{__i18n_display(ageIn(p, league.year))}</td>
              <td class={`num ${gradeClass(p.scouting.current)}`}>{__i18n_display(p.scouting.current)}</td>
              <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{__i18n_display(p.scouting.futureValue)}</td>
              {__i18n_display(extra && <td class="num">{__i18n_display(extra.value(p))}</td>)}
              {__i18n_display(action && <td>{__i18n_display(action(p))}</td>)}
            </tr>
          )))}
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
  const value = { title: __i18n_k("ui.market.value.title.1970ef0e"), value: (p: Player) => tradeValue(league, p).toFixed(1), sort: (p: Player) => tradeValue(league, p) };
  const sum = (ids: Set<PlayerId>) => [...ids].reduce((a, id) => a + tradeValue(league, league.players[id]!), 0);
  const sideValue = (ids: Set<PlayerId>, cash: number, picks: Set<number>, club: TeamId) => sum(ids) + cashValue(cash) + [...picks].reduce((a, r) => a + pickValue(league, club, r), 0);
  const side = (ids: Set<PlayerId>, cash: number, picks: Set<number>) =>
    [ids.size ? __i18n_k("ui.market.trade.side.83743982", { size: ids.size }) : '', cash ? __i18n_k("ui.market.trade.side.279a047e", { money: money(cash) }) : '', picks.size ? __i18n_k("ui.market.trade.side.23820fa9", { value: [...picks].sort((a, b) => a - b).map((r) => `${r}R`).join('·') }) : ''].filter(Boolean).join(' + ') || __i18n_k("ui.market.trade.side.d58fa73a");
  const toggleRound = (set: Set<number>, r: number) => {
    const next = new Set(set);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    return next;
  };
  const lastLog = sent !== null ? (u.log ?? []).slice(sent) : [];
  return (
    <>
      <Help title={__i18n_t("ui.market.trade.a8916b94")}>{__i18n_t("ui.market.trade.39de664b", { money: money(TRADES.cash.max) })}</Help>
      {__i18n_display(closed && <p class="notice">{__i18n_display(closed)}</p>)}
      <div class="team-chips" role="group" aria-label={__i18n_t("ui.market.trade.d1837717")}>
        {__i18n_display(clubs.map((t) => (
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
            {__i18n_display(t.short)}
          </button>
        )))}
      </div>
      <div class="trade-extras">
        <label>
          우리가 줄 현금
          <select value={cashOut} onChange={(e) => setCashOut(Number((e.currentTarget as HTMLSelectElement).value))}>
            {__i18n_display(CASH_STEPS.map((v) => (
              <option key={v} value={v}>
                {__i18n_display(v ? money(v) : __i18n_k("ui.market.trade.d58fa73a"))}
              </option>
            )))}
          </select>
        </label>
        <label>
          받을 현금
          <select value={cashIn} onChange={(e) => setCashIn(Number((e.currentTarget as HTMLSelectElement).value))}>
            {__i18n_display(CASH_STEPS.map((v) => (
              <option key={v} value={v}>
                {__i18n_display(v ? money(v) : __i18n_k("ui.market.trade.d58fa73a"))}
              </option>
            )))}
          </select>
        </label>
        <div class="pick-chips" role="group" aria-label={__i18n_t("ui.market.trade.cd679f4e")}>
          <span class="muted small">{__i18n_t("ui.market.trade.3de0ba9d", { draft: draft })}</span>
          {__i18n_display(ownPicks.length ? (
            ownPicks.map((r) => (
              <button key={r} type="button" aria-pressed={picksOut.has(r)} onClick={() => setPicksOut((x) => toggleRound(x, r))} title={__i18n_displayText(__i18n_k("ui.market.trade.1980af2f", { value: pickValue(league, u.teamId, r).toFixed(1) }))}>
                {__i18n_display(r)}R
              </button>
            ))
          ) : (
            <span class="muted small">{__i18n_t("ui.market.trade.0ab408f4")}</span>
          ))}
        </div>
        <div class="pick-chips" role="group" aria-label={__i18n_displayText(__i18n_k("ui.market.trade.915671a0", { shortName: shortName(league, teamId) }))}>
          <span class="muted small">{__i18n_t("ui.market.trade.a1544137", { shortName: shortName(league, teamId), draft: draft })}</span>
          {__i18n_display(theirPicks.length ? (
            theirPicks.map((r) => (
              <button key={r} type="button" aria-pressed={picksIn.has(r)} onClick={() => setPicksIn((x) => toggleRound(x, r))} title={__i18n_displayText(__i18n_k("ui.market.trade.1980af2f", { value: pickValue(league, teamId, r).toFixed(1) }))}>
                {__i18n_display(r)}R
              </button>
            ))
          ) : (
            <span class="muted small">{__i18n_t("ui.market.trade.a0da8a5a")}</span>
          ))}
        </div>
      </div>
      <div class="trade-bar">
        <span>{__i18n_t("ui.market.trade.e81e10d1", { side: side(give, cashOut, picksOut), value: sideValue(give, cashOut, picksOut, u.teamId).toFixed(1), side2: side(get, cashIn, picksIn), value2: sideValue(get, cashIn, picksIn, teamId).toFixed(1) })}</span>
        {__i18n_display(check?.problem && <span class="notice inline">{__i18n_display(check.problem)}</span>)}
        {__i18n_display(check && !check.problem && <span class={check.accepted ? 'plus' : 'muted'}>{__i18n_display(check.accepted ? __i18n_k("ui.market.trade.d3481a56") : __i18n_k("ui.market.trade.c027934b"))}</span>)}
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
        >{__i18n_t("ui.market.trade.9d72a2a9")}</button>
      </div>
      {__i18n_display(check?.reasons && check.reasons.length > 0 && (
        <ul class="trade-reasons muted small" aria-label={__i18n_t("ui.market.trade.6a1c2d0d")}>
          {__i18n_display(check.reasons.map((line) => (
            <li key={line}>{__i18n_display(line)}</li>
          )))}
        </ul>
      ))}
      {__i18n_display(!check && <TradePlan league={league} teamId={teamId} />)}
      {__i18n_display(lastLog.length > 0 && <p class="notice">{__i18n_display(lastLog.map((l) => l.text).join(' · '))}</p>)}
      <div class="two-col">
        <div>
          <h3>{__i18n_t("ui.market.trade.9b230d96")}</h3>
          <PickList league={league} players={ours} selected={give} toggle={(id) => setGive((s) => flip(s, id))} onPlayer={onPlayer} extra={value} />
        </div>
        <div>
          <h3>{__i18n_t("ui.market.trade.7b33091a", { shortName: shortName(league, teamId) })}</h3>
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
    const text = __i18n_k("ui.market.release.text.fb352fa8", { name: eulreul(p.name), value: league.phase === 'regular' ? __i18n_k("ui.market.release.text.33e70ae8") : '', money: money(cost.now + later) });
    if (window.confirm(text)) onAct({ kind: 'release', id: p.id });
  };
  return (
    <>
      <p class="muted">{__i18n_t("ui.market.release.7d952a9b")}</p>
      {__i18n_display((league.waivers ?? []).length > 0 && (
        <>
          <h3>{__i18n_t("ui.market.release.c9d6954d")}</h3>
          <ul class="club-log">
            {__i18n_display((league.waivers ?? []).map((w) => (
              <li key={w.id}>
                {__i18n_display(league.players[w.id]?.name)} <span class="muted">{__i18n_t("ui.market.release.15dcb4fb", { shortName: shortName(league, w.from), until: w.until })}</span>
              </li>
            )))}
          </ul>
        </>
      ))}
      <h3>{__i18n_t("ui.market.release.0cd908a5")}</h3>
      <PickList
        league={league}
        players={pool}
        onPlayer={onPlayer}
        extra={{ title: __i18n_k("ui.market.release.title.138d1c03"), value: (p) => money(poolAsk(league, p)), sort: (p) => poolAsk(league, p) }}
        action={(p) => (
          <button type="button" disabled={!!canSignFromPool(league, p.id)} title={__i18n_displayText(canSignFromPool(league, p.id) ?? '')} onClick={() => onAct({ kind: 'signPool', id: p.id })}>{__i18n_t("ui.market.release.b4116369")}</button>
        )}
      />
      <h3>{__i18n_t("ui.market.release.5cba39f3")}</h3>
      {__i18n_display((u.deadMoney ?? []).length > 0 && (
        <p class="muted">{__i18n_t("ui.market.release.6b11fc45", { value: (u.deadMoney ?? []).map((x) => `${x.season} ${x.label} ${money(x.amount)}`).join(' · ') })}</p>
      ))}
      <PickList
        league={league}
        players={ours}
        onPlayer={onPlayer}
        extra={{ title: __i18n_k("ui.market.release.title.cbf383ec"), value: (p) => money(p.contract?.salaries.find((x) => x.season === league.year)?.amount ?? 0), sort: (p) => p.contract?.salaries.find((x) => x.season === league.year)?.amount ?? 0 }}
        action={(p) => (
          <button type="button" disabled={!!canRelease(league, p.id)} title={__i18n_displayText(canRelease(league, p.id) ?? '')} onClick={() => release(p)}>{__i18n_t("ui.market.release.e16b5dd5")}</button>
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
      {__i18n_display(books && (
        <p class={books.spent + adds > books.cap ? 'notice warn' : 'muted'}>{__i18n_t("ui.market.foreign.34be7dc7", { year: league.year, usd: usd(books.spent), value: adds ? __i18n_k("ui.market.foreign.774cb355", { usd: usd(adds) }) : '', usd2: usd(books.cap), value2: books.spent + adds > books.cap ? __i18n_k("ui.market.foreign.72ed3aca") : '' })}</p>
      ))}
      <Help title={__i18n_t("ui.market.foreign.2909108b")}>{__i18n_t("ui.market.foreign.6558e0af", { used: used })}</Help>
      {__i18n_display(closed && <p class="notice">{__i18n_display(closed)}</p>)}
      <h3>{__i18n_t("ui.market.foreign.58f7280f")}</h3>
      <div class="choice-grid">
        {__i18n_display(mine.map((p) => (
          <button key={p.id} type="button" class="choice" aria-pressed={out === p.id} onClick={() => setOut(p.id)}>
            <strong>{__i18n_display(p.name)}</strong>
            <span class="muted">{__i18n_t("ui.market.foreign.8f41db3b", { positionLabel: positionLabel(p), value: p.origin.asiaQuota ? __i18n_k("ui.market.foreign.c66942ff") : __i18n_k("ui.market.foreign.5bd804b7"), current: p.scouting.current, usd: usd(usdTotal(p.contract)) })}</span>
          </button>
        )))}
      </div>
      <h3>{__i18n_t("ui.market.foreign.f9839282")}</h3>
      <PickList
        league={league}
        players={market}
        onPlayer={(id) => poolEntry(league, id) && onPlayer(id)}
        extra={{
          title: __i18n_k("ui.market.foreign.title.b4de910d"),
          value: (p) => __i18n_k("ui.market.foreign.value.48bbb81b", { usd: usd(foreignPriceNow(league, p)), value: p.origin.asiaQuota ? __i18n_k("ui.market.foreign.value.55b0ea0f") : '', archetype: p.archetype, value2: poolEntry(league, p.id) ? kboLine(league, p) : (p.origin.background?.text ?? '') }),
          sort: (p) => foreignPriceNow(league, p),
        }}
        action={(p) => (
          <button type="button" aria-pressed={inId === p.id} onClick={() => setIn(p.id)}>
            {__i18n_display(inId === p.id ? __i18n_k("ui.market.foreign.c7cad5ad") : __i18n_k("ui.market.foreign.08109e41"))}
          </button>
        )}
      />
      <div class="trade-bar">
        {__i18n_display(problem && <span class="notice inline">{__i18n_display(problem)}</span>)}
        <button type="button" class="primary" disabled={!out || !inId || !!problem || !!closed} onClick={() => out && inId && onAct({ kind: 'foreignSwap', out, in: inId })}>{__i18n_t("ui.market.foreign.c49c1d92")}</button>
      </div>
    </>
  );
}

function News({ league }: { league: LeagueState }) {
  const items = [...(league.transactions ?? [])].reverse().slice(0, 80);
  if (!items.length) return <p class="empty">{__i18n_t("ui.market.news.35419fb9")}</p>;
  return (
    <ul class="club-log">
      {__i18n_display(items.map((t, i) => (
        <li key={i}>
          <span class="num muted">{__i18n_display(t.date)}</span> {__i18n_display(t.text)}
        </li>
      )))}
    </ul>
  );
}

/** The other club's plan before anything is on the table (1.6.0). */
function TradePlan({ league, teamId }: { league: LeagueState; teamId: TeamId }) {
  const plan = clubStrategy(league, teamId);
  return (
    <p class="muted small">{__i18n_t("ui.market.tradePlan.a20e77f2", { shortName: shortName(league, teamId), value: MODE_LABEL[plan.mode], why: plan.why, value2: plan.needs.length ? __i18n_k("ui.market.tradePlan.a75fd3fd", { value: plan.needs.map((k) => SPOT_LABEL[k]).join(', ') }) : '', value3: plan.age.toFixed(1), value4: plan.room > 0 ? money(plan.room) : __i18n_k("ui.market.tradePlan.d58fa73a") })}</p>
  );
}
