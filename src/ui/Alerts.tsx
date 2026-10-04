/* Event pop-ups (V0.7.4): the new alerts one at a time (national team, free agents, awards, the hall
   of fame, the season's end, the owner's verdict, postings, achievements, and since V0.11 retirements and
   the articles about our club), and the list of all of them in the club's news. The pop-ups can be turned
   off, and the articles alone; the list stays. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Alert, AlertKind } from '../league/alerts';

export const ALERT_LABEL: Record<AlertKind, string> = {
  national: '국가대표',
  fa: 'FA',
  award: '시상',
  hall: '명예의 전당',
  season: '시즌',
  owner: '모기업',
  posting: '포스팅',
  achievement: '업적',
  injury: '부상',
  military: '병역',
  retire: '은퇴',
  move: '선수 이동',
  life: '선수 소식',
  game: '경기',
  record: '기록',
  scandal: '징계',
  dispute: '지분 분쟁',
};
const ICON: Record<AlertKind, string> = { national: '⚾', fa: '✍️', award: '🏆', hall: '🏛️', season: '📅', owner: '🏢', posting: '✈️', achievement: '🎖️', injury: '🩹', military: '🪖', retire: '👋', move: '🔁', life: '💬', game: '📰', record: '📈', scandal: '⚖️', dispute: '📜' };

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
/** Articles about our club (games, records, injuries, moves, players' news) as pop-ups too. */
export const useArticlePopups = () => usePref(MINOR);

/** The alerts that pop up now: articles only when they are wanted. */
export const poppingAlerts = (unseen: Alert[], articles: boolean) => (articles ? unseen : unseen.filter((a) => !a.minor));

// ── The pop-up ───────────────────────────────────────────────────────────────────────────────────

export function AlertPopup({ alerts, onDone }: { alerts: Alert[]; onDone: (ids: string[]) => void }) {
  const [i, setI] = useState(0);
  const [, setPopups] = useAlertPopups();
  const ok = useRef<HTMLButtonElement>(null);
  const a = alerts[Math.min(i, alerts.length - 1)];
  const all = () => onDone(alerts.map((x) => x.id));
  const last = i >= alerts.length - 1;
  useEffect(() => {
    ok.current?.focus();
  }, [a?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && all();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [alerts]);
  if (!a) return null;
  return (
    <div class="overlay alert-overlay">
      <div class={`dialog alert-dialog tone-${a.tone ?? 'info'}`} role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby="alert-lines">
        <p class="alert-kind">
          <span class="alert-icon" aria-hidden="true">
            {ICON[a.kind]}
          </span>{' '}
          {ALERT_LABEL[a.kind]} · {a.date}
          {alerts.length > 1 && <span class="alert-count"> {i + 1} / {alerts.length}</span>}
        </p>
        <h2 id="alert-title">{a.title}</h2>
        <ul id="alert-lines" class="alert-lines">
          {a.lines.map((line, k) => (
            <li key={k}>{line}</li>
          ))}
        </ul>
        <div class="row-actions">
          <button type="button" class="primary" ref={ok} onClick={() => (last ? all() : setI(i + 1))}>
            {last ? '확인' : '다음'}
          </button>
          {!last && (
            <button type="button" onClick={all}>
              모두 확인
            </button>
          )}
          <button
            type="button"
            class="link small"
            onClick={() => {
              setPopups(false);
              all();
            }}
          >
            팝업 끄기
          </button>
        </div>
        <p class="muted small">지난 알림은 우리 구단 → 소식 → 알림에서 다시 볼 수 있습니다.</p>
      </div>
    </div>
  );
}

// ── The list in the club's news ──────────────────────────────────────────────────────────────────

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <>
      <PopupSettings />
      {alerts.length ? (
        <ol class="plain alert-list">
          {[...alerts].reverse().map((a) => (
            <li key={a.id} class={`tone-${a.tone ?? 'info'}${a.seen ? '' : ' unseen'}`}>
              <p class="muted small">
                <span aria-hidden="true">{ICON[a.kind]}</span> {ALERT_LABEL[a.kind]} · {a.date}
                {!a.seen && <span class="tag">새 알림</span>}
              </p>
              <h4>{a.title}</h4>
              <ul>
                {a.lines.map((line, k) => (
                  <li key={k}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p class="muted">
          아직 알림이 없습니다. 국가대표 선발·결과, FA 시장 결과, 시상, 명예의 전당, 시즌 결과, 모기업 평가, 포스팅, 업적, 은퇴와 우리 구단 기사(경기·기록·부상·선수 이동·선수 소식)가 여기와
          팝업으로 나옵니다.
        </p>
      )}
    </>
  );
}

/** The two pop-up switches (the club's news and the display settings). */
export function PopupSettings() {
  const [on, setOn] = useAlertPopups();
  const [articles, setArticles] = useArticlePopups();
  return (
    <>
      <label class="check">
        <input type="checkbox" checked={on} onChange={(e) => setOn((e.currentTarget as HTMLInputElement).checked)} /> 새 알림을 팝업으로 보기
      </label>
      <label class="check">
        <input type="checkbox" checked={articles} disabled={!on} onChange={(e) => setArticles((e.currentTarget as HTMLInputElement).checked)} /> 우리 구단 기사(경기·기록·부상·선수 이동·선수
        소식)도 팝업으로 보기
      </label>
    </>
  );
}
