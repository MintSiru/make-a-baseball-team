import { k as __i18n_k } from '../i18n/index';
/* An old promise comes back (V0.12, an easter egg for clubs without a parent company). Very rarely, a winter brings
   an investor who put money into the club when it was founded and now says it was never a loan: it bought a share
   of the club, 40 percent, and he wants it. The story follows the Heroes' long fight (RULES.md S76: an investor's
   2008 money, a commercial arbitration award for 40 percent, the courts upholding it in 2017–18). The club can
   settle now or fight; a fight costs lawyers this winter and is decided the next, and the investor usually wins. */
import { rng } from '../draftroom';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { addNews } from './news';
import type { Decision, LeagueState } from './state';
import { DISPUTE as D } from './tuning';

const FAMILY = [__i18n_k("league.dispute.fAMILY.919dde70"), __i18n_k("league.dispute.fAMILY.ede366a3"), __i18n_k("league.dispute.fAMILY.526969e1"), __i18n_k("league.dispute.fAMILY.18e90ba9"), __i18n_k("league.dispute.fAMILY.d583ddc6"), __i18n_k("league.dispute.fAMILY.f5617b2a"), __i18n_k("league.dispute.fAMILY.0d06d8e6"), __i18n_k("league.dispute.fAMILY.c74bc058")];
const GIVEN = [__i18n_k("league.dispute.gIVEN.cd1f4c99"), __i18n_k("league.dispute.gIVEN.b963625d"), __i18n_k("league.dispute.gIVEN.31950b70"), __i18n_k("league.dispute.gIVEN.c1ed58fc"), __i18n_k("league.dispute.gIVEN.9fff797d"), __i18n_k("league.dispute.gIVEN.3ace3afa"), __i18n_k("league.dispute.gIVEN.44233836"), __i18n_k("league.dispute.gIVEN.258cf6b2")];
const FIRMS = [__i18n_k("league.dispute.fIRMS.10ca24d1"), __i18n_k("league.dispute.fIRMS.6b7aa2a1"), __i18n_k("league.dispute.fIRMS.527352a1"), __i18n_k("league.dispute.fIRMS.a8b9f3a2"), __i18n_k("league.dispute.fIRMS.9d79f533")];
const money = (n: number) => __i18n_k("league.dispute.money.1eaa5457", { value: Math.round(n / 10000) });

/** A winter's look at the dispute: the verdict on one being fought (no decision), or, very rarely, a new claim. */
export function disputeDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user;
  if (!u || u.settings.parentType !== 'namingRights' || year < u.firstTeamYear) return null;
  const d = u.dispute;
  if (d?.verdictIn === year) {
    verdict(s, year);
    return null;
  }
  if (d) return null;
  const r = rng(`${s.seed}|dispute|${year}`);
  if (r() >= D.chance) return null;
  const investor = `${FAMILY[Math.floor(r() * FAMILY.length)]}${GIVEN[Math.floor(r() * GIVEN.length)]}`;
  const firm = FIRMS[Math.floor(r() * FIRMS.length)]!;
  u.dispute = { year, investor, firm };
  addAlert(s, {
    id: `dispute-${year}`,
    date: `${year}-11-20`,
    kind: 'dispute',
    title: __i18n_k("league.dispute.disputeDecision.title.3f84102b", { firm: firm, investor: investor }),
    lines: [
      __i18n_k("league.dispute.disputeDecision.lines.45f80d46", { investor: investor }),
      __i18n_k("league.dispute.disputeDecision.lines.d4359174", { money: money(D.settle), money2: money(D.legal) }),
    ],
    tone: 'bad',
  });
  return { kind: 'dispute', investor, firm, settle: D.settle, legal: D.legal, loss: D.loss };
}

/** Settle now, or fight it out. */
export function resolveDispute(s: LeagueState, d: Extract<Decision, { kind: 'dispute' }>, answer: 'settle' | 'fight', year: number) {
  const u = s.user!;
  if (answer === 'settle') {
    u.fund -= d.settle;
    u.ledger.push({ year, label: __i18n_k("league.dispute.resolveDispute.label.db4676fb", { investor: d.investor }), amount: -d.settle });
    u.trust = Math.max(0, (u.trust ?? 60) - D.trust.settle);
    u.dispute = { ...u.dispute!, settled: year };
  } else {
    u.fund -= d.legal;
    u.ledger.push({ year, label: __i18n_k("league.dispute.resolveDispute.label.37965d52", { investor: d.investor }), amount: -d.legal });
    u.dispute = { ...u.dispute!, verdictIn: year + 1 };
  }
  (u.log ??= []).push({ year, text: answer === 'settle' ? __i18n_k("league.dispute.resolveDispute.text.d0ca6e4d", { investor: d.investor, money: money(d.settle) }) : __i18n_k("league.dispute.resolveDispute.text.aa1f4e1d", { investor: d.investor }) });
  addNews(s, {
    id: `dispute-${year}`,
    date: `${year}-11-25`,
    kind: 'move',
    title: answer === 'settle' ? __i18n_k("league.dispute.resolveDispute.title.0400ed59", { investor: d.investor }) : __i18n_k("league.dispute.resolveDispute.title.9014d5ed", { investor: d.investor }),
    body:
      answer === 'settle'
        ? __i18n_k("league.dispute.resolveDispute.body.a173c339", { investor: d.investor, money: money(d.settle) })
        : __i18n_k("league.dispute.resolveDispute.body.99914cda", { investor: d.investor }),
    quotes: [],
    facts: { 투자자: `${d.firm} ${d.investor}`, 대응: answer === 'settle' ? __i18n_k("league.dispute.facts.message.a8824da0") : __i18n_k("league.dispute.facts.message.16d15266") },
    players: [],
    mine: true,
  });
}

function verdict(s: LeagueState, year: number) {
  const u = s.user!;
  const d = u.dispute!;
  const won = rng(`${s.seed}|dispute-verdict|${year}`)() < D.win;
  d.decided = year;
  delete d.verdictIn;
  if (won) u.trust = Math.min(100, (u.trust ?? 60) + D.trust.win);
  else {
    u.fund -= D.loss;
    u.ledger.push({ year, label: __i18n_k("league.dispute.verdict.label.079d9123", { investor: d.investor }), amount: -D.loss });
    u.trust = Math.max(0, (u.trust ?? 60) - D.trust.loss);
    clubState(s, u.teamId).interest -= D.fans;
  }
  addAlert(s, {
    id: `dispute-verdict-${year}`,
    date: `${year}-11-20`,
    kind: 'dispute',
    title: won ? __i18n_k("league.dispute.verdict.title.e5439721", { investor: d.investor }) : __i18n_k("league.dispute.verdict.title.612ed43d", { investor: d.investor }),
    lines: won
      ? [__i18n_k("league.dispute.verdict.lines.f71ee413")]
      : [__i18n_k("league.dispute.verdict.lines.c93a5831", { money: money(D.loss) }), __i18n_k("league.dispute.verdict.lines.6ee6beb1")],
    tone: won ? 'good' : 'bad',
  });
  addNews(s, {
    id: `dispute-verdict-${year}`,
    date: `${year}-11-20`,
    kind: 'move',
    title: won ? __i18n_k("league.dispute.verdict.title.12682996", { investor: d.investor }) : __i18n_k("league.dispute.verdict.title.f6e017f2", { investor: d.investor }),
    body: won ? __i18n_k("league.dispute.verdict.body.5ffea1a7", { investor: d.investor }) : __i18n_k("league.dispute.verdict.body.8fc83c42", { investor: d.investor, money: money(D.loss) }),
    quotes: [],
    facts: { 투자자: `${d.firm} ${d.investor}`, 결과: won ? __i18n_k("league.dispute.facts.message.a420a28e") : __i18n_k("league.dispute.facts.message.b11cc3a9") },
    players: [],
    mine: true,
  });
}

/** The scouts (here, the lawyers) advise settling. */
export const autoDispute = (): 'settle' => 'settle';
