import { display as __i18n_display, k as __i18n_k } from '../i18n/index';
/* A rule explanation folded away (V0.7.7): the screen shows its numbers first, the "how it works" on demand. */
import type { ComponentChildren } from 'preact';

export function Help({ title = __i18n_k("ui.help.help.84196436"), children }: { title?: string; children: ComponentChildren }) {
  return (
    <details class="help">
      <summary>{__i18n_display(title)}</summary>
      <div class="muted">{__i18n_display(children)}</div>
    </details>
  );
}
