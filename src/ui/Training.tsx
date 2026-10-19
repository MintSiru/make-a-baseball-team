import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Training abroad (V0.10): the four centres, sending a player, and who went where and what came of it. */
import { shownFuture } from './grades';
import { useMemo, useState } from 'preact/hooks';
import { TOOL_LABELS, type ToolKey } from '../draftroom';
import type { Action } from '../league/actions';
import { ageIn, isPitcher } from '../league/players';
import { orgPlayers, type LeagueState, type SiteId } from '../league/state';
import { checkTrip, lastStartText, SITE_IDS, SITES, tripDates, tripSeason } from '../league/training';
import { TRAINING } from '../league/tuning';
import { LEARN, learnable, learnChance } from '../league/newpitch';
import { PITCH_LABELS, repertoire, type PitchType } from '../league/pitches';
import { positionLabel } from '../league/views';
import { money } from './format';
import { positionKey, useSort } from './sort';

const focusText = (keys: ToolKey[] | undefined) => (keys ?? []).map((k) => TOOL_LABELS[k] ?? k).join('·');

type Squad = 'active' | 'futures' | 'third' | 'all';

export function Training({ league, onAct, onPlayer }: { league: LeagueState; onAct: (a: Action) => void; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const [site, setSite] = useState<SiteId>('tokyo');
  const when = tripSeason(league);
  const S = SITES[site];
  const year = when?.season ?? league.year;
  const fits = useMemo(
    () =>
      orgPlayers(league, u.teamId)
        .filter((p) => p.status === 'active' && p.origin.kind !== 'foreign' && (S.who === 'all' || (S.who === 'pitcher') === isPitcher(p)))
        .sort((a, b) => ageIn(a, year) - ageIn(b, year) || (shownFuture(b) ?? 0) - (shownFuture(a) ?? 0)),
    [league, site, year],
  );
  const r = league.rosters[u.teamId];
  // 2.0.24 (the user's request): the first team, the futures and the reserves shown apart.
  const [squad, setSquad] = useState<Squad>('all');
  const squadKey = (id: string): Squad => (r?.active.includes(id) ? 'active' : r?.futures.includes(id) ? 'futures' : r?.third.includes(id) ? 'third' : 'all');
  const squadOf = (id: string) => (r?.active.includes(id) ? __i18n_t("ui.training.text.ef2caeba") : r?.futures.includes(id) ? __i18n_t("ui.training.text.e6607847") : r?.third.includes(id) ? __i18n_t("ui.training.text.0dce8d6b") : '');
  const shown = squad === 'all' ? fits : fits.filter((p) => squadKey(p.id) === squad);
  const { sorted, th } = useSort(
    shown,
    {
      name: { value: (p) => p.name },
      pos: { value: (p) => positionKey(positionLabel(p)), first: 1 },
      squad: { value: (p) => squadOf(p.id) },
      age: { value: (p) => ageIn(p, year), first: 1 },
      current: { value: (p) => p.scouting.current },
      future: { value: (p) => shownFuture(p) ?? -1 },
    },
    { key: 'age', dir: 1 },
  );
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
      {/* 2.0.10 (the user's request): the players to send in a sortable table, one click each, instead of a list box. */}
      <p class="inline-form trip-form">
        {__i18n_display(dates && <span class="muted small">{__i18n_display(dates.from)} ~ {__i18n_display(dates.until)}</span>)}
        <span class="muted small">{__i18n_t("ui.training.training.c2eefb9f", { money: money(u.fund) })}</span>
      </p>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.training.text.5d24a2fc")}>
        {(['all', 'active', 'futures', 'third'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={squad === k} onClick={() => setSquad(k)}>
            {k === 'active' ? __i18n_t("ui.training.text.ef2caeba") : k === 'futures' ? __i18n_t("ui.training.text.e6607847") : k === 'third' ? __i18n_t("ui.training.text.0dce8d6b") : __i18n_t("ui.training.text.934dd25e")} <span class="count">{k === 'all' ? fits.length : fits.filter((p) => squadKey(p.id) === k).length}</span>
          </button>
        ))}
      </div>
      <div class="table-wrap trip-pick" tabIndex={0}>
        <table class="record-table">
          <thead>
            <tr>
              <th aria-label={__i18n_t("ui.training.text.f4cba30a")} />
              {th('name', __i18n_t("ui.training.text.9aa18e50"))}
              {th('pos', __i18n_t("ui.training.text.81922a91"))}
              {th('squad', __i18n_t("ui.training.text.5d24a2fc"))}
              {th('age', __i18n_t("ui.training.text.6c620e5c"), true)}
              {th('current', __i18n_t("ui.training.text.001e4be2"), true)}
              {th('future', __i18n_t("ui.training.text.6e0caec5"), true)}
              <th>{__i18n_t("ui.training.text.109239e5")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const why = checkTrip(league, p.id, site);
              return (
                <tr key={p.id} class="player-row">
                  <td>
                    <button type="button" class="primary" disabled={!!why} onClick={() => onAct({ kind: 'trip', id: p.id, site })}>
                      {__i18n_t("ui.training.text.f4cba30a")}
                    </button>
                  </td>
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                      {p.name}
                    </button>
                  </td>
                  <td>{__i18n_display(positionLabel(p))}</td>
                  <td>{__i18n_display(squadOf(p.id))}</td>
                  <td class="num">{ageIn(p, year)}</td>
                  <td class="num">{p.scouting.current}</td>
                  <td class="num">{shownFuture(p) ?? '-'}</td>
                  <td class="muted small">{__i18n_display(why ?? '')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
      <LearnPitch league={league} onAct={onAct} onPlayer={onPlayer} />
    </div>
  );
}

/** 2.0.8 (the user's request): a new pitch for some of our pitchers to learn this winter (newpitch.ts). */
function LearnPitch({ league, onAct, onPlayer }: { league: LeagueState; onAct: (a: Action) => void; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const plans = u.pitchPlans ?? {};
  const year = league.year;
  const arms = orgPlayers(league, u.teamId)
    .filter((p) => p.status === 'active' && isPitcher(p) && (learnable(p).length > 0 || plans[p.id]))
    .sort((a, b) => Number(!!plans[b.id]) - Number(!!plans[a.id]) || ageIn(a, year) - ageIn(b, year));
  const [choice, setChoice] = useState<Record<string, PitchType>>({});
  const full = Object.keys(plans).length >= LEARN.perWinter;
  return (
    <section class="learn-pitch">
      <h3>{__i18n_t("ui.training.text.c8bbde22")}</h3>
      <p class="muted small">{__i18n_t("ui.training.text.b9d78d0c", { n: LEARN.perWinter })}</p>
      {arms.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table small">
            <thead>
              <tr>
                <th>{__i18n_t("ui.training.text.ef406667")}</th>
                <th class="num">{__i18n_t("ui.training.text.6c620e5c")}</th>
                <th class="num">{__i18n_t("ui.training.text.49ce2b15")}</th>
                <th>{__i18n_t("ui.training.text.28718197")}</th>
                <th class="num">{__i18n_t("ui.training.text.c59895ed")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {arms.map((p) => {
                const planned = plans[p.id];
                const can = learnable(p);
                const pick = planned ?? choice[p.id] ?? can[0];
                return (
                  <tr key={p.id}>
                    <td>
                      <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                        {p.name}
                      </button>
                    </td>
                    <td class="num">{ageIn(p, year)}</td>
                    <td class="num">{repertoire(p).length + 1}</td>
                    <td>
                      {planned ? (
                        <strong>{__i18n_displayText(PITCH_LABELS[planned])}</strong>
                      ) : (
                        <select aria-label={__i18n_t("ui.training.text.5ac483bb", { name: p.name })} value={pick} onChange={(e) => setChoice({ ...choice, [p.id]: (e.currentTarget as HTMLSelectElement).value as PitchType })}>
                          {can.map((t) => (
                            <option key={t} value={t}>
                              {__i18n_displayText(PITCH_LABELS[t])}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td class="num">{Math.round(learnChance(league, p, year) * 100)}%</td>
                    <td>
                      {planned ? (
                        <button type="button" onClick={() => onAct({ kind: 'learnPitch', id: p.id, type: null })}>
                          {__i18n_t("ui.training.text.19b2d19b")}
                        </button>
                      ) : (
                        <button type="button" disabled={full || !pick} onClick={() => pick && onAct({ kind: 'learnPitch', id: p.id, type: pick })}>
                          {__i18n_t("ui.training.text.eed2369a")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">{__i18n_t("ui.training.text.9908e755")}</p>
      )}
    </section>
  );
}
