/* The settings tab (V0.13): everything the player sets in one place — display, the game, the clubs' names,
   saves, AI articles and what the game is. Display and AI settings stay in this browser; the game and the
   clubs' names travel with the save. */
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
  ['settings-display', '화면'],
  ['settings-game', '게임'],
  ['settings-clubs', '구단 이름'],
  ['settings-save', '저장'],
  ['settings-story', 'AI 기사'],
  ['settings-about', '정보'],
];

export const DIFFICULTY_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' } as const;
export const DIFFICULTY_NOTE = {
  easy: '모기업 돈(창단 자금·연봉 예산·지원 한도) +25%, 선수들이 우리 제안을 조금 더 잘 받아들이고, 스카우트 눈이 밝고, 트레이드 상대가 덜 까다롭고, 모기업 신뢰가 천천히 떨어집니다.',
  normal: '기준입니다.',
  hard: '모기업 돈 −15%, 협상이 더 어렵고, 스카우트의 미래 평가가 흐리며, 트레이드 상대가 더 까다롭고, 모기업 신뢰가 빨리 떨어집니다.',
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
          <h2 id="settings-title">설정</h2>
          <p class="muted">화면·AI 기사 설정은 이 브라우저에만 남고, 게임과 구단 이름은 진행 파일에 함께 저장됩니다.</p>
        </div>
      </div>
      <div class="segmented settings-jump" role="group" aria-label="설정 항목">
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={open === id} onClick={() => pick(id)}>
            {label}
          </button>
        ))}
      </div>

      <section id="settings-display" class={block('settings-display')}>
        <h2>화면</h2>
        <DisplayOptions />
      </section>

      <section id="settings-game" class={block('settings-game')}>
        <h2>게임</h2>
        <GameOptions league={league} busy={busy} onAct={onAct} onNewGame={onNewGame} />
      </section>

      <section id="settings-clubs" class={block('settings-clubs')}>
        <h2>구단 이름</h2>
        <ClubNames league={league} busy={busy} onAct={onAct} />
      </section>

      <section id="settings-save" class={block('settings-save')}>
        <h2>저장</h2>
        <SaveOptions league={league} store={store} busy={busy} onExport={onExport} onImport={onImport} />
      </section>

      <section id="settings-story" class={block('settings-story')}>
        <h2>AI 기사</h2>
        <StoryOptions settings={story.settings} usage={story.usage} pausedUntil={story.pausedUntil} onSave={story.onSave} />
      </section>

      <section id="settings-about" class={block('settings-about')}>
        <h2>정보</h2>
        <dl class="facts">
          <div>
            <dt>버전</dt>
            <dd>{RELEASE}</dd>
          </div>
          <div>
            <dt>시뮬레이션</dt>
            <dd>{SIM_VERSION}</dd>
          </div>
          <div>
            <dt>시드</dt>
            <dd>{league.seed}</dd>
          </div>
        </dl>
        <p>{DISCLAIMER}</p>
        <p class="muted small">
          제도는 현실 KBO 규정을 따르고, 출처와 게임용 가정은{' '}
          <a href={RULES_URL} target="_blank" rel="noopener noreferrer">
            규정 조사표(RULES.md)
          </a>
          에 있습니다. 의견과 버그는{' '}
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            GitHub Issues
          </a>
          로 보내 주세요.
        </p>
        <h3>사용한 오픈소스</h3>
        <ul class="plain">
          {OPEN_SOURCE.map((x) => (
            <li key={x.name}>
              <a href={x.url} target="_blank" rel="noopener noreferrer">
                {x.name}
              </a>{' '}
              <span class="muted small">({x.license})</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function GameOptions({ league, busy, onAct, onNewGame }: { league: LeagueState; busy: boolean; onAct: (a: Action) => void; onNewGame: () => void }) {
  const u = league.user;
  return (
    <>
      {u && (
        <>
          <h3>난이도</h3>
          <div class="segmented" role="group" aria-label="난이도">
            {(['easy', 'normal', 'hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={u.settings.difficulty === d}
                disabled={busy}
                onClick={() => d !== u.settings.difficulty && window.confirm(`난이도를 ${ro(DIFFICULTY_LABEL[d])} 바꿀까요? 바꾼 사실은 구단 연표에 남습니다.`) && onAct({ kind: 'difficulty', level: d })}
              >
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
          <p class="muted small">{DIFFICULTY_NOTE[u.settings.difficulty]} 예산은 다음 겨울부터, 나머지는 바로 바뀝니다.</p>
          <h3>외국인 장기 근속 규정 (가상)</h3>
          <div class="segmented" role="group" aria-label="외국인 장기 근속 규정">
            {([null, 5, 8] as const).map((n) => (
              <button
                key={String(n)}
                type="button"
                aria-pressed={(league.foreignVeteran ?? null) === n}
                disabled={busy}
                onClick={() => (league.foreignVeteran ?? null) !== n && onAct({ kind: 'foreignVeteran', seasons: n })}
              >
                {n ? `${n}시즌` : '끔'}
              </button>
            ))}
          </div>
          <p class="muted small">
            켜면 KBO 1군에서 정한 시즌 이상 뛴 외국인 선수는 외국인 엔트리(슬롯)를 차지하지 않고 외국인 샐러리캡에서도 빠집니다. 일본 프로야구의 방식을 빌린 가상 규정으로, 모든 구단에
            적용되고 다음 외국인 계약부터 반영됩니다.
          </p>
        </>
      )}
      {u ? (
        <dl class="facts">
          <div>
            <dt>모기업</dt>
            <dd>{PARENT_COMPANY_TYPES[u.settings.parentType].label}</dd>
          </div>
          <div>
            <dt>1군 진입</dt>
            <dd>{u.settings.promotion === 'immediate' ? '바로 승격' : '퓨처스 1년 뒤'}</dd>
          </div>
          <div>
            <dt>단장 해임</dt>
            <dd>{u.settings.firing ? '있음' : '없음'}</dd>
          </div>
        </dl>
      ) : (
        <p class="muted">관전 모드입니다. 구단을 창단하려면 새 게임을 시작하세요.</p>
      )}
      {u?.settings.tutorial && (
        <label class="check">
          <input type="checkbox" checked={!u.tutorialOff} disabled={busy} onChange={(e) => onAct((e.currentTarget as HTMLInputElement).checked ? { kind: 'tutorial', on: true } : { kind: 'tutorial', off: true })} /> 튜토리얼 안내
          보기
        </label>
      )}
      <div class="row-actions">
        <button type="button" onClick={onNewGame} disabled={busy}>
          새 게임
        </button>
      </div>
    </>
  );
}

const FIELDS: { key: keyof ClubLabel; label: string; range: { min: number; max: number } }[] = [
  { key: 'name', label: '구단명', range: CLUB_NAME },
  { key: 'short', label: '약칭', range: CLUB_SHORT },
  { key: 'company', label: '모기업', range: COMPANY_NAME },
  { key: 'stadium', label: '구장', range: BALLPARK_NAME },
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
      <p class="muted">
        기존 10개 구단의 이름·약칭·색·모기업·구장 이름을 바꿉니다. 연고지·구장 규모·모기업 유형 같은 나머지는 그대로입니다. 이미 쓰인 기사와 알림은 옛 이름 그대로 남고, 새 기사부터 새 이름이 들어갑니다.
      </p>
      <div class="row-actions">
        <button type="button" onClick={() => fill(FICTIONAL_LABELS)}>
          가상 이름 세트 넣기
        </button>
        <button type="button" onClick={() => fill(realLabels())}>
          실제 이름 넣기
        </button>
      </div>
      <div class="club-names">
        {existing.map((t) => {
          const d = draft[t.id]!;
          return (
            <fieldset key={t.id} class="club-name">
              <legend>
                <span class="swatch" style={{ background: d.color }} aria-hidden="true" /> {t.region} · {labelOf(t).short}
              </legend>
              {FIELDS.map((f) => (
                <label key={f.key}>
                  {f.label}
                  <input value={d[f.key]} maxLength={f.range.max} onInput={(e) => set(t.id, f.key, (e.currentTarget as HTMLInputElement).value)} />
                </label>
              ))}
              <label>
                색
                <input type="color" value={d.color} onInput={(e) => set(t.id, 'color', (e.currentTarget as HTMLInputElement).value)} />
              </label>
            </fieldset>
          );
        })}
      </div>
      {problems.length > 0 && (
        <ul class="notice warn" role="alert">
          {problems.slice(0, 5).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <div class="row-actions">
        <button type="button" class="primary" disabled={busy || !changed || problems.length > 0} onClick={() => onAct({ kind: 'clubNames', labels: draft })}>
          이름 적용
        </button>
        <button type="button" disabled={!changed} onClick={() => setDraft(current())}>
          바꾼 내용 취소
        </button>
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
      <p>{store.kind === 'indexedDB' ? '진행은 조작할 때마다 이 브라우저에 자동 저장됩니다.' : '이 브라우저에서는 자동 저장을 쓸 수 없습니다. 진행 파일로 저장하세요.'}</p>
      <dl class="facts">
        <div>
          <dt>마지막 진행 파일 저장</dt>
          <dd>{at ? new Date(at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '이 브라우저에서는 아직 없음'}</dd>
        </div>
        {space && (
          <div>
            <dt>쓰는 저장 공간</dt>
            <dd>
              {mb(space.usage)}
              {space.quota ? ` / ${mb(space.quota)}` : ''}
            </dd>
          </div>
        )}
        {kept !== null && (
          <div>
            <dt>저장소 보호</dt>
            <dd>{kept ? '보호됨 (브라우저가 공간이 모자라도 지우지 않음)' : '보호 안 됨'}</dd>
          </div>
        )}
      </dl>
      <div class="row-actions">
        <button type="button" onClick={onExport} disabled={busy}>
          진행 파일 저장
        </button>
        <label class="file-button">
          불러오기
          <input type="file" accept="application/json,.json" onChange={(e) => onImport((e.currentTarget as HTMLInputElement).files?.[0])} />
        </label>
        {kept === false && (
          <button type="button" onClick={ask}>
            저장소 보호 요청
          </button>
        )}
      </div>
      <p class="muted small">
        브라우저 저장소는 사이트 데이터를 지우거나, 사파리처럼 오래 방문하지 않은 사이트의 데이터를 정리하는 브라우저에서는 사라질 수 있습니다. 긴 게임은 가끔 진행 파일로 저장해 두세요.
      </p>
    </>
  );
}
