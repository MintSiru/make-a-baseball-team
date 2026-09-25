import { cityById } from '../club/cities';
import { PARENT_COMPANY_TYPES } from '../club/types';
import { projectedPayroll } from '../league/expansion';
import type { LeagueState } from '../league/state';
import { shortName, standingsView } from '../league/views';
import { money } from './format';
import { TeamRoster } from './TeamRoster';

/** The user's club: identity, money, where it stands, the founding timeline and its roster. */
export function MyClub({ league, onPlayer, onTeam }: { league: LeagueState; onPlayer: (id: string) => void; onTeam: (id: string) => void }) {
  const u = league.user!;
  const team = league.teams.find((t) => t.id === u.teamId)!;
  const city = cityById(u.settings.cityId)!;
  const inFirstTeam = league.year >= u.firstTeamYear;
  const row = standingsView(league).find((r) => r.teamId === u.teamId);
  const f = league.futures;
  const fr = f ? f.scores.reduce((a, g) => {
        const [mine, theirs] = g.home === u.teamId ? [g.hs, g.as] : [g.as, g.hs];
        return { w: a.w + (mine > theirs ? 1 : 0), l: a.l + (mine < theirs ? 1 : 0), t: a.t + (mine === theirs ? 1 : 0) };
      }, { w: 0, l: 0, t: 0 })
    : null;
  const payYear = league.phase === 'offseason' && league.offseason ? league.offseason.year + 1 : league.year;
  const steps = [
    { year: 2026, label: '7월 창단 승인 · 트라이아웃' },
    { year: 2026, label: '9월 첫 신인 드래프트 (우선지명)' },
    ...(u.firstTeamYear === 2028 ? [{ year: 2027, label: '퓨처스리그 참가' }] : []),
    { year: u.firstTeamYear - 1, label: '겨울 특별지명 · FA 특례 · 외국인 계약' },
    { year: u.firstTeamYear, label: '1군 진입' },
  ];
  return (
    <section aria-labelledby="myclub-title" style={{ '--accent': team.color } as Record<string, string>}>
      <h2 id="myclub-title">
        <span class="swatch" style={{ background: team.color }} aria-hidden="true" /> {team.name}
      </h2>
      <p class="muted">
        {city.name} · {PARENT_COMPANY_TYPES[u.settings.parentType].label} {team.parent.name} · {team.stadium.name} {team.stadium.capacity.toLocaleString('ko-KR')}석
      </p>
      <dl class="facts club-facts">
        <div>
          <dt>{inFirstTeam ? `${league.year} 1군` : `${league.year} 시즌`}</dt>
          <dd>{inFirstTeam && row ? `${row.rank}위 ${row.w}승 ${row.l}패 ${row.t}무` : fr ? `퓨처스 ${fr.w}승 ${fr.l}패 ${fr.t}무` : '창단 준비'}</dd>
        </div>
        <div>
          <dt>창단 자금</dt>
          <dd>{money(u.fund)}</dd>
        </div>
        <div>
          <dt>{payYear}년 연봉 / 예산</dt>
          <dd>
            {money(projectedPayroll(league, u.teamId, payYear))} / {money(u.payrollBudget)}
          </dd>
        </div>
        <div>
          <dt>1군 진입</dt>
          <dd>{u.firstTeamYear}년</dd>
        </div>
      </dl>

      <h3>창단 일정</h3>
      <ol class="timeline">
        {steps.map((st) => (
          <li key={st.label} class={league.year > st.year || (league.year === st.year && inFirstTeam) ? 'done' : ''}>
            <span class="num">{st.year}</span> {st.label}
          </li>
        ))}
      </ol>

      {f && f.scores.length > 0 && (
        <>
          <h3>최근 퓨처스 경기</h3>
          <ul class="scores">
            {f.scores.slice(-5).reverse().map((g) => (
              <li key={g.id} class="numbers">
                {g.date.slice(5)} {shortName(league, g.away)} {g.as} : {g.hs} {shortName(league, g.home)}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>자금 내역</h3>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table ledger">
          <tbody>
            {[...u.ledger].reverse().slice(0, 30).map((l, i) => (
              <tr key={i}>
                <td class="num">{l.year}</td>
                <td>{l.label}</td>
                <td class="num">{l.amount ? money(-l.amount) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TeamRoster league={league} teamId={u.teamId} onTeam={onTeam} onPlayer={onPlayer} hideChips />
    </section>
  );
}
