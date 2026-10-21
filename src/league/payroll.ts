import { k as __i18n_k } from '../i18n/index';
/* 2.0.10 (the user's request, after OOTP's finances screen): the club's payroll at a glance — who is paid what this
   season and the seasons his contract already covers, until when, his service time and when he reaches free agency,
   with each season's total against the competitive balance cap. Pay is what the cap counts (salary, a free-agent
   bonus spread over the deal, incentives paid); it reads what the contracts already hold and changes nothing. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026, salaryCapFor } from '../rules/kbo2026';
import { capFloorFor, capTotal } from './cap';
import { capPay } from './contracts';
import { faOutlook, type FaOutlook } from './faclock';
import { ageIn, isForeign } from './players';
import { orgIds, type LeagueState } from './state';
import { positionLabel } from './views';

/** Seasons the table shows: this one and the next four. */
export const PAYROLL_SEASONS = 5;

export interface PayrollRow {
  id: PlayerId;
  name: string;
  pos: string;
  age: number;
  /** 1군, 퓨처스, 잔류군, 군 복무. */
  squad: string;
  /** The kind of contract (신인, 다년, FA, 외국인…). */
  kind: string;
  /** Pay in each shown season (0: no contract for it yet). */
  pay: number[];
  /** The last season his contract covers. */
  until: number | null;
  /** Credited seasons and first-team days toward the next one. */
  service: { seasons: number; days: number };
  fa: FaOutlook;
  foreign: boolean;
}

export interface Payroll {
  seasons: number[];
  rows: PayrollRow[];
  /** Each season's total over the players shown (only contracts already signed count for later seasons). */
  totals: number[];
  /** This season's top-40 total and the cap (null before the cap starts). */
  cap: { total: number; cap: number; floor: number | null } | null;
}

export const kindLabel = (p: Player): string => {
  switch (p.contract?.kind) {
    case 'rookie':
      return __i18n_k('league.payroll.text.95c461d4');
    case 'multiYear':
      return __i18n_k('league.payroll.text.2c117ac9');
    case 'freeAgent':
      return 'FA';
    case 'foreign':
      return __i18n_k('league.payroll.text.5bd804b7');
    case 'asiaQuota':
      return __i18n_k('league.payroll.text.74f290f1');
    case 'development':
      return __i18n_k('league.payroll.text.818f3b79');
    default:
      return __i18n_k('league.payroll.text.cbf383ec');
  }
};

/** The season being paid: this one, or next in the winter. */
export const payrollSeason = (s: LeagueState) => (s.offseason ? s.offseason.year + 1 : s.year);

export function payrollOf(s: LeagueState, teamId: TeamId): Payroll {
  const first = payrollSeason(s);
  const seasons = Array.from({ length: PAYROLL_SEASONS }, (_, i) => first + i);
  const r = s.rosters[teamId];
  const squadOf = (id: PlayerId) =>
    r?.active.includes(id)
      ? __i18n_k('league.payroll.text.ef2caeba')
      : r?.futures.includes(id)
        ? __i18n_k('league.payroll.text.e6607847')
        : r?.third.includes(id)
          ? __i18n_k('league.payroll.text.0dce8d6b')
          : '';
  const soldiers = Object.values(s.players).filter((p) => p.teamId === teamId && p.status === 'military');
  const players = [...orgIds(s, teamId).map((id) => s.players[id]!), ...soldiers.filter((p) => !orgIds(s, teamId).includes(p.id))];
  const rows = players.map((p): PayrollRow => {
    const until = Math.max(0, ...(p.contract?.salaries ?? []).map((x) => x.season));
    return {
      id: p.id,
      name: p.name,
      pos: positionLabel(p),
      age: ageIn(p, first),
      squad: p.status === 'military' ? __i18n_k('league.payroll.text.285374d7') : squadOf(p.id),
      kind: kindLabel(p),
      pay: seasons.map((y) => capPay(p, y)),
      until: until || null,
      service: { seasons: p.service.creditedSeasons, days: p.service.carriedDays },
      fa: faOutlook(s, p),
      foreign: isForeign(p),
    };
  });
  const totals = seasons.map((_, i) => rows.reduce((a, x) => a + x.pay[i]!, 0));
  const cap = first >= KBO_2026.salaryCap.from ? { total: capTotal(s, teamId, first), cap: salaryCapFor(first), floor: capFloorFor(first) } : null;
  return { seasons, rows, totals, cap };
}
