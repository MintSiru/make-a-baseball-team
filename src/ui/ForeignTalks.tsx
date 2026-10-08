import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
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
  if (!rows.length) return <p class="muted">{__i18n_t("ui.foreignTalks.foreignOffers.f40f6c09")}</p>;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table foreign-offers">
        <caption>{__i18n_t("ui.foreignTalks.foreignOffers.8ab04ae2")}</caption>
        <thead>
          <tr>
            <th>{__i18n_t("ui.foreignTalks.foreignOffers.c37450d6")}</th>
            <th class="num">{__i18n_t("ui.foreignTalks.foreignOffers.0aa20f27")}</th>
            <th class="num">{__i18n_t("ui.foreignTalks.foreignOffers.fd3e4a69")}</th>
            <th>{__i18n_t("ui.foreignTalks.foreignOffers.7c1430c8")}</th>
            <th>{__i18n_t("ui.foreignTalks.foreignOffers.62066cd8")}</th>
            <th>{__i18n_t("ui.foreignTalks.foreignOffers.3c7dbce6")}</th>
            <th class="num">{__i18n_t("ui.foreignTalks.foreignOffers.d0fde472")}</th>
            <th>{__i18n_t("ui.foreignTalks.foreignOffers.cf9b747a")}</th>
          </tr>
        </thead>
        <tbody>
          {__i18n_display(rows.map((id) => {
            const p = league.players[id]!;
            const t = terms[id]!;
            const offer = offerOf(league, id, t, choices);
            const cap = newSigningCap(p);
            const total = dealTotal(t, offer);
            return (
              <tr key={id}>
                <td>{__i18n_display(p.name)}</td>
                <td class="num">
                  {__i18n_display(usd(t.counter ?? t.ask))}
                  {__i18n_display(t.counter ? <span class="tag">{__i18n_t("ui.foreignTalks.foreignOffers.239c3bd1")}</span> : null)}
                </td>
                <td class="num">{__i18n_display(t.fee ? usd(t.fee) : '-')}</td>
                <td>{__i18n_display(t.rival ? t.rival.label : '-')}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    class="money-input"
                    aria-label={__i18n_displayText(__i18n_k("ui.foreignTalks.foreignOffers.3d1b66b0", { name: p.name }))}
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
                    aria-label={__i18n_displayText(__i18n_k("ui.foreignTalks.foreignOffers.c14104e0", { name: p.name }))}
                    value={choices[`o:${id}`] ?? toMan(offer.options)}
                    onInput={(e) => choose(`o:${id}`, (e.currentTarget as HTMLInputElement).value)}
                  />
                </td>
                <td class={`num ${total > cap ? 'minus' : ''}`}>
                  {__i18n_display(usd(total))} / {__i18n_display(usd(cap))}
                </td>
                <td>{__i18n_display(outlook(t, offer))}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
      <p class="muted small">{__i18n_t("ui.foreignTalks.foreignOffers.9ebbe9d0")}</p>
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
        <caption>{__i18n_t("ui.foreignTalks.renewOffers.2f510d1f")}</caption>
        <thead>
          <tr>
            <th>{__i18n_t("ui.foreignTalks.renewOffers.c37450d6")}</th>
            <th class="num">{__i18n_t("ui.foreignTalks.renewOffers.5a38f48b")}</th>
            <th>{__i18n_t("ui.foreignTalks.renewOffers.6ef251ee")}</th>
            <th>{__i18n_t("ui.foreignTalks.renewOffers.2622331e")}</th>
            <th>{__i18n_t("ui.foreignTalks.renewOffers.2c68f39f")}</th>
          </tr>
        </thead>
        <tbody>
          {__i18n_display(shown.map((r) => {
            const p = league.players[r.id]!;
            const loyalty = traitReport(league, p)?.reads.find((x) => x.key === 'loyalty');
            return (
              <tr key={r.id}>
                <td>
                  {__i18n_display(p.name)} <span class="muted small">{__i18n_t("ui.foreignTalks.renewOffers.8ff6b63f", { ageIn: ageIn(p, next) })}</span>
                </td>
                <td class="num">{__i18n_display(usd(r.ask))}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    class="money-input"
                    aria-label={__i18n_displayText(__i18n_k("ui.foreignTalks.renewOffers.6d9e359a", { name: p.name }))}
                    value={choices[`a:${r.id}`] ?? toMan(r.ask)}
                    onInput={(e) => choose(`a:${r.id}`, (e.currentTarget as HTMLInputElement).value)}
                  />
                </td>
                <td>
                  <select aria-label={__i18n_displayText(__i18n_k("ui.foreignTalks.renewOffers.2b11bcb2", { name: p.name }))} value={choices[`y:${r.id}`] ?? '1'} onChange={(e) => choose(`y:${r.id}`, (e.currentTarget as HTMLSelectElement).value)}>
                    <option value="1">{__i18n_t("ui.foreignTalks.renewOffers.495b63c7")}</option>
                    <option value="2">{__i18n_t("ui.foreignTalks.renewOffers.f093b9f1")}</option>
                  </select>
                </td>
                <td>{__i18n_display(loyalty?.text ? __i18n_k("ui.foreignTalks.renewOffers.9a0fd875", { text: loyalty.text, sure: loyalty.sure }) : __i18n_k("ui.foreignTalks.renewOffers.da8abd91"))}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
      <p class="muted small">{__i18n_t("ui.foreignTalks.renewOffers.fdc186b4")}</p>
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
