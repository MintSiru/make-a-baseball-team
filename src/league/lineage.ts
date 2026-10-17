import { k as __i18n_k } from '../i18n/index';
/* The ten existing clubs' lineage, 1982 on (1.9.4, the 1.9 plan's C; docs/RULES.md §14 with its sources): each
   club's name, short name, owner and home by season, and the year it was founded and first played on the first
   team. For a league that plays the KBO's history (the 1982 legacy start, 1.9.5); other games keep today's names.

   A club that was dissolved and founded again (현대 → 히어로즈 2008, 쌍방울 → SK 2000) is kept as one id that changed
   hands, its players carried over; the KBO's records do not join them (RULES.md §14). */
import type { ParentCompanyType } from '../club/types';
import type { TeamId } from '../model/types';

/** A club's name and owner from a season on. */
export interface ClubEra {
  from: number;
  name: string;
  short: string;
  company: string;
  parent: ParentCompanyType;
  /** The home city, and the area the club drafts from and calls home (the team's `region`). */
  city: string;
  region: string;
}

export interface Lineage {
  id: TeamId;
  /** Founded (and first in the futures, when there was a second team), and first on the first team. */
  founded: number;
  firstTeam: number;
  eras: ClubEra[];
}

const era = (from: number, name: string, short: string, company: string, city: string, region: string, parent: ParentCompanyType = 'conglomerate'): ClubEra => ({ from, name, short, company, parent, city, region });

export const LINEAGE: Lineage[] = [
  {
    id: 'samsung',
    founded: 1982,
    firstTeam: 1982,
    eras: [
      era(1982, __i18n_k("league.lineage.text.ebfb77ab"), __i18n_k("league.lineage.text.1d9554f4"), __i18n_k("league.lineage.text.b175f6f4"), __i18n_k("league.lineage.text.604f78d4"), __i18n_k("league.lineage.text.956f1239")),
    ],
  },
  {
    id: 'lotte',
    founded: 1982,
    firstTeam: 1982,
    eras: [
      era(1982, __i18n_k("league.lineage.text.6ebc8480"), __i18n_k("league.lineage.text.9625876c"), __i18n_k("league.lineage.text.e3fa752a"), __i18n_k("league.lineage.text.25f016f2"), __i18n_k("league.lineage.text.a6fb63b8")),
      era(2011, __i18n_k("league.lineage.text.6ebc8480"), __i18n_k("league.lineage.text.9625876c"), __i18n_k("league.lineage.text.e3fa752a"), __i18n_k("league.lineage.text.25f016f2"), __i18n_k("league.lineage.text.6dc04037")),
    ],
  },
  {
    id: 'lg',
    founded: 1982,
    firstTeam: 1982,
    eras: [
      era(1982, __i18n_k("league.lineage.text.fc37b702"), __i18n_k("league.lineage.text.8d097133"), __i18n_k("league.lineage.text.d963ca65"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee")),
      era(1990, __i18n_k("league.lineage.text.8bfa0c03"), __i18n_k("league.lineage.text.b4301e4b"), __i18n_k("league.lineage.text.0e156b09"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee")),
    ],
  },
  {
    id: 'doosan',
    founded: 1982,
    firstTeam: 1982,
    eras: [
      era(1982, __i18n_k("league.lineage.text.2a846912"), __i18n_k("league.lineage.text.29a6de2f"), __i18n_k("league.lineage.text.8a15b66a"), __i18n_k("league.lineage.text.1e783cc6"), __i18n_k("league.lineage.text.17a340d7")),
      era(1985, __i18n_k("league.lineage.text.2a846912"), __i18n_k("league.lineage.text.29a6de2f"), __i18n_k("league.lineage.text.8a15b66a"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee")),
      era(1999, __i18n_k("league.lineage.text.0b110249"), __i18n_k("league.lineage.text.ca26415b"), __i18n_k("league.lineage.text.8a15b66a"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee")),
    ],
  },
  {
    id: 'kia',
    founded: 1982,
    firstTeam: 1982,
    eras: [
      era(1982, __i18n_k("league.lineage.text.5763d3d6"), __i18n_k("league.lineage.text.83cd9ddc"), __i18n_k("league.lineage.text.57ac38df"), __i18n_k("league.lineage.text.ad0d7d4b"), __i18n_k("league.lineage.text.ddd086e7")),
      era(1990, __i18n_k("league.lineage.text.5763d3d6"), __i18n_k("league.lineage.text.83cd9ddc"), __i18n_k("league.lineage.text.57ac38df"), __i18n_k("league.lineage.text.ad0d7d4b"), __i18n_k("league.lineage.text.423c0933")),
      era(2001, __i18n_k("league.lineage.text.b97606a8"), __i18n_k("league.lineage.text.a09a11f6"), __i18n_k("league.lineage.text.108e8876"), __i18n_k("league.lineage.text.ad0d7d4b"), __i18n_k("league.lineage.text.423c0933")),
    ],
  },
  {
    id: 'kiwoom',
    founded: 1982,
    firstTeam: 1982,
    eras: [
      era(1982, __i18n_k("league.lineage.text.1202f8b2"), __i18n_k("league.lineage.text.e7c559da"), __i18n_k("league.lineage.text.3f2fed71"), __i18n_k("league.lineage.text.41402f7e"), __i18n_k("league.lineage.text.46c332b0"), 'midsize'),
      era(1985, __i18n_k("league.lineage.text.6aafaa3d"), __i18n_k("league.lineage.text.89bec59f"), __i18n_k("league.lineage.text.8cb4926c"), __i18n_k("league.lineage.text.41402f7e"), __i18n_k("league.lineage.text.46c332b0"), 'midsize'),
      era(1988, __i18n_k("league.lineage.text.534883cb"), __i18n_k("league.lineage.text.4af3e3ae"), __i18n_k("league.lineage.text.640702e8"), __i18n_k("league.lineage.text.41402f7e"), __i18n_k("league.lineage.text.46c332b0"), 'midsize'),
      era(1996, __i18n_k("league.lineage.text.8d8be041"), __i18n_k("league.lineage.text.71b62f90"), __i18n_k("league.lineage.text.c6abb474"), __i18n_k("league.lineage.text.41402f7e"), __i18n_k("league.lineage.text.46c332b0")),
      era(2000, __i18n_k("league.lineage.text.8d8be041"), __i18n_k("league.lineage.text.71b62f90"), __i18n_k("league.lineage.text.c6abb474"), __i18n_k("league.lineage.text.08ccbbe9"), __i18n_k("league.lineage.text.098ca0de")),
      era(2008, __i18n_k("league.lineage.text.9e30a527"), __i18n_k("league.lineage.text.055c18cb"), __i18n_k("league.lineage.text.473eff22"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee"), 'namingRights'),
      era(2009, __i18n_k("league.lineage.text.97e20f27"), __i18n_k("league.lineage.text.97e20f27"), __i18n_k("league.lineage.text.92c575a5"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee"), 'midsize'),
      era(2010, __i18n_k("league.lineage.text.3cc50bf2"), __i18n_k("league.lineage.text.30c9ab22"), __i18n_k("league.lineage.text.a6985879"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee"), 'namingRights'),
      era(2019, __i18n_k("league.lineage.text.b096e371"), __i18n_k("league.lineage.text.def4ac54"), __i18n_k("league.lineage.text.44ede046"), __i18n_k("league.lineage.text.ea9858ee"), __i18n_k("league.lineage.text.ea9858ee"), 'namingRights'),
    ],
  },
  {
    id: 'hanwha',
    founded: 1985,
    firstTeam: 1986,
    eras: [
      era(1985, __i18n_k("league.lineage.text.4aef5aa5"), __i18n_k("league.lineage.text.ed594922"), __i18n_k("league.lineage.text.ed594922"), __i18n_k("league.lineage.text.1e783cc6"), __i18n_k("league.lineage.text.17a340d7")),
      era(1994, __i18n_k("league.lineage.text.68d9f56e"), __i18n_k("league.lineage.text.f67e4351"), __i18n_k("league.lineage.text.4ff3f14f"), __i18n_k("league.lineage.text.1e783cc6"), __i18n_k("league.lineage.text.17a340d7")),
      era(2000, __i18n_k("league.lineage.text.68d9f56e"), __i18n_k("league.lineage.text.f67e4351"), __i18n_k("league.lineage.text.4ff3f14f"), __i18n_k("league.lineage.text.1e783cc6"), __i18n_k("league.lineage.text.4e73ce8d")),
    ],
  },
  {
    id: 'ssg',
    founded: 1990,
    firstTeam: 1991,
    eras: [
      era(1990, __i18n_k("league.lineage.text.27066a3c"), __i18n_k("league.lineage.text.fcc26bb5"), __i18n_k("league.lineage.text.7ad3e60e"), __i18n_k("league.lineage.text.64ada749"), __i18n_k("league.lineage.text.146e1324"), 'midsize'),
      era(2000, __i18n_k("league.lineage.text.1fb73ac9"), __i18n_k("league.lineage.text.8f15af5e"), __i18n_k("league.lineage.text.d22d802b"), __i18n_k("league.lineage.text.41402f7e"), __i18n_k("league.lineage.text.41402f7e")),
      era(2021, __i18n_k("league.lineage.text.58c49993"), __i18n_k("league.lineage.text.c5a8fe79"), __i18n_k("league.lineage.text.db35c245"), __i18n_k("league.lineage.text.41402f7e"), __i18n_k("league.lineage.text.41402f7e")),
    ],
  },
  {
    id: 'nc',
    founded: 2011,
    firstTeam: 2013,
    eras: [
      era(2011, __i18n_k("league.lineage.text.6e9552f9"), __i18n_k("league.lineage.text.ee2493b9"), __i18n_k("league.lineage.text.8202403e"), __i18n_k("league.lineage.text.d517715a"), __i18n_k("league.lineage.text.7aeadd5c"), 'midsize'),
    ],
  },
  {
    id: 'kt',
    founded: 2013,
    firstTeam: 2015,
    eras: [
      era(2013, __i18n_k("league.lineage.text.5ea849ea"), __i18n_k("league.lineage.text.396d913d"), __i18n_k("league.lineage.text.396d913d"), __i18n_k("league.lineage.text.08ccbbe9"), __i18n_k("league.lineage.text.098ca0de")),
    ],
  },
];

export const lineageOf = (id: TeamId) => LINEAGE.find((l) => l.id === id);

/** A club's name and owner in `year`, or null before it was founded (or for a club with no lineage). */
export function clubIn(id: TeamId, year: number): ClubEra | null {
  const l = lineageOf(id);
  if (!l || year < l.founded) return null;
  let out = l.eras[0]!;
  for (const e of l.eras) if (year >= e.from) out = e;
  return out;
}

/** The existing clubs on the first team in `year`. */
export const firstTeamClubsIn = (year: number): TeamId[] => LINEAGE.filter((l) => year >= l.firstTeam).map((l) => l.id);

/** The existing clubs founded in `year` (they join the futures, or the league, that year). */
export const foundedIn = (year: number): TeamId[] => LINEAGE.filter((l) => l.founded === year).map((l) => l.id);

/** 1.9.7 (the user's request): a club's home ballpark from a season on — the name, the seats then and its run factor;
    `null` for the park the club plays in today (clubs.ts). Seats of the old parks are rough figures, the run factors
    game estimates (small old parks gave up more runs: RULES.md §14). */
export interface ParkEra {
  from: number;
  park: { name: string; seats: number; factor: number } | null;
}

const park = (from: number, name: string, seats: number, factor: number): ParkEra => ({ from, park: { name, seats, factor } });
const today = (from: number): ParkEra => ({ from, park: null });

/** 잠실 (MBC from its first season; OB from its move to Seoul in 1985): its seats over the years, today's from 2027. */
const JAMSIL = (from: number): ParkEra[] => [
  park(from, __i18n_k("league.lineage.text.70eae725"), 30_500, 0.94),
  park(2010, __i18n_k("league.lineage.text.70eae725"), 27_000, 0.94),
  park(2014, __i18n_k("league.lineage.text.70eae725"), 25_000, 0.94),
  park(2022, __i18n_k("league.lineage.text.70eae725"), 23_750, 0.94),
  today(2027),
];

export const PARKS: Record<TeamId, ParkEra[]> = {
  samsung: [park(1982, __i18n_k("league.lineage.text.01ce704f"), 10_000, 1.08), today(2016)],
  lotte: [park(1982, __i18n_k("league.lineage.text.5eb6dc59"), 18_000, 1.02), today(1987)],
  lg: [...JAMSIL(1982)],
  doosan: [park(1982, __i18n_k("league.lineage.text.ed33e3ba"), 10_500, 1.06), ...JAMSIL(1985)],
  kia: [park(1982, __i18n_k("league.lineage.text.3f6477b4"), 12_500, 1.03), today(2014)],
  kiwoom: [park(1982, __i18n_k("league.lineage.text.bac657f3"), 15_000, 1.03), park(2000, __i18n_k("league.lineage.text.7ddc350e"), 14_000, 1.0), park(2008, __i18n_k("league.lineage.text.5a4b31e1"), 12_500, 1.08), today(2016)],
  hanwha: [park(1985, __i18n_k("league.lineage.text.ed33e3ba"), 10_500, 1.06), today(2025)],
  ssg: [park(1990, __i18n_k("league.lineage.text.b0606c63"), 10_000, 1.0), park(2000, __i18n_k("league.lineage.text.48eeed9f"), 15_000, 1.03), today(2002)],
  nc: [park(2011, __i18n_k("league.lineage.text.7924944d"), 11_000, 1.04), today(2019)],
  kt: [today(2013)],
};

/** The club's ballpark in `year` (null: today's). */
export function parkIn(id: TeamId, year: number): ParkEra['park'] {
  const eras = PARKS[id];
  if (!eras) return null;
  let out: ParkEra['park'] = eras[0]!.park;
  for (const e of eras) if (year >= e.from) out = e.park;
  return out;
}
