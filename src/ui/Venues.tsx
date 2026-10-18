import { display as __i18n_display, t as __i18n_t } from '../i18n/index';
/* 2.0.15 (the user's request): a player's record at home and on the road and at each ballpark — this season and his
   career (from 2.0.15 on). */
import type { Split } from '../league/engine/types';
import type { LeagueState } from '../league/state';
import { addVenues, emptyVenues, parkName, type VenueLine, type VenuePit, type Venues } from '../league/venues';

const fmt3 = (x: number) => x.toFixed(3).replace(/^0/, '');

function Rows({ league, v, pitcher }: { league: LeagueState; v: Venues; pitcher: boolean }) {
  const rows: [string, VenueLine][] = [
    [__i18n_t('ui.venues.text.13a46f96'), v.home],
    [__i18n_t('ui.venues.text.ef6b033f'), v.away],
    ...Object.entries(v.parks)
      .sort(([, a], [, b]) => (pitcher ? (b.pit?.outs ?? 0) - (a.pit?.outs ?? 0) : (b.bat?.pa ?? 0) - (a.bat?.pa ?? 0)))
      .map(([id, x]) => [parkName(league, id), x] as [string, VenueLine]),
  ];
  const bat = (b?: Split) =>
    b?.pa ? (
      <>
        <td class="num">{b.pa}</td>
        <td class="num">{b.h}</td>
        <td class="num">{b.hr}</td>
        <td class="num">{b.ab ? fmt3(b.h / b.ab) : '-'}</td>
        <td class="num">{fmt3((b.h + b.bb + b.hbp) / Math.max(1, b.ab + b.bb + b.hbp + b.sf))}</td>
        <td class="num">{b.ab ? fmt3(b.tb / b.ab) : '-'}</td>
        <td class="num strong">{fmt3((b.h + b.bb + b.hbp) / Math.max(1, b.ab + b.bb + b.hbp + b.sf) + (b.ab ? b.tb / b.ab : 0))}</td>
      </>
    ) : (
      <td colSpan={7} class="muted">
        -
      </td>
    );
  const pit = (q?: VenuePit) =>
    q?.outs ? (
      <>
        <td class="num">{`${Math.floor(q.outs / 3)}${q.outs % 3 ? `.${q.outs % 3}` : ''}`}</td>
        <td class="num">{q.h}</td>
        <td class="num">{q.hr}</td>
        <td class="num">{q.bb}</td>
        <td class="num">{q.k}</td>
        <td class="num strong">{((27 * q.er) / q.outs).toFixed(2)}</td>
        <td class="num">{((3 * (q.h + q.bb)) / q.outs).toFixed(2)}</td>
      </>
    ) : (
      <td colSpan={7} class="muted">
        -
      </td>
    );
  return (
    <tbody>
      {rows
        .filter(([, x], i) => i < 2 || (pitcher ? x.pit?.outs : x.bat?.pa))
        .map(([label, x], i) => (
          <tr key={`${label}-${i}`} class={i === 1 ? 'venue-split-end' : undefined}>
            <th scope="row">{__i18n_display(label)}</th>
            {pitcher ? pit(x.pit) : bat(x.bat)}
          </tr>
        ))}
    </tbody>
  );
}

export function VenueTable({ league, id, pitcher }: { league: LeagueState; id: string; pitcher: boolean }) {
  const p = league.players[id];
  if (!p) return null;
  const line = league.lines[id];
  const closed = p.career.some((c) => c.year === league.year && !c.level);
  const season = !closed ? line?.venues : undefined;
  const career = emptyVenues();
  if (p.venues) addVenues(career, p.venues);
  if (season) addVenues(career, season);
  const head = pitcher
    ? [
        __i18n_t('ui.venues.text.639a1f2f'),
        __i18n_t('ui.venues.text.b68b86a7'),
        __i18n_t('ui.venues.text.bf21ab80'),
        __i18n_t('ui.venues.text.21e0537f'),
        __i18n_t('ui.venues.text.3f349ed1'),
        'ERA',
        'WHIP',
      ]
    : [
        __i18n_t('ui.venues.text.0a3d002c'),
        __i18n_t('ui.venues.text.1822db88'),
        __i18n_t('ui.venues.text.9162d3a3'),
        __i18n_t('ui.venues.text.1eb19e0a'),
        __i18n_t('ui.venues.text.bb6ef1b2'),
        __i18n_t('ui.venues.text.7e66b88d'),
        'OPS',
      ];
  const table = (title: string, v: Venues | undefined) => (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table venues">
        <caption>{__i18n_display(title)}</caption>
        <thead>
          <tr>
            <th scope="col">{__i18n_t('ui.venues.text.af2feed6')}</th>
            {head.map((h) => (
              <th key={h} scope="col" class="num">
                {__i18n_display(h)}
              </th>
            ))}
          </tr>
        </thead>
        {v ? (
          <Rows league={league} v={v} pitcher={pitcher} />
        ) : (
          <tbody>
            <tr>
              <td colSpan={8} class="muted">
                {__i18n_t('ui.venues.text.626ced4e')}
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
  return (
    <>
      {table(__i18n_t('ui.venues.text.de766445', { year: league.year }), season)}
      {table(__i18n_t('ui.venues.text.fc7fa3d0'), p.venues || season ? career : undefined)}
      <p class="muted small">{__i18n_t('ui.venues.text.a3ffc7b4')}</p>
    </>
  );
}
