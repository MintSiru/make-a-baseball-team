/* 2.0.5 (the 2.0 plan's sixth stage, the user's request): our club's all-time records — the seasons year by year,
   the career and single-season leaders for this club, the retired numbers and the hall of fame (clubrecords.ts). */
import { displayText as __i18n_displayText, t as __i18n_t } from '../i18n/index';
import { useState } from 'preact/hooks';
import { clubRecords } from '../league/clubrecords';
import { ClubSquad } from './ClubSquad';
import type { LeagueState } from '../league/state';

type Part = 'years' | 'squad' | 'career' | 'season' | 'honours';

type Board = { label: string; rows: { id: string; name: string; team: string; year?: number; value: string }[] };

function Boards({ boards, onPlayer, years }: { boards: Board[]; onPlayer: (id: string) => void; years: boolean }) {
  return (
    <div class="leader-grid">
      {boards.map((g) => (
        <div key={g.label} class="leader-card">
          <h4>{__i18n_displayText(g.label)}</h4>
          {g.rows.length ? (
            <ol class="plain">
              {g.rows.map((x) => (
                <li key={x.id + (x.year ?? '')}>
                  <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                    {x.name}
                  </button>{' '}
                  {years && x.year && <span class="muted small">{x.year} </span>}
                  <strong>{__i18n_displayText(x.value)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p class="muted small">{__i18n_t("ui.clubRecords.text.c553e88b")}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ClubRecords({ league, teamId, onPlayer }: { league: LeagueState; teamId: string; onPlayer: (id: string) => void }) {
  const [part, setPart] = useState<Part>('years');
  const r = clubRecords(league, teamId);
  const t = r.totals;
  const parts: [Part, string][] = [
    ['years', __i18n_t("ui.clubRecords.text.e3d69cf7")],
    // 2.0.52: each season's best nine, rotation and bullpen (ClubSquad.tsx).
    ['squad', __i18n_t("ui.clubRecords.text.27572b83")],
    ['career', __i18n_t("ui.clubRecords.text.cefd0d88")],
    ['season', __i18n_t("ui.clubRecords.text.7fbedced")],
    ['honours', __i18n_t("ui.clubRecords.text.7d02419b")],
  ];
  return (
    <div class="club-records">
      <p>
        {t.seasons
          ? __i18n_t("ui.clubRecords.text.dd0a8b44", {
              seasons: t.seasons,
              w: t.w,
              l: t.l,
              t: t.t,
              pct: t.pct.toFixed(3).replace(/^0/, ''),
              titles: t.titles,
              postseasons: t.postseasons,
              firsts: t.firsts,
            })
          : __i18n_t("ui.clubRecords.text.31527ed8")}
      </p>
      <div class="segmented small" role="group" aria-label={__i18n_t("ui.clubRecords.text.358435f3")}>
        {parts.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={part === id} onClick={() => setPart(id)}>
            {label}
          </button>
        ))}
      </div>
      {part === 'years' &&
        (r.years.length ? (
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table club-years">
              <thead>
                <tr>
                  <th class="num">{__i18n_t("ui.clubRecords.text.b3000412")}</th>
                  <th class="num">{__i18n_t("ui.clubRecords.text.d15876f1")}</th>
                  <th class="num">{__i18n_t("ui.clubRecords.text.3b1908b7")}</th>
                  <th class="num">{__i18n_t("ui.clubRecords.text.36260e2c")}</th>
                  <th class="num">{__i18n_t("ui.clubRecords.text.56c5af5b")}</th>
                  <th class="num">{__i18n_t("ui.clubRecords.text.82cc030f")}</th>
                  <th>{__i18n_t("ui.clubRecords.text.a0f7a345")}</th>
                  <th>{__i18n_t("ui.clubRecords.text.daec431c")}</th>
                  <th>{__i18n_t("ui.clubRecords.text.a6ef8381")}</th>
                  <th class="num">{__i18n_t("ui.clubRecords.text.ada49ec6")}</th>
                </tr>
              </thead>
              <tbody>
                {r.years.map((y) => (
                  <tr key={y.year} class={y.post?.won ? 'champion-row' : undefined}>
                    <td class="num">{y.current ? __i18n_t("ui.clubRecords.text.04555519", { year: y.year }) : y.year}</td>
                    <td class="num">{__i18n_t("ui.clubRecords.text.d7a5cf38", { rank: y.rank, of: y.of })}</td>
                    <td class="num">{y.w}</td>
                    <td class="num">{y.l}</td>
                    <td class="num">{y.t}</td>
                    <td class="num">{y.pct.toFixed(3).replace(/^0/, '')}</td>
                    <td>{y.post ? (y.post.won ? <strong>{__i18n_t("ui.clubRecords.text.894badc3")}</strong> : __i18n_t("ui.clubRecords.text.92789c04", { round: __i18n_displayText(y.post.round) })) : y.current ? '' : '-'}</td>
                    <td>{y.manager ?? '-'}</td>
                    <td>
                      {y.captain ? (
                        <button type="button" class="link" onClick={() => onPlayer(y.captain!.id)}>
                          {y.captain.name}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td class="num">{y.crowd == null ? '-' : y.crowd.toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p class="muted">{__i18n_t("ui.clubRecords.text.59dd0785")}</p>
        ))}
      {part === 'years' && <p class="muted small">{__i18n_t("ui.clubRecords.text.90fb1442")}</p>}
      {part === 'squad' && <ClubSquad league={league} teamId={teamId} onPlayer={onPlayer} />}
      {part === 'career' && (
        <>
          <Boards boards={r.room.career} onPlayer={onPlayer} years={false} />
          <p class="muted small">{__i18n_t("ui.clubRecords.text.a9fb0d1b")}</p>
        </>
      )}
      {part === 'season' && (
        <>
          <Boards boards={r.room.season} onPlayer={onPlayer} years />
          <p class="muted small">{__i18n_t("ui.clubRecords.text.f4ef302a")}</p>
        </>
      )}
      {part === 'honours' && (
        <>
          <h4>{__i18n_t("ui.clubRecords.text.adad27c2")}</h4>
          {r.retired.length ? (
            <ul class="plain">
              {r.retired.map((x) => (
                <li key={x.number}>
                  <strong class="num">{x.number}</strong>{' '}
                  <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                    {x.name}
                  </button>{' '}
                  <span class="muted small">{x.from != null ? __i18n_t("ui.clubRecords.text.84f0cdb6", { from: x.from, to: x.to ?? x.from, year: x.year }) : __i18n_t("ui.clubRecords.text.06627201", { year: x.year })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted small">{__i18n_t("ui.clubRecords.text.be69e307")}</p>
          )}
          <h4>{__i18n_t("ui.clubRecords.text.6999864f")}</h4>
          {r.hall.length ? (
            <ul class="plain">
              {r.hall.map((x) => (
                <li key={x.id}>
                  <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                    {x.name}
                  </button>{' '}
                  <span class="muted small">{__i18n_t("ui.clubRecords.text.3e15aacd", { year: x.year, war: x.war.toFixed(1) })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted small">{__i18n_t("ui.clubRecords.text.ccf7056b")}</p>
          )}
        </>
      )}
    </div>
  );
}
