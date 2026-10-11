import { t as __i18n_t } from '../i18n/index';
/* 1.7.0: our players in the major leagues — every posted player who signed abroad (History), and a player's own
   big-league seasons (his records). */
import type { Player } from '../model/types';
import { mlbTotals, mlbView } from '../league/mlb';
import type { LeagueState } from '../league/state';
import { usd } from '../league/foreign';
import { isPitcher } from '../league/players';

const f3 = (x: number) => x.toFixed(3).replace(/^0/, '');
const ipText = (ip: number) => String(ip).replace(/\.0$/, '');

/** His seasons abroad, a row a year, with the totals. */
export function MlbTable({ p }: { p: Pick<Player, 'mlb' | 'role'> }) {
  const m = p.mlb;
  if (!m) return null;
  const t = mlbTotals(p);
  return (
    <>
      <p class="small">{__i18n_t("ui.mlb.text.6b5935cf", { year: m.posted, club: m.club, years: m.years, money: usd(m.total) })}</p>
      {!m.seasons.length ? (
        <p class="muted">{__i18n_t("ui.mlb.text.680cd28c")}</p>
      ) : (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table career">
            <thead>
              {isPitcher(p) ? (
                <tr>
                  <th class="num">{__i18n_t("ui.mlb.text.d5bc99dd")}</th>
                  <th>{__i18n_t("ui.mlb.text.58756112")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.e0cee61a")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.a88271df")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.3b1908b7")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.36260e2c")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.a3fa83d2")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.639a1f2f")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.3e23c769")}</th>
                  <th class="num">ERA</th>
                  <th class="num">WAR</th>
                </tr>
              ) : (
                <tr>
                  <th class="num">{__i18n_t("ui.mlb.text.d5bc99dd")}</th>
                  <th>{__i18n_t("ui.mlb.text.58756112")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.e0cee61a")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.0a3d002c")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.1eb19e0a")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.bb6ef1b2")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.7e66b88d")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.9162d3a3")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.fed1c588")}</th>
                  <th class="num">{__i18n_t("ui.mlb.text.91e54831")}</th>
                  <th class="num">WAR</th>
                </tr>
              )}
            </thead>
            <tbody>
              {m.seasons.map((x) => (
                <tr key={x.year}>
                  <td class="num">{x.year}</td>
                  <td>
                    {x.club}
                    {x.aaa && <span class="muted small"> {__i18n_t("ui.mlb.text.43eda7fb")}</span>}
                  </td>
                  {x.pit && (
                    <>
                      <td class="num">{x.pit.g}</td>
                      <td class="num">{x.pit.gs}</td>
                      <td class="num">{x.pit.w}</td>
                      <td class="num">{x.pit.l}</td>
                      <td class="num">{x.pit.sv}</td>
                      <td class="num">{ipText(x.pit.ip)}</td>
                      <td class="num">{x.pit.k}</td>
                      <td class="num strong">{x.pit.era.toFixed(2)}</td>
                    </>
                  )}
                  {x.bat && (
                    <>
                      <td class="num">{x.bat.g}</td>
                      <td class="num">{x.bat.pa}</td>
                      <td class="num strong">{f3(x.bat.avg)}</td>
                      <td class="num">{f3(x.bat.obp)}</td>
                      <td class="num">{f3(x.bat.slg)}</td>
                      <td class="num">{x.bat.hr}</td>
                      <td class="num">{x.bat.rbi}</td>
                      <td class="num">{x.bat.sb}</td>
                    </>
                  )}
                  <td class="num">{x.war.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>{__i18n_t("ui.mlb.text.6ceb560a", { n: t.seasons })}</th>
                {t.pit && (
                  <>
                    <td class="num">{t.pit.g}</td>
                    <td class="num">{m.seasons.reduce((a, x) => a + (x.pit?.gs ?? 0), 0)}</td>
                    <td class="num">{t.pit.w}</td>
                    <td class="num">{t.pit.l}</td>
                    <td class="num">{t.pit.sv}</td>
                    <td class="num">{ipText(t.pit.ip)}</td>
                    <td class="num">{t.pit.k}</td>
                    <td class="num strong">{t.pit.era.toFixed(2)}</td>
                  </>
                )}
                {t.bat && (
                  <>
                    <td class="num">{t.bat.g}</td>
                    <td class="num">{t.bat.pa}</td>
                    <td class="num strong">{f3(t.bat.avg)}</td>
                    <td class="num">{f3(t.bat.obp)}</td>
                    <td class="num">{f3(t.bat.slg)}</td>
                    <td class="num">{t.bat.hr}</td>
                    <td class="num">{t.bat.rbi}</td>
                    <td class="num">{t.bat.sb}</td>
                  </>
                )}
                <td class="num">{t.war.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p class="muted small">{__i18n_t("ui.mlb.text.e7427ef1")}</p>
    </>
  );
}

/** Everyone the KBO has posted to the majors who signed there. */
export function MlbList({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const rows = mlbView(league);
  const me = league.user?.teamId;
  if (!rows.length) return <p class="muted">{__i18n_t("ui.mlb.text.f09594e8")}</p>;
  return (
    <>
      <p class="muted small">{__i18n_t("ui.mlb.text.78b95a83")}</p>
      <div class="table-wrap">
        <table class="record-table">
          <thead>
            <tr>
              <th class="num">{__i18n_t("ui.mlb.text.6734925e")}</th>
              <th>{__i18n_t("ui.mlb.text.c37450d6")}</th>
              <th>{__i18n_t("ui.mlb.text.e947ec49")}</th>
              <th>{__i18n_t("ui.mlb.text.b4116369")}</th>
              <th>{__i18n_t("ui.mlb.text.001e4be2")}</th>
              <th class="num">{__i18n_t("ui.mlb.text.b3000412")}</th>
              <th>{__i18n_t("ui.mlb.text.bf2ff44a")}</th>
              <th class="num">WAR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} class={x.kboTeamId === me ? 'mine' : undefined}>
                <td class="num">{x.posted}</td>
                <td>
                  <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                    {x.name}
                  </button>
                </td>
                <td>{x.kboClub}</td>
                <td class="small">{__i18n_t("ui.mlb.text.a30a1b76", { club: x.club, years: x.years, money: usd(x.total) })}</td>
                <td class="small">{x.status}</td>
                <td class="num">{x.totals.seasons}</td>
                <td class="small">
                  {x.totals.pit
                    ? __i18n_t("ui.mlb.text.5b8f8b09", { w: x.totals.pit.w, l: x.totals.pit.l, sv: x.totals.pit.sv, era: x.totals.pit.era.toFixed(2) })
                    : x.totals.bat
                      ? __i18n_t("ui.mlb.text.16111fb7", { avg: f3(x.totals.bat.avg), hr: x.totals.bat.hr, rbi: x.totals.bat.rbi })
                      : '-'}
                </td>
                <td class="num">{x.totals.war.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
