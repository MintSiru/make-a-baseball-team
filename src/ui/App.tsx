import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RELEASE } from '../core/version';
import { DRAFT_ROOM_DRAFT_DATE } from '../draftroom';
import { draftClass } from '../league/players';
import { nextDate, regularOver, type Action } from '../league/actions';
import type { ExpansionSettings, LeagueState } from '../league/state';
import { shortName } from '../league/views';
import { ageOn, publicView } from '../model/player';
import type { CalendarPhase, Player, PlayerId } from '../model/types';
import { makeSave, parseSave, SaveError, serializeSave } from '../save/format';
import { openStore, type SaveStore } from '../save/store';
import { Decision } from './Decision';
import { DraftBoard } from './DraftBoard';
import { History } from './History';
import { Leaders } from './Leaders';
import { applyHere, applyInWorker, createInWorker } from './leagueClient';
import { MyClub } from './MyClub';
import { NewGame } from './NewGame';
import { PlayerPanel } from './PlayerPanel';
import { PlayerProfile } from './PlayerProfile';
import { Standings } from './Standings';
import { TeamRoster } from './TeamRoster';

const AUTO_SLOT = 'auto';
const newSeed = () => `kbo-${Math.floor(Math.random() * 36 ** 6).toString(36)}`;

type Tab = 'club' | 'standings' | 'leaders' | 'team' | 'history' | 'draft';
const TABS: { id: Tab; label: string; userOnly?: boolean }[] = [
  { id: 'club', label: '우리 구단', userOnly: true },
  { id: 'standings', label: '순위' },
  { id: 'leaders', label: '기록' },
  { id: 'team', label: '구단' },
  { id: 'history', label: '역대' },
  { id: 'draft', label: '드래프트 후보' },
];

const PHASE: Record<LeagueState['phase'], CalendarPhase> = { regular: 'regularSeason', postseason: 'postseason', offseason: 'offseason' };
const snapshotSave = (s: LeagueState) => makeSave(s.seed, [], { at: { year: s.year, phase: PHASE[s.phase] }, state: s });

function statusLine(s: LeagueState) {
  if (s.pending) return `${s.offseason ? `${s.offseason.year} 오프시즌` : `${s.year}`} · 결정할 일이 있습니다`;
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('club');
  const [teamId, setTeamId] = useState<string>('kia');
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [prospectId, setProspectId] = useState<PlayerId | null>(null);
  const [seed] = useState(newSeed);
  // A league built in the background while the player fills in the founding form.
  const building = useRef<{ seed: string; promise: Promise<LeagueState> } | null>(null);

  const show = (s: LeagueState) => {
    setLeague(s);
    setVersion((v) => v + 1);
  };

  const persist = async (st: SaveStore, s: LeagueState) => {
    try {
      await st.put(AUTO_SLOT, snapshotSave(s));
    } catch {
      setNotice('진행을 자동 저장하지 못했습니다. 진행 파일로 저장해 두세요.');
    }
  };

  const build = (s: string) => {
    if (building.current?.seed !== s) building.current = { seed: s, promise: createInWorker(s, (year) => setProgress(`${year} 시즌`)) };
    return building.current.promise;
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
          setTab(state.user ? 'club' : 'standings');
        }
      } catch (e) {
        if (e instanceof SaveError) setNotice(`자동 저장을 열지 못했습니다. ${e.message}`);
      }
      setLoading(false);
    })();
  }, []);

  // Start building a league as soon as the founding form is on screen.
  useEffect(() => {
    if (!loading && !league) void build(seed).catch(() => undefined);
  }, [loading, league]);

  // The draft class of this September (it fills next season's rosters): the 2027 draft is Draft Room's own pool.
  const draftYear = league ? (league.phase === 'offseason' && league.offseason ? league.offseason.year : league.year) : 2026;
  const draftPool = useMemo(() => (league ? draftClass(league.seed, draftYear) : []), [league?.seed, draftYear]);
  const prospect = useMemo(() => draftPool.find((p) => p.id === prospectId) ?? draftPool[0] ?? null, [draftPool, prospectId]);
  const prospectAge = (p: Player) => ageOn(p.birthday, `${draftYear}${DRAFT_ROOM_DRAFT_DATE.slice(4)}`);

  if (loading || !store) return <main class="loading">불러오는 중</main>;

  const found = async (settings: ExpansionSettings, s: string) => {
    setBusy('리그의 과거를 만드는 중');
    let base = await build(s);
    base = await applyInWorker(base, { kind: 'toFounding' });
    const next = applyHere(base, { kind: 'found', settings });
    building.current = null;
    show(next);
    setTab('club');
    await persist(store, next);
    setBusy(null);
  };

  const spectate = async (s: string) => {
    setBusy('리그의 과거를 만드는 중');
    const next = await build(s);
    building.current = null;
    show(next);
    setTab('standings');
    await persist(store, next);
    setBusy(null);
  };

  if (!league)
    return (
      <>
        <header class="masthead">
          <div>
            <h1>KBO 신구단</h1>
            <p class="muted">버전 {RELEASE}</p>
          </div>
        </header>
        {notice && <p class="notice">{notice}</p>}
        <NewGame seed={seed} busy={busy && `${busy}${progress ? ` · ${progress}` : ''}`} onFound={found} onSpectate={spectate} />
      </>
    );

  const act = async (action: Action, label: string, heavy: boolean) => {
    setBusy(label);
    setNotice('');
    try {
      const s = heavy ? await applyInWorker(league, action) : applyHere(league, action);
      show(s);
      await persist(store, s);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
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
      if (!state?.teams) throw new SaveError('damaged', '진행 파일에 리그 상태가 없습니다.');
      show(state);
      await persist(store, state);
      setNotice('진행 파일을 불러왔습니다.');
    } catch (e) {
      setNotice(e instanceof SaveError ? e.message : '진행 파일을 읽지 못했습니다.');
    }
  };

  const newGame = () => {
    if (!window.confirm('지금 게임을 두고 새 게임을 시작할까요? 진행 파일로 저장하지 않은 진행은 새 게임을 창단하면 사라집니다.')) return;
    setLeague(null);
  };

  // On narrow screens the scouting report sits below the whole list, so bring it into view.
  const selectProspect = (id: PlayerId) => {
    setProspectId(id);
    if (window.matchMedia('(max-width: 900px)').matches) requestAnimationFrame(() => document.querySelector('.profile')?.scrollIntoView({ block: 'start' }));
  };

  const openTeam = (id: string) => {
    if (id === league.user?.teamId) setTab('club');
    else {
      setTeamId(id);
      setTab('team');
    }
  };

  const controls = league.pending ? null : league.phase === 'postseason' ? (
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

  const userTeam = league.user ? league.teams.find((t) => t.id === league.user!.teamId) : null;

  return (
    <div style={userTeam ? ({ '--accent': userTeam.color } as Record<string, string>) : undefined}>
      <header class="masthead">
        <div>
          <h1>{userTeam ? userTeam.name : 'KBO 신구단'}</h1>
          <p class="muted">
            {userTeam ? `단장 · 버전 ${RELEASE}` : `관전 모드 · 버전 ${RELEASE}`} · 시드 {league.seed}
          </p>
        </div>
        <button type="button" onClick={newGame} disabled={!!busy}>
          새 게임
        </button>
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
      {league.pending ? (
        <main class="page" data-version={version}>
          <Decision league={league} onPlayer={setPlayerId} onSubmit={(input) => act({ kind: 'decide', input }, '진행 중', false)} />
        </main>
      ) : (
        <>
          <nav class="tabs" aria-label="화면">
            {TABS.filter((t) => !t.userOnly || league.user).map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <main class="page" data-version={version}>
            {tab === 'club' && league.user && <MyClub league={league} onPlayer={setPlayerId} onAct={(a) => act(a, '처리 중', false)} />}
            {tab === 'standings' && <Standings league={league} onTeam={openTeam} />}
            {tab === 'leaders' && <Leaders league={league} onPlayer={setPlayerId} />}
            {tab === 'team' && <TeamRoster league={league} teamId={teamId} onTeam={openTeam} onPlayer={setPlayerId} />}
            {tab === 'history' && <History league={league} />}
            {tab === 'draft' && (
              <div class="layout">
                <DraftBoard draftYear={draftYear} players={draftPool} ageOf={prospectAge} selectedId={prospect?.id ?? null} onSelect={selectProspect} />
                <PlayerProfile player={prospect && publicView(prospect)} age={prospect && prospectAge(prospect)} />
              </div>
            )}
          </main>
        </>
      )}
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
    </div>
  );
}
