import { display as __i18n_display } from '../i18n/index';
/* 20–80 grades on screen: the ability bar and the class that colours a grade by its tier (display.ts). */
import { gradeTier } from './display';

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
