import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* The All-Star page (1.2.0) in the 기록 tab: the voting as it stands (each spot on each side, the leaders first and our
   candidates marked), our club's voting drive, the squads once the 베스트12 are in, the game and the home run race,
   and every year before. */
import type { Action } from '../league/actions';
import { allStarView, checkCampaign, SEATS, SIDE_LABEL, SIDES, SPOT_LABEL, SPOTS, type TallyRow } from '../league/allstar';
import type { LeagueState } from '../league/state';
import { ALL_STAR } from '../league/tuning';
import { shortName } from '../league/views';
import { money } from './format';

const md = (date: string) => __i18n_k("ui.allStar.md.a629d4ea", { number: Number(date.slice(5, 7)), number2: Number(date.slice(8)) });
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export function AllStar({ league, onPlayer, onBox, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onBox?: (id: string) => void; onAct?: (a: Action) => void }) {
  const v = allStarView(league);
  const a = v.state;
  const mine = league.user?.teamId;
  const who = (id: string) => (
    <button type="button" class="link" onClick={() => onPlayer(id)}>
      {__i18n_display(league.players[id]?.name ?? '?')}
    </button>
  );
  const blocked = league.user ? checkCampaign(league) : __i18n_k("ui.allStar.allStar.blocked.272add95");
  return (
    <div class="allstar">
      <p class="muted">{__i18n_t("ui.allStar.allStar.202e5be2", { value: v.dates.open.slice(0, 4), md: md(v.dates.open), md2: md(v.dates.close), squad: ALL_STAR.squad, md3: md(v.dates.game) })}</p>
      {__i18n_display(!a && <p>{__i18n_display(league.phase === 'regular' ? __i18n_k("ui.allStar.allStar.220feade", { md: md(v.dates.open) }) : __i18n_k("ui.allStar.allStar.80b527d4"))}</p>)}
      {__i18n_display(a && (
        <>
          <p>
            {__i18n_display(a.elected ? __i18n_k("ui.allStar.allStar.3d6212fa", { md: md(v.dates.close) }) : a.tallies.length ? __i18n_k("ui.allStar.allStar.cdb7daf2", { length: a.tallies.length, md: md(a.tallies.at(-1)!) }) : __i18n_k("ui.allStar.allStar.7374e1a2"))}
            {__i18n_display(a.game && (
              <>{__i18n_t("ui.allStar.allStar.3e91ca92", { value: ' ', dream: a.game.runs.dream, nanum: a.game.runs.nanum, value2: a.game.mvp && <>{__i18n_t("ui.allStar.allStar.0500abec", { who: who(a.game.mvp) })}</>, who: who(a.game.derby.winner), value3: ' ', value4: onBox && (
                  <button type="button" onClick={() => onBox(a.game!.boxId)}>{__i18n_t("ui.allStar.allStar.8fcc8f9a")}</button>
                ) })}</>
            ))}
          </p>
          {__i18n_display(league.user && !a.elected && onAct && (
            <p class="inline-form">
              <button type="button" disabled={!!blocked} title={__i18n_displayText(blocked ?? '')} onClick={() => onAct({ kind: 'allStarCampaign' })}>{__i18n_t("ui.allStar.allStar.b3b449a4", { money: money(ALL_STAR.campaign.cost) })}</button>
              <span class="muted small">
                {__i18n_display(a.campaign ? __i18n_k("ui.allStar.allStar.6ea729d3") : __i18n_k("ui.allStar.allStar.ef5ecf65", { value: Math.round(ALL_STAR.campaign.boost * 100) }))}
              </span>
            </p>
          ))}
          {__i18n_display(a.squads ? <Squads league={league} who={who} /> : <Votes league={league} rows={v.rows} mine={mine} who={who} counted={a.tallies.length > 0} />)}
        </>
      ))}
      {__i18n_display(v.history.length > 0 && (
        <>
          <h3>{__i18n_t("ui.allStar.allStar.232c4215")}</h3>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table">
              <caption class="sr-only">{__i18n_t("ui.allStar.allStar.232c4215")}</caption>
              <thead>
                <tr>
                  <th>{__i18n_t("ui.allStar.allStar.d5bc99dd")}</th>
                  <th>{__i18n_t("ui.allStar.allStar.962eebc6")}</th>
                  <th class="num">{__i18n_t("ui.allStar.allStar.c2c3ed38")}</th>
                  <th class="num">{__i18n_t("ui.allStar.allStar.ca6f7a21")}</th>
                  <th>{__i18n_t("ui.allStar.allStar.844d0b48")}</th>
                  <th>{__i18n_t("ui.allStar.allStar.5bbf11e7")}</th>
                </tr>
              </thead>
              <tbody>
                {__i18n_display(v.history.map((h) => (
                  <tr key={h.year}>
                    <td>{__i18n_display(h.year)}</td>
                    <td>{__i18n_display(shortName(league, h.host))}</td>
                    <td class="num">{__i18n_display(h.runs.dream)}</td>
                    <td class="num">{__i18n_display(h.runs.nanum)}</td>
                    <td>{__i18n_display(h.mvp ? who(h.mvp) : '-')}</td>
                    <td>{__i18n_display(h.derby ? who(h.derby) : '-')}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </>
      ))}
    </div>
  );
}

/** The voting so far: each spot's candidates on each side, the ones in line for a place first. */
function Votes({ league, rows, mine, who, counted }: { league: LeagueState; rows: TallyRow[]; mine?: string; who: (id: string) => preact.JSX.Element; counted: boolean }) {
  if (!counted) return <p class="muted">{__i18n_t("ui.allStar.votes.dabff592")}</p>;
  return (
    <div class="allstar-sides">
      {__i18n_display(SIDES.map((side) => (
        <section key={side} aria-label={__i18n_displayText(SIDE_LABEL[side])}>
          <h3>{__i18n_display(SIDE_LABEL[side])}</h3>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table">
              <caption class="sr-only">{__i18n_t("ui.allStar.votes.02a8ec4c", { value: SIDE_LABEL[side] })}</caption>
              <thead>
                <tr>
                  <th>{__i18n_t("ui.allStar.votes.81922a91")}</th>
                  <th>{__i18n_t("ui.allStar.votes.c37450d6")}</th>
                  <th>{__i18n_t("ui.allStar.votes.58756112")}</th>
                  <th class="num">{__i18n_t("ui.allStar.votes.180db4e3")}</th>
                  <th class="num">{__i18n_t("ui.allStar.votes.5b9daec2")}</th>
                  <th class="num">{__i18n_t("ui.allStar.votes.cf3d3bd1")}</th>
                </tr>
              </thead>
              <tbody>
                {__i18n_display(SPOTS.flatMap((spot) =>
                  rows
                    .filter((r) => r.side === side && r.spot === spot)
                    .filter((r) => r.rank <= SEATS[spot] + 1 || r.teamId === mine)
                    .map((r) => (
                      <tr key={r.id} class={`${r.rank <= SEATS[spot] ? 'strong' : ''} ${r.teamId === mine ? 'mine' : ''}`}>
                        <td>{__i18n_t("ui.allStar.votes.7f92a8c6", { value: SPOT_LABEL[spot], rank: r.rank })}</td>
                        <td>{__i18n_display(who(r.id))}</td>
                        <td>{__i18n_display(shortName(league, r.teamId))}</td>
                        <td class="num">{__i18n_display(r.fans.toLocaleString('ko-KR'))}</td>
                        <td class="num">{__i18n_display(r.players.toLocaleString('ko-KR'))}</td>
                        <td class="num">{__i18n_display(pct(r.score))}</td>
                      </tr>
                    )),
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )))}
      <p class="muted small">{__i18n_t("ui.allStar.votes.a2134828")}</p>
    </div>
  );
}

/** The two squads: the 베스트12 (★) and the managers' picks. */
function Squads({ league, who }: { league: LeagueState; who: (id: string) => preact.JSX.Element }) {
  const a = league.allStar!;
  return (
    <div class="allstar-sides">
      {__i18n_display(SIDES.map((side) => (
        <section key={side} aria-label={__i18n_displayText(SIDE_LABEL[side])}>
          <h3>{__i18n_display(SIDE_LABEL[side])}</h3>
          <ul class="plain allstar-squad">
            {__i18n_display(a.squads![side].map((id) => {
              const c = a.candidates.find((x) => x.id === id);
              const elected = a.elected!.includes(id);
              return (
                <li key={id} class={league.players[id]?.teamId === league.user?.teamId ? 'mine' : ''}>
                  {__i18n_display(elected ? '★ ' : '')}
                  {__i18n_display(who(id))} <span class="muted small">{__i18n_display(shortName(league, league.players[id]?.teamId ?? null))}{__i18n_display(elected && c ? ` · ${SPOT_LABEL[c.spot]}` : '')}</span>
                </li>
              );
            }))}
          </ul>
        </section>
      )))}
      <p class="muted small">{__i18n_t("ui.allStar.squads.efc8f238")}</p>
    </div>
  );
}
