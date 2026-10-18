import { display as __i18n_display, t as __i18n_t } from '../i18n/index';
/* 2.0.11 (the user's request): a player's lines for the national team, event by event, with his totals. */
import { finishText } from '../league/international';
import { nationalLinesOf } from '../league/nationalgames';
import { addInto, emptyBat, emptyPit, type LeagueState } from '../league/state';
import { rates } from '../league/views';

export function NationalLines({ league, id, pitcher }: { league: LeagueState; id: string; pitcher: boolean }) {
  const rows = nationalLinesOf(league, id);
  if (!rows.length) return <p class="muted">{__i18n_t('ui.nationalLines.text.bd86da0e')}</p>;
  const result = (r: (typeof rows)[number]) => (r.finish ? __i18n_display(finishText({ kind: r.kind ?? 'asianGames' }, r.finish)) : '-');
  if (pitcher) {
    const t = emptyPit();
    for (const r of rows) if (r.line.pit) addInto(t, r.line.pit);
    const cells = (q: ReturnType<typeof emptyPit>) => (
      <>
        <td class="num">{q.g}</td>
        <td class="num">{q.w}</td>
        <td class="num">{q.l}</td>
        <td class="num">{q.sv}</td>
        <td class="num">{rates.ip(q.outs)}</td>
        <td class="num">{q.k}</td>
        <td class="num">{q.bb}</td>
        <td class="num strong">{q.outs ? rates.era(q).toFixed(2) : '-'}</td>
      </>
    );
    return (
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career national-lines">
          <thead>
            <tr>
              <th class="num">{__i18n_t('ui.nationalLines.text.d5bc99dd')}</th>
              <th>{__i18n_t('ui.nationalLines.text.042b946b')}</th>
              <th>{__i18n_t('ui.nationalLines.text.d3bb3576')}</th>
              <th class="num">{__i18n_t('ui.nationalLines.text.e0cee61a')}</th>
              <th class="num">{__i18n_t('ui.nationalLines.text.3b1908b7')}</th>
              <th class="num">{__i18n_t('ui.nationalLines.text.36260e2c')}</th>
              <th class="num">{__i18n_t('ui.nationalLines.text.a3fa83d2')}</th>
              <th class="num">{__i18n_t('ui.nationalLines.text.639a1f2f')}</th>
              <th class="num">{__i18n_t('ui.nationalLines.text.3f349ed1')}</th>
              <th class="num">{__i18n_t('ui.nationalLines.text.21e0537f')}</th>
              <th class="num">ERA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td class="num">{r.year}</td>
                <td>{__i18n_display(r.name)}</td>
                <td>{result(r)}</td>
                {r.line.pit ? (
                  cells(r.line.pit)
                ) : (
                  <td colSpan={8} class="muted">
                    {__i18n_t('ui.nationalLines.text.56c06a59')}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                <strong>{__i18n_t('ui.nationalLines.text.8856852b', { n: rows.length })}</strong>
              </td>
              {cells(t)}
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }
  const t = emptyBat();
  for (const r of rows) if (r.line.bat) addInto(t, r.line.bat);
  const cells = (b: ReturnType<typeof emptyBat>) => (
    <>
      <td class="num">{b.g}</td>
      <td class="num">{b.pa}</td>
      <td class="num">{b.h}</td>
      <td class="num">{b.ab ? rates.fmt3(rates.avg(b)) : '-'}</td>
      <td class="num">{b.hr}</td>
      <td class="num">{b.rbi}</td>
      <td class="num">{b.sb}</td>
      <td class="num strong">{b.pa ? rates.fmt3(rates.ops(b)) : '-'}</td>
    </>
  );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table career national-lines">
        <thead>
          <tr>
            <th class="num">{__i18n_t('ui.nationalLines.text.d5bc99dd')}</th>
            <th>{__i18n_t('ui.nationalLines.text.042b946b')}</th>
            <th>{__i18n_t('ui.nationalLines.text.d3bb3576')}</th>
            <th class="num">{__i18n_t('ui.nationalLines.text.e0cee61a')}</th>
            <th class="num">{__i18n_t('ui.nationalLines.text.0a3d002c')}</th>
            <th class="num">{__i18n_t('ui.nationalLines.text.1822db88')}</th>
            <th class="num">{__i18n_t('ui.nationalLines.text.1eb19e0a')}</th>
            <th class="num">{__i18n_t('ui.nationalLines.text.9162d3a3')}</th>
            <th class="num">{__i18n_t('ui.nationalLines.text.fed1c588')}</th>
            <th class="num">{__i18n_t('ui.nationalLines.text.91e54831')}</th>
            <th class="num">OPS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td class="num">{r.year}</td>
              <td>{__i18n_display(r.name)}</td>
              <td>{result(r)}</td>
              {r.line.bat ? (
                cells(r.line.bat)
              ) : (
                <td colSpan={8} class="muted">
                  {__i18n_t('ui.nationalLines.text.6461e185')}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              <strong>{__i18n_t('ui.nationalLines.text.8856852b', { n: rows.length })}</strong>
            </td>
            {cells(t)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
