/* The club at a glance (V0.7.7), always in the sidebar: standing, the next game, money and who is out. */
import { projectedPayroll } from '../league/expansion';
import type { LeagueState } from '../league/state';
import { rates, shortName, standingsView } from '../league/views';
import { moneyShort } from './format';

export function ClubSummary({ league, onTab }: { league: LeagueState; onTab: (tab: 'club' | 'decision') => void }) {
  const u = league.user!;
  const me = u.teamId;
  const inFirstTeam = league.year >= u.firstTeamYear;
  const row = inFirstTeam ? standingsView(league).find((r) => r.teamId === me) : undefined;
  const next = league.phase === 'regular' ? league.schedule.slice(league.next).find((g) => g.home === me || g.away === me) : undefined;
  const payYear = league.phase === 'offseason' && league.offseason ? league.offseason.year + 1 : league.year;
  const payroll = projectedPayroll(league, me, payYear);
  const hurt = Object.entries(league.injuries).filter(([id, i]) => league.players[id]?.teamId === me && !i.dtd);
  const knocks = Object.entries(league.injuries).filter(([id, i]) => league.players[id]?.teamId === me && i.dtd);
  const soldiers = Object.values(league.players).filter((p) => p.teamId === me && p.status === 'military').length;
  return (
    <section class="club-summary" aria-label="우리 구단 요약">
      <dl>
        <div>
          <dt>{inFirstTeam ? `${league.year} 순위` : '1군 진입'}</dt>
          <dd>
            {row ? (
              <>
                <strong>{row.rank}위</strong> {row.w}-{row.l}-{row.t} <span class="muted">{rates.fmt3(row.pct)}</span>
              </>
            ) : (
              `${u.firstTeamYear}년`
            )}
          </dd>
        </div>
        {next && (
          <div>
            <dt>다음 경기</dt>
            <dd>
              {next.home === me ? 'vs' : '@'} {shortName(league, next.home === me ? next.away : next.home)} <span class="muted">{next.date.slice(5).replace('-', '/')}</span>
            </dd>
          </div>
        )}
        <div>
          <dt>연봉 / 예산</dt>
          <dd class={payroll > u.payrollBudget ? 'minus' : ''}>
            {moneyShort(payroll)} <span class="muted">/ {moneyShort(u.payrollBudget)}</span>
          </dd>
        </div>
        <div>
          <dt>구단 자금</dt>
          <dd>{moneyShort(u.fund)}</dd>
        </div>
        <div>
          <dt>부상 · 결장 · 군</dt>
          <dd>
            <button type="button" class="link" onClick={() => onTab('club')} title={[...hurt, ...knocks].map(([id, i]) => `${league.players[id]!.name} ${i.part ?? ''}`).join(', ')}>
              {hurt.length}명 · {knocks.length}명 · {soldiers}명
            </button>
          </dd>
        </div>
      </dl>
      {league.pending && (
        <button type="button" class="primary wide" onClick={() => onTab('decision')}>
          결정하러 가기
        </button>
      )}
    </section>
  );
}
