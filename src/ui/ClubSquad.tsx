import { t as __i18n_t } from '../i18n/index';
/* 2.0.52 (the user's request): a club's season by its players — the best nine, the starting rotation and the bullpen,
   year by year (clubsquad.ts); a name opens the player's panel. */
import { useState } from 'preact/hooks';
import { clubSquad, SQUAD_POSITIONS, squadYears, type BullpenRole, type SquadLine } from '../league/clubsquad';
import { POSITION_SHORT } from '../league/positions';
import type { LeagueState } from '../league/state';
import { avg, era, ip, obp, slg } from '../league/stats';

const rate = (x: number) => x.toFixed(3).replace(/^0/, '');
const war = (l: SquadLine) => (Number.isFinite(l.war) ? l.war.toFixed(1) : '-');

function Name({ l, onPlayer }: { l: SquadLine; onPlayer: (id: string) => void }) {
  return (
    <button type="button" class="link" onClick={() => onPlayer(l.id)}>
      {l.name}
    </button>
  );
}

export function ClubSquad({ league, teamId, onPlayer }: { league: LeagueState; teamId: string; onPlayer: (id: string) => void }) {
  const years = squadYears(league, teamId);
  const [year, setYear] = useState<number | null>(null);
  const shown = year != null && years.includes(year) ? year : years[0];
  if (shown == null) return <p class="muted">{__i18n_t("ui.clubSquad.text.42526528")}</p>;
  const sq = clubSquad(league, teamId, shown);
  const ROLE: Record<BullpenRole, string> = { closer: __i18n_t("ui.clubSquad.text.ed8464a3"), setup: __i18n_t("ui.clubSquad.text.39429c7a"), relief: __i18n_t("ui.clubSquad.text.5b8607a3") };
  return (
    <div class="club-squad">
      <label class="inline">
        {__i18n_t("ui.clubSquad.text.b3000412")}{' '}
        <select value={String(shown)} onChange={(e) => setYear(Number((e.currentTarget as HTMLSelectElement).value))}>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </label>{' '}
      {sq.current && <span class="muted small">{__i18n_t("ui.clubSquad.text.5ff2cf7d")}</span>}
      <h4>{__i18n_t("ui.clubSquad.text.d6656b55")}</h4>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <thead>
            <tr>
              <th>{__i18n_t("ui.clubSquad.text.81922a91")}</th>
              <th>{__i18n_t("ui.clubSquad.text.c37450d6")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.586be0bc")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.e0cee61a")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.0a3d002c")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.1eb19e0a")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.bb6ef1b2")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.7e66b88d")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.9162d3a3")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.fed1c588")}</th>
              <th class="num">{__i18n_t("ui.clubSquad.text.91e54831")}</th>
              <th class="num">WAR</th>
            </tr>
          </thead>
          <tbody>
            {sq.nine.map((h, i) => {
              const pos = SQUAD_POSITIONS[i]!;
              const b = h?.bat;
              return (
                <tr key={pos}>
                  <th scope="row">{POSITION_SHORT[pos]}</th>
                  {h && b ? (
                    <>
                      <td>
                        <Name l={h} onPlayer={onPlayer} />
                      </td>
                      <td class="num">{h.starts}</td>
                      <td class="num">{b.g}</td>
                      <td class="num">{b.pa}</td>
                      <td class="num">{rate(avg(b))}</td>
                      <td class="num">{rate(obp(b))}</td>
                      <td class="num">{rate(slg(b))}</td>
                      <td class="num">{b.hr}</td>
                      <td class="num">{b.rbi}</td>
                      <td class="num">{b.sb}</td>
                      <td class="num">{war(h)}</td>
                    </>
                  ) : (
                    <td colSpan={11} class="muted">
                      -
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h4>{__i18n_t("ui.clubSquad.text.cad4826e")}</h4>
      {sq.rotation.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table">
            <thead>
              <tr>
                <th>{__i18n_t("ui.clubSquad.text.c37450d6")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.e0cee61a")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.a88271df")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.3b1908b7")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.36260e2c")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.639a1f2f")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.f0f9146b")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.3f349ed1")}</th>
                <th class="num">QS</th>
                <th class="num">WAR</th>
              </tr>
            </thead>
            <tbody>
              {sq.rotation.map((l) => {
                const p = l.pit!;
                return (
                  <tr key={l.id}>
                    <td>
                      <Name l={l} onPlayer={onPlayer} />
                    </td>
                    <td class="num">{p.g}</td>
                    <td class="num">{p.gs}</td>
                    <td class="num">{p.w}</td>
                    <td class="num">{p.l}</td>
                    <td class="num">{ip(p.outs)}</td>
                    <td class="num">{era(p).toFixed(2)}</td>
                    <td class="num">{p.k}</td>
                    <td class="num">{p.qs}</td>
                    <td class="num">{war(l)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted small">{__i18n_t("ui.clubSquad.text.0f355a0a")}</p>
      )}
      <h4>{__i18n_t("ui.clubSquad.text.5b8607a3")}</h4>
      {sq.bullpen.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table">
            <thead>
              <tr>
                <th>{__i18n_t("ui.clubSquad.text.f3f4087e")}</th>
                <th>{__i18n_t("ui.clubSquad.text.c37450d6")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.e0cee61a")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.a3fa83d2")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.9329045a")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.3b1908b7")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.36260e2c")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.639a1f2f")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.f0f9146b")}</th>
                <th class="num">{__i18n_t("ui.clubSquad.text.3f349ed1")}</th>
                <th class="num">WAR</th>
              </tr>
            </thead>
            <tbody>
              {sq.bullpen.map((l) => {
                const p = l.pit!;
                return (
                  <tr key={l.id}>
                    <td>{ROLE[l.role ?? 'relief']}</td>
                    <td>
                      <Name l={l} onPlayer={onPlayer} />
                    </td>
                    <td class="num">{p.g}</td>
                    <td class="num">{p.sv}</td>
                    <td class="num">{p.hld}</td>
                    <td class="num">{p.w}</td>
                    <td class="num">{p.l}</td>
                    <td class="num">{ip(p.outs)}</td>
                    <td class="num">{era(p).toFixed(2)}</td>
                    <td class="num">{p.k}</td>
                    <td class="num">{war(l)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted small">{__i18n_t("ui.clubSquad.text.7091a480")}</p>
      )}
      <p class="muted small">{__i18n_t("ui.clubSquad.text.8f14636a")}</p>
    </div>
  );
}
