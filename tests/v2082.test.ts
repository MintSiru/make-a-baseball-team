/* 2.0.82 (the user's question: 투수였다가 투타겸업 시킨 선수는 타자 상을 못 받나요): a two-way pitcher who hits is among
   the hitters for the batting titles, the golden gloves and the leaders; the golden gloves weigh each side's own WAR. */
import { describe, expect, it } from 'vitest';
import { computeAwards } from '../src/league/awards';
import { isForeign, isPitcher } from '../src/league/players';
import { seasonStats, standingsView } from '../src/league/views';
import type { BatTotals } from '../src/model/types';
import { loadSave } from './helpers';

describe('2.0.82: a two-way pitcher among the hitters', () => {
  it('wins the home run title and the designated hitter golden glove with his bat; his pitching does not win it for him', () => {
    const s = loadSave('2.0.81');
    const year = s.year;
    const p = Object.values(s.players).find((x) => x.status === 'active' && x.teamId && isPitcher(x) && !isForeign(x) && x.career.some((c) => c.year === year - 1 && !c.level && c.pit))!;
    p.twoWay = true;
    const rec = p.career.find((c) => c.year === year - 1 && !c.level)!;
    // A slugger's season at the plate beside his pitching: 60 home runs, 120 games as the designated hitter.
    const best = Object.values(s.players).flatMap((x) => x.career.filter((c) => c.year === year - 1 && !c.level && c.bat).map((c) => c.bat!)).reduce((a, b) => (b.hr > a.hr ? b : a));
    rec.bat = { ...(best as BatTotals), hr: best.hr + 20, posG: { DH: 120 } };
    rec.war = (rec.war ?? 0) + 9;
    const table = s.history.find((h) => h.year === year - 1)?.table ?? standingsView(s).map((r, i) => ({ teamId: r.teamId, w: 72, l: 72, t: 0, rank: i + 1, pct: 0.5, gb: 0 }));
    const a = computeAwards(s, year - 1, table as never, null);
    expect(a.titles.find((t) => t.label === '홈런')?.id).toBe(p.id);
    expect(a.goldenGloves.find((g) => g.pos === '지명타자')?.id).toBe(p.id);
    // Only his pitching (no bat): nowhere among the hitters.
    p.twoWay = false;
    rec.bat = null;
    rec.war -= 9;
    const b = computeAwards(s, year - 1, table as never, null);
    expect(b.titles.find((t) => t.label === '홈런')?.id).not.toBe(p.id);
    expect(b.goldenGloves.find((g) => g.pos === '지명타자')?.id).not.toBe(p.id);
  });

  it('is on the batting leaders board this season', () => {
    const s = loadSave('2.0.81');
    const p = Object.values(s.players).find((x) => x.teamId && isPitcher(x) && s.lines[x.id]?.pit)!;
    const line = s.lines[p.id]!;
    p.twoWay = false;
    // A pitcher's few trips to the plate: not among the hitters.
    line.bat = { ...(Object.values(s.lines).find((l) => l.bat && l.bat.pa > 10)!.bat as BatTotals), pa: 5 };
    expect(seasonStats(s).batters.some((r) => r.id === p.id)).toBe(false);
    // Two-way: he is.
    p.twoWay = true;
    expect(seasonStats(s).batters.some((r) => r.id === p.id)).toBe(true);
  });
});
