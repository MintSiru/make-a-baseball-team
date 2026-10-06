/* Foreign player talks on the decision screen (1.3.0): what we offer each new signing (guaranteed money and options,
   his club's fee on top, the scouts' read of his answer), and the figure and years for each player we re-sign. Offers
   are kept as text in the decision's choices ("g:<id>", "o:<id>" in 만 달러; "a:<id>", "y:<id>" for re-signings). */
import { newSigningCap } from '../league/expansion';
import { usd } from '../league/foreign';
import { dealTotal, outlook, suggestedOffer, type ForeignOffer, type ForeignTerms } from '../league/foreigntalks';
import { traitReport } from '../league/reports';
import type { LeagueState } from '../league/state';
import { ageIn } from '../league/players';
import type { PlayerId } from '../model/types';

const MAN = 10_000;
const toMan = (n: number) => String(Math.round(n / MAN));

/** Our offer to a candidate: what the screen holds, or his ask within the cap. */
export function offerOf(league: LeagueState, id: PlayerId, t: ForeignTerms, choices: Record<string, string>): ForeignOffer {
  const p = league.players[id]!;
  const base = suggestedOffer(t, newSigningCap(p));
  const g = choices[`g:${id}`],
    o = choices[`o:${id}`];
  return { guaranteed: g !== undefined && g !== '' ? Number(g) * MAN : base.guaranteed, options: o !== undefined && o !== '' ? Number(o) * MAN : base.options };
}

/** The offers for the players picked (only those in talks). */
export const offersFor = (league: LeagueState, ids: PlayerId[], terms: Record<PlayerId, ForeignTerms> | undefined, choices: Record<string, string>) =>
  terms ? Object.fromEntries(ids.filter((id) => terms[id]).map((id) => [id, offerOf(league, id, terms[id]!, choices)])) : undefined;

export function ForeignOffers({
  league,
  ids,
  terms,
  choices,
  choose,
}: {
  league: LeagueState;
  ids: PlayerId[];
  terms: Record<PlayerId, ForeignTerms>;
  choices: Record<string, string>;
  choose: (key: string, value: string) => void;
}) {
  const rows = ids.filter((id) => terms[id]);
  if (!rows.length) return <p class="muted">계약할 선수를 고르면 여기서 제안 조건을 정합니다.</p>;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table foreign-offers">
        <caption>제안 조건 (만 달러)</caption>
        <thead>
          <tr>
            <th>선수</th>
            <th class="num">희망 보장액</th>
            <th class="num">이적료</th>
            <th>다른 제안</th>
            <th>보장 (계약금+연봉)</th>
            <th>옵션</th>
            <th class="num">총액 / 상한</th>
            <th>스카우트 예상</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((id) => {
            const p = league.players[id]!;
            const t = terms[id]!;
            const offer = offerOf(league, id, t, choices);
            const cap = newSigningCap(p);
            const total = dealTotal(t, offer);
            return (
              <tr key={id}>
                <td>{p.name}</td>
                <td class="num">
                  {usd(t.counter ?? t.ask)}
                  {t.counter ? <span class="tag">역제안</span> : null}
                </td>
                <td class="num">{t.fee ? usd(t.fee) : '-'}</td>
                <td>{t.rival ? t.rival.label : '-'}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    class="money-input"
                    aria-label={`${p.name} 보장액 (만 달러)`}
                    value={choices[`g:${id}`] ?? toMan(offer.guaranteed)}
                    onInput={(e) => choose(`g:${id}`, (e.currentTarget as HTMLInputElement).value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    class="money-input"
                    aria-label={`${p.name} 옵션 (만 달러)`}
                    value={choices[`o:${id}`] ?? toMan(offer.options)}
                    onInput={(e) => choose(`o:${id}`, (e.currentTarget as HTMLInputElement).value)}
                  />
                </td>
                <td class={`num ${total > cap ? 'minus' : ''}`}>
                  {usd(total)} / {usd(cap)}
                </td>
                <td>{outlook(t, offer)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="muted small">
        보장액(계약금·연봉)과 옵션(좋은 시즌 뒤 지급)을 정해 제안합니다. 선수는 옵션 1달러를 보장 0.5달러쯤으로 칩니다. 이적료는 원소속 구단에 주는 돈으로 상한(총액)에 들어가고 구단 자금에서 나갑니다. 다른 곳의 제안이
        더 좋으면 그만큼 받아야 옵니다. 선수는 받아들이거나, 역제안하거나, 협상을 끝냅니다 — 최대 3차까지, 그 사이 다른 리그로 가는 선수도 있습니다. 스카우트 예상은 어림입니다.
      </p>
    </div>
  );
}

/** Re-signing our own: a figure and the years, with the coaches' read of how attached he is to us. */
export function RenewOffers({
  league,
  rows,
  ids,
  choices,
  choose,
}: {
  league: LeagueState;
  rows: { id: PlayerId; ask: number }[];
  ids: PlayerId[];
  choices: Record<string, string>;
  choose: (key: string, value: string) => void;
}) {
  const shown = rows.filter((r) => ids.includes(r.id));
  if (!shown.length) return null;
  const next = (league.offseason?.year ?? league.year) + 1;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table foreign-offers">
        <caption>재계약 조건 (만 달러, 한 시즌)</caption>
        <thead>
          <tr>
            <th>선수</th>
            <th class="num">요구액</th>
            <th>제안</th>
            <th>기간</th>
            <th>구단 애정 (코치 평가)</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const p = league.players[r.id]!;
            const loyalty = traitReport(league, p)?.reads.find((x) => x.key === 'loyalty');
            return (
              <tr key={r.id}>
                <td>
                  {p.name} <span class="muted small">만 {ageIn(p, next)}세</span>
                </td>
                <td class="num">{usd(r.ask)}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    class="money-input"
                    aria-label={`${p.name} 재계약 제안 (만 달러)`}
                    value={choices[`a:${r.id}`] ?? toMan(r.ask)}
                    onInput={(e) => choose(`a:${r.id}`, (e.currentTarget as HTMLInputElement).value)}
                  />
                </td>
                <td>
                  <select aria-label={`${p.name} 계약 기간`} value={choices[`y:${r.id}`] ?? '1'} onChange={(e) => choose(`y:${r.id}`, (e.currentTarget as HTMLSelectElement).value)}>
                    <option value="1">1년</option>
                    <option value="2">2년</option>
                  </select>
                </td>
                <td>{loyalty?.text ? `${loyalty.text} · 확신 ${loyalty.sure}` : '파악 못 함'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="muted small">
        요구액 그대로 1년이면 반드시 남습니다. 깎아서 제안하면 구단에 대한 애정이 큰 선수일수록 받아들이고, 거절하면 떠납니다. 2년 계약은 31세 이상이 반기고 젊은 선수는 조금 더 받아야 합니다.
      </p>
    </div>
  );
}

/** The re-signing offers from the screen's choices (only those changed from the ask for one year). */
export function renewOffersFor(rows: { id: PlayerId; ask: number }[], ids: PlayerId[], choices: Record<string, string>) {
  const out: Record<PlayerId, { amount: number; years: 1 | 2 }> = {};
  for (const r of rows) {
    if (!ids.includes(r.id)) continue;
    const a = choices[`a:${r.id}`],
      y = choices[`y:${r.id}`];
    const amount = a !== undefined && a !== '' ? Number(a) * MAN : r.ask;
    const years = y === '2' ? 2 : 1;
    if (amount !== r.ask || years !== 1) out[r.id] = { amount, years };
  }
  return out;
}
