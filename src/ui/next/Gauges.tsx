/* 2.0.62 (새 UI): a page's limits as gauges in one bar — each a name, its figure, and a bar filled against its limit
   (red past it); what stands beside them (a stamp, the page's controls) on the right. */
import type { ComponentChildren } from 'preact';

export interface Gauge {
  label: string;
  /** The figure shown ("67.2억 / 110.8억"). */
  value: ComponentChildren;
  /** How far along, against `of` (no bar without them). */
  n?: number;
  of?: number;
}

export function Gauges({ items, children, class: cls }: { items: Gauge[]; children?: ComponentChildren; class?: string }) {
  return (
    <div class={cls ? `roster-bar ${cls}` : 'roster-bar'}>
      <div class="quotas">
        {items.map((g) => {
          const over = g.n != null && g.of != null && g.n > g.of;
          return (
            <div class="quota" key={g.label}>
              <div class="quota-top">
                <span>{g.label}</span>
                <b class={over ? 'minus' : undefined}>{g.value}</b>
              </div>
              {g.n != null && g.of != null && (
                <span class={`qbar${over ? ' over' : ''}`} aria-hidden="true">
                  <i style={{ width: `${Math.max(0, Math.min(100, Math.round((g.n / Math.max(1, g.of)) * 100)))}%` }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
