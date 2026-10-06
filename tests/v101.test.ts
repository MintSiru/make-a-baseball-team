/* 1.0.1: fixes and screens from the 1.0 feedback. */
import { describe, expect, it } from 'vitest';
import { openDrafts, type FaMarket } from '../src/league/fa';

describe('the free-agent market screen', () => {
  it('drops the drafted offers of players who have signed or left, so they no longer block the next round', () => {
    const m = { talks: { open: {}, signed: { signed: { teamId: 'lg' } }, gone: { gone: true } } } as unknown as FaMarket;
    const drafts = { open: { annual: 1 }, signed: { annual: 2 }, gone: null, unknown: { annual: 3 } };
    expect(openDrafts(m, drafts)).toEqual({ open: { annual: 1 } });
  });
});

describe('pop-ups by kind', () => {
  it('leaves out the kinds turned off, and articles unless wanted', async () => {
    const { poppingAlerts } = await import('../src/ui/Alerts');
    const a = (id: string, kind: string, minor = false) => ({ id, date: '2027-05-01', kind, title: id, lines: [], ...(minor ? { minor } : {}) }) as never;
    const unseen = [a('fa', 'fa'), a('hurt', 'injury', true), a('award', 'award')];
    expect(poppingAlerts(unseen, true).map((x: { id: string }) => x.id)).toEqual(['fa', 'hurt', 'award']);
    expect(poppingAlerts(unseen, false).map((x: { id: string }) => x.id)).toEqual(['fa', 'award']);
    expect(poppingAlerts(unseen, true, ['fa']).map((x: { id: string }) => x.id)).toEqual(['hurt', 'award']);
  });
});

describe('the history tab', () => {
  it('tells the story of every retired number, and tallies the national team', async () => {
    const { createLeague } = await import('../src/league/history');
    const { retiredNumbersView, nationalView } = await import('../src/league/legacy');
    const s = createLeague('v101-legacy');
    // A long first-team career at one club, his number retired by it (as maybeRetireNumber does on retirement).
    const p = Object.values(s.players)
      .filter((x) => x.career.filter((c) => !c.level).length >= 8)
      .sort((a, b) => b.career.filter((c) => !c.level).length - a.career.filter((c) => !c.level).length)[0]!;
    const teamId = p.career.filter((c) => !c.level).at(-1)!.teamId;
    s.teams.find((t) => t.id === teamId)!.retiredNumbers = [{ number: 33, playerId: p.id, name: p.name, year: 2025 }];
    const [r] = retiredNumbersView(s);
    expect(r!.name).toBe(p.name);
    expect(r!.seasons).toBe(p.career.filter((c) => !c.level && c.teamId === teamId).length);
    expect(r!.story.some((l) => l.includes('33번 영구결번'))).toBe(true);
    expect(r!.pitcher ? r!.pit : r!.bat).not.toBeNull();
    const nat = nationalView(s);
    expect(nat.rows.length).toBeGreaterThan(0);
    expect(nat.rows[0]!.year).toBeGreaterThanOrEqual(nat.rows.at(-1)!.year);
    for (const row of nat.rows) expect(row.clubs.reduce((a, c) => a + c.n, 0)).toBe(row.squad);
  }, 120_000);
});
