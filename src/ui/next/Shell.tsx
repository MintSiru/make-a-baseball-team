/* 2.0.62 (the user's mockups, 새 UI): the page's frame — the club's brand and its numbers at a glance in the sidebar,
   the menu in two groups (the club's own work, the league and its records), the file links at its foot; and the bar
   over the page with the day, today's game and the day's buttons. The layout says what each part is: no labels or
   notes beyond the names. */
import type { ComponentChildren } from 'preact';
import { getLocale, t as __i18n_t } from '../../i18n/index';
import { nextDate } from '../../league/actions';
import { projectedPayroll } from '../../league/expansion';
import { bracketView } from '../../league/postseason';
import type { LeagueState } from '../../league/state';
import { clubStanding, rates, shortName } from '../../league/views';
import { moneyShort } from '../format';

export interface NavItem {
  id: string;
  label: string;
  current: boolean;
  /** A count beside the name (alerts not yet read). */
  badge?: number;
  /** The winter's decision waiting: it stands out. */
  waiting?: boolean;
  onClick: () => void;
}

const LOCALE_TAG = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' } as const;

/** "2028. 06. 28 (수)" in the page's language. */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = d.toLocaleDateString(LOCALE_TAG[getLocale()], { weekday: 'short', timeZone: 'UTC' });
  return `${date.slice(0, 4)}. ${date.slice(5, 7)}. ${date.slice(8, 10)} (${weekday})`;
}

/** The season's phase in a word, under the club's name. */
function phaseWord(s: LeagueState): string {
  if (s.phase === 'offseason') return __i18n_t("ui.next.shell.text.dfc7fe9a", { year: s.offseason?.year ?? s.year });
  if (s.phase === 'postseason') return __i18n_t("ui.next.shell.text.c2bc62c6", { year: s.year });
  return __i18n_t("ui.next.shell.text.c80e0ef9", { year: s.year });
}

/** The club's numbers: standing, the next game, payroll against the budget, the fund, who is out. */
function Hud({ league, onClub }: { league: LeagueState; onClub: () => void }) {
  const u = league.user!;
  const me = u.teamId;
  const inFirstTeam = league.year >= u.firstTeamYear;
  const standing = inFirstTeam ? clubStanding(league, me) : null;
  const row = standing?.row;
  const next = league.phase === 'regular' ? league.schedule.slice(league.next).find((g) => g.home === me || g.away === me) : undefined;
  const payYear = league.phase === 'offseason' && league.offseason ? league.offseason.year + 1 : league.year;
  const payroll = projectedPayroll(league, me, payYear);
  const share = Math.min(1, payroll / Math.max(1, u.payrollBudget));
  const hurt = Object.entries(league.injuries).filter(([id, i]) => league.players[id]?.teamId === me && !i.dtd).length;
  const knocks = Object.entries(league.injuries).filter(([id, i]) => league.players[id]?.teamId === me && i.dtd).length;
  const soldiers = Object.values(league.players).filter((p) => p.teamId === me && p.status === 'military').length;
  const post = league.phase === 'postseason' ? bracketView(league)?.ours : null;
  return (
    <section class="hud-card" aria-label={__i18n_t("ui.next.shell.text.ce112162")}>
      <dl>
        <div>
          <dt>{inFirstTeam ? __i18n_t("ui.next.shell.text.1c6906ad", { year: league.year }) : __i18n_t("ui.next.shell.text.48bea069")}</dt>
          <dd>
            {row ? (
              <>
                <strong>{standing?.league ? `${standing.league} ${row.rank}` : __i18n_t("ui.next.shell.text.b372d067", { rank: row.rank })}</strong> {row.w}-{row.l}-{row.t} <span class="muted">{rates.fmt3(row.pct)}</span>
              </>
            ) : (
              u.firstTeamYear
            )}
          </dd>
        </div>
        {post && (
          <div>
            <dt>{__i18n_t("ui.next.shell.text.a0f7a345")}</dt>
            <dd>
              <strong>{post}</strong>
            </dd>
          </div>
        )}
        {next && (
          <div>
            <dt>{__i18n_t("ui.next.shell.text.3b6ea03a")}</dt>
            <dd>
              {next.home === me ? 'vs' : '@'} {shortName(league, next.home === me ? next.away : next.home)} <span class="muted">{next.date.slice(5).replace('-', '/')}</span>
            </dd>
          </div>
        )}
        <div>
          <dt>{__i18n_t("ui.next.shell.text.75badfb0", { year: payYear })}</dt>
          <dd>
            <span class={payroll > u.payrollBudget ? 'minus' : undefined}>{moneyShort(payroll)}</span> <span class="muted">/ {moneyShort(u.payrollBudget)}</span>
            <span class={`hud-bar${payroll > u.payrollBudget ? ' over' : ''}`} aria-hidden="true">
              <i style={{ width: `${Math.round(share * 100)}%` }} />
            </span>
          </dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.next.shell.text.4f7776dd")}</dt>
          <dd class={u.fund < 0 ? 'minus' : undefined}>{moneyShort(u.fund)}</dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.next.shell.text.7d657386")}</dt>
          <dd>
            <button type="button" class={`link${hurt ? ' minus' : ''}`} onClick={onClub}>
              {__i18n_t("ui.next.shell.text.3389bc8a", { hurt, knocks, soldiers })}
            </button>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function NextSidebar({
  league,
  groups,
  foot,
  onClub,
  extra,
}: {
  league: LeagueState;
  groups: { label: string; items: NavItem[] }[];
  /** The file links and the rest, at the sidebar's foot. */
  foot: ComponentChildren;
  onClub: () => void;
  /** A button the page needs now (the tutorial paused, alerts left unread). */
  extra?: ComponentChildren;
}) {
  const team = league.user ? league.teams.find((t) => t.id === league.user!.teamId) : null;
  return (
    <aside class="sidebar next-sidebar">
      <div class="club-brand">
        <h1>{team ? team.name : __i18n_t("ui.next.shell.text.6d3582f1")}</h1>
        <p class="sub">{phaseWord(league)}</p>
        {extra && <div class="row-actions">{extra}</div>}
      </div>
      {league.user && <Hud league={league} onClub={onClub} />}
      <nav class="tabs" aria-label={__i18n_t("ui.next.shell.text.076925c5")}>
        {groups.map((g) => (
          <div class="nav-group" key={g.label} role="group" aria-label={g.label}>
            <p class="nav-label">{g.label}</p>
            {g.items.map((it) => (
              <button key={it.id} type="button" class={`nav-btn${it.waiting ? ' tab-waiting' : ''}`} aria-current={it.current ? 'page' : undefined} onClick={it.onClick}>
                <span>{it.label}</span>
                {it.badge ? <span class="nav-badge">{it.badge}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <footer class="footer sidebar-foot">{foot}</footer>
    </aside>
  );
}

/** Today's game for the top bar: home or away, the other club and the park. */
export function todayMatch(s: LeagueState): string | null {
  const me = s.user?.teamId;
  if (!me || s.phase !== 'regular') return null;
  const date = nextDate(s);
  if (!date) return null;
  const games = s.exhibition && s.exhibition.year === s.year && s.exhibition.next < s.exhibition.games.length ? s.exhibition.games.slice(s.exhibition.next).filter((g) => g.date === date) : s.schedule.slice(s.next).filter((g) => g.date === date);
  const g = games.find((x) => x.home === me || x.away === me);
  if (!g) return __i18n_t("ui.next.shell.text.0a11a9df");
  const opp = s.teams.find((t) => t.id === (g.home === me ? g.away : g.home));
  const park = s.teams.find((t) => t.id === g.home)?.stadium.name ?? '';
  return g.home === me ? __i18n_t("ui.next.shell.text.ae4ffb4c", { opp: opp?.name ?? '', park }) : __i18n_t("ui.next.shell.text.6e6a8b88", { opp: opp?.name ?? '', park });
}

export function NextTopBar({ date, status, match, controls }: { date: string | null; status: string; match: string | null; controls: ComponentChildren }) {
  return (
    <div class="progress-bar next-top">
      <div class="cal-status">
        {date && <span class="cal-date num">{dayLabel(date)}</span>}
        <p class="status" aria-live="polite">
          {status}
          {match && <span class="cal-match">{match}</span>}
        </p>
      </div>
      {controls}
    </div>
  );
}
