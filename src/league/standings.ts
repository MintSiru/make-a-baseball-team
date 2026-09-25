/* Standings. KBO winning percentage leaves ties out: W / (W + L). */

export interface GameScore {
  id: string;
  date: string;
  home: string;
  away: string;
  hs: number;
  as: number;
}

export interface StandingRow {
  teamId: string;
  w: number;
  l: number;
  t: number;
  pct: number;
  gb: number;
  rs: number;
  ra: number;
  rank: number;
}

export function standings(teamIds: string[], games: GameScore[]): StandingRow[] {
  const rows = new Map(teamIds.map((id) => [id, { teamId: id, w: 0, l: 0, t: 0, pct: 0, gb: 0, rs: 0, ra: 0, rank: 0 }]));
  const h2h = new Map<string, number>(); // "a>b" → wins of a over b
  for (const g of games) {
    const home = rows.get(g.home)!,
      away = rows.get(g.away)!;
    home.rs += g.hs;
    home.ra += g.as;
    away.rs += g.as;
    away.ra += g.hs;
    if (g.hs === g.as) {
      home.t++;
      away.t++;
    } else {
      const [win, lose] = g.hs > g.as ? [home, away] : [away, home];
      win.w++;
      lose.l++;
      h2h.set(`${win.teamId}>${lose.teamId}`, (h2h.get(`${win.teamId}>${lose.teamId}`) ?? 0) + 1);
    }
  }
  const list = [...rows.values()];
  for (const r of list) r.pct = r.w + r.l ? r.w / (r.w + r.l) : 0;
  // Ties in the table: head-to-head record, then run differential, then club id for a stable order.
  list.sort(
    (a, b) =>
      b.pct - a.pct ||
      (h2h.get(`${b.teamId}>${a.teamId}`) ?? 0) - (h2h.get(`${a.teamId}>${b.teamId}`) ?? 0) ||
      b.rs - b.ra - (a.rs - a.ra) ||
      a.teamId.localeCompare(b.teamId),
  );
  const top = list[0];
  list.forEach((r, i) => {
    r.rank = i + 1;
    r.gb = top ? (top.w - r.w + (r.l - top.l)) / 2 : 0;
  });
  return list;
}
