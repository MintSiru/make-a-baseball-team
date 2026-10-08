import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Getting a game back (1.4.1, from the 1.4 review). When a screen breaks or the autosave cannot be opened, the player
   is never left on a blank page: go to another screen, restore one of the autosaves kept behind (a few minutes
   apart), open a save file, or start a new game — the autosave is kept as a backup either way. Each choice reloads the
   page into the game it picked, with autosaving held so nothing writes over it on the way out. */
import { Component, type ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { RELEASE } from '../core/version';
import { parseSave, SaveError } from '../save/format';
import { AUTO_SLOT, autosaveHold, backupsOf, openStore, restoreBackup, UNDO_SLOT, type Backup } from '../save/store';
import { readSaveFile } from '../save/compress';

/** Asks the next start to skip the autosave once (a new game; the autosave stays as a backup). */
export const FRESH_KEY = 'kbo-fresh-start';

const reload = () => window.location.reload();
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e));

export function Recovery({ error, onBack, title }: { error?: unknown; onBack?: () => void; title?: string }) {
  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    void openStore()
      .then(backupsOf)
      .then(setBackups)
      .catch(() => setBackups([]));
  }, []);

  const restore = async (slot: string) => {
    autosaveHold.on = true;
    try {
      await restoreBackup(await openStore(), slot);
      reload();
    } catch (e) {
      autosaveHold.on = false;
      setMsg(__i18n_k("ui.recovery.recovery.restore.2b370cb6", { value: e instanceof Error ? e.message : String(e) }));
    }
  };
  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      const save = parseSave(await readSaveFile(file));
      if (!save.snapshot) throw new SaveError('damaged', __i18n_k("ui.recovery.recovery.open.8f84f785"));
      autosaveHold.on = true;
      const st = await openStore();
      await st.copy(AUTO_SLOT, UNDO_SLOT);
      await st.put(AUTO_SLOT, save);
      reload();
    } catch (e) {
      autosaveHold.on = false;
      setMsg(e instanceof SaveError ? e.message : __i18n_k("ui.recovery.recovery.open.e2604b5b"));
    }
  };
  const fresh = () => {
    if (!window.confirm(__i18n_k("ui.recovery.recovery.fresh.fe978faf"))) return;
    autosaveHold.on = true;
    try {
      sessionStorage.setItem(FRESH_KEY, '1');
    } catch {
      // Without session storage the start opens the autosave again; the recovery screen stays one click away.
    }
    reload();
  };
  const copy = () => {
    const text = __i18n_k("ui.recovery.copy.text.dd5d5e7e", { rELEASE: RELEASE, userAgent: navigator.userAgent, describe: describe(error) });
    void navigator.clipboard?.writeText(text).then(
      () => setMsg(__i18n_k("ui.recovery.recovery.copy.65e25303")),
      () => setMsg(__i18n_k("ui.recovery.recovery.copy.8f610775")),
    );
  };

  return (
    <section class="recovery" aria-labelledby="recovery-title">
      <h2 id="recovery-title">{__i18n_display(title ?? (error ? __i18n_k("ui.recovery.recovery.5364a19b") : __i18n_k("ui.recovery.recovery.c817428e")))}</h2>
      {__i18n_display(error !== undefined && (
        <p>{__i18n_t("ui.recovery.recovery.a7d54d31")}</p>
      ))}
      {__i18n_display(msg && (
        <p class="notice" role="status">
          {__i18n_display(msg)}
        </p>
      ))}
      <div class="row-actions">
        {__i18n_display(onBack && (
          <button type="button" class="primary" onClick={onBack}>{__i18n_t("ui.recovery.recovery.7397b570")}</button>
        ))}
        <label class="file-button">
          진행 파일 불러오기
          <input type="file" accept=".json,.gz,application/json" onChange={(e) => void open((e.currentTarget as HTMLInputElement).files?.[0])} />
        </label>
        <button type="button" onClick={fresh}>{__i18n_t("ui.recovery.recovery.9f84140c")}</button>
        {__i18n_display(error !== undefined && (
          <button type="button" onClick={copy}>{__i18n_t("ui.recovery.recovery.6d93b064")}</button>
        ))}
      </div>
      <h3>{__i18n_t("ui.recovery.recovery.3065f99d")}</h3>
      {__i18n_display(backups === null ? (
        <p class="muted">{__i18n_t("ui.recovery.recovery.c44aa196")}</p>
      ) : backups.length === 0 ? (
        <p class="muted">{__i18n_t("ui.recovery.recovery.2aca0b6a")}</p>
      ) : (
        <ul class="plain backup-list">
          {__i18n_display(backups.map((b) => (
            <li key={b.slot}>
              <span>
                <strong>{__i18n_display(b.problem ? __i18n_k("ui.recovery.recovery.8654097e") : __i18n_k("ui.recovery.recovery.34e28011", { at: b.at, value: b.club ? ` · ${b.club}` : __i18n_k("ui.recovery.recovery.49faefb4") }))}</strong>{__i18n_display(' ')}
                <span class="muted small">{__i18n_t("ui.recovery.recovery.f4ee1272", { when: when(b.savedAt), value: b.slot === UNDO_SLOT ? __i18n_k("ui.recovery.recovery.860ee3a3") : b.slot.startsWith('backup-') ? __i18n_k("ui.recovery.recovery.eeb7cc5b") : '' })}</span>
                {__i18n_display(b.problem && <span class="muted small"> · {__i18n_display(b.problem)}</span>)}
              </span>
              {__i18n_display(!b.problem && (
                <button type="button" onClick={() => void restore(b.slot)}>{__i18n_t("ui.recovery.recovery.61313a35")}</button>
              ))}
            </li>
          )))}
        </ul>
      ))}
      {__i18n_display(error !== undefined && (
        <details>
          <summary>{__i18n_t("ui.recovery.recovery.eb0b429b")}</summary>
          <pre class="error-text" tabIndex={0}>{__i18n_display(describe(error))}</pre>
        </details>
      ))}
    </section>
  );
}

/** Catches a screen that fails to draw and shows the recovery choices in its place. `resetKey` changing (another tab)
    gives the screen another try. */
export class Guard extends Component<{ resetKey?: string; onBack?: () => void; children: ComponentChildren }, { error: unknown; key?: string }> {
  override state = { error: undefined as unknown, key: this.props.resetKey };
  static override getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('알 수 없는 오류') };
  }
  override componentDidUpdate() {
    if (this.state.error !== undefined && this.props.resetKey !== this.state.key) this.setState({ error: undefined, key: this.props.resetKey });
  }
  override componentDidCatch(error: unknown) {
    // The screen it broke on: another one (resetKey) gets a fresh try. Kept in the console for anyone reporting it.
    this.setState({ key: this.props.resetKey });
    console.error(error);
  }
  override render() {
    if (this.state.error !== undefined) return <Recovery error={this.state.error} onBack={this.props.onBack} />;
    return this.props.children;
  }
}
