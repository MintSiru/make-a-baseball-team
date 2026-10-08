import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Training abroad (V0.10): the four centres, sending a player, and who went where and what came of it. */
import { useMemo, useState } from 'preact/hooks';
import { TOOL_LABELS, type ToolKey } from '../draftroom';
import type { Action } from '../league/actions';
import { ageIn, isPitcher } from '../league/players';
import { orgPlayers, type LeagueState, type SiteId } from '../league/state';
import { checkTrip, lastStartText, SITE_IDS, SITES, tripDates, tripSeason } from '../league/training';
import { TRAINING } from '../league/tuning';
import { positionLabel } from '../league/views';
import { money } from './format';

const focusText = (keys: ToolKey[] | undefined) => (keys ?? []).map((k) => TOOL_LABELS[k] ?? k).join('·');

export function Training({ league, onAct, onPlayer }: { league: LeagueState; onAct: (a: Action) => void; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const [site, setSite] = useState<SiteId>('tokyo');
  const [pick, setPick] = useState('');
  const when = tripSeason(league);
  const S = SITES[site];
  const year = when?.season ?? league.year;
  const fits = useMemo(
    () =>
      orgPlayers(league, u.teamId)
        .filter((p) => p.status === 'active' && p.origin.kind !== 'foreign' && (S.who === 'all' || (S.who === 'pitcher') === isPitcher(p)))
        .sort((a, b) => ageIn(a, year) - ageIn(b, year) || b.scouting.futureValue - a.scouting.futureValue),
    [league, site, year],
  );
  const chosen = fits.find((p) => p.id === pick) ? pick : '';
  const problem = chosen ? checkTrip(league, chosen, site) : __i18n_k("ui.training.training.problem.b1b73e32");
  const dates = tripDates(league, site);
  const trips = [...(u.trips ?? [])].reverse();
  const away = trips.filter((t) => !t.result);
  return (
    <div class="training">
      <p>{__i18n_t("ui.training.training.101d8cf2", { lastStartText: lastStartText, seasonMax: TRAINING.seasonMax, winterMax: TRAINING.winterMax })}</p>
      <div class="choice-grid">
        {__i18n_display(SITE_IDS.map((id) => {
          const x = SITES[id];
          return (
            <button key={id} type="button" class="choice" aria-pressed={site === id} onClick={() => setSite(id)}>
              <strong>
                {__i18n_display(x.name)} <span class="muted small">{__i18n_display(x.place)}</span>
              </strong>
              <span class="muted">{__i18n_t("ui.training.training.11afbd5f", { value: x.who === 'pitcher' ? '투수' : x.who === 'hitter' ? __i18n_k("ui.training.training.5db174c6") : __i18n_k("ui.training.training.b82ecccc"), weeks: x.weeks, money: money(x.cost) })}</span>
              <span class="muted small">
                {__i18n_display(x.focus.pitcher ? __i18n_k("ui.training.training.6077f255", { focusText: focusText(x.focus.pitcher) }) : '')}
                {__i18n_display(x.focus.pitcher && x.focus.hitter ? ' / ' : '')}
                {__i18n_display(x.focus.hitter ? __i18n_k("ui.training.training.31e548aa", { focusText: focusText(x.focus.hitter) }) : '')}
              </span>
              <span class="muted small">{__i18n_display(x.note)}</span>
            </button>
          );
        }))}
      </div>
      <div class="inline-form trip-form">
        <label>
          보낼 선수
          <select value={chosen} onChange={(e) => setPick((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">{__i18n_t("ui.training.training.b77e609c")}</option>
            {__i18n_display(fits.map((p) => (
              <option key={p.id} value={p.id}>{__i18n_t("ui.training.training.1cf929e7", { name: p.name, positionLabel: positionLabel(p), ageIn: ageIn(p, year), current: p.scouting.current, futureValue: p.scouting.futureValue })}</option>
            )))}
          </select>
        </label>
        <button type="button" class="primary" disabled={!!problem} onClick={() => chosen && onAct({ kind: 'trip', id: chosen, site })}>{__i18n_t("ui.training.training.ac4e4bae", { name: S.name })}</button>
        {__i18n_display(dates && <span class="muted small">{__i18n_display(dates.from)} ~ {__i18n_display(dates.until)}</span>)}
        <span class="muted small">{__i18n_t("ui.training.training.c2eefb9f", { money: money(u.fund) })}</span>
      </div>
      {__i18n_display(problem && chosen && <p class="notice inline">{__i18n_display(problem)}</p>)}
      {__i18n_display(!when && <p class="muted">{__i18n_t("ui.training.training.2614f6be", { value: league.phase === 'regular' ? __i18n_k("ui.training.training.20dc2991") : __i18n_k("ui.training.training.c4026615") })}</p>)}

      <h3>{__i18n_t("ui.training.training.ad7b1c1f")}</h3>
      {__i18n_display(trips.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table">
            <thead>
              <tr>
                <th>{__i18n_t("ui.training.training.c37450d6")}</th>
                <th>{__i18n_t("ui.training.training.b4de61be")}</th>
                <th>{__i18n_t("ui.training.training.2622331e")}</th>
                <th>{__i18n_t("ui.training.training.71d855ac")}</th>
              </tr>
            </thead>
            <tbody>
              {__i18n_display(trips.map((t) => {
                const p = league.players[t.id];
                return (
                  <tr key={`${t.season}-${t.id}-${t.site}`}>
                    <td>
                      {__i18n_display(p ? (
                        <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                          {__i18n_display(p.name)}
                        </button>
                      ) : (
                        '-'
                      ))}
                    </td>
                    <td>{__i18n_display(SITES[t.site].name)}</td>
                    <td class="small">
                      {__i18n_display(t.from)} ~ {__i18n_display(t.until)}
                      {__i18n_display(t.inSeason ? __i18n_k("ui.training.training.e352aafe") : '')}
                    </td>
                    <td class={t.result?.injury ? 'minus' : ''}>{__i18n_display(t.result ? `${t.result.text}${t.result.injury ? ` · ${t.result.injury}` : ''}` : __i18n_k("ui.training.training.c03643f8"))}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">{__i18n_t("ui.training.training.7ba8c700")}</p>
      ))}
      {__i18n_display(away.length > 0 && <p class="muted small">{__i18n_t("ui.training.training.bb74e8bf", { value: away.map((t) => league.players[t.id]?.name).join(', ') })}</p>)}
    </div>
  );
}
