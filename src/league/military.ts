import { k as __i18n_k } from '../i18n/index';
/* The military medical grade after an operation (V0.7.7; RULES.md §11).

   Korea's conscription exam grades health 1~7: 1~3급 serve on active duty (현역, or 상무 for athletes),
   4급 serve as social service agents (보충역 사회복무요원, 21 months, no professional games), 5급 are
   put on the wartime labour reserve (전시근로역) and do no peacetime service. A reconstructed elbow or
   knee usually means 4급 (키움 안우진 served as a 사회복무요원 after Tommy John surgery in 2023); a joint
   that keeps getting worse can go to 5급 on re-examination (최지만 moved from 사회복무요원 to 5급 in 2025
   with cartilage loss in an operated knee). The exact tables are the Military Manpower Administration's;
   the chances here are a game assumption.

   Every winter, before military decisions, a player who has not served and has had a major operation
   since his last exam is graded again. Social service agents with an operated knee may be re-graded 5급
   and discharged. */
import { rng } from '../draftroom';
import type { Player } from '../model/types';
import { addAlert } from './alerts';
import { majorSurgeries } from './injuries';
import { eunneun } from './josa';
import { isForeign } from './players';
import type { LeagueState } from './state';
import { OFFSEASON } from './tuning';

const M = () => OFFSEASON.military.exam;
const KNEE = /십자인대|아킬레스|연골/;

export const gradeLabel = (grade: number) => (grade >= 5 ? __i18n_k("league.military.gradeLabel.c95d6d83") : grade === 4 ? __i18n_k("league.military.gradeLabel.807b3872") : __i18n_k("league.military.gradeLabel.8c571e36", { grade: grade }));

/** The player's service line: "미필 · 4급 보충역 (전방십자인대 재건술)". */
export function serviceNote(p: Pick<Player, 'service'>): string {
  const e = p.service.exam;
  if (!e || e.grade < 4) return '';
  return `${gradeLabel(e.grade)} (${e.reason})`;
}

/** 4급: only social service is open to him (not 상무, not active duty). */
export const socialOnly = (p: Player) => (p.service.exam?.grade ?? 0) === 4 && p.service.military === 'pending';

/** Winter exams (idempotent within a winter): new operations since the last exam, and worsening knees. */
export function medicalReview(s: LeagueState, year: number) {
  for (const p of Object.values(s.players)) {
    if (isForeign(p) || !p.teamId) continue;
    const majors = majorSurgeries(p);
    if (!majors.length) continue;
    const e = p.service.exam;
    if (e?.year === year) continue;
    const r = rng(`${s.seed}|exam|${year}|${p.id}`);
    if (p.service.military === 'pending' && p.status === 'active' && majors.length > (e?.surgeries ?? 0)) {
      const last = majors[majors.length - 1]!;
      const five = (majors.length >= 2 ? M().fiveRepeated : M().five) + (KNEE.test(last.part) ? M().kneeBonus : 0);
      const u = r();
      const grade = u < five ? 5 : u < five + (1 - five) * M().four ? 4 : 3;
      p.service.exam = { year, grade, reason: last.part, surgeries: majors.length };
      if (grade === 5) p.service.military = 'exempt';
      if (grade >= 4) examAlert(s, p, year);
    } else if (p.status === 'military' && p.service.route === 'social' && e?.grade === 4 && KNEE.test(e.reason) && r() < M().worsening) {
      // Re-examined while serving: 5급, discharged (소집해제), back with his club.
      p.service.exam = { ...e, year, grade: 5 };
      p.service.military = 'exempt';
      p.status = 'active';
      delete p.service.route;
      delete p.service.returnsOn;
      s.rosters[p.teamId]?.futures.push(p.id);
      examAlert(s, p, year, true);
    }
  }
}

function examAlert(s: LeagueState, p: Player, year: number, discharged = false) {
  if (p.teamId !== s.user?.teamId) return;
  const e = p.service.exam!;
  addAlert(s, {
    id: `exam-${year}-${p.id}`,
    date: `${year}-11-20`,
    kind: 'military',
    title: e.grade >= 5 ? __i18n_k("league.military.examAlert.title.b1e9a666", { name: p.name }) : __i18n_k("league.military.examAlert.title.caddf37a", { name: p.name }),
    lines:
      e.grade >= 5
        ? [discharged ? __i18n_k("league.military.examAlert.lines.566e69a8") : __i18n_k("league.military.examAlert.lines.22665d05", { reason: e.reason })]
        : [__i18n_k("league.military.examAlert.lines.84ebadd1", { reason: e.reason }), __i18n_k("league.military.examAlert.lines.08735591")],
    tone: e.grade >= 5 ? 'good' : undefined,
    players: [p.id],
  });
  const u = s.user!;
  (u.log ??= []).push({ year, text: __i18n_k("league.military.examAlert.text.0c219eb6", { name: eunneun(p.name), gradeLabel: gradeLabel(e.grade), value: discharged ? __i18n_k("league.military.examAlert.text.4ad9daed") : '', reason: e.reason }) });
}
