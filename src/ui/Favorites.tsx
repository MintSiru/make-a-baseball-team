import { t as __i18n_t } from '../i18n/index';
/* 2.0.34 (the user's request: 선수 즐겨찾기): the players starred from their screens, with this season's line and,
   for a pitcher, how ready his arm is (favorites.ts). */
import type { Action } from '../league/actions';
import { favoritesView } from '../league/favorites';
import type { LeagueState } from '../league/state';
import { ArmMeter } from './ArmMeter';

export function Favorites({ league, onPlayer, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onAct?: (a: Action) => void }) {
  const rows = favoritesView(league);
  return (
    <section class="panel favorites" tabIndex={0} aria-label={__i18n_t("ui.favorites.text.fd8b4b1e", { n: rows.length })}>
      <h3>{__i18n_t("ui.favorites.text.fd8b4b1e", { n: rows.length })}</h3>
      {rows.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="mini-table">
            <thead>
              <tr>
                <th>{__i18n_t("ui.favorites.text.9aa18e50")}</th>
                <th>{__i18n_t("ui.favorites.text.58756112")}</th>
                <th>{__i18n_t("ui.favorites.text.81922a91")}</th>
                <th class="num">{__i18n_t("ui.favorites.text.6c620e5c")}</th>
                <th class="num">{__i18n_t("ui.favorites.text.001e4be2")}</th>
                <th>{__i18n_t("ui.favorites.text.3ab6c6f3")}</th>
                <th>{__i18n_t("ui.favorites.text.d1e9896f")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} class="player-row">
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                      ★ {r.name}
                    </button>
                  </td>
                  <td>{r.team}</td>
                  <td>{r.pos}</td>
                  <td class="num">{r.age}</td>
                  <td class="num">{r.grade}</td>
                  <td>{r.line}</td>
                  <td>{r.arm ? <ArmMeter arm={r.arm} /> : ''}</td>
                  <td>
                    {onAct && (
                      <button type="button" class="link small" onClick={() => onAct({ kind: 'favorite', id: r.id, on: false })} aria-label={__i18n_t("ui.favorites.text.555feabb", { name: r.name })}>
                        {__i18n_t("ui.favorites.text.a7abea5b")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted small">{__i18n_t("ui.favorites.text.018f5644")}</p>
      )}
    </section>
  );
}
