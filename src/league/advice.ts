import { k as __i18n_k } from '../i18n/index';
/* Why the scouts recommend what they do (1.5.0, from the 1.4 review): for the decision waiting, the rule the
   recommendation follows, what it picks, and what choosing otherwise costs. It reads the recommendation itself
   (autoDecision) and the public grades, so it explains rather than adds a second opinion. */
import type { PlayerId } from '../model/types';
import { autoDecision, type DecisionInput } from './expansion';
import { ageIn, isPitcher } from './players';
import { STAFF_LABELS } from './staff';
import type { LeagueState, StaffRole } from './state';

export interface Advice {
  /** The rule, in a sentence. */
  rule: string;
  /** What it picks (a few names with their grades). */
  picks: string[];
  /** What choosing otherwise costs or risks. */
  tradeoff: string;
}

const won = (n: number) => (Math.abs(n) >= 10_000 ? __i18n_k("league.advice.won.db0fc332", { value: (n / 10_000).toFixed(1).replace(/\.0$/, '') }) : __i18n_k("league.advice.won.cd1481f0", { value: Math.round(n).toLocaleString('ko-KR') }));
const MAX = 6;

export function adviceFor(s: LeagueState): Advice | null {
  const d = s.pending;
  if (!d || !s.user) return null;
  const input = autoDecision(s) as DecisionInput | null;
  if (!input) return null;
  const next = (s.offseason?.year ?? s.year) + 1;
  const who = (id: PlayerId) => {
    const p = s.players[id];
    return p ? __i18n_k("league.advice.adviceFor.who.d9026792", { name: p.name, value: isPitcher(p) ? p.role : (p.position ?? __i18n_k("league.advice.adviceFor.who.9dac0c64")), ageIn: ageIn(p, next), current: p.scouting.current, futureValue: p.scouting.futureValue }) : id;
  };
  const list = (ids: PlayerId[]) => [...ids.slice(0, MAX).map(who), ...(ids.length > MAX ? [__i18n_k("league.advice.adviceFor.list.6ff92439", { value: ids.length - MAX })] : [])];
  const none = (ids: PlayerId[], what: string) => (ids.length ? list(ids) : [__i18n_k("league.advice.adviceFor.none.170ac933", { what: what })]);
  const KEEP = __i18n_k("league.advice.adviceFor.kEEP.9d965e55");

  switch (input.kind) {
    case 'tryout':
      return { rule: __i18n_k("league.advice.adviceFor.rule.14eb66c9", { kEEP: KEEP }), picks: list(input.ids), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.b1a2e603") };
    case 'released':
      return { rule: __i18n_k("league.advice.adviceFor.rule.4c685e4d", { kEEP: KEEP }), picks: none(input.ids, __i18n_k("league.advice.adviceFor.picks.82625a47")), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.e1225907") };
    case 'specialDraft': {
      const picks = Object.values(input.picks);
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.69b93c75"),
        picks: none(picks, __i18n_k("league.advice.adviceFor.picks.68a26d9d")),
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.a9ba8e15"),
      };
    }
    case 'roster':
      return { rule: __i18n_k("league.advice.adviceFor.rule.f96655c0", { kEEP: KEEP }), picks: list(input.ids), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.8d9e8466") };
    case 'foreign': {
      const offers = input.offers ?? {};
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.ad9f1ddf"),
        picks: input.ids.length ? input.ids.map((id) => __i18n_k("league.advice.adviceFor.picks.3b180262", { who: who(id), value: offers[id] ? __i18n_k("league.advice.adviceFor.picks.91e7eb3c", { value: (offers[id]!.guaranteed / 10_000).toFixed(0) }) : '' })) : [__i18n_k("league.advice.adviceFor.picks.e1fe44d2")],
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.81276f34"),
      };
    }
    case 'military': {
      const orders = Object.entries(input.orders);
      const label = { sangmu: __i18n_k("league.advice.label.sangmu.ac73dafe"), army: __i18n_k("league.advice.label.army.b1da4883"), social: __i18n_k("league.advice.label.social.f695b002") } as Record<string, string>;
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.d93488b0"),
        picks: orders.length ? orders.map(([id, o]) => `${who(id)} → ${label[o] ?? o}`) : [__i18n_k("league.advice.adviceFor.picks.71a21ed8")],
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.fa9cb942"),
      };
    }
    case 'rookieBonus': {
      const total = Object.values(input.offers).reduce((a, b) => a + b, 0);
      const short = d.kind === 'rookieBonus' ? d.picks.filter((p) => input.offers[p.id] !== p.ask).length : 0;
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.d4d9b680"),
        picks: [__i18n_k("league.advice.adviceFor.picks.2ea6abe4", { won: won(total), value: short ? __i18n_k("league.advice.adviceFor.picks.a0d6df42", { short: short }) : '' })],
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.40d69921"),
      };
    }
    case 'development':
      return { rule: __i18n_k("league.advice.adviceFor.rule.ebf03d99"), picks: none(input.ids, __i18n_k("league.advice.adviceFor.picks.7994e59f")), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.09f9ef4d") };
    case 'camp': {
      const moves = Object.entries(input.plans).filter(([, plan]) => plan.position);
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.92e06d9e"),
        picks: moves.length ? moves.map(([id, plan]) => `${who(id)} → ${plan.position}`) : [__i18n_k("league.advice.adviceFor.picks.6d0af5ca")],
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.1d408b7e"),
      };
    }
    case 'retire':
      return { rule: __i18n_k("league.advice.adviceFor.rule.e049e905"), picks: none(input.ids, __i18n_k("league.advice.adviceFor.picks.5c6950b1")), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.e2b3546a") };
    case 'faOptions':
      return { rule: __i18n_k("league.advice.adviceFor.rule.077be73f"), picks: none(input.keep, __i18n_k("league.advice.adviceFor.picks.a6e55f8c")), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.c07ca09d") };
    case 'faProtect':
    case 'secondProtect':
      return { rule: __i18n_k("league.advice.adviceFor.rule.2f705ae8"), picks: list(input.ids), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.276381a9") };
    case 'salaries':
      return { rule: __i18n_k("league.advice.adviceFor.rule.7b248f20"), picks: [__i18n_k("league.advice.adviceFor.picks.f05fcc20")], tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.9d4f6911") };
    case 'sponsor':
      return { rule: __i18n_k("league.advice.adviceFor.rule.8c8a9a37"), picks: d.kind === 'sponsor' ? [d.offers[input.index]?.name ?? ''] : [], tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.3de4bca6") };
    case 'staff': {
      const hires = Object.entries(input.hires);
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.8a0a18f8"),
        picks: hires.length ? hires.map(([role, id]) => `${STAFF_LABELS[role as StaffRole]}: ${d.kind === 'staff' ? (d.rows.find((r) => r.role === role)?.candidates.find((c) => c.id === id)?.name ?? id) : id}`) : [__i18n_k("league.advice.adviceFor.picks.47797117")],
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.8a50ac29"),
      };
    }
    case 'returnee':
      return { rule: __i18n_k("league.advice.adviceFor.rule.cc2f83ff"), picks: none(input.ids, __i18n_k("league.advice.adviceFor.picks.f9839282")), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.ff5291f6") };
    case 'posting':
      return { rule: __i18n_k("league.advice.adviceFor.rule.2930bc17"), picks: input.id ? [who(input.id)] : [__i18n_k("league.advice.adviceFor.picks.fbd57e0a")], tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.97e0bf90") };
    case 'secondPick':
      return { rule: __i18n_k("league.advice.adviceFor.rule.bf880257"), picks: input.id ? [who(input.id)] : [__i18n_k("league.advice.adviceFor.picks.bef6677a")], tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.549e7254") };
    case 'foreignRenew':
      return { rule: __i18n_k("league.advice.adviceFor.rule.ea376c90"), picks: none(input.keep, __i18n_k("league.advice.adviceFor.picks.994331cf")), tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.66b7f878") };
    case 'faCompensation':
      return { rule: __i18n_k("league.advice.adviceFor.rule.4ef6c272"), picks: input.player ? [who(input.player)] : [__i18n_k("league.advice.adviceFor.picks.1695d428")], tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.ba8dbe2a") };
    case 'national': {
      const rows = d.kind === 'national' ? d.rows : [];
      const exempt = rows.filter((r) => r.exemption).map((r) => r.id);
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.34ebb92f"),
        picks: input.ids.length ? input.ids.map(who) : [__i18n_k("league.advice.adviceFor.picks.d9a37283")],
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.27bd7e9c", { value: exempt.length ? __i18n_k("league.advice.adviceFor.tradeoff.950b51b3", { length: exempt.length }) : '' }),
      };
    }
    case 'meddle':
      return {
        rule: __i18n_k("league.advice.adviceFor.rule.3797364a"),
        picks: [input.answer === 'obey' ? __i18n_k("league.advice.adviceFor.picks.53383ff3") : __i18n_k("league.advice.adviceFor.picks.c3df1fb6")],
        tradeoff: __i18n_k("league.advice.adviceFor.tradeoff.6a510576"),
      };
    default:
      return null;
  }
}

