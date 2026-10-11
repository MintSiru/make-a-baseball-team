import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* The club at a glance (V0.7.7), always in the sidebar: standing, the next game, money and who is out. */
import { projectedPayroll } from '../league/expansion';
import type { LeagueState } from '../league/state';
import { rates, shortName, standingsView } from '../league/views';
import { bracketView } from '../league/postseason';
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
  // 1.4.0: our postseason in a phrase while it is on and after it.
  const post = league.phase === 'postseason' ? bracketView(league)?.ours : null;
  return (
    <section class="club-summary" aria-label={__i18n_t("ui.clubSummary.clubSummary.b2be4c3a")}>
      <dl>
        <div>
          <dt>{__i18n_display(inFirstTeam ? __i18n_k("ui.clubSummary.clubSummary.1c6906ad", { year: league.year }) : __i18n_k("ui.clubSummary.clubSummary.48bea069"))}</dt>
          <dd>
            {__i18n_display(row ? (
              <>
                <strong>{__i18n_t("ui.clubSummary.clubSummary.b372d067", { rank: row.rank })}</strong> {__i18n_display(row.w)}-{__i18n_display(row.l)}-{__i18n_display(row.t)} <span class="muted">{__i18n_display(rates.fmt3(row.pct))}</span>
              </>
            ) : (
              __i18n_k("ui.clubSummary.clubSummary.57787c68", { firstTeamYear: u.firstTeamYear })
            ))}
          </dd>
        </div>
        {__i18n_display(post && (
          <div>
            <dt>{__i18n_t("ui.clubSummary.clubSummary.a0f7a345")}</dt>
            <dd>
              <strong>{__i18n_display(post)}</strong>
            </dd>
          </div>
        ))}
        {__i18n_display(next && (
          <div>
            <dt>{__i18n_t("ui.clubSummary.clubSummary.3b6ea03a")}</dt>
            <dd>
              {__i18n_display(next.home === me ? 'vs' : '@')} {__i18n_display(shortName(league, next.home === me ? next.away : next.home))} <span class="muted">{__i18n_display(next.date.slice(5).replace('-', '/'))}</span>
            </dd>
          </div>
        ))}
        <div>
          <dt>{__i18n_t("ui.clubSummary.clubSummary.64ff6df4")}</dt>
          <dd class={payroll > u.payrollBudget ? 'minus' : ''}>
            {__i18n_display(moneyShort(payroll))} <span class="muted">/ {__i18n_display(moneyShort(u.payrollBudget))}</span>
          </dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.clubSummary.clubSummary.4f7776dd")}</dt>
          <dd>{__i18n_display(moneyShort(u.fund))}</dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.clubSummary.clubSummary.5fc96861")}</dt>
          <dd>
            <button type="button" class="link" onClick={() => onTab('club')} title={__i18n_displayText([...hurt, ...knocks].map(([id, i]) => `${league.players[id]!.name} ${i.part ?? ''}`).join(', '))}>{__i18n_t("ui.clubSummary.clubSummary.e15d2e0c", { length: hurt.length, length2: knocks.length, soldiers: soldiers })}</button>
          </dd>
        </div>
      </dl>
      {__i18n_display(league.pending && (
        <button type="button" class="primary wide" onClick={() => onTab('decision')}>{__i18n_t("ui.clubSummary.clubSummary.bc195740")}</button>
      ))}
    </section>
  );
}
