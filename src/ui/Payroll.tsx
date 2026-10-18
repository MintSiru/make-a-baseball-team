import { display as __i18n_display, displayText as __i18n_displayText, t as __i18n_t } from '../i18n/index';
/* 2.0.10 (the user's request, after OOTP's finances screen): our payroll in one table — pay this season and the
   seasons already signed, until when, service time and free agency, sortable by any column (payroll.ts). */
import { useMemo } from 'preact/hooks';
import { payrollOf } from '../league/payroll';
import type { LeagueState } from '../league/state';
import { money, moneyShort } from './format';
import { positionKey, useSort } from './sort';

export function Payroll({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const book = useMemo(() => payrollOf(league, u.teamId), [league]);
  const { sorted, th } = useSort(
    book.rows,
    {
      name: { value: (r) => r.name },
      pos: { value: (r) => positionKey(r.pos), first: 1 },
      age: { value: (r) => r.age, first: 1 },
      squad: { value: (r) => r.squad },
      kind: { value: (r) => r.kind },
      pay0: { value: (r) => r.pay[0]! },
      pay1: { value: (r) => r.pay[1]! },
      pay2: { value: (r) => r.pay[2]! },
      pay3: { value: (r) => r.pay[3]! },
      pay4: { value: (r) => r.pay[4]! },
      until: { value: (r) => r.until ?? 0, first: 1 },
      service: { value: (r) => r.service.seasons * 1000 + r.service.days },
      fa: { value: (r) => r.fa.year ?? 9999, first: 1 },
    },
    { key: 'pay0', dir: -1 },
  );
  const payKeys = ['pay0', 'pay1', 'pay2', 'pay3', 'pay4'] as const;
  return (
    <div class="payroll">
      <p class="muted">{__i18n_t('ui.payroll.text.e528b78e')}</p>
      {book.cap && (
        <p>
          {__i18n_t('ui.payroll.text.2a7e1be8', { season: book.seasons[0]!, total: money(book.cap.total, book.seasons[0]), cap: money(book.cap.cap, book.seasons[0]) })}
          {book.cap.floor !== null && __i18n_t('ui.payroll.text.e7c9e70c', { floor: money(book.cap.floor) })}{' '}
          <strong class={book.cap.total > book.cap.cap ? 'minus' : 'plus'}>
            {book.cap.total > book.cap.cap
              ? __i18n_t('ui.payroll.text.4a58680f', { n: money(book.cap.total - book.cap.cap) })
              : __i18n_t('ui.payroll.text.921fae13', { n: money(book.cap.cap - book.cap.total) })}
          </strong>
        </p>
      )}
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table payroll-table">
          <thead>
            <tr>
              {th('name', __i18n_t('ui.payroll.text.9aa18e50'))}
              {th('pos', __i18n_t('ui.payroll.text.81922a91'))}
              {th('age', __i18n_t('ui.payroll.text.6c620e5c'), true)}
              {th('squad', __i18n_t('ui.payroll.text.5d24a2fc'))}
              {th('kind', __i18n_t('ui.payroll.text.b4116369'))}
              {book.seasons.map((y, i) => th(payKeys[i]!, String(y), true))}
              {th('until', __i18n_t('ui.payroll.text.378cea54'), true)}
              {th('service', __i18n_t('ui.payroll.text.f64694ca'), true)}
              {th('fa', __i18n_t('ui.payroll.text.eb55a24f'), true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} class="player-row">
                <td>
                  <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                    {r.name}
                  </button>
                </td>
                <td>{__i18n_display(r.pos)}</td>
                <td class="num">{r.age}</td>
                <td>{__i18n_display(r.squad)}</td>
                <td>{__i18n_display(r.kind)}</td>
                {r.pay.map((x, i) => (
                  <td key={i} class={`num${x ? '' : ' muted'}`}>
                    {x ? moneyShort(x, book.seasons[i]) : '-'}
                  </td>
                ))}
                <td class="num">{r.until ?? '-'}</td>
                <td class="num">{r.foreign ? '-' : __i18n_t('ui.payroll.text.ed5fa245', { seasons: r.service.seasons, days: r.service.days })}</td>
                <td class="num" title={__i18n_displayText(r.fa.text)}>
                  {r.fa.year ?? __i18n_display(r.fa.short)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>
                <strong>{__i18n_t('ui.payroll.text.9f794f1d', { n: book.rows.length })}</strong>
              </td>
              {book.totals.map((x, i) => (
                <td key={i} class="num strong">
                  {moneyShort(x, book.seasons[i])}
                </td>
              ))}
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
