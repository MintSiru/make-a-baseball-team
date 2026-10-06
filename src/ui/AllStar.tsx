/* The All-Star page (1.2.0) in the 기록 tab: the voting as it stands (each spot on each side, the leaders first and our
   candidates marked), our club's voting drive, the squads once the 베스트12 are in, the game and the home run race,
   and every year before. */
import type { Action } from '../league/actions';
import { allStarView, checkCampaign, SEATS, SIDE_LABEL, SIDES, SPOT_LABEL, SPOTS, type TallyRow } from '../league/allstar';
import type { LeagueState } from '../league/state';
import { ALL_STAR } from '../league/tuning';
import { shortName } from '../league/views';
import { money } from './format';

const md = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export function AllStar({ league, onPlayer, onBox, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onBox?: (id: string) => void; onAct?: (a: Action) => void }) {
  const v = allStarView(league);
  const a = v.state;
  const mine = league.user?.teamId;
  const who = (id: string) => (
    <button type="button" class="link" onClick={() => onPlayer(id)}>
      {league.players[id]?.name ?? '?'}
    </button>
  );
  const blocked = league.user ? checkCampaign(league) : '구단이 없습니다.';
  return (
    <div class="allstar">
      <p class="muted">
        팬 투표(70%)와 선수단 투표(30%)로 {v.dates.open.slice(0, 4)}년 {md(v.dates.open)}부터 {md(v.dates.close)}까지 포지션마다 베스트12를 뽑고, 감독 추천 선수까지 양 팀 {ALL_STAR.squad}명이 {md(v.dates.game)} 올스타전에
        나갑니다. 전날에는 홈런 레이스가 열립니다. 올스타전 기록은 시즌 기록에 들어가지 않습니다.
      </p>
      {!a && <p>{league.phase === 'regular' ? `투표는 ${md(v.dates.open)}에 시작합니다.` : '올해 올스타전은 정규시즌에 열립니다.'}</p>}
      {a && (
        <>
          <p>
            {a.elected ? `투표 마감 (${md(v.dates.close)})` : a.tallies.length ? `${a.tallies.length}차 중간 집계 (${md(a.tallies.at(-1)!)})` : '투표 중 — 첫 중간 집계 전'}
            {a.game && (
              <>
                {' '}
                · 올스타전 드림 {a.game.runs.dream} : 나눔 {a.game.runs.nanum}
                {a.game.mvp && <> · 미스터 올스타 {who(a.game.mvp)}</>} · 홈런 레이스 {who(a.game.derby.winner)}{' '}
                {onBox && (
                  <button type="button" onClick={() => onBox(a.game!.boxId)}>
                    기록지
                  </button>
                )}
              </>
            )}
          </p>
          {league.user && !a.elected && onAct && (
            <p class="inline-form">
              <button type="button" disabled={!!blocked} title={blocked ?? ''} onClick={() => onAct({ kind: 'allStarCampaign' })}>
                팬 투표 독려 캠페인 ({money(ALL_STAR.campaign.cost)})
              </button>
              <span class="muted small">
                {a.campaign ? '캠페인 중: 우리 후보의 팬 투표가 늘었습니다.' : `우리 후보의 팬 투표가 지금부터 ${Math.round(ALL_STAR.campaign.boost * 100)}% 늘어납니다. 한 시즌 한 번.`}
              </span>
            </p>
          )}
          {a.squads ? <Squads league={league} who={who} /> : <Votes league={league} rows={v.rows} mine={mine} who={who} counted={a.tallies.length > 0} />}
        </>
      )}
      {v.history.length > 0 && (
        <>
          <h3>역대 올스타전</h3>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table">
              <caption class="sr-only">역대 올스타전</caption>
              <thead>
                <tr>
                  <th>연도</th>
                  <th>장소</th>
                  <th class="num">드림</th>
                  <th class="num">나눔</th>
                  <th>미스터 올스타</th>
                  <th>홈런 레이스</th>
                </tr>
              </thead>
              <tbody>
                {v.history.map((h) => (
                  <tr key={h.year}>
                    <td>{h.year}</td>
                    <td>{shortName(league, h.host)}</td>
                    <td class="num">{h.runs.dream}</td>
                    <td class="num">{h.runs.nanum}</td>
                    <td>{h.mvp ? who(h.mvp) : '-'}</td>
                    <td>{h.derby ? who(h.derby) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** The voting so far: each spot's candidates on each side, the ones in line for a place first. */
function Votes({ league, rows, mine, who, counted }: { league: LeagueState; rows: TallyRow[]; mine?: string; who: (id: string) => preact.JSX.Element; counted: boolean }) {
  if (!counted) return <p class="muted">구단별 후보가 나왔습니다. 첫 중간 집계가 나오면 득표가 보입니다.</p>;
  return (
    <div class="allstar-sides">
      {SIDES.map((side) => (
        <section key={side} aria-label={SIDE_LABEL[side]}>
          <h3>{SIDE_LABEL[side]}</h3>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table">
              <caption class="sr-only">{SIDE_LABEL[side]} 투표 현황</caption>
              <thead>
                <tr>
                  <th>포지션</th>
                  <th>선수</th>
                  <th>구단</th>
                  <th class="num">팬 투표</th>
                  <th class="num">선수단</th>
                  <th class="num">합산</th>
                </tr>
              </thead>
              <tbody>
                {SPOTS.flatMap((spot) =>
                  rows
                    .filter((r) => r.side === side && r.spot === spot)
                    .filter((r) => r.rank <= SEATS[spot] + 1 || r.teamId === mine)
                    .map((r) => (
                      <tr key={r.id} class={`${r.rank <= SEATS[spot] ? 'strong' : ''} ${r.teamId === mine ? 'mine' : ''}`}>
                        <td>
                          {SPOT_LABEL[spot]} {r.rank}위
                        </td>
                        <td>{who(r.id)}</td>
                        <td>{shortName(league, r.teamId)}</td>
                        <td class="num">{r.fans.toLocaleString('ko-KR')}</td>
                        <td class="num">{r.players.toLocaleString('ko-KR')}</td>
                        <td class="num">{pct(r.score)}</td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p class="muted small">포지션마다 1위(외야수는 3위까지)가 베스트12입니다. 합산은 팬 투표 득표율의 70%와 선수단 투표 득표율의 30%를 더한 값입니다.</p>
    </div>
  );
}

/** The two squads: the 베스트12 (★) and the managers' picks. */
function Squads({ league, who }: { league: LeagueState; who: (id: string) => preact.JSX.Element }) {
  const a = league.allStar!;
  return (
    <div class="allstar-sides">
      {SIDES.map((side) => (
        <section key={side} aria-label={SIDE_LABEL[side]}>
          <h3>{SIDE_LABEL[side]}</h3>
          <ul class="plain allstar-squad">
            {a.squads![side].map((id) => {
              const c = a.candidates.find((x) => x.id === id);
              const elected = a.elected!.includes(id);
              return (
                <li key={id} class={league.players[id]?.teamId === league.user?.teamId ? 'mine' : ''}>
                  {elected ? '★ ' : ''}
                  {who(id)} <span class="muted small">{shortName(league, league.players[id]?.teamId ?? null)}{elected && c ? ` · ${SPOT_LABEL[c.spot]}` : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p class="muted small">★ 팬·선수단 투표로 뽑힌 베스트12, 나머지는 감독 추천입니다.</p>
    </div>
  );
}
