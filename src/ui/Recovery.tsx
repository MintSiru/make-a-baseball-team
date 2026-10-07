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
      setMsg(`되돌리지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      const save = parseSave(await readSaveFile(file));
      if (!save.snapshot) throw new SaveError('damaged', '진행 파일에 리그 상태가 없습니다.');
      autosaveHold.on = true;
      const st = await openStore();
      await st.copy(AUTO_SLOT, UNDO_SLOT);
      await st.put(AUTO_SLOT, save);
      reload();
    } catch (e) {
      autosaveHold.on = false;
      setMsg(e instanceof SaveError ? e.message : '진행 파일을 읽지 못했습니다.');
    }
  };
  const fresh = () => {
    if (!window.confirm('새 게임을 시작할까요? 지금 자동 저장은 백업으로 남아 이 화면에서 다시 되돌릴 수 있습니다.')) return;
    autosaveHold.on = true;
    try {
      sessionStorage.setItem(FRESH_KEY, '1');
    } catch {
      // Without session storage the start opens the autosave again; the recovery screen stays one click away.
    }
    reload();
  };
  const copy = () => {
    const text = `KBO 신구단 ${RELEASE}\n${navigator.userAgent}\n${describe(error)}`;
    void navigator.clipboard?.writeText(text).then(
      () => setMsg('오류 내용을 복사했습니다.'),
      () => setMsg('복사하지 못했습니다. 아래 내용을 직접 복사하세요.'),
    );
  };

  return (
    <section class="recovery" aria-labelledby="recovery-title">
      <h2 id="recovery-title">{title ?? (error ? '이 화면을 여는 중에 문제가 생겼습니다' : '이전 진행으로 되돌리기')}</h2>
      {error !== undefined && (
        <p>
          게임은 멈추지 않았습니다. 다른 화면으로 가거나, 몇 분 전 자동 저장으로 되돌리거나, 진행 파일을 불러올 수 있습니다. 같은 일이 되풀이되면 오류 내용을 복사해 알려 주세요.
        </p>
      )}
      {msg && (
        <p class="notice" role="status">
          {msg}
        </p>
      )}
      <div class="row-actions">
        {onBack && (
          <button type="button" class="primary" onClick={onBack}>
            다른 화면으로
          </button>
        )}
        <label class="file-button">
          진행 파일 불러오기
          <input type="file" accept=".json,.gz,application/json" onChange={(e) => void open((e.currentTarget as HTMLInputElement).files?.[0])} />
        </label>
        <button type="button" onClick={fresh}>
          새 게임 시작
        </button>
        {error !== undefined && (
          <button type="button" onClick={copy}>
            오류 내용 복사
          </button>
        )}
      </div>
      <h3>자동 저장 백업</h3>
      {backups === null ? (
        <p class="muted">백업을 찾는 중</p>
      ) : backups.length === 0 ? (
        <p class="muted">아직 백업이 없습니다. 자동 저장은 몇 분마다, 그리고 다른 게임을 시작하기 전에 백업으로 남습니다.</p>
      ) : (
        <ul class="plain backup-list">
          {backups.map((b) => (
            <li key={b.slot}>
              <span>
                <strong>{b.problem ? '열 수 없음' : `${b.at}${b.club ? ` · ${b.club}` : ' · 관전'}`}</strong>{' '}
                <span class="muted small">
                  {when(b.savedAt)} 저장{b.slot === UNDO_SLOT ? ' · 되돌리기 전 상태' : b.slot.startsWith('backup-') ? ' · 버전 업데이트 전' : ''}
                </span>
                {b.problem && <span class="muted small"> · {b.problem}</span>}
              </span>
              {!b.problem && (
                <button type="button" onClick={() => void restore(b.slot)}>
                  이 시점으로 되돌리기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error !== undefined && (
        <details>
          <summary>오류 내용</summary>
          <pre class="error-text" tabIndex={0}>{describe(error)}</pre>
        </details>
      )}
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
