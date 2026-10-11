import { k as __i18n_k } from '../i18n/index';
/* Adapting to the KBO (1.7.0, from the 1.6 feedback: 외국인 선수 적응 실패, 숨겨진 능력치 적응력). Every foreign
   player has a hidden 적응력 (adaptability): how easily he settles into a new country, its food, its strike zone and
   its way of playing. It does nothing for a player who settles; in his first KBO season, a player who does not can
   fail to adapt: in late April or late May he loses his touch and his main tools play several grade points lower in
   games for the rest of that season (AI clubs then replace him, trade.ts aiForeignChanges). A player who comes back
   for a second season has settled. Asia-quota players and those who have played in Japan settle more easily; the
   scouts' and coaches' reports read it like the other hidden traits (reports.ts).
   Drawn from the player's id alone, so it needs no migration and moves nothing else. */
import { hashUnit, rng } from '../draftroom';
import type { Player } from '../model/types';
import { kboSeasons } from './foreigncap';
import { iga } from './josa';
import { addNews } from './news';
import { isForeign, isPitcher } from './players';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';

export const ADAPT = {
  base: 55,
  sd: 15,
  /** Asia-quota players and those who have played in Japan know the Asian game. */
  asia: 10,
  japan: 5,
  /** The game days he may lose his touch on (once each, his first KBO season only). */
  checks: ['04-25', '05-25'],
  /** Under this adaptability he may fail: the chance grows by `perPoint` for each point under, up to `max`. */
  below: 48,
  perPoint: 0.016,
  max: 0.4,
  /** Grade points his main tools lose in games for the rest of the season. */
  drop: [5, 9] as const,
} as const;

// Each personality settles in a little more or less easily.
const LEAN: Record<string, number> = {
  '차분한 노력파': 4,
  '승부욕 강한 도전자': -4,
  '밝은 분위기 메이커': 8,
  '분석을 즐기는 연구형': 2,
  '책임감 강한 리더': 2,
  '말보다 행동하는 실천형': 0,
  '꾸준함을 믿는 성실형': -2,
  '큰 무대를 즐기는 대담형': -6,
};

/** His hidden adaptability, 1–99 (a domestic player is at home: 99). */
export function adaptabilityOf(p: Pick<Player, 'id' | 'personality' | 'origin'>): number {
  if (p.origin.kind !== 'foreign') return 99;
  const r = rng(`adapt|${p.id}`);
  const g = (r() + r() + r() + r() - 2) * Math.sqrt(3);
  const japan = p.origin.background?.level === 'npb' || p.origin.background?.level === 'npbFarm' || p.origin.background?.level === 'jpIndie';
  const v = ADAPT.base + g * ADAPT.sd + (LEAN[p.personality] ?? 0) + (p.origin.asiaQuota ? ADAPT.asia : 0) + (japan && !p.origin.asiaQuota ? ADAPT.japan : 0);
  return Math.max(1, Math.min(99, Math.round(v)));
}

/** The chance he fails to adapt at one of the checks. */
export const failChance = (adapt: number) => Math.min(ADAPT.max, Math.max(0, (ADAPT.below - adapt) * ADAPT.perPoint));

/** Grade points his main tools lose in games this season (0 unless he failed to adapt this year). */
export const adaptPenalty = (p: Pick<Player, 'adaptFail'>, year: number) => (p.adaptFail?.year === year ? p.adaptFail.delta : 0);

/** Before the day's games: foreigners in their first KBO season who lose their touch today. */
export function adaptDay(s: LeagueState, date: string) {
  if (s.phase !== 'regular' || !ADAPT.checks.includes(date.slice(5) as (typeof ADAPT.checks)[number])) return;
  for (const teamId of firstTeamIds(s)) {
    for (const p of orgPlayers(s, teamId)) {
      if (!isForeign(p) || p.adaptFail || kboSeasons(p, s.year) > 0) continue;
      const r = rng(`${s.seed}|adapt|${p.id}|${date}`);
      if (r() >= failChance(adaptabilityOf(p))) continue;
      const delta = ADAPT.drop[0] + Math.floor(r() * (ADAPT.drop[1] - ADAPT.drop[0] + 1));
      p.adaptFail = { year: s.year, date, delta };
      const mine = teamId === s.user?.teamId;
      const club = s.teams.find((t) => t.id === teamId)?.short ?? teamId;
      const what = isPitcher(p) ? __i18n_k("league.adapt.text.6b09925d") : __i18n_k("league.adapt.text.7bc4a700");
      const why = [__i18n_k("league.adapt.text.0905ceb4"), __i18n_k("league.adapt.text.ff9330e9"), __i18n_k("league.adapt.text.145137d8"), __i18n_k("league.adapt.text.82e06cb6")][Math.floor(hashUnit(`${p.id}|adapt-why`) * 4)]!;
      addNews(s, {
        id: `adapt-${p.id}`,
        date,
        kind: 'interview',
        title: __i18n_k("league.adapt.text.dd5a5b48", { club, name: p.name }),
        body: __i18n_k("league.adapt.text.54f581c7", { club, name: iga(p.name), what, why }),
        quotes: [],
        facts: { player: p.name, club },
        players: [p.id],
        mine,
      });
      if (mine) ((p.life ??= {}).events ??= []).push({ date, text: __i18n_k("league.adapt.text.c1562fc1"), tone: 'bad' });
    }
  }
}

/** Whether he has failed to adapt this season (for the AI clubs' replacements). */
export const failedToAdapt = (p: Player, year: number) => p.adaptFail?.year === year;
