/* The rivalry (V0.9): the user's club against the twelfth club. Their games draw bigger crowds (fans.ts), every
   one of them gets an article (news.ts), the season series moves both fan bases, and a player who crosses from
   one to the other stirs the fans. */
import type { Player, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { addNews } from './news';
import { seasonSeries, twelveClubs } from './twelve';
import { FANS, RIVAL } from './tuning';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const short = (s: import('./state').LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
type LeagueState = import('./state').LeagueState;

/** The rivalry's record over the years, from the user's side (this season included while it is played). */
export function allTime(s: LeagueState): { w: number; l: number; t: number; seasons: number } {
  const out = { w: 0, l: 0, t: 0, seasons: 0 };
  for (const x of s.twelve?.h2h ?? []) {
    out.w += x.w;
    out.l += x.l;
    out.t += x.t;
    out.seasons++;
  }
  if (s.phase !== 'offseason' && !(s.twelve?.h2h ?? []).some((x) => x.year === s.year)) {
    const now = seasonSeries(s);
    if (now.w + now.l + now.t) {
      out.w += now.w;
      out.l += now.l;
      out.t += now.t;
      out.seasons++;
    }
  }
  return out;
}

/** After the season: the series goes into the record, the fans of the winning side feel it, and an article. */
export function closeRivalry(s: LeagueState, year: number) {
  const tw = s.twelve,
    u = s.user;
  if (!tw || !u || !twelveClubs(s, year)) return;
  const r = seasonSeries(s);
  if (r.w + r.l + r.t === 0) return;
  tw.h2h = [...(tw.h2h ?? []).filter((x) => x.year !== year), { year, ...r }];
  const R = RIVAL.rivalry;
  const k = clamp((r.w - r.l) * R.perGame, -R.most, R.most);
  for (const [id, sign] of [
    [u.teamId, 1],
    [tw.teamId, -1],
  ] as const) {
    const c = clubState(s, id);
    c.interest = clamp(c.interest + sign * k, FANS.interestMin, FANS.interestMax);
  }
  const me = short(s, u.teamId),
    them = short(s, tw.teamId);
  const total = allTime(s);
  const verdict = r.w > r.l ? `${me}의 우세` : r.w < r.l ? `${them}의 우세` : '팽팽한 균형';
  addNews(s, {
    date: `${year}-10-31`,
    kind: 'season',
    title: `${year} 라이벌전 ${me} ${r.w}승 ${r.l}패${r.t ? ` ${r.t}무` : ''} · ${verdict}`,
    body:
      `${me}와 ${them}의 ${year} 시즌 맞대결은 ${r.w}승 ${r.l}패${r.t ? ` ${r.t}무` : ''}로 끝났다. ` +
      `통산 ${total.seasons}시즌 ${total.w}승 ${total.l}패${total.t ? ` ${total.t}무` : ''}. ` +
      (k > 0 ? '라이벌을 꺾은 팬들의 열기가 겨울까지 이어진다.' : k < 0 ? '라이벌에 밀린 팬들의 아쉬움이 크다.' : ''),
    quotes: [],
    facts: { year, wins: r.w, losses: r.l, ties: r.t, allTimeWins: total.w, allTimeLosses: total.l },
    players: [],
    mine: true,
  });
}

/** How much the fans care about a player: his last season, a star's years, and whether he grew up in the club. */
function fondness(p: Player, from: TeamId): number {
  const recent = p.career.filter((c) => !c.level && c.teamId === from).slice(-3);
  const war = recent.reduce((a, c) => a + c.war, 0);
  const homeGrown = !!p.origin.draftYear && p.career.filter((c) => !c.level).every((c) => c.teamId === from);
  return clamp(war / 8, 0, 1) + (homeGrown ? 0.3 : 0);
}

/**
 * A player crossing between the user's club and the twelfth club (a free agent, the special draft, a trade): the
 * fans he leaves take it hard when he was one of theirs, and the club he joins gets a little lift.
 */
export function crossing(
  s: LeagueState,
  p: Player,
  from: TeamId,
  to: TeamId,
  how: string,
  date = s.phase === 'regular' ? (s.schedule[Math.max(0, s.next - 1)]?.date ?? `${s.year}-04-01`) : `${s.year}-11-01`,
  alert = true,
) {
  const tw = s.twelve,
    u = s.user;
  if (!tw || !u) return;
  const pair = (from === u.teamId && to === tw.teamId) || (from === tw.teamId && to === u.teamId);
  if (!pair) return;
  const f = fondness(p, from);
  if (f < 0.2) return;
  const hit = RIVAL.rivalry.crossing * f;
  const left = clubState(s, from),
    joined = clubState(s, to);
  left.interest = clamp(left.interest - hit, FANS.interestMin, FANS.interestMax);
  joined.interest = clamp(joined.interest + hit / 2, FANS.interestMin, FANS.interestMax);
  const leaving = from === u.teamId;
  addNews(s, {
    date,
    kind: 'move',
    title: leaving ? `${p.name}, 라이벌 ${short(s, to)} 유니폼… ${short(s, from)} 팬들 술렁` : `라이벌의 간판 ${p.name}, ${short(s, to)}로`,
    body: leaving
      ? `${short(s, from)}에서 뛰던 ${p.name}이(가) ${how}로 라이벌 ${short(s, to)}에 간다. 팬 커뮤니티에는 아쉬움과 서운함이 섞인 글이 이어졌다.`
      : `${short(s, from)}의 ${p.name}이(가) ${how}로 ${short(s, to)}에 온다. 라이벌 팬들은 충격에 빠졌고, ${short(s, to)} 팬들은 반기는 분위기다.`,
    quotes: [{ who: '팬', role: 'fan', text: leaving ? '하필이면 거기냐…' : '이제 우리 선수다, 환영한다!' }],
    facts: { player: p.name, from: short(s, from), to: short(s, to), how },
    players: [p.id],
    mine: true,
  });
  if (leaving && alert)
    addAlert(s, {
      id: `rival-cross-${p.id}-${date}`,
      date,
      kind: 'season',
      title: `${p.name} 라이벌 이적`,
      lines: [`${p.name}이(가) ${how}로 ${short(s, to)}에 갔습니다. 팬들의 관심이 조금 떨어졌습니다.`],
      tone: 'bad',
      players: [p.id],
    });
}
