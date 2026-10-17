/* 1.9.8: the update notes — a list in the settings tab and a one-time dialog after an update (updates.ts). */
import { useRef } from 'preact/hooks';
import { useFocusTrap } from './modal';
import { RELEASE } from '../core/version';
import { getLocale, t as __i18n_t } from '../i18n/index';
import { type UpdateNote, UPDATE_NOTES } from './updates';

function NoteList({ notes }: { notes: UpdateNote[] }) {
  return (
    <dl class="update-notes">
      {getLocale() !== 'ko' && <p class="muted small">{__i18n_t("ui.updates.text.b90eb779")}</p>}
      {notes.map((n) => (
        <div key={n.version}>
          <dt class="strong">{n.version}</dt>
          <dd>{n.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The settings tab's list: the latest versions, all of them on request. */
export function UpdateNotes() {
  return (
    <>
      <p class="muted">{__i18n_t("ui.updates.text.552800b9", { release: RELEASE })}</p>
      <NoteList notes={UPDATE_NOTES.slice(0, 8)} />
      {UPDATE_NOTES.length > 8 && (
        <details>
          <summary>{__i18n_t("ui.updates.text.483585b1")}</summary>
          <NoteList notes={UPDATE_NOTES.slice(8)} />
        </details>
      )}
    </>
  );
}

/** Once after an update: what changed since the version this browser last opened. */
export function UpdateDialog({ notes, onClose }: { notes: UpdateNote[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, onClose);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="update-title" ref={box}>
        <h2 id="update-title">{__i18n_t("ui.updates.text.0d435c6f", { release: RELEASE })}</h2>
        <NoteList notes={notes} />
        <p class="muted small">{__i18n_t("ui.updates.text.6654f975")}</p>
        <div class="row-actions">
          <button type="button" class="primary" onClick={onClose}>
            {__i18n_t("ui.updates.text.468266d6")}
          </button>
        </div>
      </div>
    </div>
  );
}
