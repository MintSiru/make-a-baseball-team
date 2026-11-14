/* 2.0.85 (the user's report: 4년 미만 FA 계약이 끝나자마자 다시 FA로 나옴): a free agent is one again only four seasons
   after his last free agency (KBO rules). A period option not taken up ends the deal, but short of the four seasons he
   stays with his club on a renewed salary; an opt-out takes him to the market only when he has them. */
import { describe, expect, it } from 'vitest';
import { settlePeriodOptions } from '../src/league/fa';
import { freeAgentsFor, isFreeAgent } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import type { LeagueState } from '../src/league/state';
import { firstTeamIds, orgPlayers } from '../src/league/state';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';

/** A two-year free-agent deal ending this season, with a two-year period option; his last free agency `since` seasons ago. */
function deal(s: LeagueState, p: Player, holder: 'club' | 'player', since: number) {
  const year = s.year;
  p.service.creditedSeasons = 12;
  p.service.lastFreeAgencyAt = 12 - since;
  delete p.service.optionFree;
  p.contract = {
    teamId: p.teamId!,
    kind: 'freeAgent',
    signedIn: year - 2,
    signingBonus: 0,
    salaries: [
      { season: year - 1, amount: 30000 },
      { season: year, amount: 30000 },
    ],
    fa: { years: 2, options: 0, incentive: 'games', paid: [], extra: { years: 2, holder, annual: holder === 'club' ? 900_000 : 1000 } },
  } as never;
}

describe('2.0.85: a short free-agent deal does not make him a free agent again before four seasons', () => {
  it('a club option declined: he stays (not on the market) until he has the four seasons; with them, he is a free agent', () => {
    const s = loadSave('2.0.84');
    const next = s.year + 1;
    const club = firstTeamIds(s).find((id) => id !== s.user!.teamId)!;
    const [a, b] = orgPlayers(s, club).filter((p) => !isForeign(p) && p.status === 'active' && p.scouting.current >= 50);
    // The club option's salary far above his worth: the club declines it.
    deal(s, a!, 'club', 2);
    deal(s, b!, 'club', 4);
    settlePeriodOptions(s, next);
    for (const p of [a!, b!]) expect(p.contract!.fa!.extra).toBeUndefined();
    expect(a!.service.optionFree).toBeUndefined();
    expect(isFreeAgent(a!, next)).toBe(false);
    expect(freeAgentsFor(s, next).some((p) => p.id === a!.id)).toBe(false);
    expect(a!.teamId).toBe(club);
    // Four seasons since his last free agency: a free agent as anyone.
    expect(isFreeAgent(b!, next)).toBe(true);
  });

  it('a player option: short of the seasons he takes it up; with them, he may opt out', () => {
    const s = loadSave('2.0.84');
    const next = s.year + 1;
    const club = firstTeamIds(s).find((id) => id !== s.user!.teamId)!;
    const [a, b] = orgPlayers(s, club)
      .filter((p) => !isForeign(p) && p.status === 'active' && p.birthday > `${next - 31}`)
      .sort((x, y) => y.scouting.current - x.scouting.current);
    // A tiny option salary: the market would pay him far more.
    deal(s, a!, 'player', 2);
    deal(s, b!, 'player', 4);
    settlePeriodOptions(s, next);
    // Short of the seasons: he takes the option (two more years).
    expect(a!.contract!.salaries.some((x) => x.season === next + 1)).toBe(true);
    expect(isFreeAgent(a!, next)).toBe(false);
    // With them: he opts out, onto the market.
    expect(b!.contract!.salaries.some((x) => x.season === next)).toBe(false);
    expect(isFreeAgent(b!, next)).toBe(true);
  });
});
