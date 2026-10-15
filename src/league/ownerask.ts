import { k as __i18n_k } from '../i18n/index';
/* Asking the owner for a free agent (1.8.0, from the 1.7 feedback: 구단주에게 FA 사달라고 조르기). Besides the
   owner's own gift now and then (V0.7.7, market.ts parentGiftFor), the general manager may go to the owner once a
   winter with one name from the market: if the owner agrees, it pays his deal itself, outside the payroll budget,
   just as with a gift. A conglomerate is the likeliest to say yes, a citizen club the least; trust moves it a good
   deal, and the bigger the price, the harder the sell. A no costs a little trust. */
import { rng } from '../draftroom';
import type { PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { eok, faDate, guaranteed } from './fa';
import { eulreul, iga } from './josa';
import { ageIn } from './players';
import type { LeagueState } from './state';
import { PARENT } from './tuning';

export const OWNER_ASK = {
  base: { conglomerate: 0.45, midsize: 0.28, namingRights: 0.15, citizen: 0.06 },
  /** Each point of trust above (or below) 50. */
  perTrust: 0.012,
  /** A deal this big (만 원, guaranteed) halves the odds; a small one barely moves them. */
  bigDeal: 1_200_000,
  min: 0.03,
  max: 0.85,
  /** The owner's limit over his asking price, as with a gift. */
  premium: 1.15,
  /** Trust lost when the owner says no. */
  noTrust: 3,
  maxAge: 34,
} as const;

/** Why we cannot ask the owner for him now, or null. */
export function askOwnerProblem(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const m = s.offseason?.fa;
  if (!u || !m || m.closed) return __i18n_k("league.ownerask.text.e8621a4d");
  if (m.gift) return __i18n_k("league.ownerask.text.2d20c512");
  if (m.asked) return __i18n_k("league.ownerask.text.19d60d1c");
  const t = m.talks[id];
  const p = s.players[id];
  if (!t || !p || t.signed) return __i18n_k("league.ownerask.text.09cffef4");
  if (t.from === u.teamId) return __i18n_k("league.ownerask.text.ea57b6e1");
  if (ageIn(p, m.year + 1) > OWNER_ASK.maxAge) return __i18n_k("league.ownerask.text.9eb5fa6c", { age: OWNER_ASK.maxAge });
  return null;
}

/** The odds the owner says yes for him. */
export function askOwnerChance(s: LeagueState, id: PlayerId): number {
  const u = s.user!;
  const t = s.offseason!.fa!.talks[id]!;
  const trust = u.trust ?? PARENT.startTrust;
  const price = guaranteed(t.price);
  const sizeFactor = Math.max(0.35, Math.min(1.1, 1.2 - (price / OWNER_ASK.bigDeal) * 0.6));
  const base = OWNER_ASK.base[u.settings.parentType] + (trust - 50) * OWNER_ASK.perTrust;
  return Math.max(OWNER_ASK.min, Math.min(OWNER_ASK.max, base * sizeFactor));
}

/** We ask; the owner says yes (pays his deal up to its limit) or no (a little trust lost). */
export function askOwner(s: LeagueState, id: PlayerId): boolean {
  const problem = askOwnerProblem(s, id);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const m = s.offseason!.fa!;
  const p = s.players[id]!;
  const t = m.talks[id]!;
  const day = m.round;
  const yes = rng(`${s.seed}|owner-ask|${m.year}|${id}`)() < askOwnerChance(s, id);
  m.asked = { id, yes };
  if (yes) {
    m.gift = { id, total: Math.round((guaranteed(t.price) * OWNER_ASK.premium) / 1000) * 1000, years: t.price.years };
    addAlert(s, {
      id: `owner-ask-${m.year}`,
      date: faDate(m, day),
      kind: 'owner',
      title: __i18n_k("league.ownerask.text.31861b5d", { name: eulreul(p.name) }),
      lines: [__i18n_k("league.ownerask.text.873ff20e", { parent: iga(u.settings.parentName), name: eulreul(p.name), total: eok(m.gift.total) })],
      tone: 'good',
      players: [id],
    });
    m.news.push({ day, text: __i18n_k("league.ownerask.text.f959c2dc", { parent: u.settings.parentName, name: p.name }), mine: true });
  } else {
    u.trust = Math.max(0, (u.trust ?? PARENT.startTrust) - OWNER_ASK.noTrust);
    addAlert(s, {
      id: `owner-ask-${m.year}`,
      date: faDate(m, day),
      kind: 'owner',
      title: __i18n_k("league.ownerask.text.1f70003a", { name: p.name }),
      lines: [__i18n_k("league.ownerask.text.71e36b05")],
      tone: 'bad',
      players: [id],
    });
  }
  (u.log ??= []).push({ year: m.year, text: yes ? __i18n_k("league.ownerask.text.d968d82d", { name: p.name }) : __i18n_k("league.ownerask.text.add6a4cd", { name: p.name }) });
  return yes;
}
