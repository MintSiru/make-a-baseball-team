import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RELEASE } from '../core/version';
import { DRAFT_ROOM_DRAFT_DATE } from '../draftroom';
import { draftClass } from '../league/players';
import { allowedWhileWaiting, nextDate, regularOver, type Action } from '../league/actions';
import type { ExpansionSettings, LeagueState } from '../league/state';
import { shortName } from '../league/views';
import { scoutView } from '../league/staff';
import { ageOn, publicView } from '../model/player';
import type { CalendarPhase, Player, PlayerId } from '../model/types';
import { makeSave, parseSave, SaveError, serializeSave } from '../save/format';
import { AUTO_SLOT, autosaveHold, BACKUP_EVERY, openStore, rotateBackups, setAsideDamaged, type SaveStore } from '../save/store';
import { autoSaver, type AutoSaver } from '../save/autosave';
import { readSaveFile } from '../save/compress';
import { BoxScore } from './BoxScore';
import { StorySettings } from './StorySettings';
import { DisplaySettings } from './DisplaySettings';
import { readableAccent } from './display';
import { useDark } from './useDisplay';
import { lastExport, noteExport, Settings } from './Settings';
import { Manual } from './Manual';
import { DISCLAIMER } from '../core/about';
import { ClubSummary } from './ClubSummary';
import { AlertPopup, poppingAlerts, useAlertKindsOff, useAlertPopups, useArticlePopups } from './Alerts';
import { TutorialCard } from './Tutorial';
import { tutorialPaused } from './tutorial';
import { unseenAlerts } from '../league/alerts';
import { hasKey, loadSettings, saveSettings, type StorySettings as StorySettingsT } from '../story/settings';
import { PROVIDERS, rewrite } from '../story/writer';
import type { StoryError } from '../story/types';
import { detailFor, type NewsItem } from '../league/news';
import { Decision } from './Decision';
import { Games } from './Games';
import { DraftBoard } from './DraftBoard';
import { History } from './History';
import { Leaders } from './Leaders';
import { postseasonStatus } from '../league/postseason';
import { applyCombine, attends, checkWorkout, combineHeld, combineLines, workoutsOf } from '../league/combine';
import { traitReport } from '../league/reports';
import { COMBINE } from '../league/tuning';
import { money } from './format';
import { applyHere, applyInWorker, createInWorker } from './leagueClient';
import { Market } from './Market';
import { FRESH_KEY, Guard, Recovery } from './Recovery';
import { MyClub } from './MyClub';
import { NewGame } from './NewGame';
import { PlayerPanel } from './PlayerPanel';
import { PlayerProfile } from './PlayerProfile';
import { Standings } from './Standings';
import { TeamRoster } from './TeamRoster';

const newSeed = () => `kbo-${Math.floor(Math.random() * 36 ** 6).toString(36)}`;

type Tab = 'decision' | 'club' | 'market' | 'games' | 'standings' | 'leaders' | 'team' | 'history' | 'draft' | 'settings' | 'help';
const TABS: { id: Tab; label: string; userOnly?: boolean; waiting?: boolean }[] = [
  // Only while the game waits for a decision (the winter's steps): the other screens stay open beside it.
  { id: 'decision', label: '결정할 일', waiting: true },
  { id: 'club', label: '우리 구단', userOnly: true },
  { id: 'market', label: '이적시장', userOnly: true },
  { id: 'games', label: '경기' },
  { id: 'standings', label: '순위' },
  { id: 'leaders', label: '기록' },
  { id: 'team', label: '구단' },
  { id: 'history', label: '역대' },
  { id: 'draft', label: '드래프트 후보' },
  { id: 'settings', label: '설정' },
  { id: 'help', label: '도움말' },
];

const AUTO_KINDS: NewsItem['kind'][] = ['season', 'award', 'month', 'interview'];
/** Automatic mode after a failure it can wait out: seconds to pause (at least; longer if the server asks),
    and how many times one article is tried. A spent quota or a bad key turns automatic mode off. */
const AUTO_PAUSE: Partial<Record<StoryError, number>> = { rate: 60, busy: 180, network: 120 };
const AUTO_TRIES = 3;
/** Seconds between automatic articles, so a backlog does not go out as a burst. */
const AUTO_GAP = 5;
const seconds = (sec: number) => (sec < 60 ? `${sec}초` : `${Math.ceil(sec / 60)}분`);

const PHASE: Record<LeagueState['phase'], CalendarPhase> = { regular: 'regularSeason', postseason: 'postseason', offseason: 'offseason' };
const snapshotSave = (s: LeagueState) => makeSave(s.seed, [], { at: { year: s.year, phase: PHASE[s.phase] }, state: s });

function statusLine(s: LeagueState) {
  if (s.pending) return `${s.offseason ? `${s.offseason.year} 오프시즌` : `${s.year}`} · 결정할 일이 있습니다`;
  if (s.phase === 'postseason') {
    const live = postseasonStatus(s);
    if (live) return live;
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
  /** The founding screen shows the recovery choices (an autosave that would not open, or asked for). */
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('club');
  const [clubView, setClubView] = useState('overview');
  const [boxId, setBoxId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string>('kia');
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [prospectId, setProspectId] = useState<PlayerId | null>(null);
  const [seed] = useState(newSeed);
  // AI articles (V0.7): settings and keys stay outside the league state.
  const [storySettings, setStorySettings] = useState<StorySettingsT>(loadSettings);
  const [storyOpen, setStoryOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [storyBusy, setStoryBusy] = useState<string | null>(null);
  const usage = useRef({ input: 0, output: 0, articles: 0 });
  // Event pop-ups (V0.7.4): shown when they are on, or when the player opens them from the header.
  const [popups] = useAlertPopups();
  const [articles] = useArticlePopups();
  const [kindsOff] = useAlertKindsOff();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const dark = useDark();
  const autoTried = useRef(new Set<string>());
  const autoTries = useRef(new Map<string, number>());
  // Automatic mode waits until this time (ms); the tick wakes it up.
  const autoPause = useRef(0);
  const [autoTick, setAutoTick] = useState(0);
  const latest = useRef<LeagueState | null>(null);
  latest.current = league;
  const acting = useRef<Promise<void>>(Promise.resolve());
  // A league built in the background while the player fills in the founding form.
  const building = useRef<{ seed: string; promise: Promise<LeagueState> } | null>(null);

  const show = (s: LeagueState) => {
    setLeague(s);
    setVersion((v) => v + 1);
  };

  // 1.4.1: the autosave goes behind into the backups every few minutes and before another game takes its place.
  const backedUp = useRef<{ at: number; seed: string | null }>({ at: 0, seed: null });
  const persist = async (st: SaveStore, s: LeagueState) => {
    if (autosaveHold.on) return;
    try {
      const b = backedUp.current;
      if (Date.now() - b.at >= BACKUP_EVERY || b.seed !== s.seed) {
        await rotateBackups(st);
        backedUp.current = { at: Date.now(), seed: s.seed };
      }
      await st.put(AUTO_SLOT, snapshotSave(s));
    } catch {
      setNotice('진행을 자동 저장하지 못했습니다. 진행 파일로 저장해 두세요.');
    }
  };
  // V0.14: everyday steps save a moment later, one write at a time (a burst of clicks is one write).
  const saver = useRef<AutoSaver<LeagueState> | null>(null);
  const saveSoon = (st: SaveStore, s: LeagueState) => (saver.current ??= autoSaver((x) => persist(st, x))).schedule(s);
  /** A new or loaded game: saved at once, after anything still waiting (so an older state cannot land last). */
  const saveNow = async (st: SaveStore, s: LeagueState) => {
    saveSoon(st, s);
    await saver.current!.flush();
  };
  useEffect(() => {
    // Leaving the page (closing the tab, switching apps on a phone): write what is waiting now.
    const flush = () => void saver.current?.flush();
    const onHide = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const build = (s: string) => {
    if (building.current?.seed !== s) building.current = { seed: s, promise: createInWorker(s, (year) => setProgress(`${year} 시즌`)) };
    return building.current.promise;
  };

  useEffect(() => {
    (async () => {
      const st = await openStore();
      setStore(st);
      // A new game asked for from the recovery screen: the autosave stays, as the first backup once this game saves.
      let fresh = false;
      try {
        fresh = sessionStorage.getItem(FRESH_KEY) === '1';
        sessionStorage.removeItem(FRESH_KEY);
      } catch {
        // No session storage: open the autosave as usual.
      }
      try {
        const saved = fresh ? null : await st.get(AUTO_SLOT);
        const state = saved?.snapshot?.state as LeagueState | undefined;
        if (state?.teams) {
          show(state);
          setTab(state.user ? 'club' : 'standings');
          if (saved?.migratedFrom) {
            // Keep the original before the carried-forward game overwrites the autosave.
            await st.copy(AUTO_SLOT, `backup-${saved.migratedFrom}`).catch(() => undefined);
            setNotice(`이전 버전(시뮬레이션 ${saved.migratedFrom})의 진행을 ${RELEASE} 규칙으로 옮겨 이어 합니다. 지나간 기록은 그대로이고, 앞으로의 경기와 성장은 새 규칙을 따릅니다.`);
          }
        }
      } catch (e) {
        // 1.4.1: a damaged autosave is set aside (never copied over a good backup) and the recovery choices come up.
        await setAsideDamaged(st).catch(() => undefined);
        setNotice(`자동 저장을 열지 못했습니다. ${e instanceof Error ? e.message : String(e)} 아래에서 백업으로 되돌리거나 진행 파일을 불러올 수 있습니다.`);
        setRecovering(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // V0.14: browsers may clear a site's data (Safari after weeks without a visit), autosave and all. A long game
  // gets a nudge, once a session, to keep a file of its own.
  const reminded = useRef(false);
  useEffect(() => {
    if (!league?.user || reminded.current || store?.kind !== 'indexedDB' || league.year - 2026 < 2) return;
    const at = lastExport(league.seed);
    const days = at ? Math.floor((Date.now() - Date.parse(at)) / 86_400_000) : null;
    if (days !== null && days < 14) return;
    reminded.current = true;
    setNotice(
      `${days === null ? '이 게임을 아직 진행 파일로 저장한 적이 없습니다' : `마지막으로 진행 파일을 저장한 지 ${days}일 지났습니다`}. 브라우저가 사이트 데이터를 지우면 자동 저장도 함께 사라지니, 설정 → 저장에서 진행 파일로 보관해 두세요. 아이폰·아이패드는 홈 화면에 추가해서 열면 더 오래 남습니다.`,
    );
  }, [league?.seed, league?.year, store]);

  // Start building a league as soon as the founding form is on screen.
  useEffect(() => {
    if (!loading && !league) void build(seed).catch(() => undefined);
  }, [loading, league]);

  // The draft class of this September (it fills next season's rosters): the 2027 draft is Draft Room's own pool.
  const draftYear = league ? (league.phase === 'offseason' && league.offseason ? league.offseason.year : league.year) : 2026;
  // The class, plus draftees who went abroad and come back through this draft (V0.7.3).
  const draftPool = useMemo(
    () =>
      league
        ? [
            // After the combine (1.3.0) the clubs know the class better.
            ...(combineHeld(league, draftYear) ? applyCombine(league.seed, draftYear, draftClass(league.seed, draftYear)) : draftClass(league.seed, draftYear)),
            ...Object.values(league.players).filter((p) => p.status === 'overseas' && p.abroad?.draft === draftYear),
          ]
        : [],
    [league?.seed, draftYear, version],
  );
  const prospect = useMemo(() => draftPool.find((p) => p.id === prospectId) ?? draftPool[0] ?? null, [draftPool, prospectId]);
  const prospectAge = (p: Player) => ageOn(p.birthday, `${draftYear}${DRAFT_ROOM_DRAFT_DATE.slice(4)}`);

  // Automatic mode: big articles get written as they appear, one at a time, within the session's budget.
  useEffect(() => {
    if (!league || !storySettings.auto || !hasKey(storySettings) || storyBusy || busy) return;
    if (usage.current.articles >= storySettings.budget) return;
    const wait = autoPause.current - Date.now();
    if (wait > 0) {
      const t = setTimeout(() => setAutoTick((x) => x + 1), wait);
      return () => clearTimeout(t);
    }
    const next = [...(league.news ?? [])].reverse().find((n) => (AUTO_KINDS.includes(n.kind) || (n.kind === 'move' && n.mine)) && !n.ai && !autoTried.current.has(n.id));
    if (next) {
      autoTried.current.add(next.id);
      void writeStory(next, true);
    }
  }, [version, storySettings, storyBusy, busy, autoTick]);

  // A new decision brings its screen forward (the other tabs stay open beside it); once the winter is
  // done, its tab goes away.
  const waitingKey = league?.pending ? `${league.year}|${league.offseason?.step ?? ''}|${league.pending.kind}` : null;
  useEffect(() => {
    if (waitingKey) setTab('decision');
    else setTab((t) => (t === 'decision' ? (latest.current?.user ? 'club' : 'standings') : t));
  }, [waitingKey]);

  if (loading || !store) return <main class="loading">불러오는 중</main>;

  /** Asks the chosen model for an article and stores it on the latest league state. */
  async function writeStory(item: NewsItem, auto = false) {
    if (!hasKey(storySettings)) {
      setStoryOpen(true);
      return;
    }
    const provider = storySettings.provider;
    const model = storySettings.models[provider] || PROVIDERS[provider].defaultModel;
    setStoryBusy(item.id);
    // Articles written before the fact lines existed get them rebuilt while the game is still kept.
    const detail = latest.current ? detailFor(latest.current, item) : item.detail;
    const out = await rewrite(detail ? { ...item, detail } : item, { provider, key: storySettings.keys[provider]!, model });
    setStoryBusy(null);
    if (!out.ok) {
      let note = '';
      const pause = AUTO_PAUSE[out.error];
      if (storySettings.auto && pause) {
        // Wait it out, then try this article again (a few times at most).
        const sec = Math.max(pause, out.retryAfter ?? 0);
        autoPause.current = Date.now() + sec * 1000;
        note = ` 자동 모드는 ${seconds(sec)} 쉬었다가 이어갑니다.`;
        const tries = (autoTries.current.get(item.id) ?? 0) + 1;
        autoTries.current.set(item.id, tries);
        if (auto && tries < AUTO_TRIES) autoTried.current.delete(item.id);
      } else if (storySettings.auto && (out.error === 'quota' || out.error === 'auth')) {
        setStorySettings((s) => {
          const off = { ...s, auto: false };
          saveSettings(off);
          return off;
        });
        note = ' 자동 모드를 껐습니다. 확인한 뒤 AI 기사 설정에서 다시 켜세요.';
      }
      setNotice(`AI 기사: ${out.message} (원래 기사를 씁니다)${note}`);
      return;
    }
    if (auto) autoPause.current = Date.now() + AUTO_GAP * 1000;
    usage.current = { input: usage.current.input + out.usage.input, output: usage.current.output + out.usage.output, articles: usage.current.articles + 1 };
    const base = latest.current;
    if (!base || !store) return;
    const s = applyHere(base, { kind: 'storyText', id: item.id, ai: { ...out.text, provider: PROVIDERS[provider].label, model } });
    show(s);
    saveSoon(store, s);
  }
  async function revertStory(item: NewsItem) {
    const base = latest.current;
    if (!base || !store) return;
    const s = applyHere(base, { kind: 'storyText', id: item.id, ai: null });
    show(s);
    saveSoon(store, s);
  }

  const found = async (settings: ExpansionSettings, s: string) => {
    setBusy('리그의 과거를 만드는 중');
    let base = await build(s);
    base = await applyInWorker(base, { kind: 'toFounding' });
    const next = applyHere(base, { kind: 'found', settings });
    building.current = null;
    show(next);
    setTab('club');
    await saveNow(store, next);
    setBusy(null);
  };

  const spectate = async (s: string) => {
    setBusy('리그의 과거를 만드는 중');
    const next = await build(s);
    building.current = null;
    show(next);
    setTab('standings');
    await saveNow(store, next);
    setBusy(null);
  };

  const importSave = async (file: File | undefined) => {
    if (!file) return;
    try {
      const save = parseSave(await readSaveFile(file));
      const state = save.snapshot?.state as LeagueState | undefined;
      if (!state?.teams) throw new SaveError('damaged', '진행 파일에 리그 상태가 없습니다.');
      building.current = null;
      setRecovering(false);
      show(state);
      setTab(state.user ? 'club' : 'standings');
      await saveNow(store!, state);
      setNotice(save.migratedFrom ? `이전 버전(시뮬레이션 ${save.migratedFrom})의 진행 파일을 ${RELEASE} 규칙으로 옮겨 불러왔습니다.` : '진행 파일을 불러왔습니다.');
    } catch (e) {
      setNotice(e instanceof SaveError ? e.message : '진행 파일을 읽지 못했습니다.');
    }
  };

  if (!league)
    return (
      <>
        <header class="masthead">
          <div>
            <h1>KBO 신구단</h1>
            <p class="muted">버전 {RELEASE}</p>
          </div>
          <div class="row-actions">
            {/* 1.4.1: a game kept as a file, or one of the autosave's backups, can be picked up from the start. */}
            <label class="file-button">
              진행 파일 불러오기
              <input type="file" accept="application/json,.json,.gz" onChange={(e) => importSave((e.currentTarget as HTMLInputElement).files?.[0])} />
            </label>
            <button type="button" aria-pressed={recovering} onClick={() => setRecovering((x) => !x)}>
              백업에서 되돌리기
            </button>
            <button type="button" onClick={() => setDisplayOpen(true)}>
              화면 설정
            </button>
          </div>
        </header>
        {displayOpen && <DisplaySettings onClose={() => setDisplayOpen(false)} />}
        {notice && <p class="notice">{notice}</p>}
        {recovering && <Recovery title="이전 진행으로 되돌리기" />}
        <NewGame seed={seed} busy={busy && `${busy}${progress ? ` · ${progress}` : ''}`} onFound={found} onSpectate={spectate} />
      </>
    );

  // 1.4.1: one change at a time, each on the newest league — a click during a long advance waits for it instead of
  // working on the league from before and overwriting what the advance did.
  const act = (action: Action, label: string, heavy: boolean) => {
    const step = async () => {
      const base = latest.current;
      if (!base) return;
      if (base.pending && !allowedWhileWaiting(action)) {
        setNotice('먼저 결정할 일을 끝내세요. 기다리는 동안에는 구단 운영(티켓·마케팅·구장)과 기사만 바꿀 수 있습니다.');
        return;
      }
      setBusy(label);
      setNotice('');
      try {
        const s = heavy ? await applyInWorker(base, action) : applyHere(base, action);
        latest.current = s;
        show(s);
        saveSoon(store, s);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
      }
      setBusy(null);
    };
    acting.current = acting.current.then(step, step);
    return acting.current;
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
    noteExport(league.seed);
  };

  const saveStory = (s: StorySettingsT) => {
    setStorySettings(s);
    saveSettings(s);
    setNotice('AI 기사 설정을 저장했습니다.');
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

  const postLive = league.phase === 'postseason' && !!league.bracket && !league.bracket.done;
  const controls = league.pending ? null : postLive ? (
    <>
      <button type="button" onClick={() => act({ kind: 'postseasonDay' }, '경기 중', false)}>
        다음 경기
      </button>
      <button type="button" onClick={() => act({ kind: 'postseasonRound' }, '포스트시즌 진행 중', false)}>
        이번 라운드 끝까지
      </button>
      <button type="button" onClick={() => act({ kind: 'postseason' }, '포스트시즌 진행 중', true)}>
        포스트시즌 끝까지
      </button>
    </>
  ) : league.phase === 'postseason' ? (
    <button type="button" onClick={() => act({ kind: 'nextSeason' }, '오프시즌 진행 중', true)}>
      다음 시즌으로
    </button>
  ) : regularOver(league) ? (
    <>
      <button type="button" onClick={() => act({ kind: 'postseasonStart' }, '대진 추첨 중', false)}>
        포스트시즌 시작
      </button>
      <button type="button" onClick={() => act({ kind: 'postseason' }, '포스트시즌 진행 중', true)}>
        포스트시즌 끝까지
      </button>
    </>
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
  // The club colour as the accent, made readable on this page (V0.15).
  const accent = userTeam ? readableAccent(userTeam.color, dark) : null;
  const unseenAll = league.user ? unseenAlerts(league) : [];
  const unseen = poppingAlerts(unseenAll, articles, kindsOff);

  return (
    <div class="app" style={accent ? ({ '--accent': accent.accent, '--accent-ink': accent.ink } as Record<string, string>) : undefined}>
      <a class="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      {/* V0.7.7: on a wide screen the club, the screens and the saves stay in a sidebar and only the page
          scrolls; on a phone everything flows top to bottom as before. */}
      <aside class="sidebar">
        <header class="masthead">
          <div>
            <h1>{userTeam ? userTeam.name : 'KBO 신구단'}</h1>
            <p class="muted">
              {userTeam ? `단장 · 버전 ${RELEASE}` : `관전 모드 · 버전 ${RELEASE}`} · 시드 {league.seed}
            </p>
          </div>
          <div class="row-actions">
            {tutorialPaused(league) && (
              <button type="button" onClick={() => act({ kind: 'tutorial', on: true }, '튜토리얼', false)}>
                튜토리얼 다시 켜기
              </button>
            )}
            {unseen.length > 0 && !popups && (
              <button type="button" onClick={() => setAlertsOpen(true)}>
                새 알림 {unseen.length}
              </button>
            )}
            <button type="button" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}>
              설정
            </button>
          </div>
        </header>
        {league.user && <ClubSummary league={league} onTab={setTab} />}
        <nav class="tabs" aria-label="화면">
          {TABS.filter((t) => (!t.userOnly || league.user) && (!t.waiting || league.pending)).map((t) => (
            <button key={t.id} type="button" class={t.waiting ? 'tab-waiting' : undefined} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <footer class="footer">
          <div class="save-actions">
            <button type="button" onClick={exportSave} disabled={!!busy}>
              진행 파일 저장
            </button>
            <label class="file-button">
              불러오기
              <input type="file" accept="application/json,.json,.gz" onChange={(e) => importSave((e.currentTarget as HTMLInputElement).files?.[0])} />
            </label>
            <span class="muted">{store.kind === 'indexedDB' ? '자동 저장됨' : '이 브라우저에서는 자동 저장을 쓸 수 없습니다. 진행 파일로 저장하세요.'}</span>
          </div>
          <p class="muted small">{DISCLAIMER}</p>
        </footer>
      </aside>
      {storyOpen && (
        <StorySettings
          settings={storySettings}
          usage={usage.current}
          pausedUntil={storySettings.auto ? autoPause.current : 0}
          onClose={() => setStoryOpen(false)}
          onSave={(s) => {
            saveStory(s);
            setStoryOpen(false);
          }}
        />
      )}
      {(popups || alertsOpen) && !busy && unseen.length > 0 && (
        <AlertPopup
          key={unseen[0]!.id}
          alerts={unseen}
          onDone={(ids) => {
            setAlertsOpen(false);
            // Articles left out of the pop-ups count as read with the rest (they stay in the list).
            void act({ kind: 'alertsSeen', ids: [...ids, ...unseenAll.filter((a) => !unseen.includes(a)).map((a) => a.id)] }, '알림 확인', false);
          }}
        />
      )}
      <div class="progress-bar">
        <p class="status" aria-live="polite">
          {busy ?? statusLine(league)}
        </p>
        <fieldset class="controls" disabled={!!busy}>
          {controls}
        </fieldset>
      </div>
      <main class="page" id="main" tabIndex={-1} data-version={version}>
        {notice && (
          <p class="notice" role="status">
            {notice}
          </p>
        )}
        <Guard resetKey={`${tab}|${clubView}`} onBack={() => setTab(tab === 'standings' ? (league.user ? 'club' : 'leaders') : 'standings')}>
        <TutorialCard league={league} tab={tab} view={tab === 'club' ? clubView : undefined} onAct={(a) => act(a, '튜토리얼', false)} />
        {tab === 'decision' && league.pending && <Decision league={league} onPlayer={setPlayerId} onSubmit={(input) => act({ kind: 'decide', input }, '진행 중', false)} />}
        {tab === 'club' && league.user && <MyClub league={league} onPlayer={setPlayerId} onAct={(a) => act(a, '처리 중', false)} onView={setClubView} story={{ onRewrite: writeStory, onRevert: revertStory, busyId: storyBusy }} />}
        {tab === 'market' && league.user && <Market league={league} onPlayer={setPlayerId} onAct={(a) => act(a, '처리 중', false)} />}
        {tab === 'games' && <Games league={league} onOpen={setBoxId} />}
        {tab === 'standings' && <Standings league={league} onTeam={openTeam} onBox={setBoxId} onAct={league.user ? (a) => act(a, '처리 중', false) : undefined} />}
        {tab === 'leaders' && <Leaders league={league} onPlayer={setPlayerId} onBox={setBoxId} onAct={league.user ? (a) => act(a, '처리 중', false) : undefined} />}
        {tab === 'team' && <TeamRoster league={league} teamId={teamId} onTeam={openTeam} onPlayer={setPlayerId} />}
        {tab === 'history' && <History league={league} onPlayer={setPlayerId} />}
        {tab === 'settings' && (
          <Settings
            league={league}
            store={store}
            busy={!!busy}
            story={{ settings: storySettings, usage: usage.current, pausedUntil: storySettings.auto ? autoPause.current : 0, onSave: saveStory }}
            onAct={(a) => act(a, '처리 중', false)}
            onExport={exportSave}
            onImport={importSave}
            onNewGame={newGame}
          />
        )}
        {tab === 'help' && <Manual />}
        {tab === 'draft' && (
          <div class="layout">
            <DraftBoard draftYear={draftYear} players={draftPool} ageOf={prospectAge} selectedId={prospect?.id ?? null} onSelect={selectProspect} ourView={league?.user ? (p) => scoutView(league!, p) : undefined} />
            <PlayerProfile
              player={prospect && publicView(prospect)}
              age={prospect && prospectAge(prospect)}
              combine={prospect && league && combineHeld(league, draftYear) && attends(league.seed, draftYear, prospect) ? combineLines(league.seed, draftYear, prospect) : null}
              combineNote={league && !combineHeld(league, draftYear) ? `${draftYear}년 8월 25일 컴바인에서 측정합니다 (공개 순위 60위 안 초청).` : '컴바인에 나오지 않았습니다.'}
              report={prospect && league?.user ? traitReport(league, prospect) : null}
              workout={
                prospect && league?.user
                  ? {
                      done: workoutsOf(league, draftYear).includes(prospect.id),
                      blocked: checkWorkout(league, draftYear, prospect.id),
                      cost: money(COMBINE.workoutCost),
                      onClick: () => act({ kind: 'workout', draftYear, id: prospect.id, name: prospect.name }, '처리 중', false),
                    }
                  : undefined
              }
            />
          </div>
        )}
        </Guard>
      </main>
      {boxId && league && (
        <BoxScore
          league={league}
          id={boxId}
          onClose={() => setBoxId(null)}
          onPlayer={(pid) => {
            setBoxId(null);
            setPlayerId(pid);
          }}
          onAct={(a) => act(a, '기사 쓰는 중', false)}
          story={{ onRewrite: writeStory, onRevert: revertStory, busyId: storyBusy }}
        />
      )}
      {playerId && league && (
        <PlayerPanel
          league={league}
          id={playerId}
          onClose={() => setPlayerId(null)}
          onInterview={(pid) => act({ kind: 'interview', id: pid }, '인터뷰 중', false)}
          onAct={(a) => act(a, '처리 중', false)}
        />
      )}
    </div>
  );
}
