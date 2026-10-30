import { display as __i18n_display, k as __i18n_k } from '../i18n/index';
/* A rule explanation folded away (V0.7.7): the screen shows its numbers first, the "how it works" on demand.
   2.0.62 (새 UI): an ⓘ that opens it over the page — the rule out of the way until asked for. */
import type { ComponentChildren } from 'preact';
import { useUi } from './useDisplay';

export function Help({ title = __i18n_k("ui.help.help.84196436"), children }: { title?: string; children: ComponentChildren }) {
  const ui = useUi();
  if (ui === 'new')
    return (
      <details class="help help-info">
        <summary aria-label={title} title={title}>
          ⓘ
        </summary>
        <div class="help-pop">
          <strong>{title}</strong>
          <div class="muted">{children}</div>
        </div>
      </details>
    );
  return (
    <details class="help">
      <summary>{__i18n_display(title)}</summary>
      <div class="muted">{__i18n_display(children)}</div>
    </details>
  );
}
