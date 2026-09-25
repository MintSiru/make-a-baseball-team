import { useEffect, useMemo, useState } from 'preact/hooks';
import { RELEASE } from '../core/version';
import { DRAFT_ROOM_DRAFT_DATE } from '../draftroom';
import { ageOn, publicView } from '../model/player';
import type { Player, PlayerId } from '../model/types';
import { makeSave, parseSave, SaveError, serializeSave } from '../save/format';
import { openStore, type SaveStore } from '../save/store';
import { createWorld, type World } from '../world/world';
import { DraftBoard } from './DraftBoard';
import { PlayerProfile } from './PlayerProfile';

const AUTO_SLOT = 'auto';
const newSeed = () => `kbo-${Math.floor(Math.random() * 36 ** 6).toString(36)}`;
const ageOf = (p: Player) => ageOn(p.birthday, DRAFT_ROOM_DRAFT_DATE);
const STACKED = '(max-width: 900px)';

export function App() {
  const [store, setStore] = useState<SaveStore | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [selectedId, setSelectedId] = useState<PlayerId | null>(null);
  const [notice, setNotice] = useState('');
  const [seedDraft, setSeedDraft] = useState('');

  const start = async (s: SaveStore, seed: string) => {
    const w = createWorld(seed);
    setWorld(w);
    setSeedDraft(seed);
    setSelectedId(w.draftClass[0]?.id ?? null);
    await s.put(AUTO_SLOT, makeSave(seed));
  };

  useEffect(() => {
    (async () => {
      const s = await openStore();
      setStore(s);
      let seed = newSeed();
      try {
        seed = (await s.get(AUTO_SLOT))?.seed ?? seed;
      } catch (e) {
        if (e instanceof SaveError) setNotice(`자동 저장을 열지 못해 새로 시작했습니다. ${e.message}`);
      }
      await start(s, seed);
    })();
  }, []);

  const selected = useMemo(() => world?.draftClass.find((p) => p.id === selectedId) ?? null, [world, selectedId]);

  if (!store || !world) return <main class="loading">불러오는 중</main>;

  const exportSave = () => {
    const blob = new Blob([serializeSave(makeSave(world.seed))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kbo-expansion-${world.seed}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const importSave = async (file: File | undefined) => {
    if (!file) return;
    try {
      const save = parseSave(await file.text());
      await start(store, save.seed);
      setNotice('진행 파일을 불러왔습니다.');
    } catch (e) {
      setNotice(e instanceof SaveError ? e.message : '진행 파일을 읽지 못했습니다.');
    }
  };

  // On narrow screens the report sits below the whole list, so bring it into view.
  const select = (id: PlayerId) => {
    setSelectedId(id);
    if (window.matchMedia(STACKED).matches) requestAnimationFrame(() => document.querySelector('.profile')?.scrollIntoView({ block: 'start' }));
  };

  const restart = (seed: string) => {
    setNotice('');
    void start(store, seed.trim() || newSeed());
  };

  return (
    <>
      <header class="masthead">
        <div>
          <h1>KBO 신구단</h1>
          <p class="muted">2026 창단 준비 · 버전 {RELEASE}</p>
        </div>
        <form
          class="seed"
          onSubmit={(e) => {
            e.preventDefault();
            restart(seedDraft);
          }}
        >
          <label>
            시드
            <input value={seedDraft} onInput={(e) => setSeedDraft((e.currentTarget as HTMLInputElement).value)} spellcheck={false} />
          </label>
          <button type="submit">새로 만들기</button>
          <button type="button" onClick={() => restart(newSeed())}>
            무작위
          </button>
        </form>
      </header>
      {notice && (
        <p class="notice" role="status">
          {notice}
        </p>
      )}
      <main class="layout">
        <DraftBoard players={world.draftClass} ageOf={ageOf} selectedId={selectedId} onSelect={select} />
        <PlayerProfile player={selected && publicView(selected)} age={selected && ageOf(selected)} />
      </main>
      <footer class="footer">
        <div class="save-actions">
          <button type="button" onClick={exportSave}>
            진행 파일 저장
          </button>
          <label class="file-button">
            불러오기
            <input type="file" accept="application/json,.json" onChange={(e) => importSave((e.currentTarget as HTMLInputElement).files?.[0])} />
          </label>
          <span class="muted">{store.kind === 'indexedDB' ? '자동 저장됨' : '이 브라우저에서는 자동 저장을 쓸 수 없습니다. 진행 파일로 저장하세요.'}</span>
        </div>
        <p class="muted">선수·학교·기록은 모두 가상입니다. 구단명 외에는 실제와 관계없습니다.</p>
      </footer>
    </>
  );
}
