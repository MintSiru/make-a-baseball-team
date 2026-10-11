import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
import { scenarioDef } from '../league/scenarios';
import { setEra, startYear } from '../league/era';
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
import { LanguagePicker } from './LanguagePicker';
import { registerKept, registerNames } from '../i18n/runtime';
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
import { autoDecision, checkDecision } from '../league/expansion';
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
  { id: 'decision', label: __i18n_k("ui.app.tABS.label.2d179fd7"), waiting: true },
  { id: 'club', label: __i18n_k("ui.app.tABS.label.8cc09c32"), userOnly: true },
  { id: 'market', label: __i18n_k("ui.app.tABS.label.e11828a8"), userOnly: true },
  { id: 'games', label: __i18n_k("ui.app.tABS.label.e0cee61a") },
  { id: 'standings', label: __i18n_k("ui.app.tABS.label.d15876f1") },
  { id: 'leaders', label: __i18n_k("ui.app.tABS.label.d84b6f4b") },
  { id: 'team', label: __i18n_k("ui.app.tABS.label.58756112") },
  { id: 'history', label: __i18n_k("ui.app.tABS.label.1ab3847c") },
  { id: 'draft', label: __i18n_k("ui.app.tABS.label.0db7daf2") },
  { id: 'settings', label: __i18n_k("ui.app.tABS.label.c14a567e") },
  { id: 'help', label: __i18n_k("ui.app.tABS.label.e2654ac5") },
];

const AUTO_KINDS: NewsItem['kind'][] = ['season', 'award', 'month', 'interview'];
/** Automatic mode after a failure it can wait out: seconds to pause (at least; longer if the server asks),
    and how many times one article is tried. A spent quota or a bad key turns automatic mode off. */
const AUTO_PAUSE: Partial<Record<StoryError, number>> = { rate: 60, busy: 180, network: 120 };
const AUTO_TRIES = 3;
/** Seconds between automatic articles, so a backlog does not go out as a burst. */
const AUTO_GAP = 5;
const seconds = (sec: number) => (sec < 60 ? __i18n_k("ui.app.seconds.c4a2109c", { sec: sec }) : __i18n_k("ui.app.seconds.32ba7f5b", { value: Math.ceil(sec / 60) }));

const PHASE: Record<LeagueState['phase'], CalendarPhase> = { regular: 'regularSeason', postseason: 'postseason', offseason: 'offseason' };
const snapshotSave = (s: LeagueState) => makeSave(s.seed, [], { at: { year: s.year, phase: PHASE[s.phase] }, state: s });

function statusLine(s: LeagueState) {
  if (s.pending) return __i18n_k("ui.app.statusLine.93c4cfd1", { value: s.offseason ? __i18n_k("ui.app.statusLine.dfc7fe9a", { year: s.offseason.year }) : `${s.year}` });
  if (s.phase === 'postseason') {
    const live = postseasonStatus(s);
    if (live) return live;
    const ks = s.postseason.find((x) => x.round === 'ks');
    return __i18n_k("ui.app.statusLine.86001336", { year: s.year, value: ks ? shortName(s, ks.winner) : '-' });
  }
  if (regularOver(s)) return __i18n_k("ui.app.statusLine.18db41b9", { year: s.year });
  const date = nextDate(s);
  return __i18n_k("ui.app.statusLine.dfb24da9", { year: s.year, value: date ? __i18n_k("ui.app.statusLine.a629d4ea", { number: Number(date.slice(5, 7)), number2: Number(date.slice(8)) }) : '-' });
}

export function App() {
  const [store, setStore] = useState<SaveStore | null>(null);
  const [league, setLeague] = useState<LeagueState | null>(null);
  // en/ja: who the people in this game are (names read from the tables or romanized), and our club's typed names.
  useEffect(() => {
    if (!league) return;
    registerNames(Object.values(league.players).map((p) => p.name));
    for (const c of Object.values(league.clubs ?? {})) registerNames(Object.values(c.staff ?? {}).map((m) => m?.name ?? ''));
    const me = league.user && league.teams.find((t) => t.id === league.user!.teamId);
    if (me) registerKept([me.name, me.short, me.parent?.name ?? ""]);
  }, [league]);
  // The calendar of the league on the page (1.6.0: a game may start before 2026).
  setEra(league);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  /** The founding screen shows the recovery choices (an autosave that would not open, or asked for). */
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('club');
  const [clubView, setClubView] = useState('overview');
  // 1.5.0: where the briefing sent the player in the market (n counts the visits so each opens fresh).
  const [marketIntent, setMarketIntent] = useState<{ view: 'search' | 'trade' | 'release' | 'foreign'; spot?: string; n: number }>({ view: 'trade', n: 0 });
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
      setNotice(__i18n_k("ui.app.app.persist.32df8d08"));
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

  // 1.6.0: a league for 「백 투 더 패스트」 starts its history ten years earlier (a different build, kept apart).
  const build = (s: string, era = 0) => {
    const key = era ? `${s}|era${era}` : s;
    if (building.current?.seed !== key) building.current = { seed: key, promise: createInWorker(s, (year) => setProgress(__i18n_k("ui.app.build.promise.de766445", { year: year })), era) };
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
            setNotice(__i18n_k("ui.app.app.e6bc6a6d", { migratedFrom: saved.migratedFrom, rELEASE: RELEASE }));
          }
        }
      } catch (e) {
        // 1.4.1: a damaged autosave is set aside (never copied over a good backup) and the recovery choices come up.
        await setAsideDamaged(st).catch(() => undefined);
        setNotice(__i18n_k("ui.app.app.e6f5b9c2", { value: e instanceof Error ? e.message : String(e) }));
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
    if (!league?.user || reminded.current || store?.kind !== 'indexedDB' || league.year - startYear() < 2) return;
    const at = lastExport(league.seed);
    const days = at ? Math.floor((Date.now() - Date.parse(at)) / 86_400_000) : null;
    if (days !== null && days < 14) return;
    reminded.current = true;
    setNotice(
      __i18n_k("ui.app.app.25ab35e0", { value: days === null ? __i18n_k("ui.app.app.1ad2d9fc") : __i18n_k("ui.app.app.32d4944c", { days: days }) }),
    );
  }, [league?.seed, league?.year, store]);

  // Start building a league as soon as the founding form is on screen.
  useEffect(() => {
    if (!loading && !league) void build(seed).catch(() => undefined);
  }, [loading, league]);

  // The draft class of this September (it fills next season's rosters): the 2027 draft is Draft Room's own pool.
  const draftYear = league ? (league.phase === 'offseason' && league.offseason ? league.offseason.year : league.year) : startYear();
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
  useEffect(() => registerNames(draftPool.map((p) => p.name)), [draftPool]);
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

  // 1.5.0: with the decisions before the debut handed to the scouts, each one goes through on its recommendation.
  // Stops (and leaves the screen to the player) when there is none, when it does not check out, or after many in a
  // row on the same step, so nothing can loop.
  const autoRun = useRef<{ key: string; n: number }>({ key: '', n: 0 });
  const actRef = useRef<((action: Action, label: string, heavy: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    const s = league;
    const u = s?.user;
    if (!s?.pending || !u?.settings.autoPrep || busy || loading || !actRef.current) return;
    if ((s.offseason?.year ?? s.year) >= u.firstTeamYear) return;
    const key = `${s.year}|${s.offseason?.step ?? ''}|${s.pending.kind}`;
    const run = autoRun.current;
    run.n = run.key === key ? run.n + 1 : 1;
    run.key = key;
    if (run.n > 40) return;
    const input = autoDecision(s);
    if (!input || checkDecision(s, input)) return;
    void actRef.current({ kind: 'decide', input }, __i18n_k("ui.app.app.93376cf8"), false);
  }, [version, busy, loading]);

  // A new decision brings its screen forward (the other tabs stay open beside it); once the winter is
  // done, its tab goes away.
  const waitingKey = league?.pending ? `${league.year}|${league.offseason?.step ?? ''}|${league.pending.kind}` : null;
  useEffect(() => {
    if (waitingKey) setTab('decision');
    else setTab((t) => (t === 'decision' ? (latest.current?.user ? 'club' : 'standings') : t));
  }, [waitingKey]);

  if (loading || !store) return <main class="loading">{__i18n_t("ui.app.app.e090c88e")}</main>;

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
        note = __i18n_k("ui.app.app.writeStory.e60f20b6", { seconds: seconds(sec) });
        const tries = (autoTries.current.get(item.id) ?? 0) + 1;
        autoTries.current.set(item.id, tries);
        if (auto && tries < AUTO_TRIES) autoTried.current.delete(item.id);
      } else if (storySettings.auto && (out.error === 'quota' || out.error === 'auth')) {
        setStorySettings((s) => {
          const off = { ...s, auto: false };
          saveSettings(off);
          return off;
        });
        note = __i18n_k("ui.app.app.writeStory.7de49f3c");
      }
      setNotice(__i18n_k("ui.app.app.writeStory.ec1540a5", { message: out.message, note: note }));
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
    setBusy(__i18n_k("ui.app.app.found.2015bb35"));
    const era = scenarioDef(settings.scenario)?.era ?? 0;
    let base = await build(s, era);
    base = await applyInWorker(base, { kind: 'toFounding' });
    let next = applyHere(base, { kind: 'found', settings });
    // 살려야 한다: the runaway AI's five years, off the page.
    if (settings.scenario === 'rescue') {
      setBusy(__i18n_k("ui.app.app.found.8e215bcd"));
      next = await applyInWorker(next, { kind: 'rogue' });
    }
    building.current = null;
    show(next);
    setTab('club');
    await saveNow(store, next);
    setBusy(null);
  };

  const spectate = async (s: string) => {
    setBusy(__i18n_k("ui.app.app.spectate.2015bb35"));
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
      if (!state?.teams) throw new SaveError('damaged', __i18n_k("ui.app.app.importSave.8f84f785"));
      building.current = null;
      setRecovering(false);
      show(state);
      setTab(state.user ? 'club' : 'standings');
      await saveNow(store!, state);
      setNotice(save.migratedFrom ? __i18n_k("ui.app.app.importSave.e3c248bc", { migratedFrom: save.migratedFrom, rELEASE: RELEASE }) : __i18n_k("ui.app.app.importSave.e3648aa1"));
    } catch (e) {
      setNotice(e instanceof SaveError ? e.message : __i18n_k("ui.app.app.importSave.e2604b5b"));
    }
  };

  if (!league)
    return (
      <>
        <header class="masthead">
          <div>
            <h1>{__i18n_t("ui.app.app.7fd36273")}</h1>
            <p class="muted">{__i18n_t("ui.app.app.ec12bca1", { rELEASE: RELEASE })}</p>
          </div>
          <div class="row-actions">
            {/* 1.4.1: a game kept as a file, or one of the autosave's backups, can be picked up from the start. */}
            <label class="file-button">
              진행 파일 불러오기
              <input type="file" accept="application/json,.json,.gz" onChange={(e) => importSave((e.currentTarget as HTMLInputElement).files?.[0])} />
            </label>
            <button type="button" aria-pressed={recovering} onClick={() => setRecovering((x) => !x)}>{__i18n_t("ui.app.app.53ba8c13")}</button>
            <button type="button" onClick={() => setDisplayOpen(true)}>{__i18n_t("ui.app.app.b1c35543")}</button>
            <LanguagePicker />
          </div>
        </header>
        {__i18n_display(displayOpen && <DisplaySettings onClose={() => setDisplayOpen(false)} />)}
        {__i18n_display(notice && <p class="notice">{__i18n_display(notice)}</p>)}
        {__i18n_display(recovering && <Recovery title={__i18n_t("ui.app.app.c817428e")} />)}
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
        setNotice(__i18n_k("ui.app.act.step.d4504a6a"));
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
  actRef.current = act;

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
    setNotice(__i18n_k("ui.app.app.saveStory.cc20ba25"));
  };

  const newGame = () => {
    if (!window.confirm(__i18n_k("ui.app.app.newGame.869a8dfd"))) return;
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
      <button type="button" onClick={() => act({ kind: 'postseasonDay' }, __i18n_k("ui.app.app.controls.e39c3d6f"), false)}>{__i18n_t("ui.app.app.controls.3b6ea03a")}</button>
      <button type="button" onClick={() => act({ kind: 'postseasonRound' }, __i18n_k("ui.app.app.controls.9edd7286"), false)}>{__i18n_t("ui.app.app.controls.2878bba4")}</button>
      <button type="button" onClick={() => act({ kind: 'postseason' }, __i18n_k("ui.app.app.controls.9edd7286"), true)}>{__i18n_t("ui.app.app.controls.8d2f8637")}</button>
    </>
  ) : league.phase === 'postseason' ? (
    <button type="button" onClick={() => act({ kind: 'nextSeason' }, __i18n_k("ui.app.app.controls.caf40e73"), true)}>{__i18n_t("ui.app.app.controls.0f1609e9")}</button>
  ) : regularOver(league) ? (
    <>
      <button type="button" onClick={() => act({ kind: 'postseasonStart' }, __i18n_k("ui.app.app.controls.55dbee7a"), false)}>{__i18n_t("ui.app.app.controls.0af8f4bd")}</button>
      <button type="button" onClick={() => act({ kind: 'postseason' }, __i18n_k("ui.app.app.controls.9edd7286"), true)}>{__i18n_t("ui.app.app.controls.8d2f8637")}</button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => act({ kind: 'days', days: 1 }, __i18n_k("ui.app.app.controls.e39c3d6f"), false)}>{__i18n_t("ui.app.app.controls.c3537d9a")}</button>
      <button type="button" onClick={() => act({ kind: 'days', days: 6, stops: true }, __i18n_k("ui.app.app.controls.e39c3d6f"), false)}>{__i18n_t("ui.app.app.controls.3d84dffe")}</button>
      <button type="button" onClick={() => act({ kind: 'days', days: 26, stops: true }, __i18n_k("ui.app.app.controls.3b268e0d"), true)}>{__i18n_t("ui.app.app.controls.f425e3ef")}</button>
      <button type="button" onClick={() => act({ kind: 'regularEnd', stops: true }, __i18n_k("ui.app.app.controls.8373c66d"), true)}>{__i18n_t("ui.app.app.controls.1e9ed42f")}</button>
    </>
  );

  const userTeam = league.user ? league.teams.find((t) => t.id === league.user!.teamId) : null;
  // The club colour as the accent, made readable on this page (V0.15).
  const accent = userTeam ? readableAccent(userTeam.color, dark) : null;
  const unseenAll = league.user ? unseenAlerts(league) : [];
  const unseen = poppingAlerts(unseenAll, articles, kindsOff);

  return (
    <div class="app" style={accent ? ({ '--accent': accent.accent, '--accent-ink': accent.ink } as Record<string, string>) : undefined}>
      <a class="skip-link" href="#main">{__i18n_t("ui.app.app.f509a430")}</a>
      {/* V0.7.7: on a wide screen the club, the screens and the saves stay in a sidebar and only the page
          scrolls; on a phone everything flows top to bottom as before. */}
      <aside class="sidebar">
        <header class="masthead">
          <div>
            <h1>{__i18n_display(userTeam ? userTeam.name : __i18n_k("ui.app.app.7fd36273"))}</h1>
            <p class="muted">{__i18n_t("ui.app.app.9cf15945", { value: userTeam ? __i18n_k("ui.app.app.41a35f43", { rELEASE: RELEASE }) : __i18n_k("ui.app.app.b03985f3", { rELEASE: RELEASE }), seed: league.seed })}</p>
          </div>
          <div class="row-actions">
            {__i18n_display(tutorialPaused(league) && (
              <button type="button" onClick={() => act({ kind: 'tutorial', on: true }, __i18n_k("ui.app.app.aca4b433"), false)}>{__i18n_t("ui.app.app.f626ade9")}</button>
            ))}
            {__i18n_display(unseen.length > 0 && !popups && (
              <button type="button" onClick={() => setAlertsOpen(true)}>{__i18n_t("ui.app.app.8b7e42a7", { length: unseen.length })}</button>
            ))}
            <button type="button" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}>{__i18n_t("ui.app.app.c14a567e")}</button>
          </div>
        </header>
        {__i18n_display(league.user && <ClubSummary league={league} onTab={setTab} />)}
        <nav class="tabs" aria-label={__i18n_t("ui.app.app.43c786f1")}>
          {__i18n_display(TABS.filter((t) => (!t.userOnly || league.user) && (!t.waiting || league.pending)).map((t) => (
            <button key={t.id} type="button" class={t.waiting ? 'tab-waiting' : undefined} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {__i18n_display(t.label)}
            </button>
          )))}
        </nav>
        <footer class="footer">
          <div class="save-actions">
            <button type="button" onClick={exportSave} disabled={!!busy}>{__i18n_t("ui.app.app.2ba578d5")}</button>
            <label class="file-button">
              불러오기
              <input type="file" accept="application/json,.json,.gz" onChange={(e) => importSave((e.currentTarget as HTMLInputElement).files?.[0])} />
            </label>
            <span class="muted">{__i18n_display(store.kind === 'indexedDB' ? __i18n_k("ui.app.app.cdf1c4df") : __i18n_k("ui.app.app.9fa95b75"))}</span>
          </div>
          <p class="muted small">{__i18n_display(DISCLAIMER)}</p>
        </footer>
      </aside>
      {__i18n_display(storyOpen && (
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
      ))}
      {__i18n_display((popups || alertsOpen) && !busy && unseen.length > 0 && (
        <AlertPopup
          key={unseen[0]!.id}
          alerts={unseen}
          onDone={(ids) => {
            setAlertsOpen(false);
            // Articles left out of the pop-ups count as read with the rest (they stay in the list).
            void act({ kind: 'alertsSeen', ids: [...ids, ...unseenAll.filter((a) => !unseen.includes(a)).map((a) => a.id)] }, __i18n_k("ui.app.app.f0dd4af2"), false);
          }}
        />
      ))}
      <div class="progress-bar">
        <p class="status" aria-live="polite">
          {__i18n_display(busy ?? statusLine(league))}
        </p>
        <fieldset class="controls" disabled={!!busy}>
          {__i18n_display(controls)}
        </fieldset>
      </div>
      <main class="page" id="main" tabIndex={-1} data-version={version}>
        {__i18n_display(notice && (
          <p class="notice" role="status">
            {__i18n_display(notice)}
          </p>
        ))}
        <Guard resetKey={`${tab}|${clubView}`} onBack={() => setTab(tab === 'standings' ? (league.user ? 'club' : 'leaders') : 'standings')}>
        <TutorialCard league={league} tab={tab} view={tab === 'club' ? clubView : undefined} onAct={(a) => act(a, __i18n_k("ui.app.app.aca4b433"), false)} />
        {__i18n_display(tab === 'decision' && league.pending && <Decision league={league} onPlayer={setPlayerId} onSubmit={(input) => act({ kind: 'decide', input }, __i18n_k("ui.app.app.7890cafc"), false)} />)}
        {__i18n_display(tab === 'club' && league.user && (
          <MyClub
            league={league}
            onPlayer={setPlayerId}
            onAct={(a) => act(a, __i18n_k("ui.app.app.bd04d7e4"), false)}
            onView={setClubView}
            onGo={(g) => {
              if (g.tab !== 'market') return;
              setMarketIntent((m) => ({ view: g.view, ...(g.spot ? { spot: g.spot } : {}), n: m.n + 1 }));
              setTab('market');
            }}
            story={{ onRewrite: writeStory, onRevert: revertStory, busyId: storyBusy }}
          />
        ))}
        {__i18n_display(tab === 'market' && league.user && (
          <Market key={marketIntent.n} league={league} intent={marketIntent.n ? marketIntent : undefined} onPlayer={setPlayerId} onAct={(a) => act(a, __i18n_k("ui.app.app.bd04d7e4"), false)} />
        ))}
        {__i18n_display(tab === 'games' && <Games league={league} onOpen={setBoxId} />)}
        {__i18n_display(tab === 'standings' && <Standings league={league} onTeam={openTeam} onBox={setBoxId} onAct={league.user ? (a) => act(a, __i18n_k("ui.app.app.bd04d7e4"), false) : undefined} />)}
        {__i18n_display(tab === 'leaders' && <Leaders league={league} onPlayer={setPlayerId} onBox={setBoxId} onAct={league.user ? (a) => act(a, __i18n_k("ui.app.app.bd04d7e4"), false) : undefined} />)}
        {__i18n_display(tab === 'team' && <TeamRoster league={league} teamId={teamId} onTeam={openTeam} onPlayer={setPlayerId} />)}
        {__i18n_display(tab === 'history' && <History league={league} onPlayer={setPlayerId} />)}
        {__i18n_display(tab === 'settings' && (
          <Settings
            league={league}
            store={store}
            busy={!!busy}
            story={{ settings: storySettings, usage: usage.current, pausedUntil: storySettings.auto ? autoPause.current : 0, onSave: saveStory }}
            onAct={(a) => act(a, __i18n_k("ui.app.app.bd04d7e4"), false)}
            onExport={exportSave}
            onImport={importSave}
            onNewGame={newGame}
          />
        ))}
        {__i18n_display(tab === 'help' && <Manual />)}
        {__i18n_display(tab === 'draft' && (
          <div class="layout">
            <DraftBoard draftYear={draftYear} players={draftPool} ageOf={prospectAge} selectedId={prospect?.id ?? null} onSelect={selectProspect} ourView={league?.user ? (p) => scoutView(league!, p) : undefined} />
            <PlayerProfile
              player={prospect && publicView(prospect)}
              age={prospect && prospectAge(prospect)}
              combine={prospect && league && combineHeld(league, draftYear) && attends(league.seed, draftYear, prospect) ? combineLines(league.seed, draftYear, prospect) : null}
              combineNote={league && !combineHeld(league, draftYear) ? __i18n_k("ui.app.app.dabfaec3", { draftYear: draftYear }) : __i18n_k("ui.app.app.5e6c4cae")}
              report={prospect && league?.user ? traitReport(league, prospect) : null}
              workout={
                prospect && league?.user
                  ? {
                      done: workoutsOf(league, draftYear).includes(prospect.id),
                      blocked: checkWorkout(league, draftYear, prospect.id),
                      cost: money(COMBINE.workoutCost),
                      onClick: () => act({ kind: 'workout', draftYear, id: prospect.id, name: prospect.name }, __i18n_k("ui.app.app.onClick.bd04d7e4"), false),
                    }
                  : undefined
              }
            />
          </div>
        ))}
        </Guard>
      </main>
      {__i18n_display(boxId && league && (
        <BoxScore
          league={league}
          id={boxId}
          onClose={() => setBoxId(null)}
          onPlayer={(pid) => {
            setBoxId(null);
            setPlayerId(pid);
          }}
          onAct={(a) => act(a, __i18n_k("ui.app.app.8dd94575"), false)}
          story={{ onRewrite: writeStory, onRevert: revertStory, busyId: storyBusy }}
        />
      ))}
      {__i18n_display(playerId && league && (
        <PlayerPanel
          league={league}
          id={playerId}
          onClose={() => setPlayerId(null)}
          onInterview={(pid) => act({ kind: 'interview', id: pid }, __i18n_k("ui.app.app.7296f88b"), false)}
          onAct={(a) => act(a, __i18n_k("ui.app.app.bd04d7e4"), false)}
        />
      ))}
    </div>
  );
}
