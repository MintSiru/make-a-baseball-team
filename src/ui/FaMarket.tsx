/* The free-agent market (V0.8): the winter's free agents, what each wants, and talks with one at a time. The
   club makes or changes offers (bonus, salary, incentives, a period option, promises), then lets the days run:
   to the next round, until one of its talks has news, or to the end of the market. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { autoDecision, checkDecision, type DecisionInput } from '../league/expansion';
import {
  budgetUse,
  capHit,
  capRoomFor,
  faDate,
  guaranteed,
  maxGuaranteed,
  meetTerms,
  offerTotal,
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
import { positionLabel, shortName } from '../league/views';
import type { FaPromise, PlayerId } from '../model/types';
import { salaryCapFor } from '../rules/kbo2026';
import { money, moneyShort, parseEok } from './format';
import { gradeClass } from './grades';

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
      return `${d.min}년 이상 보장`;
    case 'bonus':
      return `계약금 ${Math.round(d.share * 100)}% 이상`;
    case 'starter':
      return '주전 보장';
    case 'reinforce':
      return `${spotLabel(d.spot)} 보강`;
    case 'contender':
      return '우승 전력';
    case 'hometown':
      return `고향 팀 (${d.region})`;
    case 'optOut':
      return '옵트아웃';
  }
}

const EXTRAS: [string, string][] = [
  ['', '없음'],
  ['club-1', '+1년 구단 옵션'],
  ['club-2', '+2년 구단 옵션'],
  ['player-1', '+1년 선수 옵션 (옵트아웃)'],
  ['player-2', '+2년 선수 옵션 (옵트아웃)'],
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
  if (t.signed) return t.signed.teamId === t.from ? `잔류 (${moneyShort(offerTotal(t.signed.offer))})` : `→ ${shortName(league, t.signed.teamId)} (${moneyShort(offerTotal(t.signed.offer))})`;
  if (t.gone) return '은퇴';
  if (t.decideOn !== undefined) return `고민 중 · ${decideDate(m, t)} 결정`;
  const n = Object.keys(t.offers).filter((id) => id !== league.user!.teamId).length;
  return n ? `제안 ${n}곳` : '관망';
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
  const input = (run: 'round' | 'news' | 'close'): DecisionInput => ({ kind: 'faRound', offers: drafts, run });
  const problem = checkDecision(league, input('round'));

  // What the open offers commit: next season's payroll budget (bonuses spread over the deals) and the salary cap.
  const mine: Record<PlayerId, FaOffer> = {};
  for (const t of talks) {
    const o = current(t.id);
    if (o && !t.signed && !t.gone) mine[t.id] = o;
  }
  const c = openCommitments(league, m, mine).budget;
  const base = payrollBeforeOffers(league, m, next);
  const cap = salaryCapFor(next);
  const capNow = cap - capRoomFor(league, me, next, new Set(talks.filter((t) => !t.signed && !t.gone).map((t) => t.id)));
  const capAdd = Object.values(mine).reduce((a, o) => a + capHit(o), 0);
  const outside = Object.keys(mine).filter((id) => m.talks[id]!.from !== me).length;
  const room = m.userLimit - (m.signedOut[me] ?? 0);
  const nextDay = FA.rounds[m.round + 1];

  const shown = talks.filter((t) => (filter === 'open' ? !t.signed && !t.gone : filter === 'mine' ? t.from === me || !!current(t.id) || t.signed?.teamId === me : true));
  const selected = sel ? m.talks[sel] : undefined;

  return (
    <section class="decision fa-market" aria-labelledby="decision-title">
      <h2 id="decision-title">
        FA 시장 · {Number(d.date.slice(5, 7))}월 {Number(d.date.slice(8))}일 <span class="muted small">({m.round + 1}/{FA.rounds.length} 라운드)</span>
      </h2>
      <dl class="fa-summary">
        <div>
          <dt>외부 영입</dt>
          <dd>
            제안 {outside} / 남은 자리 {Math.max(0, room)}명{m.userFree ? ' (보상 없음, 신생구단 특례)' : ''}
          </dd>
        </div>
        <div>
          <dt>{next} 연봉 예산</dt>
          <dd class={base + c > u.payrollBudget ? 'minus' : ''} title="연봉과 FA 계약금(계약 기간에 나눈 몫)">
            {moneyShort(base)} + 제안 {eokOrZero(c)} / {moneyShort(u.payrollBudget)}
          </dd>
        </div>
        <div>
          <dt>{next} 샐러리캡</dt>
          <dd class={capNow + capAdd > cap ? 'minus' : ''}>
            {moneyShort(Math.round(capNow + capAdd))} / {moneyShort(cap)}
          </dd>
        </div>
      </dl>
      {m.gift && !m.talks[m.gift.id]!.signed && (
        <p class="notice good">
          <strong>모기업 지원</strong>: {league.players[m.gift.id]!.name} 영입 비용을 보장액 {money(m.gift.total)}까지 모기업이 냅니다 (자금·연봉 예산 밖).{' '}
          <button type="button" class="link" onClick={() => setSel(m.gift!.id)}>
            협상하기
          </button>
        </p>
      )}

      <div class="fa-grid">
        <div class="fa-list">
          <div class="segmented" role="group" aria-label="FA 목록 보기">
            {(
              [
                ['all', `전체 ${talks.length}`],
                ['open', '협상 중'],
                ['mine', '우리 관련'],
              ] as const
            ).map(([k, label]) => (
              <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
          <div class="table-wrap">
            <table class="record-table fa-table">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>포지션</th>
                  <th class="num">나이</th>
                  <th>등급</th>
                  <th class="num">WAR</th>
                  <th class="num">시장가</th>
                  <th>상태</th>
                  <th>우리 제안</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const p = league.players[t.id]!;
                  const o = current(t.id);
                  const open = !t.signed && !t.gone;
                  const x = o && open ? reaction(league, m, t, o, next) : null;
                  return (
                    <tr key={t.id} class={`player-row${sel === t.id ? ' selected' : ''}`} aria-selected={sel === t.id}>
                      <td>
                        <button type="button" class="link" onClick={() => setSel(t.id)}>
                          {p.name}
                        </button>
                        {t.from === me && <span class="tag">우리 FA</span>}
                        {m.gift?.id === t.id && <span class="tag">모기업</span>}
                      </td>
                      <td>
                        {positionLabel(p)} <span class="muted small">{shortName(league, t.from)}</span>
                      </td>
                      <td class="num">{ageIn(p, next)}</td>
                      <td>{t.free ? '보상 없음' : t.grade}</td>
                      <td class="num">{lastWar(league, t.id)?.toFixed(1) ?? '-'}</td>
                      <td class="num">{moneyShort(offerTotal(t.price))}</td>
                      <td class={t.signed?.teamId === me ? 'plus' : t.signed && t.from === me ? 'minus' : ''}>{status(league, m, t)}</td>
                      <td class={x ? `fa-band ${x.band}` : 'muted'}>
                        {x ? x.label : o && t.signed?.teamId === me ? '계약' : '-'}
                        {x && o?.ceiling !== undefined && <span class="muted small"> · 상한 {moneyShort(o.ceiling)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {selected && (
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
        )}
      </div>

      <h3>시장 소식</h3>
      <ul class="fa-news">
        {[...m.news]
          .reverse()
          .slice(0, 10)
          .map((n, i) => (
            <li key={i} class={n.mine ? 'mine' : ''}>
              <span class="muted small">{faDate(m, n.day).slice(5).replace('-', '/')}</span> {n.text}
            </li>
          ))}
        {!m.news.length && <li class="muted">아직 계약 소식이 없습니다.</li>}
      </ul>

      <div class="actions">
        <button type="button" class="primary" disabled={!!problem} onClick={() => onSubmit(input('round'))}>
          {nextDay !== undefined ? `다음 라운드 (${faDate(m, nextDay).slice(5).replace('-', '/')})` : '마지막 날 (남은 선수 모두 결정)'}
        </button>
        <button type="button" disabled={!!problem} onClick={() => onSubmit(input('news'))} title="우리가 협상하는 선수가 결정하거나 고민을 시작할 때까지 진행">
          소식이 올 때까지
        </button>
        <button type="button" disabled={!!problem} onClick={() => onSubmit(input('close'))}>
          시장 끝까지
        </button>
        <button
          type="button"
          onClick={() => {
            const a = autoDecision(league);
            if (a && a.kind === 'faRound') setDrafts((prev) => ({ ...prev, ...a.offers }));
          }}
        >
          스카우트 추천 (우리 FA 붙잡기, 15%까지 자동 증액)
        </button>
        {problem && <span class="notice inline">{problem}</span>}
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
        {label}
        {hint && <span class="muted small"> {hint}</span>}
      </span>
      <span class="money-stepper">
        <button type="button" aria-label={`${label} ${step}억 줄이기`} onClick={() => bump(-step)}>
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          aria-label={label}
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
        <button type="button" aria-label={`${label} ${step}억 늘리기`} onClick={() => bump(step)}>
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
  return (
    <aside class="fa-talk" aria-label={`${p.name} 협상`}>
      <h3>
        <button type="button" class="link" onClick={() => onPlayer(p.id)}>
          {p.name}
        </button>{' '}
        <span class="muted small">
          {positionLabel(p)} · {ageIn(p, next)}세 · {shortName(league, t.from)} · {t.free ? '보상 없음' : `${t.grade}등급`}
        </span>
      </h3>
      <p class="small">
        <span class={gradeClass(p.scouting.current)}>현재 {p.scouting.current}</span> · 최근 WAR {lastWar(league, t.id)?.toFixed(1) ?? '-'} · 시장가 {termsText(t.price)}
      </p>
      <p class="small">
        요구: {t.demands.length ? t.demands.map(demandText).join(' · ') : '조건보다 돈'} · 다른 구단 제안 {others}곳
        {t.decideOn !== undefined && ` · ${decideDate(m, t)}까지 고민`}
      </p>

      {t.signed ? (
        <p class={`notice ${t.signed.teamId === me ? 'good' : ''}`}>
          {t.signed.teamId === me ? '우리와 계약했습니다' : `${wagwa(shortName(league, t.signed.teamId))} 계약했습니다`}: {termsText(t.signed.offer)}
        </p>
      ) : t.gone ? (
        <p class="notice">새 팀을 찾지 못하고 은퇴했습니다.</p>
      ) : (
        <>
          <div class="quick-offers" role="group" aria-label="빠른 제안">
            <button type="button" onClick={() => shape(meetTerms(league, m, t, next))} title="지금 받아들일 만한 최소 수준">
              요구 수준
            </button>
            <button type="button" onClick={() => shape(winTerms(league, m, t, next))} title="다른 구단 제안보다 좋고, 고민 없이 바로 사인할 수준">
              바로 사인 수준
            </button>
            <button type="button" onClick={() => shape(scaleOffer(form, guaranteed(form) * 1.05, next))}>
              +5%
            </button>
            <button type="button" onClick={() => shape(scaleOffer(form, guaranteed(form) * 1.1, next))}>
              +10%
            </button>
            <button type="button" disabled={most < 1000} onClick={() => shape(scaleOffer(form, most, next))} title="연봉 예산(일시불이면 구단 자금)이 허락하는 최대">
              예산 안 최대
            </button>
          </div>
          <div class="fa-offer" role="group" aria-label="제안 조건">
            <label>
              보장 기간
              <select value={form.years} onChange={(e) => set({ years: Number((e.currentTarget as HTMLSelectElement).value) })}>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </label>
            <MoneyField label="계약금 (억)" value={form.bonus} step={1} onChange={(v) => set({ bonus: v })} />
            <MoneyField label="연봉 (억, 매년)" value={form.annual} step={0.5} onChange={(v) => set({ annual: v })} />
            <MoneyField label="옵션 총액 (억)" value={form.options} step={1} onChange={(v) => set({ options: v })} />
            <label>
              기간 옵션
              <select value={extraKey(form)} onChange={(e) => set({ extra: extraOf((e.currentTarget as HTMLSelectElement).value) })}>
                {EXTRAS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {promisable.map((dd) => (
              <label key={dd.kind} class="check">
                <input
                  type="checkbox"
                  checked={!!form.promises?.includes(dd.kind)}
                  onChange={(e) => {
                    const on = (e.currentTarget as HTMLInputElement).checked;
                    const promises = (form.promises ?? []).filter((k) => k !== dd.kind);
                    set({ promises: on ? [...promises, dd.kind] : promises });
                  }}
                />{' '}
                {dd.kind === 'starter' ? '주전 보장 약속' : `${spotLabel(dd.spot)} 보강 약속 (개막 전까지)`}
              </label>
            ))}
            <label class="check">
              <input type="checkbox" checked={!!form.prepaid} onChange={(e) => set({ prepaid: (e.currentTarget as HTMLInputElement).checked || undefined })} /> 계약금을 구단 자금에서 일시불로 (연봉 예산에서 빠짐 · 쓸 수 있는 자금 {moneyShort(Math.max(0, fundLeft))})
            </label>
            <label class="check">
              <input
                type="checkbox"
                checked={form.ceiling !== undefined}
                onChange={(e) => {
                  const on = (e.currentTarget as HTMLInputElement).checked;
                  set({ ceiling: on ? Math.max(guaranteed(form), Math.min(Math.round((guaranteed(form) * 1.2) / 1000) * 1000, most)) : undefined });
                }}
              />{' '}
              자동 증액: 경쟁 제안이 오거나 요구에 못 미치면 상한까지 알아서 올리기
            </label>
            {form.ceiling !== undefined && (
              <MoneyField label="상한 (보장액, 억)" hint={`예산 안 최대 ${moneyShort(most)}`} value={form.ceiling} step={5} onChange={(v) => set({ ceiling: v })} />
            )}
          </div>
          <p class="small">
            총액 {money(offerTotal(form))} (보장 {money(guaranteed(form))}) · 계약금 비중 {Math.round((form.bonus / Math.max(1, guaranteed(form))) * 100)}% · 연봉 예산 연{' '}
            {moneyShort(budgetUse(form))} / 남은 예산 {moneyShort(Math.max(0, budgetLeft))} · 샐러리캡 연 {moneyShort(Math.round(capHit(form)))}
          </p>
          <div class={`fa-reaction ${x.band}`}>
            <div class="fa-meter" aria-hidden="true">
              <span style={{ width: `${meter * 100}%` }} />
              <i style={{ left: `${(1 / 1.3) * 100}%` }} />
            </div>
            <strong>{x.label}</strong> <span class="muted small">(스카우트 판단: 지금 요구 수준의 약 {Math.round(x.ratio * 20) * 5}%)</span>
            {x.behind !== undefined && (
              <p class="small minus">
                다른 구단 제안이 더 좋다고 합니다 (가치로 약 {Math.max(1, Math.round(x.behind * 100))}% 차이). 이기려면 보장 약 {money(Math.ceil((guaranteed(form) * (1 + x.behind) * 1.02) / 1000) * 1000)} 이상이 필요합니다.
              </p>
            )}
            {(x.fit.wants.length > 0 || x.fit.good.length > 0) && (
              <ul class="plain small">
                {x.fit.wants.map((w) => (
                  <li key={w} class="minus">
                    {w}
                  </li>
                ))}
                {x.fit.good.map((w) => (
                  <li key={w} class="plus">
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div class="row-actions">
            <button type="button" class="primary" disabled={!!problem} onClick={() => setOffer(form)}>
              {offer ? '제안 고치기' : '제안 넣기'}
            </button>
            {offer && (
              <button type="button" onClick={() => setOffer(null)}>
                제안 철회
              </button>
            )}
          </div>
          {problem && <p class="notice warn small">{problem}</p>}
          {offer && (
            <p class="small muted">
              {changed ? '다음 라운드로 넘길 때 보낼 제안' : '지금 걸려 있는 제안'}: {termsText(offer)}
              {offer.promises?.length ? ` · 약속: ${offer.promises.map((k) => (k === 'starter' ? '주전' : '보강')).join(', ')}` : ''}
              {offer.prepaid ? ' · 계약금 일시불' : ''}
              {offer.ceiling !== undefined ? ` · 자동 증액 상한 ${money(offer.ceiling)}` : ''}
            </p>
          )}
        </>
      )}
      {t.notes.length > 0 && (
        <>
          <h4>협상 기록</h4>
          <ul class="fa-notes">
            {[...t.notes].reverse().map((n, i) => (
              <li key={i} class={n.tone ? `tone-${n.tone}` : ''}>
                <span class="muted small">{faDate(m, n.day).slice(5).replace('-', '/')}</span> {n.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {open && t.from === me && !offer && <p class="small muted">우리 FA입니다. 제안하지 않으면 다른 구단과 계약하거나 시장이 끝날 때 은퇴할 수 있습니다.</p>}
    </aside>
  );
}
