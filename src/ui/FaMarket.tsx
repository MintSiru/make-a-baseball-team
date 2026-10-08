import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* The free-agent market (V0.8): the winter's free agents, what each wants, and talks with one at a time. The
   club makes or changes offers (bonus, salary, incentives, a period option, promises), then lets the days run:
   to the next round, until one of its talks has news, or to the end of the market. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { autoDecision, checkDecision, foreignReserve, type DecisionInput } from '../league/expansion';
import {
  budgetUse,
  capHit,
  capRoomFor,
  faDate,
  guaranteed,
  maxGuaranteed,
  meetTerms,
  offerTotal,
  openDrafts,
  openCommitments,
  payrollBeforeOffers,
  reaction,
  scaleOffer,
  spotLabel,
  termsText,
  winTerms,
  type FaDemand,
  type FaMarket as Market,
  type FaOffer,
  type FaTalk,
} from '../league/fa';
import { wagwa } from '../league/josa';
import { ageIn } from '../league/players';
import type { LeagueState } from '../league/state';
import { FA } from '../league/tuning';
import { positionLabel, shortName, statLine } from '../league/views';
import type { FaPromise, PlayerId } from '../model/types';
import { salaryCapFor } from '../rules/kbo2026';
import { money, moneyShort, parseEok } from './format';
import { gradeClass } from './grades';
import { positionKey, useSort } from './sort';

interface Props {
  league: LeagueState;
  onSubmit: (input: DecisionInput) => void;
  onPlayer: (id: PlayerId) => void;
}

const eok = (manwon: number) => Math.round(manwon / 1000) / 10;
const manwon = (x: number) => Math.max(0, Math.round((Number.isFinite(x) ? x : 0) * 100) * 100);
const lastWar = (league: LeagueState, id: PlayerId) => league.players[id]!.career.filter((c) => !c.level).at(-1)?.war;

export function demandText(d: FaDemand) {
  switch (d.kind) {
    case 'years':
      return __i18n_k("ui.faMarket.demandText.8d829b4f", { min: d.min });
    case 'bonus':
      return __i18n_k("ui.faMarket.demandText.651c5fce", { value: Math.round(d.share * 100) });
    case 'starter':
      return __i18n_k("ui.faMarket.demandText.b2db18ee");
    case 'reinforce':
      return __i18n_k("ui.faMarket.demandText.88384259", { spotLabel: spotLabel(d.spot) });
    case 'contender':
      return __i18n_k("ui.faMarket.demandText.b0b8b8d9");
    case 'hometown':
      return __i18n_k("ui.faMarket.demandText.6fa45db3", { region: d.region });
    case 'optOut':
      return __i18n_k("ui.faMarket.demandText.25e57a72");
  }
}

const EXTRAS: [string, string][] = [
  ['', __i18n_k("ui.faMarket.eXTRAS.d58fa73a")],
  ['club-1', __i18n_k("ui.faMarket.eXTRAS.ff1ec1d4")],
  ['club-2', __i18n_k("ui.faMarket.eXTRAS.5eaea33a")],
  ['player-1', __i18n_k("ui.faMarket.eXTRAS.124de938")],
  ['player-2', __i18n_k("ui.faMarket.eXTRAS.9c532a59")],
];
const extraKey = (o: FaOffer) => (o.extra ? `${o.extra.holder}-${o.extra.years}` : '');
const extraOf = (k: string): FaOffer['extra'] => {
  if (!k) return undefined;
  const [holder, years] = k.split('-');
  return { holder: holder as 'club' | 'player', years: Number(years) };
};

/** The day he decides, as a date (the next round's when it has come). */
const decideDate = (m: Market, t: FaTalk) => faDate(m, Math.max(t.decideOn!, FA.rounds[m.round] ?? t.decideOn!)).slice(5).replace('-', '/');
const eokOrZero = (manwon: number) => (manwon ? moneyShort(manwon) : '0');

function status(league: LeagueState, m: Market, t: FaTalk) {
  if (t.signed) return t.signed.teamId === t.from ? __i18n_k("ui.faMarket.status.cf4c6e9c", { moneyShort: moneyShort(offerTotal(t.signed.offer)) }) : `→ ${shortName(league, t.signed.teamId)} (${moneyShort(offerTotal(t.signed.offer))})`;
  if (t.gone) return __i18n_k("ui.faMarket.status.5b170d3c");
  if (t.decideOn !== undefined) return __i18n_k("ui.faMarket.status.ce068b09", { decideDate: decideDate(m, t) });
  const n = Object.keys(t.offers).filter((id) => id !== league.user!.teamId).length;
  return n ? __i18n_k("ui.faMarket.status.71e4cd4c", { n: n }) : __i18n_k("ui.faMarket.status.8630cbaf");
}

export function FaMarket({ league, onSubmit, onPlayer }: Props) {
  const m = league.offseason!.fa!;
  const u = league.user!;
  const me = u.teamId;
  const next = league.offseason!.year + 1;
  const d = league.pending as Extract<NonNullable<LeagueState['pending']>, { kind: 'faRound' }>;
  const talks = m.order.map((id) => m.talks[id]!);
  const [drafts, setDrafts] = useState<Record<PlayerId, FaOffer | null>>({});
  const firstOpen = talks.find((t) => t.from === me && !t.signed && !t.gone) ?? talks.find((t) => !t.signed && !t.gone) ?? talks[0];
  const [sel, setSelected] = useState<PlayerId | null>(firstOpen?.id ?? null);
  // On a narrow screen the talks sit under the list: bring them into view.
  const setSel = (id: PlayerId) => {
    setSelected(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1100) setTimeout(() => document.querySelector('.fa-talk')?.scrollIntoView({ block: 'start' }), 0);
  };
  const [filter, setFilter] = useState<'all' | 'open' | 'mine'>('all');

  const current = (id: PlayerId): FaOffer | null => (id in drafts ? drafts[id]! : (m.talks[id]!.offers[me] ?? null));
  // A new day of the market (1.0.1): the drafts went out with the last submit, and keeping them blocked the buttons
  // once one of their players had signed.
  useEffect(() => setDrafts({}), [m.round, d.day]);
  const input = (run: 'round' | 'news' | 'close'): DecisionInput => ({ kind: 'faRound', offers: openDrafts(m, drafts), run });
  const problem = checkDecision(league, input('round'));

  // What the open offers commit: next season's payroll budget (bonuses spread over the deals) and the salary cap.
  const mine: Record<PlayerId, FaOffer> = {};
  for (const t of talks) {
    const o = current(t.id);
    if (o && !t.signed && !t.gone) mine[t.id] = o;
  }
  const c = openCommitments(league, m, mine).budget;
  const base = payrollBeforeOffers(league, m, next);
  // V0.16: the foreign players sign after the free agents, from the same budget.
  const reserve = foreignReserve(league, me, next);
  const cap = salaryCapFor(next);
  const capNow = cap - capRoomFor(league, me, next, new Set(talks.filter((t) => !t.signed && !t.gone).map((t) => t.id)));
  const capAdd = Object.values(mine).reduce((a, o) => a + capHit(o), 0);
  const outside = Object.keys(mine).filter((id) => m.talks[id]!.from !== me).length;
  const room = m.userLimit - (m.signedOut[me] ?? 0);
  const nextDay = FA.rounds[m.round + 1];

  const shown = talks.filter((t) => (filter === 'open' ? !t.signed && !t.gone : filter === 'mine' ? t.from === me || !!current(t.id) || t.signed?.teamId === me : true));
  // 1.0.1: the list sorts by its headings, like the other player tables.
  const GRADE_ORDER: Record<string, number> = { A: 3, B: 2, C: 1 };
  const { sorted, th } = useSort(shown, {
    name: { value: (t) => league.players[t.id]!.name },
    position: { value: (t) => positionKey(positionLabel(league.players[t.id]!)), first: 1 },
    age: { value: (t) => ageIn(league.players[t.id]!, next), first: 1 },
    current: { value: (t) => league.players[t.id]!.scouting.current },
    future: { value: (t) => league.players[t.id]!.scouting.futureValue },
    war: { value: (t) => lastWar(league, t.id) ?? -99 },
    grade: { value: (t) => (t.free ? 0 : (GRADE_ORDER[t.grade] ?? 0)), first: 1 },
    price: { value: (t) => offerTotal(t.price) },
  });
  const selected = sel ? m.talks[sel] : undefined;

  return (
    <section class="decision fa-market" aria-labelledby="decision-title">
      <h2 id="decision-title">{__i18n_rich("ui.faMarket.faMarket.96e4e087", { number: Number(d.date.slice(5, 7)), number2: Number(d.date.slice(8)), value: <span class="muted small">{__i18n_t("ui.faMarket.faMarket.8832706d", { value: m.round + 1, length: FA.rounds.length })}</span> })}</h2>
      <dl class="fa-summary">
        <div>
          <dt>{__i18n_t("ui.faMarket.faMarket.7cd5c6ba")}</dt>
          <dd>{__i18n_t("ui.faMarket.faMarket.9329d16a", { outside: outside, value: Math.max(0, room), value2: m.userFree ? __i18n_k("ui.faMarket.faMarket.4031c36f") : '' })}</dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.faMarket.faMarket.4ac6fbee", { next: next })}</dt>
          <dd class={base + c > u.payrollBudget ? 'minus' : ''} title={__i18n_t("ui.faMarket.faMarket.f94f5762")}>{__i18n_t("ui.faMarket.faMarket.68b07cc3", { moneyShort: moneyShort(base), eokOrZero: eokOrZero(c), moneyShort2: moneyShort(u.payrollBudget) })}</dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.faMarket.faMarket.1293394a")}</dt>
          <dd title={__i18n_t("ui.faMarket.faMarket.86aff787")}>{__i18n_t("ui.faMarket.faMarket.9891f1a2", { moneyShort: moneyShort(reserve) })}</dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.faMarket.faMarket.c868d2a2", { next: next })}</dt>
          <dd class={capNow + capAdd > cap ? 'minus' : ''}>
            {__i18n_display(moneyShort(Math.round(capNow + capAdd)))} / {__i18n_display(moneyShort(cap))}
          </dd>
        </div>
      </dl>
      {__i18n_display(base + c <= u.payrollBudget && base + c + reserve > u.payrollBudget && (
        <p class="notice warn">{__i18n_t("ui.faMarket.faMarket.8694e6c8", { moneyShort: moneyShort(reserve), moneyShort2: moneyShort(base + c + reserve - u.payrollBudget) })}</p>
      ))}
      {__i18n_display(m.gift && !m.talks[m.gift.id]!.signed && (
        <p class="notice good">{__i18n_rich("ui.faMarket.faMarket.35ffaa19", { value: <strong>{__i18n_t("ui.faMarket.faMarket.17f613d4")}</strong>, name: league.players[m.gift.id]!.name, money: money(m.gift.total), value2: ' ', value3: <button type="button" class="link" onClick={() => setSel(m.gift!.id)}>{__i18n_t("ui.faMarket.faMarket.858d3c58")}</button> })}</p>
      ))}

      <div class="fa-grid">
        <div class="fa-list">
          <div class="segmented" role="group" aria-label={__i18n_t("ui.faMarket.faMarket.0b782028")}>
            {__i18n_display((
              [
                ['all', __i18n_k("ui.faMarket.faMarket.a2a0da64", { length: talks.length })],
                ['open', __i18n_k("ui.faMarket.faMarket.e7bf361a")],
                ['mine', __i18n_k("ui.faMarket.faMarket.0be4ce88")],
              ] as const
            ).map(([k, label]) => (
              <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {__i18n_display(label)}
              </button>
            )))}
          </div>
          <div class="table-wrap">
            <table class="record-table fa-table">
              <thead>
                <tr>
                  <th>{__i18n_t("ui.faMarket.faMarket.4f39ee63")}</th>
                  {__i18n_display(th('name', __i18n_k("ui.faMarket.faMarket.c37450d6")))}
                  {__i18n_display(th('position', __i18n_k("ui.faMarket.faMarket.81922a91")))}
                  {__i18n_display(th('age', __i18n_k("ui.faMarket.faMarket.6c620e5c"), true))}
                  {__i18n_display(th('current', __i18n_k("ui.faMarket.faMarket.001e4be2"), true))}
                  {__i18n_display(th('future', __i18n_k("ui.faMarket.faMarket.6e0caec5"), true))}
                  <th>{__i18n_t("ui.faMarket.faMarket.d3441398")}</th>
                  {__i18n_display(th('war', 'WAR', true))}
                  {__i18n_display(th('grade', __i18n_k("ui.faMarket.faMarket.89dbf513")))}
                  {__i18n_display(th('price', __i18n_k("ui.faMarket.faMarket.b1fd715c"), true))}
                  <th>{__i18n_t("ui.faMarket.faMarket.2926977b")}</th>
                </tr>
              </thead>
              <tbody>
                {__i18n_display(sorted.map((t) => {
                  const p = league.players[t.id]!;
                  const o = current(t.id);
                  const open = !t.signed && !t.gone;
                  const x = o && open ? reaction(league, m, t, o, next) : null;
                  const line = statLine(league, p);
                  return (
                    <tr key={t.id} class={`player-row${sel === t.id ? ' selected' : ''}`} aria-selected={sel === t.id}>
                      <td class={x ? `fa-band ${x.band}` : 'muted'}>
                        <button type="button" class={`talk-button${sel === t.id ? ' on' : ''}`} aria-label={__i18n_displayText(__i18n_k("ui.faMarket.faMarket.ab64c5c5", { name: p.name }))} onClick={() => setSel(t.id)}>
                          {__i18n_display(x ? x.label : o && t.signed?.teamId === me ? __i18n_k("ui.faMarket.faMarket.b4116369") : open ? __i18n_k("ui.faMarket.faMarket.15aaa276") : __i18n_k("ui.faMarket.faMarket.58d6978a"))}
                        </button>
                        {__i18n_display(x && o?.ceiling !== undefined && <span class="muted small">{__i18n_t("ui.faMarket.faMarket.ce356a1a", { moneyShort: moneyShort(o.ceiling) })}</span>)}
                      </td>
                      <td>
                        {/* The name opens his profile, as everywhere else; talks open from the first column (0.10.1). */}
                        <button type="button" class="link" onClick={() => onPlayer(t.id)}>
                          {__i18n_display(p.name)}
                        </button>
                        {__i18n_display(t.from === me && <span class="tag">{__i18n_t("ui.faMarket.faMarket.466570d3")}</span>)}
                        {__i18n_display(m.gift?.id === t.id && <span class="tag">{__i18n_t("ui.faMarket.faMarket.cf76b767")}</span>)}
                      </td>
                      <td>
                        {__i18n_display(positionLabel(p))} <span class="muted small">{__i18n_display(shortName(league, t.from))}</span>
                      </td>
                      <td class="num">{__i18n_display(ageIn(p, next))}</td>
                      <td class={`num ${gradeClass(p.scouting.current)}`}>{__i18n_display(p.scouting.current)}</td>
                      <td class={`num ${gradeClass(p.scouting.futureValue)}`}>{__i18n_display(p.scouting.futureValue)}</td>
                      <td class="small nowrap">{__i18n_display(line ? line.text : '-')}</td>
                      <td class="num">{__i18n_display(lastWar(league, t.id)?.toFixed(1) ?? '-')}</td>
                      <td>{__i18n_display(t.free ? __i18n_k("ui.faMarket.faMarket.4c0223d3") : t.grade)}</td>
                      <td class="num">{__i18n_display(moneyShort(offerTotal(t.price)))}</td>
                      <td class={t.signed?.teamId === me ? 'plus' : t.signed && t.from === me ? 'minus' : ''}>{__i18n_display(status(league, m, t))}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
        {__i18n_display(selected && (
          <TalkPanel
            key={selected.id}
            league={league}
            m={m}
            t={selected}
            next={next}
            offer={current(selected.id)}
            offers={mine}
            check={(o) => checkDecision(league, { kind: 'faRound', offers: { ...drafts, [selected.id]: o }, run: 'round' })}
            setOffer={(o) => setDrafts((prev) => ({ ...prev, [selected.id]: o }))}
            onPlayer={onPlayer}
            changed={selected.id in drafts}
          />
        ))}
      </div>

      <h3>{__i18n_t("ui.faMarket.faMarket.9365d125")}</h3>
      <ul class="fa-news">
        {__i18n_display([...m.news]
          .reverse()
          .slice(0, 10)
          .map((n, i) => (
            <li key={i} class={n.mine ? 'mine' : ''}>
              <span class="muted small">{__i18n_display(faDate(m, n.day).slice(5).replace('-', '/'))}</span> {__i18n_display(n.text)}
            </li>
          )))}
        {__i18n_display(!m.news.length && <li class="muted">{__i18n_t("ui.faMarket.faMarket.11ebbdab")}</li>)}
      </ul>

      <div class="actions">
        <button type="button" class="primary" disabled={!!problem} onClick={() => onSubmit(input('round'))}>
          {__i18n_display(nextDay !== undefined ? __i18n_k("ui.faMarket.faMarket.b836d29d", { value: faDate(m, nextDay).slice(5).replace('-', '/') }) : __i18n_k("ui.faMarket.faMarket.06986c84"))}
        </button>
        <button type="button" disabled={!!problem} onClick={() => onSubmit(input('news'))} title={__i18n_t("ui.faMarket.faMarket.e76111b6")}>{__i18n_t("ui.faMarket.faMarket.f324ec90")}</button>
        <button type="button" disabled={!!problem} onClick={() => onSubmit(input('close'))}>{__i18n_t("ui.faMarket.faMarket.2906c0dd")}</button>
        <button
          type="button"
          onClick={() => {
            const a = autoDecision(league);
            if (a && a.kind === 'faRound') setDrafts((prev) => ({ ...prev, ...a.offers }));
          }}
        >{__i18n_t("ui.faMarket.faMarket.64dce6c7")}</button>
        {__i18n_display(problem && <span class="notice inline">{__i18n_display(problem)}</span>)}
      </div>
    </section>
  );
}

/** A money field in 억 that keeps what is typed until it is a number (a phone keyboard types "12." on the way to
    "12.5"), with one-tap steps either side. */
function MoneyField({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (manwon: number) => void; step?: number; hint?: string }) {
  const show = (v: number) => String(eok(v));
  const [text, setText] = useState(show(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(show(value));
  }, [value, editing]);
  const bump = (d: number) => onChange(manwon(Math.max(0, eok(value) + d)));
  return (
    <div class="money-field">
      <span>
        {__i18n_display(label)}
        {__i18n_display(hint && <span class="muted small"> {__i18n_display(hint)}</span>)}
      </span>
      <span class="money-stepper">
        <button type="button" aria-label={__i18n_displayText(__i18n_k("ui.faMarket.moneyField.d192fc06", { label: label, step: step }))} onClick={() => bump(-step)}>
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          aria-label={__i18n_displayText(label)}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false);
            const x = parseEok(text);
            if (x !== null) onChange(manwon(x));
            else setText(show(value));
          }}
          onInput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            setText(v);
            const x = parseEok(v);
            if (x !== null && !v.endsWith('.')) onChange(manwon(x));
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        />
        <button type="button" aria-label={__i18n_displayText(__i18n_k("ui.faMarket.moneyField.f1b1b7e3", { label: label, step: step }))} onClick={() => bump(step)}>
          +
        </button>
      </span>
    </div>
  );
}

function TalkPanel({
  league,
  m,
  t,
  next,
  offer,
  offers,
  check,
  setOffer,
  onPlayer,
  changed,
}: {
  league: LeagueState;
  m: Market;
  t: FaTalk;
  next: number;
  offer: FaOffer | null;
  /** The club's offers as they stand (drafts included). */
  offers: Record<PlayerId, FaOffer>;
  /** What the rules say about this offer with the others. */
  check: (o: FaOffer) => string | null;
  setOffer: (o: FaOffer | null) => void;
  onPlayer: (id: PlayerId) => void;
  changed: boolean;
}) {
  const p = league.players[t.id]!;
  const u = league.user!;
  const me = u.teamId;
  const open = !t.signed && !t.gone;
  const [form, setForm] = useState<FaOffer>(() => offer ?? meetTerms(league, m, t, next));
  const x = useMemo(() => reaction(league, m, t, form, next), [form, t, league]);
  const promisable = t.demands.filter((d): d is Extract<FaDemand, { kind: FaPromise }> => d.kind === 'starter' || d.kind === 'reinforce');
  const others = Object.keys(t.offers).filter((id) => id !== me).length;
  const set = (change: Partial<FaOffer>) => setForm((prev) => ({ ...prev, ...change }));
  const meter = Math.max(0, Math.min(1.3, x.ratio)) / 1.3;
  // Room for this offer: the payroll budget and the fund after the club's other offers.
  const rest = Object.fromEntries(Object.entries(offers).filter(([id]) => id !== t.id));
  const used = openCommitments(league, m, rest);
  const budgetLeft = u.payrollBudget - payrollBeforeOffers(league, m, next) - used.budget;
  const fundLeft = u.fund - used.fund;
  const most = maxGuaranteed(league, m, t, form, next, offers);
  const keepCeiling = (o: FaOffer): FaOffer => (form.ceiling !== undefined ? { ...o, ceiling: Math.max(form.ceiling, guaranteed(o)), prepaid: form.prepaid } : { ...o, prepaid: form.prepaid });
  const shape = (o: FaOffer) => setForm(keepCeiling({ ...o, promises: o.promises ?? form.promises }));
  const problem = open ? check(form) : null;
  const line = statLine(league, p);
  return (
    <aside class="fa-talk" aria-label={__i18n_displayText(__i18n_k("ui.faMarket.talkPanel.ab64c5c5", { name: p.name }))}>
      <h3>
        <button type="button" class="link" onClick={() => onPlayer(p.id)}>
          {__i18n_display(p.name)}
        </button>{__i18n_display(' ')}
        <span class="muted small">{__i18n_t("ui.faMarket.talkPanel.66b8b5b2", { positionLabel: positionLabel(p), ageIn: ageIn(p, next), shortName: shortName(league, t.from), value: t.free ? __i18n_k("ui.faMarket.talkPanel.4c0223d3") : __i18n_k("ui.faMarket.talkPanel.3f69daa3", { grade: t.grade }) })}</span>
      </h3>
      <p class="small">
        <span class={gradeClass(p.scouting.current)}>{__i18n_t("ui.faMarket.talkPanel.24fc8609", { current: p.scouting.current })}</span> · <span class={gradeClass(p.scouting.futureValue)}>{__i18n_t("ui.faMarket.talkPanel.92982abd", { futureValue: p.scouting.futureValue })}</span> ·{__i18n_display(' ')}
        {__i18n_display(line ? `${line.year} ${line.text}` : __i18n_k("ui.faMarket.talkPanel.12ca5e35"))} · WAR {__i18n_display(lastWar(league, t.id)?.toFixed(1) ?? '-')}{__i18n_display(' ')}
        <button type="button" class="link small" onClick={() => onPlayer(p.id)}>{__i18n_t("ui.faMarket.talkPanel.243cf4c2")}</button>
      </p>
      <p class="small">{__i18n_t("ui.faMarket.talkPanel.7b6d4a37", { termsText: termsText(t.price), value: t.demands.length ? t.demands.map(demandText).join(' · ') : __i18n_k("ui.faMarket.talkPanel.0dcc462c"), others: others, value2: t.decideOn !== undefined && __i18n_k("ui.faMarket.talkPanel.e858d967", { decideDate: decideDate(m, t) }) })}</p>

      {__i18n_display(t.signed ? (
        <p class={`notice ${t.signed.teamId === me ? 'good' : ''}`}>
          {__i18n_display(t.signed.teamId === me ? __i18n_k("ui.faMarket.talkPanel.14152e46") : __i18n_k("ui.faMarket.talkPanel.4bfd172f", { shortName: wagwa(shortName(league, t.signed.teamId)) }))}: {__i18n_display(termsText(t.signed.offer))}
        </p>
      ) : t.gone ? (
        <p class="notice">{__i18n_t("ui.faMarket.talkPanel.7429394c")}</p>
      ) : (
        <>
          <div class="quick-offers" role="group" aria-label={__i18n_t("ui.faMarket.talkPanel.97ea914e")}>
            <button type="button" onClick={() => shape(meetTerms(league, m, t, next))} title={__i18n_t("ui.faMarket.talkPanel.75a5be92")}>{__i18n_t("ui.faMarket.talkPanel.39d3ee8b")}</button>
            <button type="button" onClick={() => shape(winTerms(league, m, t, next))} title={__i18n_t("ui.faMarket.talkPanel.cdebb7c3")}>{__i18n_t("ui.faMarket.talkPanel.72b751e0")}</button>
            <button type="button" onClick={() => shape(scaleOffer(form, guaranteed(form) * 1.05, next))}>
              +5%
            </button>
            <button type="button" onClick={() => shape(scaleOffer(form, guaranteed(form) * 1.1, next))}>
              +10%
            </button>
            <button type="button" disabled={most < 1000} onClick={() => shape(scaleOffer(form, most, next))} title={__i18n_t("ui.faMarket.talkPanel.708e8157")}>{__i18n_t("ui.faMarket.talkPanel.daf773af")}</button>
          </div>
          <div class="fa-offer" role="group" aria-label={__i18n_t("ui.faMarket.talkPanel.d6f65fc1")}>
            <label>
              보장 기간
              <select value={form.years} onChange={(e) => set({ years: Number((e.currentTarget as HTMLSelectElement).value) })}>
                {__i18n_display([1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>{__i18n_t("ui.faMarket.talkPanel.4f6a7548", { y: y })}</option>
                )))}
              </select>
            </label>
            <MoneyField label={__i18n_t("ui.faMarket.talkPanel.fae43edd")} value={form.bonus} step={1} onChange={(v) => set({ bonus: v })} />
            <MoneyField label={__i18n_t("ui.faMarket.talkPanel.36a4f53a")} value={form.annual} step={0.5} onChange={(v) => set({ annual: v })} />
            <MoneyField label={__i18n_t("ui.faMarket.talkPanel.1cffc0e9")} value={form.options} step={1} onChange={(v) => set({ options: v })} />
            <label>
              기간 옵션
              <select value={extraKey(form)} onChange={(e) => set({ extra: extraOf((e.currentTarget as HTMLSelectElement).value) })}>
                {__i18n_display(EXTRAS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {__i18n_display(label)}
                  </option>
                )))}
              </select>
            </label>
            {__i18n_display(promisable.map((dd) => (
              <label key={dd.kind} class="check">
                <input
                  type="checkbox"
                  checked={!!form.promises?.includes(dd.kind)}
                  onChange={(e) => {
                    const on = (e.currentTarget as HTMLInputElement).checked;
                    const promises = (form.promises ?? []).filter((k) => k !== dd.kind);
                    set({ promises: on ? [...promises, dd.kind] : promises });
                  }}
                />{__i18n_display(' ')}
                {__i18n_display(dd.kind === 'starter' ? __i18n_k("ui.faMarket.talkPanel.c46a2128") : __i18n_k("ui.faMarket.talkPanel.0edb0b24", { spotLabel: spotLabel(dd.spot) }))}
              </label>
            )))}
            <label class="check">
              <input type="checkbox" checked={!!form.prepaid} onChange={(e) => set({ prepaid: (e.currentTarget as HTMLInputElement).checked || undefined })} /> {__i18n_t("ui.faMarket.offerForm.fbaebdd5", { money: moneyShort(Math.max(0, fundLeft)) })}
            </label>
            <label class="check">
              <input
                type="checkbox"
                checked={form.ceiling !== undefined}
                onChange={(e) => {
                  const on = (e.currentTarget as HTMLInputElement).checked;
                  set({ ceiling: on ? Math.max(guaranteed(form), Math.min(Math.round((guaranteed(form) * 1.2) / 1000) * 1000, most)) : undefined });
                }}
              />{__i18n_display(' ')}
              자동 증액: 경쟁 제안이 오거나 요구에 못 미치면 상한까지 알아서 올리기
            </label>
            {__i18n_display(form.ceiling !== undefined && (
              <MoneyField label={__i18n_t("ui.faMarket.talkPanel.99042f38")} hint={__i18n_k("ui.faMarket.talkPanel.8ba56a86", { moneyShort: moneyShort(most) })} value={form.ceiling} step={5} onChange={(v) => set({ ceiling: v })} />
            ))}
          </div>
          <p class="small">{__i18n_t("ui.faMarket.talkPanel.f895950a", { money: money(offerTotal(form)), money2: money(guaranteed(form)), value: Math.round((form.bonus / Math.max(1, guaranteed(form))) * 100), value2: ' ', moneyShort: moneyShort(budgetUse(form)), moneyShort2: moneyShort(Math.max(0, budgetLeft)), moneyShort3: moneyShort(Math.round(capHit(form))) })}</p>
          <div class={`fa-reaction ${x.band}`}>
            <div class="fa-meter" aria-hidden="true">
              <span style={{ width: `${meter * 100}%` }} />
              <i style={{ left: `${(1 / 1.3) * 100}%` }} />
            </div>
            <strong>{__i18n_display(x.label)}</strong> <span class="muted small">{__i18n_t("ui.faMarket.talkPanel.a9c7d33f", { value: Math.round(x.ratio * 20) * 5 })}</span>
            {__i18n_display(x.behind !== undefined && (
              <p class="small minus">{__i18n_t("ui.faMarket.talkPanel.0ab2ce14", { value: Math.max(1, Math.round(x.behind * 100)), money: money(Math.ceil((guaranteed(form) * (1 + x.behind) * 1.02) / 1000) * 1000) })}</p>
            ))}
            {__i18n_display((x.fit.wants.length > 0 || x.fit.good.length > 0) && (
              <ul class="plain small">
                {__i18n_display(x.fit.wants.map((w) => (
                  <li key={w} class="minus">
                    {__i18n_display(w)}
                  </li>
                )))}
                {__i18n_display(x.fit.good.map((w) => (
                  <li key={w} class="plus">
                    {__i18n_display(w)}
                  </li>
                )))}
              </ul>
            ))}
          </div>
          <div class="row-actions">
            <button type="button" class="primary" disabled={!!problem} onClick={() => setOffer(form)}>
              {__i18n_display(offer ? __i18n_k("ui.faMarket.talkPanel.47876e77") : __i18n_k("ui.faMarket.talkPanel.e891de51"))}
            </button>
            {__i18n_display(offer && (
              <button type="button" onClick={() => setOffer(null)}>{__i18n_t("ui.faMarket.talkPanel.f2b6dba9")}</button>
            ))}
          </div>
          {__i18n_display(problem && <p class="notice warn small">{__i18n_display(problem)}</p>)}
          {__i18n_display(offer && (
            <p class="small muted">
              {__i18n_display(changed ? __i18n_k("ui.faMarket.talkPanel.550fc016") : __i18n_k("ui.faMarket.talkPanel.9f998c99"))}: {__i18n_display(termsText(offer))}
              {__i18n_display(offer.promises?.length ? __i18n_k("ui.faMarket.talkPanel.de6a7537", { value: offer.promises.map((k) => (k === 'starter' ? __i18n_k("ui.faMarket.talkPanel.4b64d20a") : __i18n_k("ui.faMarket.talkPanel.d48d5bda"))).join(', ') }) : '')}
              {__i18n_display(offer.prepaid ? __i18n_k("ui.faMarket.talkPanel.11a8ce64") : '')}
              {__i18n_display(offer.ceiling !== undefined ? __i18n_k("ui.faMarket.talkPanel.d9c1021e", { money: money(offer.ceiling) }) : '')}
            </p>
          ))}
        </>
      ))}
      {__i18n_display(t.notes.length > 0 && (
        <>
          <h4>{__i18n_t("ui.faMarket.talkPanel.832c46c4")}</h4>
          <ul class="fa-notes">
            {__i18n_display([...t.notes].reverse().map((n, i) => (
              <li key={i} class={n.tone ? `tone-${n.tone}` : ''}>
                <span class="muted small">{__i18n_display(faDate(m, n.day).slice(5).replace('-', '/'))}</span> {__i18n_display(n.text)}
              </li>
            )))}
          </ul>
        </>
      ))}
      {__i18n_display(open && t.from === me && !offer && <p class="small muted">{__i18n_t("ui.faMarket.talkPanel.28dd6ea6")}</p>)}
    </aside>
  );
}
