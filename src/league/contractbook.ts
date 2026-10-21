import { k as __i18n_k } from '../i18n/index';
/* 2.0.34 (the user's request: 계약 탭 — before the salary talks a contract was hard to see in full): every contract
   of our club in one place — its kind and term, the money in it season by season, the bonus and how it was paid,
   incentives, a period option, the promises made, and what comes when it ends (free agency, arbitration). It reads
   the contracts and changes nothing. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { salaryIn, usdTotal } from './contracts';
import { faOutlook } from './faclock';
import { usd } from './foreign';
import { eok, spotLabel } from './fa';
import { kindLabel, payrollSeason } from './payroll';
import { ageIn, isForeign } from './players';
import { orgIds, type LeagueState } from './state';
import { positionLabel } from './views';

export interface ContractRow {
  id: PlayerId;
  name: string;
  pos: string;
  age: number;
  kind: string;
  /** The season it was signed and the last one it covers (null: none past this one on file). */
  signedIn: number | null;
  until: number | null;
  /** Seasons still to be paid, the one being paid included. */
  left: number;
  /** All the money in it: bonus, salaries and incentives (만 원; foreign deals in dollars, `usd`). */
  total: number;
  bonus: number;
  /** This season's (or, in the winter, next season's) salary. */
  pay: number;
  options: number;
  foreign: boolean;
  /** Free agency, in a word, and in a sentence. */
  fa: string;
  faText: string;
  /** Everything else, one line each. */
  lines: string[];
}

const INCENTIVE = { games: () => __i18n_k("league.contractbook.text.dff9e5d5"), innings: () => __i18n_k("league.contractbook.text.32e5ee02"), relief: () => __i18n_k("league.contractbook.text.5ecf8558") };

function rowOf(s: LeagueState, p: Player, season: number): ContractRow {
  const c = p.contract;
  const salaries = c?.salaries ?? [];
  const until = salaries.length ? Math.max(...salaries.map((x) => x.season)) : null;
  const left = salaries.filter((x) => x.season >= season).length;
  const foreign = isForeign(p);
  const fa = c?.fa;
  const lines: string[] = [];
  if (c?.usd) {
    lines.push(__i18n_k("league.contractbook.text.7c431269", { total: usd(usdTotal(c)), bonus: usd(c.usd.bonus), salary: usd(c.usd.salary), options: usd(c.usd.options) }));
    if (c.usd.fee) lines.push(__i18n_k("league.contractbook.text.53ef4ce1", { fee: usd(c.usd.fee) }));
  }
  if (salaries.length) lines.push(__i18n_k("league.contractbook.text.e9feb626", { list: salaries.map((x) => `${x.season} ${eok(x.amount)}`).join(' · ') }));
  if (c?.signingBonus) lines.push(fa?.prepaid ? __i18n_k("league.contractbook.text.1583dc5b", { bonus: eok(c.signingBonus) }) : fa ? __i18n_k("league.contractbook.text.8614ace0", { bonus: eok(c.signingBonus) }) : __i18n_k("league.contractbook.text.ce8eb5e8", { bonus: eok(c.signingBonus) }));
  if (fa) {
    if (fa.options) {
      const paid = fa.paid.reduce((a, x) => a + x.amount, 0);
      lines.push(__i18n_k("league.contractbook.text.2171fe12", { options: eok(fa.options), kind: INCENTIVE[fa.incentive](), paid: eok(paid) }));
    }
    if (fa.extra) lines.push(fa.extra.holder === 'club' ? __i18n_k("league.contractbook.text.f2f5ca09", { years: fa.extra.years, annual: eok(fa.extra.annual) }) : __i18n_k("league.contractbook.text.e01f6e58", { years: fa.extra.years, annual: eok(fa.extra.annual) }));
    for (const pr of fa.promises ?? []) {
      const what = pr === 'starter' ? __i18n_k("league.contractbook.text.b2db18ee") : __i18n_k("league.contractbook.text.6ebe94b0", { spot: fa.spot ? spotLabel(fa.spot) : '' });
      const kept = fa.kept?.[pr];
      lines.push(kept === undefined ? __i18n_k("league.contractbook.text.b0619846", { what }) : kept ? __i18n_k("league.contractbook.text.7fe649dc", { what }) : __i18n_k("league.contractbook.text.6bc071ca", { what }));
    }
  }
  if (c?.temp) lines.push(__i18n_k("league.contractbook.text.e2740c61", { name: s.players[c.temp]?.name ?? '' }));
  const out = faOutlook(s, p);
  if (!foreign && c?.kind !== 'development' && season - p.proSince >= KBO_2026.arbitration.minProYears) lines.push(__i18n_k("league.contractbook.text.1dd86071", { n: season - p.proSince }));
  const total = c?.usd ? usdTotal(c) : (c?.signingBonus ?? 0) + salaries.reduce((a, x) => a + x.amount, 0) + (fa?.options ?? 0);
  return {
    id: p.id,
    name: p.name,
    pos: positionLabel(p),
    age: ageIn(p, season),
    kind: kindLabel(p),
    signedIn: c?.signedIn ?? null,
    until,
    left,
    total,
    bonus: c?.usd ? c.usd.bonus : (c?.signingBonus ?? 0),
    pay: c?.usd ? c.usd.salary : salaryIn(p, season),
    options: c?.usd ? c.usd.options : (fa?.options ?? 0),
    foreign: !!c?.usd,
    fa: out.short,
    faText: out.text,
    lines,
  };
}

/** Our club's contracts: the organisation and its soldiers. */
export function contractBook(s: LeagueState, teamId: TeamId): { season: number; rows: ContractRow[] } {
  const season = payrollSeason(s);
  const ids = new Set(orgIds(s, teamId));
  const players = [...[...ids].map((id) => s.players[id]!), ...Object.values(s.players).filter((p) => p.teamId === teamId && p.status === 'military' && !ids.has(p.id))];
  return { season, rows: players.map((p) => rowOf(s, p, season)) };
}
