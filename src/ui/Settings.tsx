import { display as __i18n_display, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* The settings tab (V0.13): everything the player sets in one place — display, the game, the clubs' names,
   saves, AI articles and what the game is. Display and AI settings stay in this browser; the game and the
   clubs' names travel with the save. */
import { STOP_KINDS, STOP_LABEL, stopsOf } from '../league/stops';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { DISCLAIMER, ISSUES_URL, OPEN_SOURCE, RULES_URL } from '../core/about';
import { RELEASE, SIM_VERSION } from '../core/version';
import { PARENT_COMPANY_TYPES } from '../club/types';
import { FICTIONAL_LABELS, labelOf, labelProblems, realLabels, CLUB_NAME, CLUB_SHORT, COMPANY_NAME, BALLPARK_NAME, type ClubLabel } from '../league/clubs';
import type { Action } from '../league/actions';
import type { LeagueState } from '../league/state';
import type { SaveStore } from '../save/store';
import type { StorySettings as StorySettingsT } from '../story/settings';
import { ro } from '../league/josa';
import { DisplayOptions } from './DisplaySettings';
import { StoryOptions } from './StorySettings';

const SECTIONS: [string, string][] = [
  ['settings-display', __i18n_k("ui.settings.sECTIONS.43c786f1")],
  ['settings-game', __i18n_k("ui.settings.sECTIONS.d7fa83fc")],
  ['settings-clubs', __i18n_k("ui.settings.sECTIONS.70b0c130")],
  ['settings-save', __i18n_k("ui.settings.sECTIONS.1f1712ac")],
  ['settings-story', __i18n_k("ui.settings.sECTIONS.fdc0ffd0")],
  ['settings-about', __i18n_k("ui.settings.sECTIONS.032e3f1f")],
];

export const DIFFICULTY_LABEL = { easy: __i18n_k("ui.settings.dIFFICULTY_LABEL.easy.aeb16cc3"), normal: '보통', hard: __i18n_k("ui.settings.dIFFICULTY_LABEL.hard.485e4f6a") } as const;
export const DIFFICULTY_NOTE = {
  easy: __i18n_k("ui.settings.dIFFICULTY_NOTE.easy.a62126de"),
  normal: __i18n_k("ui.settings.dIFFICULTY_NOTE.normal.61502180"),
  hard: __i18n_k("ui.settings.dIFFICULTY_NOTE.hard.ade5d68c"),
} as const;

/** When this browser last saved a file of this game (kept per browser, for the reminder). */
const EXPORT_KEY = 'kbo-last-export';
export function noteExport(seed: string) {
  try {
    localStorage.setItem(EXPORT_KEY, JSON.stringify({ seed, at: new Date().toISOString() }));
  } catch {
    // Private windows may refuse storage; the reminder just will not know.
  }
}
export function lastExport(seed: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(EXPORT_KEY) ?? 'null') as { seed: string; at: string } | null;
    return v && v.seed === seed ? v.at : null;
  } catch {
    return null;
  }
}

interface Props {
  league: LeagueState;
  store: SaveStore;
  busy: boolean;
  story: { settings: StorySettingsT; usage: { input: number; output: number; articles: number }; pausedUntil: number; onSave: (s: StorySettingsT) => void };
  onAct: (a: Action) => void;
  onExport: () => void;
  onImport: (file: File | undefined) => void;
  onNewGame: () => void;
}

export function Settings({ league, store, busy, story, onAct, onExport, onImport, onNewGame }: Props) {
  // 1.0.1: on a phone the page shows one subject at a time (the bar picks it); a wide screen shows them all and
  // the bar jumps to one.
  const [open, setOpen] = useState(SECTIONS[0]![0]);
  const pick = (id: string) => {
    setOpen(id);
    if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 761px)').matches) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  };
  const block = (id: string) => `settings-block${open === id ? ' on' : ''}`;
  return (
    <section class="settings-page" aria-labelledby="settings-title">
      <div class="page-head">
        <div>
          <h2 id="settings-title">{__i18n_t("ui.settings.settings.c14a567e")}</h2>
          <p class="muted">{__i18n_t("ui.settings.settings.fefd6b03")}</p>
        </div>
      </div>
      <div class="segmented settings-jump" role="group" aria-label={__i18n_t("ui.settings.settings.170b2521")}>
        {__i18n_display(SECTIONS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={open === id} onClick={() => pick(id)}>
            {__i18n_display(label)}
          </button>
        )))}
      </div>

      <section id="settings-display" class={block('settings-display')}>
        <h2>{__i18n_t("ui.settings.settings.43c786f1")}</h2>
        <DisplayOptions />
      </section>

      <section id="settings-game" class={block('settings-game')}>
        <h2>{__i18n_t("ui.settings.settings.d7fa83fc")}</h2>
        <GameOptions league={league} busy={busy} onAct={onAct} onNewGame={onNewGame} />
      </section>

      <section id="settings-clubs" class={block('settings-clubs')}>
        <h2>{__i18n_t("ui.settings.settings.70b0c130")}</h2>
        <ClubNames league={league} busy={busy} onAct={onAct} />
      </section>

      <section id="settings-save" class={block('settings-save')}>
        <h2>{__i18n_t("ui.settings.settings.1f1712ac")}</h2>
        <SaveOptions league={league} store={store} busy={busy} onExport={onExport} onImport={onImport} />
      </section>

      <section id="settings-story" class={block('settings-story')}>
        <h2>{__i18n_t("ui.settings.settings.fdc0ffd0")}</h2>
        <StoryOptions settings={story.settings} usage={story.usage} pausedUntil={story.pausedUntil} onSave={story.onSave} />
      </section>

      <section id="settings-about" class={block('settings-about')}>
        <h2>{__i18n_t("ui.settings.settings.032e3f1f")}</h2>
        <dl class="facts">
          <div>
            <dt>{__i18n_t("ui.settings.settings.593f8a81")}</dt>
            <dd>{__i18n_display(RELEASE)}</dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.settings.settings.6349265b")}</dt>
            <dd>{__i18n_display(SIM_VERSION)}</dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.settings.settings.94277611")}</dt>
            <dd>{__i18n_display(league.seed)}</dd>
          </div>
        </dl>
        <p>{__i18n_display(DISCLAIMER)}</p>
        <p class="muted small">{__i18n_rich("ui.settings.settings.96129e30", { value: ' ', value2: <a href={RULES_URL} target="_blank" rel="noopener noreferrer">{__i18n_t("ui.settings.settings.571bd1fa")}</a>, value3: ' ', value4: <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            GitHub Issues
          </a> })}</p>
        <h3>{__i18n_t("ui.settings.settings.470bbace")}</h3>
        <ul class="plain">
          {__i18n_display(OPEN_SOURCE.map((x) => (
            <li key={x.name}>
              <a href={x.url} target="_blank" rel="noopener noreferrer">
                {__i18n_display(x.name)}
              </a>{__i18n_display(' ')}
              <span class="muted small">({__i18n_display(x.license)})</span>
            </li>
          )))}
        </ul>
      </section>
    </section>
  );
}

function GameOptions({ league, busy, onAct, onNewGame }: { league: LeagueState; busy: boolean; onAct: (a: Action) => void; onNewGame: () => void }) {
  const u = league.user;
  return (
    <>
      {__i18n_display(u && (
        <>
          <h3>{__i18n_t("ui.settings.gameOptions.e8ee93fa")}</h3>
          <div class="segmented" role="group" aria-label={__i18n_t("ui.settings.gameOptions.e8ee93fa")}>
            {__i18n_display((['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={u.settings.difficulty === d}
                disabled={busy}
                onClick={() => d !== u.settings.difficulty && window.confirm(__i18n_k("ui.settings.gameOptions.c4da7ce7", { value: ro(DIFFICULTY_LABEL[d]) })) && onAct({ kind: 'difficulty', level: d })}
              >
                {__i18n_display(DIFFICULTY_LABEL[d])}
              </button>
            )))}
          </div>
          <p class="muted small">{__i18n_t("ui.settings.gameOptions.ce8b2ea2", { value: DIFFICULTY_NOTE[u.settings.difficulty] })}</p>
          <h3>{__i18n_t("ui.settings.gameOptions.d7914f70")}</h3>
          <div class="segmented" role="group" aria-label={__i18n_t("ui.settings.gameOptions.cad96f9c")}>
            {__i18n_display(([null, 5, 8] as const).map((n) => (
              <button
                key={String(n)}
                type="button"
                aria-pressed={(league.foreignVeteran ?? null) === n}
                disabled={busy}
                onClick={() => (league.foreignVeteran ?? null) !== n && onAct({ kind: 'foreignVeteran', seasons: n })}
              >
                {__i18n_display(n ? __i18n_k("ui.settings.gameOptions.dbf4c3d2", { n: n }) : __i18n_k("ui.settings.gameOptions.66770937"))}
              </button>
            )))}
          </div>
          <p class="muted small">{__i18n_t("ui.settings.gameOptions.132bf02d")}</p>
        </>
      ))}
      {__i18n_display(u ? (
        <dl class="facts">
          <div>
            <dt>{__i18n_t("ui.settings.gameOptions.cf76b767")}</dt>
            <dd>{__i18n_display(PARENT_COMPANY_TYPES[u.settings.parentType].label)}</dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.settings.gameOptions.48bea069")}</dt>
            <dd>{__i18n_display(u.settings.promotion === 'immediate' ? __i18n_k("ui.settings.gameOptions.fc995d6b") : __i18n_k("ui.settings.gameOptions.95fffb3d"))}</dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.settings.gameOptions.a13e9cdd")}</dt>
            <dd>{__i18n_display(u.settings.firing ? __i18n_k("ui.settings.gameOptions.d657270f") : __i18n_k("ui.settings.gameOptions.d58fa73a"))}</dd>
          </div>
        </dl>
      ) : (
        <p class="muted">{__i18n_t("ui.settings.gameOptions.04e6da8b")}</p>
      ))}
      {__i18n_display(u?.settings.tutorial && (
        <label class="check">
          <input type="checkbox" checked={!u.tutorialOff} disabled={busy} onChange={(e) => onAct((e.currentTarget as HTMLInputElement).checked ? { kind: 'tutorial', on: true } : { kind: 'tutorial', off: true })} /> 튜토리얼 안내
          보기
        </label>
      ))}
      {__i18n_display(u && (
        <fieldset class="stops">
          <legend>{__i18n_t("ui.settings.gameOptions.dd658299")}</legend>
          <p class="muted small">{__i18n_t("ui.settings.gameOptions.8467ccdc")}</p>
          {__i18n_display(STOP_KINDS.map((k) => {
            const on = stopsOf(league).includes(k);
            return (
              <label key={k} class="check">
                <input type="checkbox" checked={on} disabled={busy} onChange={() => onAct({ kind: 'stops', kinds: on ? stopsOf(league).filter((x) => x !== k) : [...stopsOf(league), k] })} /> {__i18n_display(STOP_LABEL[k])}
              </label>
            );
          }))}
        </fieldset>
      ))}
      {__i18n_display(u && (league.offseason?.year ?? league.year) < u.firstTeamYear && (
        <label class="check">
          <input type="checkbox" checked={!!u.settings.autoPrep} disabled={busy} onChange={(e) => onAct({ kind: 'autoPrep', on: (e.currentTarget as HTMLInputElement).checked })} /> 1군 데뷔 전 결정은
          스카우트 추천대로 처리
        </label>
      ))}
      <div class="row-actions">
        <button type="button" onClick={onNewGame} disabled={busy}>{__i18n_t("ui.settings.gameOptions.5b4d0867")}</button>
      </div>
    </>
  );
}

const FIELDS: { key: keyof ClubLabel; label: string; range: { min: number; max: number } }[] = [
  { key: 'name', label: __i18n_k("ui.settings.fIELDS.label.3417788b"), range: CLUB_NAME },
  { key: 'short', label: __i18n_k("ui.settings.fIELDS.label.7d2842b0"), range: CLUB_SHORT },
  { key: 'company', label: __i18n_k("ui.settings.fIELDS.label.cf76b767"), range: COMPANY_NAME },
  { key: 'stadium', label: __i18n_k("ui.settings.fIELDS.label.c2998c5f"), range: BALLPARK_NAME },
];

function ClubNames({ league, busy, onAct }: { league: LeagueState; busy: boolean; onAct: (a: Action) => void }) {
  const existing = league.teams.filter((t) => t.kind === 'existing');
  const current = () => Object.fromEntries(existing.map((t) => [t.id, labelOf(t)]));
  const [draft, setDraft] = useState<Record<string, ClubLabel>>(current);
  const key = existing.map((t) => JSON.stringify(labelOf(t))).join('|');
  // Applied (or loaded from another save): start again from what the league has.
  useEffect(() => setDraft(current()), [key]);
  const problems = useMemo(() => labelProblems(league.teams, draft), [draft, key]);
  const changed = existing.some((t) => JSON.stringify(labelOf(t)) !== JSON.stringify(draft[t.id]));
  const set = (id: string, field: keyof ClubLabel, value: string) => setDraft((d) => ({ ...d, [id]: { ...d[id]!, [field]: value } }));
  const fill = (from: Record<string, ClubLabel>) => setDraft((d) => Object.fromEntries(Object.keys(d).map((id) => [id, from[id] ?? d[id]!])));
  return (
    <>
      <p class="muted">{__i18n_t("ui.settings.clubNames.0b606764")}</p>
      <div class="row-actions">
        <button type="button" onClick={() => fill(FICTIONAL_LABELS)}>{__i18n_t("ui.settings.clubNames.f2a27bbc")}</button>
        <button type="button" onClick={() => fill(realLabels())}>{__i18n_t("ui.settings.clubNames.f420b8d9")}</button>
      </div>
      <div class="club-names">
        {__i18n_display(existing.map((t) => {
          const d = draft[t.id]!;
          return (
            <fieldset key={t.id} class="club-name">
              <legend>
                <span class="swatch" style={{ background: d.color }} aria-hidden="true" /> {__i18n_display(t.region)} · {__i18n_display(labelOf(t).short)}
              </legend>
              {__i18n_display(FIELDS.map((f) => (
                <label key={f.key}>
                  {__i18n_display(f.label)}
                  <input value={d[f.key]} maxLength={f.range.max} onInput={(e) => set(t.id, f.key, (e.currentTarget as HTMLInputElement).value)} />
                </label>
              )))}
              <label>
                색
                <input type="color" value={d.color} onInput={(e) => set(t.id, 'color', (e.currentTarget as HTMLInputElement).value)} />
              </label>
            </fieldset>
          );
        }))}
      </div>
      {__i18n_display(problems.length > 0 && (
        <ul class="notice warn" role="alert">
          {__i18n_display(problems.slice(0, 5).map((x) => (
            <li key={x}>{__i18n_display(x)}</li>
          )))}
        </ul>
      ))}
      <div class="row-actions">
        <button type="button" class="primary" disabled={busy || !changed || problems.length > 0} onClick={() => onAct({ kind: 'clubNames', labels: draft })}>{__i18n_t("ui.settings.clubNames.8417d0a6")}</button>
        <button type="button" disabled={!changed} onClick={() => setDraft(current())}>{__i18n_t("ui.settings.clubNames.18a3e949")}</button>
      </div>
    </>
  );
}

function SaveOptions({ league, store, busy, onExport, onImport }: { league: LeagueState; store: SaveStore; busy: boolean; onExport: () => void; onImport: (file: File | undefined) => void }) {
  const [space, setSpace] = useState<{ usage: number; quota: number } | null>(null);
  const [kept, setKept] = useState<boolean | null>(null);
  useEffect(() => {
    const st = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    st?.estimate?.()
      .then((e) => setSpace({ usage: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => undefined);
    st?.persisted?.()
      .then(setKept)
      .catch(() => undefined);
  }, []);
  const ask = async () => {
    try {
      setKept((await navigator.storage?.persist?.()) ?? false);
    } catch {
      setKept(false);
    }
  };
  const at = lastExport(league.seed);
  const mb = (x: number) => `${(x / 1_000_000).toFixed(1)}MB`;
  return (
    <>
      <p>{__i18n_display(store.kind === 'indexedDB' ? __i18n_k("ui.settings.saveOptions.dc86f90b") : __i18n_k("ui.settings.saveOptions.9fa95b75"))}</p>
      <dl class="facts">
        <div>
          <dt>{__i18n_t("ui.settings.saveOptions.e1462591")}</dt>
          <dd>{__i18n_display(at ? new Date(at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : __i18n_k("ui.settings.saveOptions.89759ef1"))}</dd>
        </div>
        {__i18n_display(space && (
          <div>
            <dt>{__i18n_t("ui.settings.saveOptions.7a5a1bad")}</dt>
            <dd>
              {__i18n_display(mb(space.usage))}
              {__i18n_display(space.quota ? ` / ${mb(space.quota)}` : '')}
            </dd>
          </div>
        ))}
        {__i18n_display(kept !== null && (
          <div>
            <dt>{__i18n_t("ui.settings.saveOptions.cfdec3c9")}</dt>
            <dd>{__i18n_display(kept ? __i18n_k("ui.settings.saveOptions.37b61564") : __i18n_k("ui.settings.saveOptions.5f1ffa91"))}</dd>
          </div>
        ))}
      </dl>
      <div class="row-actions">
        <button type="button" onClick={onExport} disabled={busy}>{__i18n_t("ui.settings.saveOptions.2ba578d5")}</button>
        <label class="file-button">
          불러오기
          <input type="file" accept="application/json,.json" onChange={(e) => onImport((e.currentTarget as HTMLInputElement).files?.[0])} />
        </label>
        {__i18n_display(kept === false && (
          <button type="button" onClick={ask}>{__i18n_t("ui.settings.saveOptions.ae7d9c89")}</button>
        ))}
      </div>
      <p class="muted small">{__i18n_t("ui.settings.saveOptions.291e0032")}</p>
    </>
  );
}
