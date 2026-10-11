import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* Event pop-ups (V0.7.4): the new alerts one at a time (national team, free agents, awards, the hall
   of fame, the season's end, the owner's verdict, postings, achievements, and since V0.11 retirements and
   the articles about our club), and the list of all of them in the club's news. The pop-ups can be turned
   off, and the articles alone; the list stays. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from './modal';
import type { Alert, AlertKind } from '../league/alerts';

export const ALERT_LABEL: Record<AlertKind, string> = {
  national: __i18n_k("ui.alerts.aLERT_LABEL.national.3243618b"),
  fa: 'FA',
  award: __i18n_k("ui.alerts.aLERT_LABEL.award.d95a37a4"),
  hall: __i18n_k("ui.alerts.aLERT_LABEL.hall.6999864f"),
  season: __i18n_k("ui.alerts.aLERT_LABEL.season.b3000412"),
  owner: __i18n_k("ui.alerts.aLERT_LABEL.owner.cf76b767"),
  posting: __i18n_k("ui.alerts.aLERT_LABEL.posting.6734925e"),
  achievement: __i18n_k("ui.alerts.aLERT_LABEL.achievement.62850cd4"),
  injury: __i18n_k("ui.alerts.aLERT_LABEL.injury.501fb802"),
  military: __i18n_k("ui.alerts.aLERT_LABEL.military.82af035c"),
  retire: __i18n_k("ui.alerts.aLERT_LABEL.retire.5b170d3c"),
  move: __i18n_k("ui.alerts.aLERT_LABEL.move.311ef0cd"),
  life: __i18n_k("ui.alerts.aLERT_LABEL.life.1598a25a"),
  game: __i18n_k("ui.alerts.aLERT_LABEL.game.e0cee61a"),
  record: __i18n_k("ui.alerts.aLERT_LABEL.record.d84b6f4b"),
  scandal: __i18n_k("ui.alerts.aLERT_LABEL.scandal.e6681fb0"),
  dispute: __i18n_k("ui.alerts.aLERT_LABEL.dispute.8cc0c1f5"),
  allstar: '올스타',
};
const ICON: Record<AlertKind, string> = { national: '⚾', fa: '✍️', award: '🏆', hall: '🏛️', season: '📅', owner: '🏢', posting: '✈️', achievement: '🎖️', injury: '🩹', military: '🪖', retire: '👋', move: '🔁', life: '💬', game: '📰', record: '📈', scandal: '⚖️', dispute: '📜', allstar: '⭐' };

// ── Whether new alerts pop up (per-browser preferences; the list is always there) ─────────────────

const PREF = 'kbo-expansion-alert-popups';
/** V0.11: whether the articles about our club pop up too (on unless turned off). */
const MINOR = 'kbo-expansion-alert-minor';
const memory: Record<string, boolean> = {};

function prefOn(key: string): boolean {
  if (key in memory) return memory[key]!;
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

function setPref(key: string, on: boolean) {
  memory[key] = on;
  try {
    if (on) localStorage.removeItem(key);
    else localStorage.setItem(key, 'off');
  } catch {
    // Storage blocked: the choice lasts for this tab.
  }
  window.dispatchEvent(new Event(key));
}

function usePref(key: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => prefOn(key));
  useEffect(() => {
    const sync = () => setOn(prefOn(key));
    window.addEventListener(key, sync);
    return () => window.removeEventListener(key, sync);
  }, []);
  return [on, (v: boolean) => setPref(key, v)];
}

export const useAlertPopups = () => usePref(PREF);

/** 1.0.1: kinds of alert the player does not want popping up (the list still has them). */
const KINDS_OFF = 'kbo-expansion-alert-kinds-off';
function kindsOff(): AlertKind[] {
  try {
    const v = JSON.parse(localStorage.getItem(KINDS_OFF) ?? '[]');
    return Array.isArray(v) ? v.filter((k): k is AlertKind => k in ALERT_LABEL) : [];
  } catch {
    return (memory[KINDS_OFF] as unknown as AlertKind[] | undefined) ?? [];
  }
}
export function useAlertKindsOff(): [AlertKind[], (kind: AlertKind, popUp: boolean) => void] {
  const [off, setOff] = useState(kindsOff);
  useEffect(() => {
    const sync = () => setOff(kindsOff());
    window.addEventListener(KINDS_OFF, sync);
    return () => window.removeEventListener(KINDS_OFF, sync);
  }, []);
  const set = (kind: AlertKind, popUp: boolean) => {
    const next = popUp ? kindsOff().filter((k) => k !== kind) : [...new Set([...kindsOff(), kind])];
    try {
      localStorage.setItem(KINDS_OFF, JSON.stringify(next));
    } catch {
      (memory as Record<string, unknown>)[KINDS_OFF] = next;
    }
    window.dispatchEvent(new Event(KINDS_OFF));
  };
  return [off, set];
}
/** Articles about our club (games, records, injuries, moves, players' news) as pop-ups too. */
export const useArticlePopups = () => usePref(MINOR);

/** The alerts that pop up now: articles only when they are wanted, and none of the kinds turned off (1.0.1). */
export const poppingAlerts = (unseen: Alert[], articles: boolean, off: AlertKind[] = []) => unseen.filter((a) => (articles || !a.minor) && !off.includes(a.kind));

// ── The pop-up ───────────────────────────────────────────────────────────────────────────────────

export function AlertPopup({ alerts, onDone }: { alerts: Alert[]; onDone: (ids: string[]) => void }) {
  const [i, setI] = useState(0);
  const [, setPopups] = useAlertPopups();
  const ok = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, () => all());
  const a = alerts[Math.min(i, alerts.length - 1)];
  const all = () => onDone(alerts.map((x) => x.id));
  const last = i >= alerts.length - 1;
  useEffect(() => {
    ok.current?.focus();
  }, [a?.id]);
  if (!a) return null;
  return (
    <div class="overlay alert-overlay">
      <div class={`dialog alert-dialog tone-${a.tone ?? 'info'}`} role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby="alert-lines" ref={box}>
        <p class="alert-kind">
          <span class="alert-icon" aria-hidden="true">
            {__i18n_display(ICON[a.kind])}
          </span>{__i18n_display(' ')}
          {__i18n_display(ALERT_LABEL[a.kind])} · {__i18n_display(a.date)}
          {__i18n_display(alerts.length > 1 && <span class="alert-count"> {__i18n_display(i + 1)} / {__i18n_display(alerts.length)}</span>)}
        </p>
        <h2 id="alert-title">{__i18n_display(a.title)}</h2>
        <ul id="alert-lines" class="alert-lines">
          {__i18n_display(a.lines.map((line, k) => (
            <li key={k}>{__i18n_display(line)}</li>
          )))}
        </ul>
        <div class="row-actions">
          <button type="button" class="primary" ref={ok} onClick={() => (last ? all() : setI(i + 1))}>
            {__i18n_display(last ? __i18n_k("ui.alerts.alertPopup.468266d6") : __i18n_k("ui.alerts.alertPopup.854c76f3"))}
          </button>
          {__i18n_display(!last && (
            <button type="button" onClick={all}>{__i18n_t("ui.alerts.alertPopup.43c1a81d")}</button>
          ))}
          <button
            type="button"
            class="link small"
            onClick={() => {
              setPopups(false);
              all();
            }}
          >{__i18n_t("ui.alerts.alertPopup.253fe948")}</button>
        </div>
        <p class="muted small">{__i18n_t("ui.alerts.alertPopup.f0064645")}</p>
      </div>
    </div>
  );
}

// ── The list in the club's news ──────────────────────────────────────────────────────────────────

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <>
      <PopupSettings />
      {__i18n_display(alerts.length ? (
        <ol class="plain alert-list">
          {__i18n_display([...alerts].reverse().map((a) => (
            <li key={a.id} class={`tone-${a.tone ?? 'info'}${a.seen ? '' : ' unseen'}`}>
              <p class="muted small">
                <span aria-hidden="true">{__i18n_display(ICON[a.kind])}</span> {__i18n_display(ALERT_LABEL[a.kind])} · {__i18n_display(a.date)}
                {__i18n_display(!a.seen && <span class="tag">{__i18n_t("ui.alerts.alertList.888f43de")}</span>)}
              </p>
              <h4>{__i18n_display(a.title)}</h4>
              <ul>
                {__i18n_display(a.lines.map((line, k) => (
                  <li key={k}>{__i18n_display(line)}</li>
                )))}
              </ul>
            </li>
          )))}
        </ol>
      ) : (
        <p class="muted">{__i18n_t("ui.alerts.alertList.2c74b8cb")}</p>
      ))}
    </>
  );
}

/** The pop-up switches (the club's news and the display settings): pop-ups at all, our club's articles, and each
    kind of alert (1.0.1). */
export function PopupSettings() {
  const [on, setOn] = useAlertPopups();
  const [articles, setArticles] = useArticlePopups();
  const [off, setKind] = useAlertKindsOff();
  return (
    <>
      <label class="check">
        <input type="checkbox" checked={on} onChange={(e) => setOn((e.currentTarget as HTMLInputElement).checked)} /> 새 알림을 팝업으로 보기
      </label>
      <label class="check">
        <input type="checkbox" checked={articles} disabled={!on} onChange={(e) => setArticles((e.currentTarget as HTMLInputElement).checked)} /> 우리 구단 기사(경기·기록·부상·선수 이동·선수
        소식)도 팝업으로 보기
      </label>
      <fieldset class="alert-kinds" disabled={!on}>
        <legend>{__i18n_t("ui.alerts.popupSettings.fedc1a36")}</legend>
        {__i18n_display((Object.keys(ALERT_LABEL) as AlertKind[]).map((k) => (
          <label key={k} class="check">
            <input type="checkbox" checked={!off.includes(k)} onChange={(e) => setKind(k, (e.currentTarget as HTMLInputElement).checked)} /> {__i18n_display(ALERT_LABEL[k])}
          </label>
        )))}
      </fieldset>
    </>
  );
}
