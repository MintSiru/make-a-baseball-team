import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Games (V0.7): the user's games this season and the league's last few days; each opens its box score. */
import type { LeagueState } from '../league/state';
import { gameList } from '../league/views';
import { spoilerHidden } from './display';

type Row = ReturnType<typeof gameList>['mine'][number];

function GameTable({ rows, onOpen, mine }: { rows: Row[]; onOpen: (id: string) => void; mine: boolean }) {
  if (!rows.length) return <p class="muted">{__i18n_t("ui.games.gameTable.eac67846")}</p>;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table games-table">
        <thead>
          <tr>
            <th>{__i18n_t("ui.games.gameTable.5caa75a8")}</th>
            <th>{__i18n_t("ui.games.gameTable.ef6b033f")}</th>
            <th class="num">{__i18n_t("ui.games.gameTable.67d2cf6b")}</th>
            <th>{__i18n_t("ui.games.gameTable.13a46f96")}</th>
            {__i18n_display(mine && <th>{__i18n_t("ui.games.gameTable.71d855ac")}</th>)}
            <th class="num">{__i18n_t("ui.games.gameTable.f3384bbb")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {__i18n_display(rows.map((g) => {
            const hide = mine && spoilerHidden(g.id, true, !!g.pbp);
            return (
            <tr key={g.id} class="player-row">
              <td>
                {__i18n_display(g.date.slice(5))}
                {__i18n_display(g.post && <span class="tag">PS</span>)}
              </td>
              <td class={!hide && g.as > g.hs ? 'strong' : ''}>{__i18n_display(g.away)}</td>
              <td class="num">{__i18n_display(hide ? '? : ?' : `${g.as} : ${g.hs}`)}</td>
              <td class={!hide && g.hs > g.as ? 'strong' : ''}>{__i18n_display(g.home)}</td>
              {__i18n_display(mine && <td class={hide ? 'muted' : g.result === '승' ? 'plus' : g.result === '패' ? 'minus' : ''}>{__i18n_display(hide ? __i18n_k("ui.games.gameTable.5938236a") : g.result)}</td>)}
              <td class="num">{__i18n_display(g.att ? g.att.toLocaleString('ko-KR') : '-')}</td>
              <td>
                <button type="button" class="link" onClick={() => onOpen(g.id)}>
                  {__i18n_display(hide ? __i18n_k("ui.games.gameTable.5f44ff00") : g.pbp ? __i18n_k("ui.games.gameTable.f934b6e0") : __i18n_k("ui.games.gameTable.8fcc8f9a"))}
                </button>
              </td>
            </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

export function Games({ league, onOpen }: { league: LeagueState; onOpen: (id: string) => void }) {
  const list = gameList(league);
  return (
    <section aria-labelledby="games-title">
      <h2 id="games-title">{__i18n_t("ui.games.games.e0cee61a")}</h2>
      <div class={league.user ? 'split' : undefined}>
        {__i18n_display(league.user && (
          <div class="panel tall" tabIndex={0} aria-label={__i18n_t("ui.games.games.bc02b8ba")}>
            <h3>{__i18n_t("ui.games.games.23c54cc0", { year: league.year })}</h3>
            <p class="muted">{__i18n_t("ui.games.games.d26a8db2")}</p>
            <GameTable rows={list.mine} onOpen={onOpen} mine />
          </div>
        ))}
        <div class={league.user ? 'panel tall' : undefined}>
          <h3>{__i18n_t("ui.games.games.8eaf05a2")}</h3>
          <GameTable rows={list.recent} onOpen={onOpen} mine={false} />
        </div>
      </div>
    </section>
  );
}
