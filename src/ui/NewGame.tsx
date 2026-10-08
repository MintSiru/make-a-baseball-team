import { useState } from 'preact/hooks';
import { accentStyle } from './display';
import { useDark } from './useDisplay';
import { CITIES, cityById } from '../club/cities';
import { SCENARIOS, scenarioDef, withScenario, type ScenarioId } from '../league/scenarios';
import { PARENT_COMPANY_TYPES, type ParentCompanyType } from '../club/types';
import { existingTeams } from '../league/clubs';
import { budgetFor, difficultyStars, foundingRisks, STADIUM_PLANS } from '../league/expansion';
import type { Difficulty, ExpansionSettings, Promotion, TwelveSetting } from '../league/state';
import { money } from './format';
import { TwelveSettingField } from './Twelve';
import { DIFFICULTY_LABEL, DIFFICULTY_NOTE } from './Settings';

const COLORS = ['#0f6e8c', '#1b7f5a', '#6b3fa0', '#c2572b', '#2f4858', '#b3261e', '#0b5394', '#8a6d1d'];
/** The existing clubs' short names, as a new league has them (renamed later in the settings, if at all). */
const TAKEN = existingTeams().map((t) => t.short);

type Stadium = ExpansionSettings['stadium'];

interface Props {
  seed: string;
  busy: string | null;
  onFound: (settings: ExpansionSettings, seed: string) => void;
  onSpectate: (seed: string) => void;
}

const LOCK_LABEL: Record<string, string> = { cityId: '연고지', parentType: '모기업 형태', parentName: '모기업 이름', name: '구단명', short: '약칭', difficulty: '난이도', firing: '해임 있음', promotion: '1군 진입 시기', stadium: '홈구장' };

/** The recommended first game (1.5.0): a big parent, the existing ballpark, a futures year with the guide. */
const NICKNAMES = ['웨일스', '블루스', '썬더스', '파이어스'];
function recommended(cityId: string, cityName: string, color: string, name: string, short: string, parentName: string): ExpansionSettings {
  const nick = NICKNAMES[Math.abs([...cityName].reduce((a, c) => a + c.charCodeAt(0), 0)) % NICKNAMES.length]!;
  return {
    name: name.trim() || `${cityName} ${nick}`,
    short: short.trim() || cityName.slice(0, 4),
    color,
    cityId,
    parentType: 'conglomerate',
    parentName: parentName.trim() || `${cityName}그룹`,
    stadium: 'existing',
    promotion: 'afterFutures',
    difficulty: 'normal',
    scenario: null,
    tutorial: true,
  };
}

export function NewGame({ seed: initialSeed, busy, onFound, onSpectate }: Props) {
  const dark = useDark();
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [color, setColor] = useState(COLORS[0]!);
  const [cityId, setCityId] = useState('ulsan');
  const [parentType, setParentType] = useState<ParentCompanyType>('conglomerate');
  const [parentName, setParentName] = useState('');
  const [stadium, setStadium] = useState<Stadium>('existing');
  // 1.5.0: when the club reaches the first team and whether the guide comes along are two choices (they were one
  // game mode from V0.7.5 to 1.4); a third hands the decisions before the debut to the scouts.
  const [promotion, setPromotion] = useState<Promotion>('afterFutures');
  const [guide, setGuide] = useState(true);
  const [autoPrep, setAutoPrep] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [firing, setFiring] = useState(false);
  const [seed, setSeed] = useState(initialSeed);
  const [twelve, setTwelve] = useState<TwelveSetting>({ mode: 'off' });
  // 1.6.0: a scenario sets some of the conditions (and locks some of them).
  const [scenario, setScenario] = useState<ScenarioId | null>(null);
  const def = scenarioDef(scenario);
  const locked = new Set<string>(def?.locked ?? []);
  const pickScenario = (id: ScenarioId | null) => {
    const before = def?.fixed;
    // What the last scenario named goes with it.
    if (before?.name) setName('');
    if (before?.short) setShort('');
    if (before?.parentName) setParentName('');
    if (before?.cityId && !CITIES.some((c) => c.id === before.cityId)) setCityId('ulsan');
    setScenario(id);
    const f = scenarioDef(id)?.fixed;
    if (!f) return;
    if (f.cityId) setCityId(f.cityId);
    if (f.parentType) setParentType(f.parentType);
    if (f.parentName) setParentName(f.parentName);
    if (f.name) setName(f.name);
    if (f.short) setShort(f.short);
    if (f.stadium) setStadium(f.stadium);
    if (f.promotion) setPromotion(f.promotion);
    if (f.difficulty) setDifficulty(f.difficulty);
    if (f.firing != null) setFiring(f.firing);
  };
  const city = cityById(cityId)!;
  const cities = locked.has('cityId') ? [city] : CITIES;
  // The twelfth club comes once ours is in the first team.
  const twelveFrom = promotion === 'immediate' ? 2027 : 2028;
  const twelveSetting: TwelveSetting = twelve.mode === 'year' ? { mode: 'year', year: Math.max(twelveFrom, twelve.year ?? twelveFrom + 2) } : twelve;

  const settings: ExpansionSettings = withScenario({
    name,
    short,
    color,
    cityId,
    parentType,
    parentName,
    stadium,
    promotion,
    difficulty,
    scenario: null,
    ...(firing ? { firing } : {}),
    ...(guide ? { tutorial: true } : {}),
    ...(autoPrep ? { autoPrep: true } : {}),
    ...(twelveSetting.mode !== 'off' ? { twelve: twelveSetting } : {}),
  }, scenario);
  const b = budgetFor(settings);
  const stars = difficultyStars(settings);
  const problems = [
    !name.trim() && '구단명을 정하세요.',
    name.trim().length > 12 && '구단명은 12자 이내로 정하세요.',
    !short.trim() && '약칭을 정하세요.',
    short.trim().length > 4 && '약칭은 4자 이내로 정하세요.',
    TAKEN.includes(short.trim()) && '다른 구단과 같은 약칭입니다.',
    !parentName.trim() && '모기업(또는 스폰서·운영 주체) 이름을 정하세요.',
  ].filter(Boolean) as string[];

  return (
    <main class="page new-game" style={accentStyle(color, dark)}>
      <h2>2026년, KBO 11번째 구단 창단</h2>
      <p>
        7월 1일 창단 승인을 받는 순간부터 시작합니다. 9월 신인 드래프트에서 우선지명을 하고,{' '}
        {promotion === 'afterFutures' ? '2027년 퓨처스리그를 거쳐 2028년 1군에 들어갑니다.' : '곧바로 2027년 1군에 들어갑니다.'}
        {guide ? ' 1군 데뷔까지 튜토리얼이 할 일을 안내합니다.' : ''}
      </p>

      <section class="form-block" aria-labelledby="ng-scenario">
        <h3 id="ng-scenario">시나리오</h3>
        <div class="choice-grid scenario-grid" role="radiogroup" aria-label="시나리오">
          <button type="button" class="choice" role="radio" aria-checked={!scenario} aria-pressed={!scenario} onClick={() => pickScenario(null)}>
            <strong>자유 창단</strong>
            <span class="muted">조건을 모두 직접 정하고, 정해진 목표 없이 구단을 키웁니다.</span>
          </button>
          {SCENARIOS.map((x) => (
            <button key={x.id} type="button" class="choice" role="radio" aria-checked={scenario === x.id} aria-pressed={scenario === x.id} onClick={() => pickScenario(x.id)}>
              <strong>{x.title}</strong>
              <span class="muted">{x.tagline}</span>
              <span class="stars" aria-label={`난이도 5점 중 ${x.stars}점`}>
                {'★'.repeat(x.stars)}
                {'☆'.repeat(5 - x.stars)}
              </span>
            </button>
          ))}
        </div>
        {def && (
          <div class="scenario-brief">
            {def.story.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>
              <strong>목표</strong> {def.goal}
            </p>
            <p class="muted small">
              고정 조건: {def.locked.map((k) => LOCK_LABEL[k] ?? k).join(' · ')}. 목표를 이루거나 놓치면 알림으로 알려 주고, 그 뒤로도 구단을 계속 운영할 수 있습니다.
            </p>
          </div>
        )}
      </section>

      {!def && (
      <section class="quick-start" aria-labelledby="ng-quick">
        <h3 id="ng-quick">빠른 시작</h3>
        <p class="muted small">
          처음이라면 추천 조건으로 바로 시작하세요: {city.name} · 대기업 모기업 · 기존 구장 · 퓨처스 1년 뒤 2028년 1군 · 튜토리얼 안내 · 보통 난이도 · 해임 없음. 이름은 나중에 설정 탭에서 바꿀 수
          있습니다.
        </p>
        <button type="button" class="primary" disabled={!!busy} onClick={() => onFound(recommended(city.id, city.name, color, name, short, parentName), seed.trim() || initialSeed)}>
          추천 조건으로 바로 시작
        </button>
      </section>
      )}

      <section class="form-block" aria-labelledby="ng-identity">
        <h3 id="ng-identity">구단</h3>
        <div class="fields">
          <label>
            구단명
            <input value={name} maxLength={12} disabled={locked.has('name')} placeholder={`예: ${city.name} 웨일스`} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label>
            약칭
            <input value={short} maxLength={4} disabled={locked.has('short')} placeholder={city.name} onInput={(e) => setShort((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
        <div class="swatches" role="radiogroup" aria-label="구단 색">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={c} class="swatch-button" style={{ background: c }} onClick={() => setColor(c)} />
          ))}
          <label class="custom-color">
            직접 고르기 <input type="color" value={color} onInput={(e) => setColor((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
      </section>

      <section class="form-block" aria-labelledby="ng-city">
        <h3 id="ng-city">연고지</h3>
        <div class="choice-grid">
          {cities.map((c) => (
            <button key={c.id} type="button" class="choice" aria-pressed={c.id === cityId} disabled={locked.has('cityId')} onClick={() => setCityId(c.id)}>
              <strong>{c.name}</strong>
              <span class="muted">
                인구 {Math.round(c.population / 10000)}만 · 시장 {c.market}
              </span>
              <span class="muted">
                {c.stadium.name} {c.stadium.seats.toLocaleString('ko-KR')}석{c.stadium.real ? '' : ' (가정)'}
              </span>
            </button>
          ))}
        </div>
        <p class="muted">
          {city.competition}. {city.note}
        </p>
      </section>

      <section class="form-block" aria-labelledby="ng-parent">
        <h3 id="ng-parent">모기업</h3>
        <div class="choice-grid">
          {(Object.keys(PARENT_COMPANY_TYPES) as ParentCompanyType[]).map((t) => (
            <button key={t} type="button" class="choice" aria-pressed={t === parentType} disabled={locked.has('parentType') && t !== parentType} onClick={() => setParentType(t)}>
              <strong>{PARENT_COMPANY_TYPES[t].label}</strong>
              <span class="muted">{PARENT_COMPANY_TYPES[t].summary}</span>
            </button>
          ))}
        </div>
        <label class="wide">
          {parentType === 'citizen' ? '운영 주체' : parentType === 'namingRights' ? '메인 스폰서' : '모기업'} 이름
          <input value={parentName} maxLength={20} disabled={locked.has('parentName')} placeholder={parentType === 'citizen' ? `${city.name}시` : '가상의 회사명'} onInput={(e) => setParentName((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </section>

      <section class="form-block" aria-labelledby="ng-mode">
        <h3 id="ng-mode">시작 방식</h3>
        <div class="choice-grid mode-grid" role="group" aria-label="1군 진입">
          <button type="button" class="choice" aria-pressed={promotion === 'afterFutures'} disabled={locked.has('promotion')} onClick={() => setPromotion('afterFutures')}>
            <strong>퓨처스 1년 뒤 · 2028년 1군</strong>
            <span class="muted">2027년 퓨처스리그에서 선수단을 키운 뒤 1군에 들어갑니다 (NC·KT 선례). 준비할 시간이 넉넉합니다.</span>
          </button>
          <button type="button" class="choice" aria-pressed={promotion === 'immediate'} disabled={locked.has('promotion')} onClick={() => setPromotion('immediate')}>
            <strong>바로 1군 · 2027년</strong>
            <span class="muted">첫 겨울에 1군 전력을 한꺼번에 만들고 곧바로 1군에 들어갑니다. 빨리 1군 경기를 보고 싶다면.</span>
          </button>
        </div>
        <div class="choice-grid mode-grid" role="group" aria-label="안내">
          <button type="button" class="choice" aria-pressed={guide} onClick={() => setGuide(true)}>
            <strong>튜토리얼 안내 받기</strong>
            <span class="muted">처음 해 보는 일마다 무엇을 왜 하는지 알려 줍니다. 1군 데뷔까지, 언제든 끌 수 있습니다. 처음이라면 추천.</span>
          </button>
          <button type="button" class="choice" aria-pressed={!guide} onClick={() => setGuide(false)}>
            <strong>안내 없이</strong>
            <span class="muted">규칙을 아는 단장용. 결정 화면마다 "이 결정은?"과 스카우트 추천은 그대로 있습니다.</span>
          </button>
        </div>
        <label class="check">
          <input type="checkbox" checked={autoPrep} onChange={(e) => setAutoPrep((e.currentTarget as HTMLInputElement).checked)} /> 1군 데뷔 전 결정(트라이아웃·드래프트·특별지명·FA·외국인 등)은 스카우트 추천대로 처리
        </label>
        <p class="muted small">켜면 데뷔 전까지 결정 화면이 멈추지 않고 스카우트 추천으로 넘어갑니다. 설정 탭에서 언제든 끌 수 있습니다.</p>
      </section>

      <details class="form-block advanced">
        <summary>고급 설정 — 홈구장 · 12구단 라이벌 · 난이도 · 해임 · 시드</summary>
      <section class="form-block" aria-labelledby="ng-stadium">
        <h3 id="ng-stadium">홈구장</h3>
        <div class="choice-grid">
          {(Object.keys(STADIUM_PLANS) as Stadium[]).map((k) => (
            <button key={k} type="button" class="choice" aria-pressed={k === stadium} onClick={() => setStadium(k)}>
              <strong>{STADIUM_PLANS[k].label}</strong>
              <span class="muted">{k === 'existing' ? `${city.stadium.name} ${city.stadium.seats.toLocaleString('ko-KR')}석` : `${STADIUM_PLANS[k].opens}년 개장 예정, 그때까지 ${city.stadium.name}`}</span>
            </button>
          ))}
        </div>
      </section>

      <section class="form-block" aria-labelledby="ng-twelve">
        <h3 id="ng-twelve">12구단 · 라이벌</h3>
        <TwelveSettingField value={twelveSetting} from={twelveFrom} onChange={setTwelve} />
      </section>

      <section class="form-block" aria-labelledby="ng-rules">
        <h3 id="ng-rules">진행</h3>
        <div class="segmented" role="group" aria-label="기본 난이도">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} type="button" aria-pressed={difficulty === d} disabled={locked.has('difficulty')} onClick={() => setDifficulty(d)}>
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
        <p class="muted small">{DIFFICULTY_NOTE[difficulty]} 게임 중에도 설정 탭에서 바꿀 수 있습니다.</p>
        <label class="check">
          <input type="checkbox" checked={firing} disabled={locked.has('firing')} onChange={(e) => setFiring((e.currentTarget as HTMLInputElement).checked)} /> 성적이 나쁘면 모기업이 단장을 해임할 수 있음 (끄면 샌드박스)
        </label>
        <label class="seed-field">
          시드
          <input value={seed} spellcheck={false} onInput={(e) => setSeed((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </section>

      </details>

      <section class="summary" aria-labelledby="ng-summary">
        <h3 id="ng-summary">창단 조건</h3>
        <dl class="facts">
          <div>
            <dt>체감 난이도</dt>
            <dd class="stars" aria-label={`5점 중 ${stars}점`}>
              {'★'.repeat(stars)}
              {'☆'.repeat(5 - stars)}
            </dd>
          </div>
          <div>
            <dt>창단 자금</dt>
            <dd>{money(b.fund)}</dd>
          </div>
          <div>
            <dt>연간 연봉 예산</dt>
            <dd>{money(b.payrollBudget)}</dd>
          </div>
          <div>
            <dt>가입금 · 발전기금</dt>
            <dd>
              {money(b.entryFee)} · {money(b.developmentFund)}
            </dd>
          </div>
        </dl>
        <details class="risks" open>
          <summary>이 조합에서 조심할 점</summary>
          <ul>
            {foundingRisks(settings).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
        <p class="muted">창단 자금에서 가입금·발전기금·신인 계약금·특별지명 보상금(1명 10억)을 냅니다. 예치금 100억은 KBO가 보관합니다. 금액은 게임용 가정입니다.</p>
        {problems.length > 0 && <p class="notice">{problems[0]}</p>}
        <div class="actions">
          <button type="button" class="primary" disabled={problems.length > 0 || !!busy} onClick={() => onFound({ ...settings, name: name.trim(), short: short.trim(), parentName: parentName.trim() }, seed.trim() || initialSeed)}>
            창단 신청
          </button>
          <button type="button" class="link" disabled={!!busy} onClick={() => onSpectate(seed.trim() || initialSeed)}>
            구단 없이 리그만 관전
          </button>
        </div>
        {busy && (
          <p class="status" role="status">
            {busy}
          </p>
        )}
      </section>
    </main>
  );
}
