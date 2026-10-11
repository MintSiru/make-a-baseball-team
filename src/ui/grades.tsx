import { display as __i18n_display } from '../i18n/index';
/* 20–80 grades on screen: the ability bar and the class that colours a grade by its tier (display.ts). */
import type { Player } from '../model/types';
import { gradeTier, loadDisplay } from './display';

/** The future grade the page shows (1.7.0): the scouts' current one, or with "draft day only" in the display
    settings a pro's draft-day expectation (null when he was not drafted or the save predates 1.7.0). Amateurs
    always show theirs: it is the draft's own. */
export function shownFuture(p: Pick<Player, 'status' | 'origin' | 'scouting'>): number | null {
  if (loadDisplay().futureView !== 'draft' || p.status === 'amateur') return p.scouting.futureValue;
  return p.origin.draftGrade ?? null;
}
/** A roster row's future grade as shown (views.ts rows carry both). */
export const rowFuture = (r: { future: number; draftGrade: number | null }) => (loadDisplay().futureView === 'draft' ? r.draftGrade : r.future);
/** Whether the per-ability future grades and the scouts' revisions are shown for him (not with "draft day only"). */
export const showsFutureDetail = (p: Pick<Player, 'status'>) => loadDisplay().futureView !== 'draft' || p.status === 'amateur';

/** Class for a grade in a table: coloured only when the display settings ask for it. */
export const gradeClass = (g: number | null | undefined) => (g ? `grade-num t${gradeTier(g)}` : '');

/** A 20–80 grade as a bar, with the projected grade as a tick. */
export function GradeBar({ label, now, future, note }: { label: string; now: number | undefined; future?: number; note?: string }) {
  const pct = (g: number) => `${((Math.max(20, Math.min(80, g)) - 20) / 60) * 100}%`;
  return (
    <div class="gradebar">
      <span class="gradebar-label">{__i18n_display(label)}</span>
      <span class="gradebar-track" aria-hidden="true">
        {__i18n_display(now != null && <span class={`gradebar-fill t${gradeTier(now)}`} style={{ width: pct(now) }} />)}
        {__i18n_display(future != null && future > (now ?? 0) && <span class="gradebar-future" style={{ left: pct(future) }} />)}
      </span>
      <span class="gradebar-num">
        {__i18n_display(now ?? '-')}
        {__i18n_display(future != null && future !== now && <span class="muted"> → {__i18n_display(future)}</span>)}
      </span>
      {__i18n_display(note && <span class="gradebar-note muted">{__i18n_display(note)}</span>)}
    </div>
  );
}
