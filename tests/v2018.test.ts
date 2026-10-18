/* 2.0.18: the injury replacement foreign player (부상 대체 외국인): a stand-in for a foreign player out six weeks or
   more, outside the replacements and the foreign cap; one of the two stays when the injured player is back. */
import { beforeAll, describe, expect, it } from 'vitest';
import { today } from '../src/league/entry';
import { capPlayers } from '../src/league/foreigncap';
import { createLeague } from '../src/league/history';
import { isForeign } from '../src/league/players';
import { orgPlayers, type LeagueState, type UserClub } from '../src/league/state';
import { checkTemp, endTemps, setTempKeep, signTemp, TEMP_FOREIGN, tempEligible, tempForeignDay, tempMarket, tempPrice, tempsOf } from '../src/league/tempforeign';
import { canReplaceForeign } from '../src/league/trade';

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

describe('injury stand-ins', () => {
  let s: LeagueState;
  let me: string;
  beforeAll(() => {
    s = createLeague('v2018-temp');
    s.phase = 'regular';
    me = s.teams[0]!.id;
    s.user = { teamId: me } as UserClub;
  }, 300_000);

  const hurt = (id: string, days: number) => {
    s.injuries[id] = { until: addDays(today(s), days), days, onList: true, part: '햄스트링' };
  };

  it('offers a stand-in only for six weeks out or more', () => {
    const [a, b] = orgPlayers(s, me).filter(isForeign);
    hurt(a!.id, 20);
    expect(tempEligible(s, me).map((p) => p.id)).not.toContain(a!.id);
    hurt(a!.id, TEMP_FOREIGN.minDays + 10);
    expect(tempEligible(s, me).map((p) => p.id)).toContain(a!.id);
    expect(tempEligible(s, me).map((p) => p.id)).not.toContain(b!.id);
    const market = tempMarket(s, me, a!.id);
    expect(market).toHaveLength(TEMP_FOREIGN.candidates);
    for (const p of market) {
      expect(!!p.origin.asiaQuota).toBe(!!a!.origin.asiaQuota);
      expect(tempPrice(s, p, a!.id)).toBeLessThanOrEqual(TEMP_FOREIGN.monthlyUsd * 3);
    }
  });

  it('signs one without a replacement and outside the cap; keeping him releases the injured player', () => {
    const a = tempEligible(s, me)[0]!;
    const pick = tempMarket(s, me, a.id)[0]!;
    expect(checkTemp(s, me, a.id, pick.id)).toBeNull();
    const changes = s.foreignChanges?.[me] ?? 0;
    signTemp(s, me, a.id, pick.id);
    const temp = s.players[pick.id]!;
    expect(temp.teamId).toBe(me);
    expect(temp.contract?.temp).toBe(a.id);
    expect(s.foreignChanges?.[me] ?? 0).toBe(changes);
    expect(capPlayers(s, me, s.year).map((p) => p.id)).not.toContain(temp.id);
    expect(canReplaceForeign(s, me, temp.id, 'x')).not.toBeNull();
    expect(tempEligible(s, me).map((p) => p.id)).not.toContain(a.id);
    // Still out: nothing changes.
    tempForeignDay(s, today(s));
    expect(tempsOf(s, me)).toHaveLength(1);
    // Back, and we keep the stand-in.
    setTempKeep(s, temp.id, 'temp');
    delete s.injuries[a.id];
    tempForeignDay(s, today(s));
    expect(tempsOf(s, me)).toHaveLength(0);
    expect(s.players[temp.id]!.teamId).toBe(me);
    expect(s.players[temp.id]!.contract?.temp).toBeUndefined();
    expect(s.players[a.id]!.teamId).not.toBe(me);
    expect(s.foreignChanges?.[me]).toBe(changes + 1);
  });

  it('lets the stand-in go by default when the injured player is back, and at the season’s end', () => {
    const b = orgPlayers(s, me).filter((p) => isForeign(p) && !p.contract?.temp && !s.injuries[p.id])[0]!;
    hurt(b.id, 70);
    const pick = tempMarket(s, me, b.id)[1]!;
    signTemp(s, me, b.id, pick.id);
    delete s.injuries[b.id];
    tempForeignDay(s, today(s));
    expect(s.players[pick.id]?.teamId).not.toBe(me);
    expect(s.players[b.id]!.teamId).toBe(me);
    // Another, still standing in when the season ends.
    hurt(b.id, 90);
    const again = tempMarket(s, me, b.id)[0]!;
    signTemp(s, me, b.id, again.id);
    endTemps(s);
    expect(tempsOf(s, me)).toHaveLength(0);
    expect(s.players[again.id]?.teamId).not.toBe(me);
  });

  it('has the other clubs sign stand-ins for their long injuries', () => {
    const other = s.teams.find((t) => t.id !== me && orgPlayers(s, t.id).some(isForeign))!.id;
    const keep = TEMP_FOREIGN.aiChance;
    TEMP_FOREIGN.aiChance = 1;
    const p = orgPlayers(s, other).find(isForeign)!;
    hurt(p.id, 60);
    tempForeignDay(s, today(s));
    TEMP_FOREIGN.aiChance = keep;
    expect(tempsOf(s, other).map((t) => t.for)).toContain(p.id);
  });
});
