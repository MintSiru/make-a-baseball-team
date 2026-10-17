/* 1.9.3: more pitches (the user's codes 4SFB … SH, old pitches for old arms), a fastball of each pitcher's own
   (four-seam, two-seam or cutter), the overseas record split into MLB, the minors and NPB, and 강철야구's veterans
   who keep playing through the club's first three seasons. */
import { describe, expect, it } from 'vitest';
import type { Player } from '../src/model/types';
import { apply } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { joinNpb, mlbSeason, mlbView, NPB_CLUBS } from '../src/league/mlb';
import { retiring, STEEL_HOLD } from '../src/league/offseason';
import { fastballOf, PITCH_LABELS, repertoire, type PitchType } from '../src/league/pitches';
import { isPitcher } from '../src/league/players';
import { withScenario } from '../src/league/scenarios';
import type { ExpansionSettings, LeagueState } from '../src/league/state';

const CODES = ['SL', 'SW', 'SLV', 'CB', 'CH', 'CIR', 'FRK', 'SPL', 'CUT', '2SFB', 'SNK', 'KN', 'SCR', 'PLM', 'SH'];
const FAMILY: Record<string, string> = { SL: 's', SW: 's', SLV: 's', CH: 'c', CIR: 'c', FRK: 'f', SPL: 'f', '2SFB': 'k', SNK: 'k' };
const OLD: PitchType[] = ['SCR', 'PLM', 'SH'];

let league: LeagueState | null = null;
const base = () => (league ??= createLeague('v193'));
const pitchers = () => Object.values(base().players).filter((p) => isPitcher(p) && p.hidden.current.breaking != null);

describe('pitches', () => {
  it('every code has a label; every arm carries one pitch per family and not his own fastball again', () => {
    expect(Object.keys(PITCH_LABELS).sort()).toEqual([...CODES].sort());
    const seen = new Set<string>();
    for (const p of pitchers()) {
      const types = repertoire(p).map((x) => x.type);
      types.forEach((t) => seen.add(t));
      expect(new Set(types).size).toBe(types.length);
      const families = types.map((t) => FAMILY[t]).filter(Boolean);
      expect(new Set(families).size).toBe(families.length);
      const fb = fastballOf(p);
      if (fb !== '4SFB') {
        expect(types).not.toContain(fb);
        if (FAMILY[fb]) expect(types.map((t) => FAMILY[t])).not.toContain(FAMILY[fb]);
      }
    }
    // The new pitches show up in a league's worth of arms.
    for (const t of ['SNK', 'CIR', 'SPL', 'SLV', '2SFB']) expect(seen).toContain(t);
  });

  it('most lean on a four-seamer, some on a two-seamer or a cutter', () => {
    const fb = pitchers().map(fastballOf);
    const share = (t: string) => fb.filter((x) => x === t).length / fb.length;
    expect(share('4SFB')).toBeGreaterThan(0.6);
    expect(share('2SFB')).toBeGreaterThan(0.05);
    expect(share('CUT')).toBeGreaterThan(0.02);
    expect(fastballOf({ ...pitchers()[0]!, hidden: { ...pitchers()[0]!.hidden, current: { ...pitchers()[0]!.hidden.current, breaking: undefined } } } as Player)).toBe('4SFB');
  });

  it('the old pitches belong to pitchers born long ago', () => {
    const arms = pitchers().slice(0, 400);
    const oldShare = (born: string) => {
      const all = arms.flatMap((p) => repertoire({ ...p, id: `${p.id}-${born}`, birthday: `${born}-05-05` }).map((x) => x.type));
      return all.filter((t) => OLD.includes(t)).length / all.length;
    };
    expect(oldShare('1962')).toBeGreaterThan(oldShare('2002') * 3);
  });
});

describe('the overseas record', () => {
  it('a player who signs in Japan is on the NPB list; a weak season abroad is mostly in the minors', () => {
    const src = Object.values(base().players).find((x) => !isPitcher(x) && x.status === 'active' && !x.mlb)!;
    const p: Player = { ...src };
    const s = { ...base(), players: { [p.id]: p } } as LeagueState;
    joinNpb(p, 2026, { years: 2, total: 2_400_000 });
    expect(p.mlb!.league).toBe('npb');
    expect(NPB_CLUBS).toContain(p.mlb!.club);
    expect(mlbView(s).find((r) => r.id === p.id)!.npb).toBe(true);
    const weak = { ...p, hidden: { ...p.hidden, current: Object.fromEntries(Object.entries(p.hidden.current).map(([k, v]) => [k, v == null ? v : 25])) } } as Player;
    const season = mlbSeason(weak, 2027, p.mlb!.club, true);
    expect(season.aaa).toBe(true);
    expect(season.minors?.bat?.pa).toBeGreaterThan(season.bat!.pa);
  });

  it('a league built from history has players in Japan as well as the majors', () => {
    const rows = mlbView(base());
    expect(rows.some((r) => r.npb)).toBe(true);
    expect(rows.some((r) => !r.npb)).toBe(true);
  });
});

describe('강철야구', () => {
  it('our players don’t retire before the club’s fourth season; the others still do', () => {
    const s = createLeague('v193-steel');
    apply(s, { kind: 'toFounding' });
    const st: ExpansionSettings = withScenario({ name: '', short: '', color: '#333333', cityId: 'seoul', parentType: 'midsize', parentName: '', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'steel');
    apply(s, { kind: 'found', settings: st });
    while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    const u = s.user!;
    const ours = (ids: string[]) => ids.filter((id) => s.players[id]!.teamId === u.teamId && !s.players[id]!.life?.careerOver);
    const year = u.firstTeamYear + STEEL_HOLD - 2;
    expect(ours(retiring(s, year))).toEqual([]);
    expect(retiring(s, year).length).toBeGreaterThan(0);
    // Out of the scenario (or past its first three seasons) the same veterans would go.
    u.settings.scenario = null;
    expect(ours(retiring(s, year)).length).toBeGreaterThan(0);
    u.settings.scenario = 'steel';
    expect(ours(retiring(s, u.firstTeamYear + STEEL_HOLD - 1)).length).toBeGreaterThan(0);
  }, 240_000);
});
