import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
import { startYear } from '../league/era';
import { useState } from 'preact/hooks';
import { nationalView, retiredNumbersView } from '../league/legacy';
import type { LeagueState } from '../league/state';
import { awardsView, recordRoom, shortName, teamOf } from '../league/views';
import { avg, era, ip, obp, ops, slg } from '../league/stats';

type View = 'seasons' | 'awards' | 'records' | 'hall' | 'retired' | 'national';

export function History({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const [view, setView] = useState<View>('seasons');
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title">{__i18n_t("ui.history.history.1ab3847c")}</h2>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.history.history.1ab3847c")}>
        {__i18n_display((
          [
            ['seasons', __i18n_k("ui.history.history.b3000412")],
            ['awards', __i18n_k("ui.history.history.d95a37a4")],
            ['records', __i18n_k("ui.history.history.24f4444a")],
            ['hall', __i18n_k("ui.history.history.6999864f")],
            ['retired', __i18n_k("ui.history.history.adad27c2")],
            ['national', __i18n_k("ui.history.history.3243618b")],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {__i18n_display(label)}
          </button>
        )))}
      </div>
      {__i18n_display(view === 'seasons' && <Seasons league={league} />)}
      {__i18n_display(view === 'awards' && <Awards league={league} onPlayer={onPlayer} />)}
      {__i18n_display(view === 'records' && <Records league={league} onPlayer={onPlayer} />)}
      {__i18n_display(view === 'hall' && <Hall league={league} onPlayer={onPlayer} />)}
      {__i18n_display(view === 'retired' && <Retired league={league} onPlayer={onPlayer} />)}
      {__i18n_display(view === 'national' && <National league={league} onPlayer={onPlayer} />)}
    </section>
  );
}

const Who = ({ x, onPlayer }: { x: { id: string; name: string; team: string } | null; onPlayer: (id: string) => void }) =>
  x ? (
    <>
      <button type="button" class="link" onClick={() => onPlayer(x.id)}>
        {__i18n_display(x.name)}
      </button>
      <span class="muted small"> {__i18n_display(x.team)}</span>
    </>
  ) : (
    <span class="muted">-</span>
  );

function Awards({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const years = awardsView(league);
  if (!years.length) return <p class="muted">{__i18n_t("ui.history.awards.17c0863a")}</p>;
  return (
    <>
      <p class="muted">{__i18n_t("ui.history.awards.b17ac715")}</p>
      {__i18n_display(years.map((y) => (
        <section key={y.year} class="award-year">
          <h3>{__i18n_display(y.year)}</h3>
          <p>
            <span class="tag">MVP</span> <Who x={y.mvp} onPlayer={onPlayer} /> · <span class="tag">{__i18n_t("ui.history.awards.9ecfbb08")}</span> <Who x={y.rookie} onPlayer={onPlayer} />
          </p>
          <p class="small">
            <strong>{__i18n_t("ui.history.awards.f2b151c4")}</strong>{__i18n_display(' ')}
            {__i18n_display(y.gg.map((g, i) => (
              <span key={i}>
                {__i18n_display(g.pos)} <Who x={g} onPlayer={onPlayer} />
                {__i18n_display(i < y.gg.length - 1 ? ' · ' : '')}
              </span>
            )))}
          </p>
          <p class="small">
            <strong>{__i18n_t("ui.history.awards.9557702b")}</strong>{__i18n_display(' ')}
            {__i18n_display(y.titles.map((t, i) => (
              <span key={i}>
                {__i18n_display(t.label)} <Who x={t} onPlayer={onPlayer} /> ({__i18n_display(t.value)}){__i18n_display(i < y.titles.length - 1 ? ' · ' : '')}
              </span>
            )))}
          </p>
        </section>
      )))}
    </>
  );
}

function Records({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const r = recordRoom(league);
  const block = (title: string, groups: typeof r.season) => (
    <>
      <h3>{__i18n_display(title)}</h3>
      <div class="leader-grid">
        {__i18n_display(groups.map((g) => (
          <div key={g.label} class="leader-card">
            <h4>{__i18n_display(g.label)}</h4>
            <ol class="plain">
              {__i18n_display(g.rows.map((x) => (
                <li key={x.id + (x.year ?? '')}>
                  <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                    {__i18n_display(x.name)}
                  </button>{__i18n_display(' ')}
                  <span class="muted small">
                    {__i18n_display(x.team)}
                    {__i18n_display(x.year ? ` ${x.year}` : '')}
                  </span>{__i18n_display(' ')}
                  <strong>{__i18n_display(x.value)}</strong>
                </li>
              )))}
            </ol>
          </div>
        )))}
      </div>
    </>
  );
  return (
    <>
      <p class="muted">{__i18n_t("ui.history.records.f9fd8941")}</p>
      {__i18n_display(block(__i18n_k("ui.history.records.816d3b96"), r.season))}
      {__i18n_display(block(__i18n_k("ui.history.records.fc7fa3d0"), r.career))}
    </>
  );
}

function Hall({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const hall = [...(league.hallOfFame ?? [])].reverse();
  return (
    <>
      <p class="muted">{__i18n_t("ui.history.hall.7aeaf1ba")}</p>
      {__i18n_display(hall.length ? (
        <div class="table-wrap">
          <table class="record-table">
            <thead>
              <tr>
                <th class="num">{__i18n_t("ui.history.hall.90a76354")}</th>
                <th>{__i18n_t("ui.history.hall.c37450d6")}</th>
                <th>{__i18n_t("ui.history.hall.58756112")}</th>
                <th class="num">{__i18n_t("ui.history.hall.b3000412")}</th>
                <th class="num">WAR</th>
                <th>{__i18n_t("ui.history.hall.fc7fa3d0")}</th>
              </tr>
            </thead>
            <tbody>
              {__i18n_display(hall.map((h) => (
                <tr key={h.id}>
                  <td class="num">{__i18n_display(h.year)}</td>
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(h.id)}>
                      {__i18n_display(h.name)}
                    </button>
                  </td>
                  <td>{__i18n_display(h.teams.map((t) => shortName(league, t)).join(' · '))}</td>
                  <td class="num">{__i18n_display(h.seasons)}</td>
                  <td class="num strong">{__i18n_display(h.war.toFixed(1))}</td>
                  <td>{__i18n_display(h.line)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">{__i18n_t("ui.history.hall.92967a7b")}</p>
      ))}
    </>
  );
}

function Seasons({ league }: { league: LeagueState }) {
  const seasons = [...league.history].reverse();
  return (
    <>
      <p class="muted">{__i18n_t("ui.history.seasons.9ad603d6", { value: startYear() - 1 })}</p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <thead>
            <tr>
              <th class="num">{__i18n_t("ui.history.seasons.b3000412")}</th>
              <th>{__i18n_t("ui.history.seasons.894badc3")}</th>
              <th>{__i18n_t("ui.history.seasons.cef6f7cf")}</th>
              <th class="num">{__i18n_t("ui.history.seasons.85205cf0")}</th>
              <th>{__i18n_t("ui.history.seasons.daa5f097")}</th>
              <th class="num">{__i18n_t("ui.history.seasons.32f51659")}</th>
              <th class="num">{__i18n_t("ui.history.seasons.e6c1adda")}</th>
              <th class="num">{__i18n_t("ui.history.seasons.8d32d243")}</th>
            </tr>
          </thead>
          <tbody>
            {__i18n_display(seasons.map((h) => {
              const b = h.totals.bat;
              return (
                <tr key={h.year}>
                  <td class="num">{__i18n_display(h.year)}</td>
                  <td class="strong">{__i18n_display(h.champion ? teamOf(league, h.champion)?.name : '-')}</td>
                  <td>{__i18n_display(shortName(league, h.table[0]!.teamId))}</td>
                  <td class="num">{__i18n_display(h.table[0]!.pct.toFixed(3))}</td>
                  <td>{__i18n_display(h.futures?.[0] ? shortName(league, h.futures[0].teamId) : '-')}</td>
                  <td class="num">{__i18n_display((b.h / b.ab).toFixed(3))}</td>
                  <td class="num">{__i18n_display((obp(b) + slg(b)).toFixed(3))}</td>
                  <td class="num">{__i18n_display(era(h.totals.pit).toFixed(2))}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
      {__i18n_display(seasons.find((h) => h.futures) && <FuturesTable league={league} />)}
    </>
  );
}

/** The latest futures league table (every club's futures squad and 상무). */
function FuturesTable({ league }: { league: LeagueState }) {
  const h = [...league.history].reverse().find((x) => x.futures)!;
  return (
    <>
      <h3>{__i18n_t("ui.history.futuresTable.b5dc6dec", { year: h.year })}</h3>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <thead>
            <tr>
              <th class="num">{__i18n_t("ui.history.futuresTable.d15876f1")}</th>
              <th>{__i18n_t("ui.history.futuresTable.90583011")}</th>
              <th class="num">{__i18n_t("ui.history.futuresTable.3b1908b7")}</th>
              <th class="num">{__i18n_t("ui.history.futuresTable.36260e2c")}</th>
              <th class="num">{__i18n_t("ui.history.futuresTable.56c5af5b")}</th>
              <th class="num">{__i18n_t("ui.history.futuresTable.82cc030f")}</th>
            </tr>
          </thead>
          <tbody>
            {__i18n_display(h.futures!.map((r) => (
              <tr key={r.teamId}>
                <td class="num">{__i18n_display(r.rank)}</td>
                <td>{__i18n_display(shortName(league, r.teamId))}</td>
                <td class="num">{__i18n_display(r.w)}</td>
                <td class="num">{__i18n_display(r.l)}</td>
                <td class="num">{__i18n_display(r.t)}</td>
                <td class="num">{__i18n_display(r.pct.toFixed(3))}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Retired numbers (1.0.1): each club's, ours first, with the player's story and his numbers with the club. */
function Retired({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const list = retiredNumbersView(league);
  if (!list.length) return <p class="muted">{__i18n_t("ui.history.retired.b42d5d44")}</p>;
  return (
    <div class="retired-grid">
      {__i18n_display(list.map((r) => (
        <article key={`${r.teamId}-${r.number}`} class={`card retired-card${r.teamId === league.user?.teamId ? ' mine' : ''}`}>
          <p class="retired-number" aria-hidden="true">
            {__i18n_display(r.number)}
          </p>
          <h3>
            <button type="button" class="link" onClick={() => onPlayer(r.id)}>
              {__i18n_display(r.name)}
            </button>{__i18n_display(' ')}
            <span class="muted small">
              {__i18n_display(r.team)} · {__i18n_display(r.position)}
            </span>
          </h3>
          <ul class="plain small retired-story">
            {__i18n_display(r.story.map((line, i) => (
              <li key={i}>{__i18n_display(line)}</li>
            )))}
          </ul>
          <dl class="facts small">
            {__i18n_display(r.bat && !r.pitcher && (
              <div>
                <dt>{__i18n_t("ui.history.retired.5363b622")}</dt>
                <dd>{__i18n_t("ui.history.retired.b941b09e", { g: r.bat.g, value: avg(r.bat).toFixed(3).replace(/^0/, ''), h: r.bat.h, hr: r.bat.hr, rbi: r.bat.rbi, sb: r.bat.sb, value2: ops(r.bat).toFixed(3).replace(/^0/, '') })}</dd>
              </div>
            ))}
            {__i18n_display(r.pit && r.pitcher && (
              <div>
                <dt>{__i18n_t("ui.history.retired.8386b1a9")}</dt>
                <dd>{__i18n_t("ui.history.retired.be61ed76", { g: r.pit.g, w: r.pit.w, l: r.pit.l, sv: r.pit.sv, hld: r.pit.hld, ip: ip(r.pit.outs), value: era(r.pit).toFixed(2), value2: r.pit.k })}</dd>
              </div>
            ))}
            <div>
              <dt>WAR</dt>
              <dd>{__i18n_t("ui.history.retired.9e3da76a", { value: r.war.toFixed(1), value2: r.careerWar.toFixed(1) })}</dd>
            </div>
          </dl>
        </article>
      )))}
    </div>
  );
}

/** The national team (1.0.1): every finished tournament, the result, where the squad came from, ours. */
function National({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const v = nationalView(league);
  if (!v.rows.length) return <p class="muted">{__i18n_t("ui.history.national.f3f55aff")}</p>;
  return (
    <>
      <p class="muted">{__i18n_t("ui.history.national.a9d8690a", { length: v.rows.length, wins: v.wins, podiums: v.podiums, exemptions: v.exemptions })}</p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <caption class="sr-only">{__i18n_t("ui.history.national.419bb35b")}</caption>
          <thead>
            <tr>
              <th scope="col" class="num">{__i18n_t("ui.history.national.d5bc99dd")}</th>
              <th scope="col">{__i18n_t("ui.history.national.042b946b")}</th>
              <th scope="col">{__i18n_t("ui.history.national.d3bb3576")}</th>
              <th scope="col" class="num">{__i18n_t("ui.history.national.175e75de")}</th>
              <th scope="col">{__i18n_t("ui.history.national.3cb4e46d")}</th>
              <th scope="col">{__i18n_t("ui.history.national.0298c997")}</th>
            </tr>
          </thead>
          <tbody>
            {__i18n_display(v.rows.map((r) => (
              <tr key={r.id}>
                <td class="num">{__i18n_display(r.year)}</td>
                <td>{__i18n_display(r.name)}</td>
                <td class={r.result === '우승' || r.result === '금메달' ? 'strong' : ''}>
                  {__i18n_display(r.result)}
                  {__i18n_display(r.medal && <span class="tag">{__i18n_t("ui.history.national.de7fcbc3")}</span>)}
                </td>
                <td class="num">{__i18n_display(r.squad)}</td>
                <td class="small">{__i18n_display(r.clubs.map((c) => `${c.team} ${c.n}`).join(' · '))}</td>
                <td class="small">
                  {__i18n_display(r.ours.length
                    ? r.ours.map((x, i) => (
                        <span key={x.id}>
                          {__i18n_display(i > 0 && ', ')}
                          <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                            {__i18n_display(x.name)}
                          </button>
                        </span>
                      ))
                    : '-')}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </>
  );
}
