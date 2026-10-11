import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
import { useState } from 'preact/hooks';
import type { LeagueState } from '../league/state';
import { leaders, rates, seasonStats } from '../league/views';
import { positionKey, useSort } from './sort';
import { AllStar } from './AllStar';
import { postseasonBoards } from '../league/poststats';
import type { Action } from '../league/actions';

type View = 'leaders' | 'batters' | 'pitchers' | 'postseason' | 'allstar';
const f3 = rates.fmt3;
const f2 = (x: number) => x.toFixed(2);

export function Leaders({ league, onPlayer, onBox, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onBox?: (id: string) => void; onAct?: (a: Action) => void }) {
  const [view, setView] = useState<View>('leaders');
  const [qualifiedOnly, setQualifiedOnly] = useState(true);
  const data = leaders(league);
  const block = (title: string, rows: { id: string; name: string; team: string; value: string }[]) => (
    <div class="leader-block" key={title}>
      <h4>{__i18n_display(title)}</h4>
      {__i18n_display(rows.length === 0 ? (
        <p class="muted">{__i18n_t("ui.leaders.leaders.block.2de28099")}</p>
      ) : (
        <ol>
          {__i18n_display(rows.map((r) => (
            <li key={r.id}>
              <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                {__i18n_display(r.name)}
              </button>{__i18n_display(' ')}
              <span class="muted">{__i18n_display(r.team)}</span>
              <span class="num leader-value">{__i18n_display(r.value)}</span>
            </li>
          )))}
        </ol>
      ))}
    </div>
  );
  return (
    <section aria-labelledby="leaders-title">
      <h2 id="leaders-title">{__i18n_t("ui.leaders.leaders.880aa107", { year: league.year })}</h2>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.leaders.leaders.58d6978a")}>
        {__i18n_display((
          [
            ['leaders', __i18n_k("ui.leaders.leaders.50827b9b")],
            ['batters', __i18n_k("ui.leaders.leaders.00fdfc8a")],
            ['pitchers', __i18n_k("ui.leaders.leaders.6491cbc9")],
            ['postseason', __i18n_k("ui.leaders.leaders.a0f7a345")],
            ['allstar', '올스타'],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {__i18n_display(label)}
          </button>
        )))}
      </div>
      {__i18n_display(view === 'allstar' && <AllStar league={league} onPlayer={onPlayer} onBox={onBox} onAct={onAct} />)}
      {__i18n_display(view === 'postseason' && <PostseasonBoards league={league} block={block} />)}
      <p class="muted" hidden={view === 'allstar' || view === 'postseason'}>{__i18n_t("ui.leaders.leaders.0cfe29e8", { pa: data.qualifying.pa, innings: data.qualifying.innings })}</p>
      {__i18n_display(view === 'leaders' && (
        <>
          <h3>{__i18n_t("ui.leaders.leaders.5db174c6")}</h3>
          <div class="leader-grid">{__i18n_display(data.batting.map((c) => block(c.title, c.rows)))}</div>
          <h3>{__i18n_t("ui.leaders.leaders.ef406667")}</h3>
          <div class="leader-grid">{__i18n_display(data.pitching.map((c) => block(c.title, c.rows)))}</div>
        </>
      ))}
      {__i18n_display((view === 'batters' || view === 'pitchers') && (
        <label class="check">
          <input type="checkbox" checked={qualifiedOnly} onChange={() => setQualifiedOnly(!qualifiedOnly)} /> {__i18n_t("ui.leaders.leaders.741289ec", { value: view === 'batters' ? __i18n_k("ui.leaders.leaders.0a3d002c") : __i18n_k("ui.leaders.leaders.639a1f2f") })}
        </label>
      ))}
      {__i18n_display(view === 'batters' && <BatterTable league={league} onPlayer={onPlayer} qualifiedOnly={qualifiedOnly} />)}
      {__i18n_display(view === 'pitchers' && <PitcherTable league={league} onPlayer={onPlayer} qualifiedOnly={qualifiedOnly} />)}
    </section>
  );
}

type Stats = ReturnType<typeof seasonStats>;

function BatterTable({ league, onPlayer, qualifiedOnly }: { league: LeagueState; onPlayer: (id: string) => void; qualifiedOnly: boolean }) {
  const rows = seasonStats(league).batters.filter((r) => !qualifiedOnly || r.qualified);
  type R = Stats['batters'][number];
  const col = (k: keyof R) => ({ value: (r: R) => r[k] as number });
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r: R) => r.name },
      team: { value: (r: R) => r.team },
      pos: { value: (r: R) => positionKey(r.pos), first: 1 },
      g: col('g'), pa: col('pa'), avg: col('avg'), obp: col('obp'), slg: col('slg'), ops: col('ops'), hr: col('hr'), rbi: col('rbi'), r: col('r'), sb: col('sb'), bb: col('bb'), k: col('k'), babip: col('babip'), wrc: col('wrc'), war: col('war'),
    },
    { key: 'ops', dir: -1 },
  );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table stats-table">
        <thead>
          <tr>
            {__i18n_display(th('name', __i18n_k("ui.leaders.batterTable.9aa18e50")))}
            {__i18n_display(th('team', __i18n_k("ui.leaders.batterTable.58756112")))}
            {__i18n_display(th('pos', __i18n_k("ui.leaders.batterTable.81922a91")))}
            {__i18n_display(th('g', __i18n_k("ui.leaders.batterTable.e0cee61a"), true))}
            {__i18n_display(th('pa', __i18n_k("ui.leaders.batterTable.0a3d002c"), true))}
            {__i18n_display(th('avg', __i18n_k("ui.leaders.batterTable.1eb19e0a"), true))}
            {__i18n_display(th('obp', __i18n_k("ui.leaders.batterTable.bb6ef1b2"), true))}
            {__i18n_display(th('slg', __i18n_k("ui.leaders.batterTable.7e66b88d"), true))}
            {__i18n_display(th('ops', 'OPS', true))}
            {__i18n_display(th('hr', __i18n_k("ui.leaders.batterTable.9162d3a3"), true))}
            {__i18n_display(th('rbi', __i18n_k("ui.leaders.batterTable.fed1c588"), true))}
            {__i18n_display(th('r', __i18n_k("ui.leaders.batterTable.4b4a98b9"), true))}
            {__i18n_display(th('sb', __i18n_k("ui.leaders.batterTable.91e54831"), true))}
            {__i18n_display(th('bb', __i18n_k("ui.leaders.batterTable.21e0537f"), true))}
            {__i18n_display(th('k', __i18n_k("ui.leaders.batterTable.3f349ed1"), true))}
            {__i18n_display(th('babip', 'BABIP', true))}
            {__i18n_display(th('wrc', 'wRC+', true))}
            {__i18n_display(th('war', 'WAR', true))}
          </tr>
        </thead>
        <tbody>
          {__i18n_display(sorted.map((r) => (
            <tr key={r.id} class="player-row">
              <td>
                <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                  {__i18n_display(r.name)}
                </button>
              </td>
              <td>{__i18n_display(r.team)}</td>
              <td>{__i18n_display(r.pos)}</td>
              <td class="num">{__i18n_display(r.g)}</td>
              <td class="num">{__i18n_display(r.pa)}</td>
              <td class="num">{__i18n_display(f3(r.avg))}</td>
              <td class="num">{__i18n_display(f3(r.obp))}</td>
              <td class="num">{__i18n_display(f3(r.slg))}</td>
              <td class="num strong">{__i18n_display(f3(r.ops))}</td>
              <td class="num">{__i18n_display(r.hr)}</td>
              <td class="num">{__i18n_display(r.rbi)}</td>
              <td class="num">{__i18n_display(r.r)}</td>
              <td class="num">{__i18n_display(r.sb)}</td>
              <td class="num">{__i18n_display(r.bb)}</td>
              <td class="num">{__i18n_display(r.k)}</td>
              <td class="num">{__i18n_display(f3(r.babip))}</td>
              <td class="num">{__i18n_display(r.wrc)}</td>
              <td class="num">{__i18n_display(r.war.toFixed(1))}</td>
            </tr>
          )))}
        </tbody>
      </table>
      {__i18n_display(!sorted.length && <p class="muted">{__i18n_t("ui.leaders.batterTable.be27edb9")}</p>)}
    </div>
  );
}

function PitcherTable({ league, onPlayer, qualifiedOnly }: { league: LeagueState; onPlayer: (id: string) => void; qualifiedOnly: boolean }) {
  const rows = seasonStats(league).pitchers.filter((r) => !qualifiedOnly || r.qualified);
  type R = Stats['pitchers'][number];
  const col = (k: keyof R, first?: 1 | -1) => ({ value: (r: R) => r[k] as number, first });
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r: R) => r.name },
      team: { value: (r: R) => r.team },
      g: col('g'), gs: col('gs'), w: col('w'), l: col('l'), sv: col('sv'), hld: col('hld'), outs: col('outs'), era: col('era', 1), whip: col('whip', 1), fip: col('fip', 1), k: col('k'), bb: col('bb'), k9: col('k9'), bb9: col('bb9', 1), babip: col('babip', 1), war: col('war'),
    },
    { key: 'era', dir: 1 },
  );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table stats-table">
        <thead>
          <tr>
            {__i18n_display(th('name', __i18n_k("ui.leaders.pitcherTable.9aa18e50")))}
            {__i18n_display(th('team', __i18n_k("ui.leaders.pitcherTable.58756112")))}
            {__i18n_display(th('g', __i18n_k("ui.leaders.pitcherTable.e0cee61a"), true))}
            {__i18n_display(th('gs', __i18n_k("ui.leaders.pitcherTable.a88271df"), true))}
            {__i18n_display(th('w', '승', true))}
            {__i18n_display(th('l', '패', true))}
            {__i18n_display(th('sv', __i18n_k("ui.leaders.pitcherTable.c5e4d00d"), true))}
            {__i18n_display(th('hld', __i18n_k("ui.leaders.pitcherTable.10a4423a"), true))}
            {__i18n_display(th('outs', __i18n_k("ui.leaders.pitcherTable.639a1f2f"), true))}
            {__i18n_display(th('era', 'ERA', true))}
            {__i18n_display(th('whip', 'WHIP', true))}
            {__i18n_display(th('fip', 'FIP', true))}
            {__i18n_display(th('k', __i18n_k("ui.leaders.pitcherTable.3f349ed1"), true))}
            {__i18n_display(th('bb', __i18n_k("ui.leaders.pitcherTable.21e0537f"), true))}
            {__i18n_display(th('k9', 'K/9', true))}
            {__i18n_display(th('bb9', 'BB/9', true))}
            {__i18n_display(th('babip', 'BABIP', true))}
            {__i18n_display(th('war', 'WAR', true))}
          </tr>
        </thead>
        <tbody>
          {__i18n_display(sorted.map((r) => (
            <tr key={r.id} class="player-row">
              <td>
                <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                  {__i18n_display(r.name)}
                </button>
              </td>
              <td>{__i18n_display(r.team)}</td>
              <td class="num">{__i18n_display(r.g)}</td>
              <td class="num">{__i18n_display(r.gs)}</td>
              <td class="num">{__i18n_display(r.w)}</td>
              <td class="num">{__i18n_display(r.l)}</td>
              <td class="num">{__i18n_display(r.sv)}</td>
              <td class="num">{__i18n_display(r.hld)}</td>
              <td class="num">{__i18n_display(rates.ip(r.outs))}</td>
              <td class="num strong">{__i18n_display(f2(r.era))}</td>
              <td class="num">{__i18n_display(f2(r.whip))}</td>
              <td class="num">{__i18n_display(f2(r.fip))}</td>
              <td class="num">{__i18n_display(r.k)}</td>
              <td class="num">{__i18n_display(r.bb)}</td>
              <td class="num">{__i18n_display(r.k9.toFixed(1))}</td>
              <td class="num">{__i18n_display(r.bb9.toFixed(1))}</td>
              <td class="num">{__i18n_display(f3(r.babip))}</td>
              <td class="num">{__i18n_display(r.war.toFixed(1))}</td>
            </tr>
          )))}
        </tbody>
      </table>
      {__i18n_display(!sorted.length && <p class="muted">{__i18n_t("ui.leaders.pitcherTable.be27edb9")}</p>)}
    </div>
  );
}

/** 1.4.0: the latest postseason's leaders and every postseason's (postseason games stay out of the season's records). */
function PostseasonBoards({ league, block }: { league: LeagueState; block: (title: string, rows: { id: string; name: string; team: string; value: string }[]) => preact.JSX.Element }) {
  const b = postseasonBoards(league);
  if (b.year == null) return <p class="muted">{__i18n_t("ui.leaders.postseasonBoards.c749df8b")}</p>;
  return (
    <>
      <h3>{__i18n_t("ui.leaders.postseasonBoards.c2bc62c6", { year: b.year })}</h3>
      <div class="leader-grid">{__i18n_display(b.latest.map((c) => block(c.label, c.rows)))}</div>
      <h3>{__i18n_t("ui.leaders.postseasonBoards.af368305", { value: b.since != null && b.since !== b.year ? ` (${b.since}~)` : '' })}</h3>
      <div class="leader-grid">{__i18n_display(b.ever.map((c) => block(c.label, c.rows)))}</div>
      <p class="muted small">{__i18n_t("ui.leaders.postseasonBoards.43432f95")}</p>
    </>
  );
}
