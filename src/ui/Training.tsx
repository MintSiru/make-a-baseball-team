import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Training abroad (V0.10): the four centres, sending a player, and who went where and what came of it. 2.0.31 (the
   user's report: the fall league, the ABL and the wrap-up camp were lost under the long list of players): each
   programme on a tab of its own at the top. */
import { shownFuture } from './grades';
import { useMemo, useState } from 'preact/hooks';
import { TOOL_LABELS, type ToolKey } from '../draftroom';
import type { Action } from '../league/actions';
import { ageIn, isPitcher } from '../league/players';
import { orgPlayers, type LeagueState, type SiteId } from '../league/state';
import { checkTrip, lastStartText, SITE_IDS, SITES, tripDates, tripRecord, tripSeason } from '../league/training';
import { TRAINING } from '../league/tuning';
import { LEARN, learnable, learnChance } from '../league/newpitch';
import { PITCH_LABELS, repertoire, type PitchType } from '../league/pitches';
import { positionLabel } from '../league/views';
import { money } from './format';
import { CAMP_IDS, CAMP_SITES, campClosed, checkCamp, checkDev, DEV, devCandidates, devYear, type CampSite } from '../league/development';
import { positionKey, useSort } from './sort';
import { Gauges } from './next/Gauges';
import { Help } from './Help';
import { useUi } from './useDisplay';
import { FarmReportView } from './FarmReport';
import { INTENSITIES, intensityLabel, intensityOf, programLabel, programOf, programsFor, type Intensity } from '../league/drills';

const focusText = (keys: ToolKey[] | undefined) => (keys ?? []).map((k) => TOOL_LABELS[k] ?? k).join('·');

type Squad = 'active' | 'futures' | 'third' | 'all';

/** 2.0.31: the programmes, one at a time (the last one opened is kept). */
type View = 'plans' | 'farm' | 'trip' | 'fall' | 'abl' | 'camp' | 'pitch';
let lastView: View = 'trip';

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
  // 2.0.31: the record lists what was not cleared (tripRecord); who is away reads every trip.
  const trips = tripRecord(league);
  const away = (u.trips ?? []).filter((t) => !t.result);
  const winterSent = when ? (u.trips ?? []).filter((t) => t.season === when.season && !t.inSeason).length : 0;
  // 2.0.62 (새 UI): the limits as gauges, how a trip works behind an ⓘ, what each site does on its card's hover.
  const next = useUi() === 'new';
  const [view, setViewState] = useState<View>(lastView);
  const setView = (v: View) => setViewState((lastView = v));
  const views: [View, string][] = [
    // 2.0.66 (the user's request): every player's programme and intensity, and the farm coaches' monthly reports.
    ['plans', __i18n_t("ui.training.text.671db5f5")],
    ['farm', __i18n_t("ui.training.text.ab09962d")],
    ['trip', __i18n_t("ui.training.text.b4927759")],
    ['fall', __i18n_t("ui.training.text.f285e071")],
    ['abl', __i18n_t("ui.training.text.37d4233b")],
    ['camp', __i18n_t("ui.training.text.dce453a2")],
    ['pitch', __i18n_t("ui.training.text.c8bbde22")],
  ];
  return (
    <div class="training">
      <div class="segmented training-views" role="group" aria-label={__i18n_t("ui.training.text.3e801fc3")}>
        {views.map(([v, label]) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'fall' && <DevSection league={league} kind="fall" onAct={onAct} onPlayer={onPlayer} />}
      {view === 'abl' && <DevSection league={league} kind="abl" onAct={onAct} onPlayer={onPlayer} />}
      {view === 'camp' && <WrapCamp league={league} onAct={onAct} />}
      {view === 'pitch' && <LearnPitch league={league} onAct={onAct} onPlayer={onPlayer} />}
      {view === 'plans' && <TrainingPlans league={league} onAct={onAct} onPlayer={onPlayer} />}
      {view === 'farm' && <FarmReportView league={league} onPlayer={onPlayer} />}
      {view === 'trip' && (
        <>
          {next ? (
            <Gauges
              items={[
                when && !when.inSeason
                  ? { label: __i18n_t("ui.training.text.9f33b587"), value: `${winterSent} / ${TRAINING.winterMax}`, n: winterSent, of: TRAINING.winterMax }
                  : { label: __i18n_t("ui.training.text.bc373d86"), value: `${Object.keys(league.abroad ?? {}).length} / ${TRAINING.seasonMax}`, n: Object.keys(league.abroad ?? {}).length, of: TRAINING.seasonMax },
                { label: __i18n_t("ui.office.office.4f7776dd"), value: money(u.fund) },
              ]}
            >
              <span class="small">
                {away.length > 0 && __i18n_t("ui.training.training.bb74e8bf", { value: away.map((t) => league.players[t.id]?.name).join(', ') })}{' '}
                <Help title={__i18n_t("ui.training.text.b4927759")}>{__i18n_t("ui.training.training.101d8cf2", { lastStartText: lastStartText, seasonMax: TRAINING.seasonMax, winterMax: TRAINING.winterMax })}</Help>
              </span>
            </Gauges>
          ) : (
            <p>{__i18n_t("ui.training.training.101d8cf2", { lastStartText: lastStartText, seasonMax: TRAINING.seasonMax, winterMax: TRAINING.winterMax })}</p>
          )}
          <div class="choice-grid trip-sites">
            {__i18n_display(SITE_IDS.map((id) => {
              const x = SITES[id];
              return (
                <button key={id} type="button" class="choice" aria-pressed={site === id} title={next ? __i18n_displayText(x.note) : undefined} onClick={() => setSite(id)}>
                  <strong>
                    {__i18n_display(x.name)} <span class="muted small">{__i18n_display(x.place)}</span>
                  </strong>
                  <span class="muted">{__i18n_t("ui.training.training.11afbd5f", { value: x.who === 'pitcher' ? '투수' : x.who === 'hitter' ? __i18n_k("ui.training.training.5db174c6") : __i18n_k("ui.training.training.b82ecccc"), weeks: x.weeks, money: money(x.cost) })}</span>
                  <span class="muted small">
                    {__i18n_display(x.focus.pitcher ? __i18n_k("ui.training.training.6077f255", { focusText: focusText(x.focus.pitcher) }) : '')}
                    {__i18n_display(x.focus.pitcher && x.focus.hitter ? ' / ' : '')}
                    {__i18n_display(x.focus.hitter ? __i18n_k("ui.training.training.31e548aa", { focusText: focusText(x.focus.hitter) }) : '')}
                  </span>
                  {!next && <span class="muted small">{__i18n_display(x.note)}</span>}
                </button>
              );
            }))}
          </div>
          {/* 2.0.10 (the user's request): the players to send in a sortable table, one click each, instead of a list box. */}
          <p class="inline-form trip-form">
            {__i18n_display(dates && <span class="muted small">{__i18n_display(dates.from)} ~ {__i18n_display(dates.until)}</span>)}
            {!next && <span class="muted small">{__i18n_t("ui.training.training.c2eefb9f", { money: money(u.fund) })}</span>}
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

          <div class="section-head">
            <h3>{__i18n_t("ui.training.training.ad7b1c1f")}</h3>
            {trips.some((t) => t.result) && (
              <button type="button" class="small" onClick={() => window.confirm(__i18n_t("ui.training.text.0abac6b4")) && onAct({ kind: 'clearTrips' })}>
                {__i18n_t("ui.training.text.9e62ff83")}
              </button>
            )}
          </div>
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
            <p class="muted">{(u.tripsCleared ?? 0) > 0 ? __i18n_t("ui.training.text.bb50e4ae") : __i18n_t("ui.training.training.7ba8c700")}</p>
          ))}
          {__i18n_display(!next && away.length > 0 && <p class="muted small">{__i18n_t("ui.training.training.bb74e8bf", { value: away.map((t) => league.players[t.id]?.name).join(', ') })}</p>)}
        </>
      )}
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

/** 2.0.28 (the user's request, development.ts): the fall instructional league, a winter in Australia, and the wrap-up
    camp abroad. */
function DevPick({ league, kind, onAct, onPlayer }: { league: LeagueState; kind: 'fall' | 'abl'; onAct: (a: Action) => void; onPlayer: (id: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const D = DEV[kind];
  const year = devYear(league);
  const list = useMemo(() => devCandidates(league, kind).sort((a, b) => (shownFuture(b) ?? 0) - (shownFuture(a) ?? 0) || ageIn(a, year) - ageIn(b, year)), [league, kind]);
  const done = (kind === 'fall' ? league.user?.dev?.fall : league.user?.dev?.abl) === year;
  const why = done ? __i18n_t("ui.training.text.75edbde0") : checkDev(league, kind, picked.length ? picked : list.slice(0, 1).map((p) => p.id));
  const toggle = (id: string) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length < D.max ? [...x, id] : x));
  return (
    <>
      <p class="muted small">
        {kind === 'fall'
          ? __i18n_t("ui.training.text.9d1e46be", { max: D.max, cost: money(D.cost) })
          : __i18n_t("ui.training.text.b6dd3647", { max: D.max, cost: money(D.cost) })}
      </p>
      {done ? (
        <p class="muted">{__i18n_t("ui.training.text.0e7a6713")}</p>
      ) : (
        <>
          <div class="table-wrap trip-pick" tabIndex={0}>
            <table class="record-table">
              <thead>
                <tr>
                  <th aria-label={__i18n_t("ui.training.text.08109e41")} />
                  <th>{__i18n_t('ui.training.text.9aa18e50')}</th>
                  <th>{__i18n_t('ui.training.text.81922a91')}</th>
                  <th class="num">{__i18n_t('ui.training.text.6c620e5c')}</th>
                  <th class="num">{__i18n_t('ui.training.text.001e4be2')}</th>
                  <th class="num">{__i18n_t('ui.training.text.6e0caec5')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} class="player-row">
                    <td>
                      <input type="checkbox" aria-label={p.name} checked={picked.includes(p.id)} disabled={!picked.includes(p.id) && picked.length >= D.max} onChange={() => toggle(p.id)} />
                    </td>
                    <td>
                      <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                        {p.name}
                      </button>
                    </td>
                    <td>{__i18n_display(positionLabel(p))}</td>
                    <td class="num">{ageIn(p, year + 1)}</td>
                    <td class="num">{p.scouting.current}</td>
                    <td class="num">{shownFuture(p) ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="inline-form">
            <button type="button" class="primary" disabled={!picked.length || !!checkDev(league, kind, picked)} onClick={() => (onAct({ kind: 'devSend', what: kind, ids: picked }), setPicked([]))}>
              {__i18n_t("ui.training.text.5539e8b5", { n: picked.length, cost: money(picked.length * D.cost) })}
            </button>
            <span class="muted small">{__i18n_display(picked.length ? (checkDev(league, kind, picked) ?? '') : (why ?? ''))}</span>
          </p>
        </>
      )}
    </>
  );
}

/** 2.0.29: the fall instructional league or a season in Australia, under its own tab (2.0.31). */
function DevSection({ league, kind, onAct, onPlayer }: { league: LeagueState; kind: 'fall' | 'abl'; onAct: (a: Action) => void; onPlayer: (id: string) => void }) {
  return (
    <section class="dev-programs">
      <h3>{kind === 'fall' ? __i18n_t("ui.training.text.f285e071") : __i18n_t("ui.training.text.37d4233b")}</h3>
      <DevPick league={league} kind={kind} onAct={onAct} onPlayer={onPlayer} />
      <p class="muted small">{__i18n_t("ui.training.text.dce8ab82")}</p>
    </section>
  );
}

/** The camp's places to pick from (here and in the winter's wrap-up camp decision, 2.0.32). */
export function CampChoices({ site, year, onPick, onNone }: { site: CampSite | null; year: number; onPick: (site: CampSite) => void; onNone?: () => void }) {
  return (
    <div class="choice-grid">
      {CAMP_IDS.map((id) => {
        const C = CAMP_SITES[id];
        // 2.0.50: a league that plays history goes abroad only from the place's year.
        const closed = campClosed(id, year);
        return (
          <button key={id} type="button" class="choice" aria-pressed={site === id} disabled={!!closed} title={__i18n_displayText(closed ?? '')} onClick={() => onPick(id)}>
            <strong>{__i18n_display(C.name())}</strong>
            <span class="muted">{C.cost ? money(C.cost) : __i18n_t("ui.training.text.06048927")}</span>
            <span class="muted small">
              {__i18n_t("ui.training.text.77e97665", { p: focusText(C.pitcher), h: focusText(C.hitter) })}
            </span>
            <span class="muted small">{__i18n_display(closed ?? C.note())}</span>
          </button>
        );
      })}
      {onNone && (
        <button type="button" class="choice" aria-pressed={site === null} onClick={onNone}>
          <strong>{__i18n_t("ui.training.text.4399e2cd")}</strong>
          <span class="muted">{__i18n_t("ui.training.text.06048927")}</span>
          <span class="muted small">{__i18n_t("ui.decision.text.07238217")}</span>
        </button>
      )}
    </div>
  );
}

/** 2.0.29: the November camp abroad, under its own tab (2.0.31). */
function WrapCamp({ league, onAct }: { league: LeagueState; onAct: (a: Action) => void }) {
  const [site, setSite] = useState<CampSite>(() => (campClosed('okinawa', devYear(league)) ? 'home' : 'okinawa'));
  const camp = league.user?.dev?.camp;
  const year = devYear(league);
  const why = checkCamp(league, site);
  return (
    <section class="dev-programs">
      <h3>{__i18n_t("ui.training.text.dce453a2")}</h3>
      <p class="muted small">{__i18n_t("ui.training.text.e8c26099")}</p>
      <CampChoices site={site} year={year} onPick={setSite} />
      {camp?.year === year ? (
        <p class="muted">{__i18n_t("ui.training.text.d517e650", { place: CAMP_SITES[camp.site].name(), n: camp.players })}</p>
      ) : (
        <p class="inline-form">
          <button type="button" class="primary" disabled={!!why} onClick={() => onAct({ kind: 'wrapCamp', site })}>
            {__i18n_t("ui.training.text.29e29050", { place: CAMP_SITES[site].name() })}
          </button>
          <span class="muted small">{__i18n_display(why ?? '')}</span>
        </p>
      )}
      <p class="muted small">{__i18n_t("ui.training.text.dce8ab82")}</p>
    </section>
  );
}

/** 2.0.66 (the user's request: 훈련 세분화): every player's programme and intensity, by squad, with a change for all. */
function TrainingPlans({ league, onAct, onPlayer }: { league: LeagueState; onAct: (a: Action) => void; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const r = league.rosters[u.teamId];
  const [squad, setSquad] = useState<Squad>('all');
  const of = (id: string): Squad => (r?.active.includes(id) ? 'active' : r?.futures.includes(id) ? 'futures' : r?.third.includes(id) ? 'third' : 'all');
  const players = orgPlayers(league, u.teamId)
    .filter((p) => p.status === 'active' && (squad === 'all' || of(p.id) === squad))
    .sort((a, b) => Number(isPitcher(b)) - Number(isPitcher(a)) || ageIn(a, league.year) - ageIn(b, league.year));
  const all = (intensity: Intensity) => {
    const ids = players.filter((p) => intensityOf(p) !== intensity).map((p) => p.id);
    if (ids.length) onAct({ kind: 'trainingIntensity', ids, intensity });
  };
  return (
    <>
      <div class="row-actions">
        <div class="segmented" role="group" aria-label={__i18n_t("ui.training.text.5d24a2fc")}>
          {(['all', 'active', 'futures', 'third'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={squad === k} onClick={() => setSquad(k)}>
              {k === 'all' ? __i18n_t("ui.training.text.934dd25e") : k === 'active' ? __i18n_t("ui.training.text.ef2caeba") : k === 'futures' ? __i18n_t("ui.training.text.1345128f") : __i18n_t("ui.training.text.0dce8d6b")}
            </button>
          ))}
        </div>
        <span class="muted small">{__i18n_t("ui.training.text.bb407ae7")}</span>
        {INTENSITIES.map((k) => (
          <button key={k} type="button" onClick={() => all(k)}>
            {intensityLabel(k)}
          </button>
        ))}
      </div>
      <p class="muted small">{__i18n_t("ui.training.text.3007107e")}</p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <caption class="sr-only">{__i18n_t("ui.training.text.671db5f5")}</caption>
          <thead>
            <tr>
              <th scope="col">{__i18n_t("ui.training.text.c37450d6")}</th>
              <th scope="col">{__i18n_t("ui.training.text.5d24a2fc")}</th>
              <th scope="col" class="num">{__i18n_t("ui.training.text.6c620e5c")}</th>
              <th scope="col">{__i18n_t("ui.training.text.14bf7f79")}</th>
              <th scope="col">{__i18n_t("ui.training.text.6d471e8d")}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                    {p.name}
                  </button>{' '}
                  <span class="muted small">{positionLabel(p)}</span>
                </td>
                <td>{of(p.id) === 'active' ? __i18n_t("ui.training.text.ef2caeba") : of(p.id) === 'futures' ? __i18n_t("ui.training.text.1345128f") : of(p.id) === 'third' ? __i18n_t("ui.training.text.0dce8d6b") : '-'}</td>
                <td class="num">{ageIn(p, league.year)}</td>
                <td>
                  <select value={programOf(p)} aria-label={__i18n_t("ui.training.text.9743c8af", { name: p.name })} onChange={(e) => onAct({ kind: 'trainingPlan', id: p.id, focus: (e.currentTarget as HTMLSelectElement).value })}>
                    {programsFor(isPitcher(p)).map((k) => (
                      <option key={k} value={k}>
                        {programLabel(k)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={intensityOf(p)} aria-label={__i18n_t("ui.training.text.5f0249f6", { name: p.name })} onChange={(e) => onAct({ kind: 'trainingPlan', id: p.id, intensity: (e.currentTarget as HTMLSelectElement).value as Intensity })}>
                    {INTENSITIES.map((k) => (
                      <option key={k} value={k}>
                        {intensityLabel(k)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
