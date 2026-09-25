import { useEffect, useMemo, useState } from 'preact/hooks';
import { RELEASE } from '../core/version';
import { DRAFT_ROOM_DRAFT_DATE } from '../draftroom';
import { nextDate, regularOver, type Action } from '../league/actions';
import type { LeagueState } from '../league/state';
import { shortName } from '../league/views';
import { ageOn, publicView } from '../model/player';
import type { CalendarPhase, Player, PlayerId } from '../model/types';
import { makeSave, parseSave, SaveError, serializeSave } from '../save/format';
import { openStore, type SaveStore } from '../save/store';
import { createWorld } from '../world/world';
import { DraftBoard } from './DraftBoard';
import { History } from './History';
import { Leaders } from './Leaders';
import { applyHere, applyInWorker, createInWorker } from './leagueClient';
import { PlayerPanel } from './PlayerPanel';
import { PlayerProfile } from './PlayerProfile';
import { Standings } from './Standings';
import { TeamRoster } from './TeamRoster';

const AUTO_SLOT = 'auto';
const newSeed = () => `kbo-${Math.floor(Math.random() * 36 ** 6).toString(36)}`;
const prospectAge = (p: Player) => ageOn(p.birthday, DRAFT_ROOM_DRAFT_DATE);

type Tab = 'standings' | 'leaders' | 'team' | 'history' | 'draft';
const TABS: { id: Tab; label: string }[] = [
  { id: 'standings', label: '순위' },
  { id: 'leaders', label: '기록' },
  { id: 'team', label: '구단' },
  { id: 'history', label: '역대' },
  { id: 'draft', label: '드래프트 후보' },
];

const PHASE: Record<LeagueState['phase'], CalendarPhase> = { regular: 'regularSeason', postseason: 'postseason', offseason: 'offseason' };
const snapshotSave = (s: LeagueState) => makeSave(s.seed, [], { at: { year: s.year, phase: PHASE[s.phase] }, state: s });

function statusLine(s: LeagueState) {
  if (s.phase === 'postseason') {
    const ks = s.postseason.find((x) => x.round === 'ks');
    return `${s.year} 시즌 종료 · 우승 ${ks ? shortName(s, ks.winner) : '-'}`;
  }
  if (regularOver(s)) return `${s.year} 정규시즌 종료 · 포스트시즌을 기다리는 중`;
  const date = nextDate(s);
  return `${s.year} 정규시즌 · 다음 경기일 ${date ? `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일` : '-'}`;
}

export function App() {
  const [store, setStore] = useState<SaveStore | null>(null);
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>('불러오는 중');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('standings');
  const [teamId, setTeamId] = useState<string>('kia');
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [prospectId, setProspectId] = useState<PlayerId | null>(null);
  const [seedDraft, setSeedDraft] = useState('');

  const show = (s: LeagueState) => {
    setLeague(s);
    setVersion((v) => v + 1);
    setSeedDraft(s.seed);
  };

  const persist = async (st: SaveStore, s: LeagueState) => {
    try {
      await st.put(AUTO_SLOT, snapshotSave(s));
    } catch {
      setNotice('진행을 자동 저장하지 못했습니다. 진행 파일로 저장해 두세요.');
    }
  };

  const create = async (st: SaveStore, seed: string) => {
    setBusy('리그를 만드는 중 · 2015년부터 시즌을 치르고 있습니다');
    const s = await createInWorker(seed, (year) => setBusy(`리그를 만드는 중 · ${year} 시즌`));
    show(s);
    await persist(st, s);
    setBusy(null);
  };

  useEffect(() => {
    (async () => {
      const st = await openStore();
      setStore(st);
      try {
        const saved = await st.get(AUTO_SLOT);
        const state = saved?.snapshot?.state as LeagueState | undefined;
        if (state?.teams) {
          show(state);
          setBusy(null);
          return;
        }
      } catch (e) {
        if (e instanceof SaveError) setNotice(`자동 저장을 열지 못해 새 리그를 만듭니다. ${e.message}`);
      }
      await create(st, newSeed());
    })();
  }, []);

  const world = useMemo(() => (league ? createWorld(league.seed) : null), [league?.seed]);
  const prospect = useMemo(() => world?.draftClass.find((p) => p.id === prospectId) ?? world?.draftClass[0] ?? null, [world, prospectId]);

  if (!store || !league) return <main class="loading">{busy ?? '불러오는 중'}</main>;

  const act = async (action: Action, label: string, heavy: boolean) => {
    setBusy(label);
    setNotice('');
    const s = heavy ? await applyInWorker(league, action) : applyHere(league, action);
    show(s);
    await persist(store, s);
    setBusy(null);
  };

  const exportSave = () => {
    const blob = new Blob([serializeSave(snapshotSave(league))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kbo-expansion-${league.seed}-${league.year}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const importSave = async (file: File | undefined) => {
    if (!file) return;
    try {
      const save = parseSave(await file.text());
      const state = save.snapshot?.state as LeagueState | undefined;
      if (state?.teams) {
        show(state);
        await persist(store, state);
      } else await create(store, save.seed);
      setNotice('진행 파일을 불러왔습니다.');
    } catch (e) {
      setNotice(e instanceof SaveError ? e.message : '진행 파일을 읽지 못했습니다.');
    }
  };

  // On narrow screens the scouting report sits below the whole list, so bring it into view.
  const selectProspect = (id: PlayerId) => {
    setProspectId(id);
    if (window.matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => document.querySelector('.profile')?.scrollIntoView({ block: 'start' }));
  };

  const openTeam = (id: string) => {
    setTeamId(id);
    setTab('team');
  };

  const controls =
    league.phase === 'postseason' ? (
      <button type="button" onClick={() => act({ kind: 'nextSeason' }, '오프시즌 진행 중', true)}>
        다음 시즌으로
      </button>
    ) : regularOver(league) ? (
      <button type="button" onClick={() => act({ kind: 'postseason' }, '포스트시즌 진행 중', true)}>
        포스트시즌 진행
      </button>
    ) : (
      <>
        <button type="button" onClick={() => act({ kind: 'days', days: 1 }, '경기 중', false)}>
          하루
        </button>
        <button type="button" onClick={() => act({ kind: 'days', days: 6 }, '경기 중', false)}>
          1주
        </button>
        <button type="button" onClick={() => act({ kind: 'days', days: 26 }, '한 달 진행 중', true)}>
          한 달
        </button>
        <button type="button" onClick={() => act({ kind: 'regularEnd' }, '정규시즌 진행 중', true)}>
          정규시즌 끝까지
        </button>
      </>
    );

  return (
    <>
      <header class="masthead">
        <div>
          <h1>KBO 신구단</h1>
          <p class="muted">
            관전 모드 · 버전 {RELEASE}
          </p>
        </div>
        <form
          class="seed"
          onSubmit={(e) => {
            e.preventDefault();
            void create(store, seedDraft.trim() || newSeed());
          }}
        >
          <label>
            시드
            <input value={seedDraft} onInput={(e) => setSeedDraft((e.currentTarget as HTMLInputElement).value)} spellcheck={false} disabled={!!busy} />
          </label>
          <button type="submit" disabled={!!busy}>
            새 리그
          </button>
        </form>
      </header>
      <div class="progress-bar">
        <p class="status" aria-live="polite">
          {busy ?? statusLine(league)}
        </p>
        <fieldset class="controls" disabled={!!busy}>
          {controls}
        </fieldset>
      </div>
      {notice && (
        <p class="notice" role="status">
          {notice}
        </p>
      )}
      <nav class="tabs" aria-label="화면">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main class="page" data-version={version}>
        {tab === 'standings' && <Standings league={league} onTeam={openTeam} />}
        {tab === 'leaders' && <Leaders league={league} onPlayer={setPlayerId} />}
        {tab === 'team' && <TeamRoster league={league} teamId={teamId} onTeam={setTeamId} onPlayer={setPlayerId} />}
        {tab === 'history' && <History league={league} />}
        {tab === 'draft' && world && (
          <div class="layout">
            <DraftBoard players={world.draftClass} ageOf={prospectAge} selectedId={prospect?.id ?? null} onSelect={selectProspect} />
            <PlayerProfile player={prospect && publicView(prospect)} age={prospect && prospectAge(prospect)} />
          </div>
        )}
      </main>
      {playerId && <PlayerPanel league={league} id={playerId} onClose={() => setPlayerId(null)} />}
      <footer class="footer">
        <div class="save-actions">
          <button type="button" onClick={exportSave} disabled={!!busy}>
            진행 파일 저장
          </button>
          <label class="file-button">
            불러오기
            <input type="file" accept="application/json,.json" onChange={(e) => importSave((e.currentTarget as HTMLInputElement).files?.[0])} />
          </label>
          <span class="muted">{store.kind === 'indexedDB' ? '자동 저장됨' : '이 브라우저에서는 자동 저장을 쓸 수 없습니다. 진행 파일로 저장하세요.'}</span>
        </div>
        <p class="muted">선수·학교·기록은 모두 가상입니다. 구단명과 구장 외에는 실제와 관계없습니다.</p>
      </footer>
    </>
  );
}
