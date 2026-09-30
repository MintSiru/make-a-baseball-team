/* A rule explanation folded away (V0.7.7): the screen shows its numbers first, the "how it works" on demand. */
import type { ComponentChildren } from 'preact';

export function Help({ title = '설명', children }: { title?: string; children: ComponentChildren }) {
  return (
    <details class="help">
      <summary>{title}</summary>
      <div class="muted">{children}</div>
    </details>
  );
}
