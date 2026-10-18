import { t as __i18n_t } from '../i18n/index';
/* 2.0.7 (the user's request): before a new game, a warning to save this one — save it to a file and start, start
   without saving, or stay. */
import { useEffect, useRef } from 'preact/hooks';
import { useFocusTrap } from './modal';

export function NewGameDialog({ onSaveAndStart, onStart, onClose }: { onSaveAndStart: () => void; onStart: () => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, onClose);
  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>('button.primary')?.focus();
  }, []);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog alert-dialog tone-bad" role="alertdialog" aria-modal="true" aria-labelledby="new-game-title" aria-describedby="new-game-lines" ref={box}>
        <h2 id="new-game-title">{__i18n_t("ui.newGameDialog.text.fbe445c8")}</h2>
        <div id="new-game-lines">
          <p>{__i18n_t("ui.newGameDialog.text.117098fd")}</p>
        </div>
        <p class="actions">
          <button type="button" class="primary" onClick={onSaveAndStart}>
            {__i18n_t("ui.newGameDialog.text.c1b65236")}
          </button>
          <button type="button" class="danger" onClick={onStart}>
            {__i18n_t("ui.newGameDialog.text.b5a42117")}
          </button>
          <button type="button" onClick={onClose}>
            {__i18n_t("ui.newGameDialog.text.19b2d19b")}
          </button>
        </p>
      </div>
    </div>
  );
}
