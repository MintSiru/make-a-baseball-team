import { useState } from 'preact/hooks';
import { CITIES, cityById } from '../club/cities';
import { PARENT_COMPANY_TYPES, type ParentCompanyType } from '../club/types';
import { budgetFor, difficultyStars, STADIUM_PLANS } from '../league/expansion';
import type { Difficulty, ExpansionSettings, Promotion } from '../league/state';
import { money } from './format';

const COLORS = ['#0f6e8c', '#1b7f5a', '#6b3fa0', '#c2572b', '#2f4858', '#b3261e', '#0b5394', '#8a6d1d'];
const TAKEN = ['키움', 'NC', '한화', '롯데', 'SSG', 'KT', '두산', 'LG', '삼성', 'KIA'];

type Stadium = ExpansionSettings['stadium'];

interface Props {
  seed: string;
  busy: string | null;
  onFound: (settings: ExpansionSettings, seed: string) => void;
  onSpectate: (seed: string) => void;
}

export function NewGame({ seed: initialSeed, busy, onFound, onSpectate }: Props) {
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [color, setColor] = useState(COLORS[0]!);
  const [cityId, setCityId] = useState('ulsan');
  const [parentType, setParentType] = useState<ParentCompanyType>('conglomerate');
  const [parentName, setParentName] = useState('');
  const [stadium, setStadium] = useState<Stadium>('existing');
  const [promotion, setPromotion] = useState<Promotion>('afterFutures');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [seed, setSeed] = useState(initialSeed);
  const city = cityById(cityId)!;

  const settings: ExpansionSettings = { name, short, color, cityId, parentType, parentName, stadium, promotion, difficulty, scenario: null };
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
    <main class="page new-game" style={{ '--accent': color } as Record<string, string>}>
      <h2>2026년, KBO 11번째 구단 창단</h2>
      <p>
        7월 1일 창단 승인을 받는 순간부터 시작합니다. 9월 신인 드래프트에서 우선지명을 하고,{' '}
        {promotion === 'afterFutures' ? '2027년 퓨처스리그를 거쳐 2028년 1군에 들어갑니다.' : '곧바로 2027년 1군에 들어갑니다.'}
      </p>

      <section class="form-block" aria-labelledby="ng-identity">
        <h3 id="ng-identity">구단</h3>
        <div class="fields">
          <label>
            구단명
            <input value={name} maxLength={12} placeholder={`예: ${city.name} 웨일스`} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label>
            약칭
            <input value={short} maxLength={4} placeholder={city.name} onInput={(e) => setShort((e.currentTarget as HTMLInputElement).value)} />
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
          {CITIES.map((c) => (
            <button key={c.id} type="button" class="choice" aria-pressed={c.id === cityId} onClick={() => setCityId(c.id)}>
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
            <button key={t} type="button" class="choice" aria-pressed={t === parentType} onClick={() => setParentType(t)}>
              <strong>{PARENT_COMPANY_TYPES[t].label}</strong>
              <span class="muted">{PARENT_COMPANY_TYPES[t].summary}</span>
            </button>
          ))}
        </div>
        <label class="wide">
          {parentType === 'citizen' ? '운영 주체' : parentType === 'namingRights' ? '메인 스폰서' : '모기업'} 이름
          <input value={parentName} maxLength={20} placeholder={parentType === 'citizen' ? `${city.name}시` : '가상의 회사명'} onInput={(e) => setParentName((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </section>

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

      <section class="form-block" aria-labelledby="ng-rules">
        <h3 id="ng-rules">진행</h3>
        <div class="segmented" role="group" aria-label="1군 진입">
          <button type="button" aria-pressed={promotion === 'afterFutures'} onClick={() => setPromotion('afterFutures')}>
            퓨처스 1년 후 1군 (NC·KT 선례)
          </button>
          <button type="button" aria-pressed={promotion === 'immediate'} onClick={() => setPromotion('immediate')}>
            바로 1군
          </button>
        </div>
        <div class="segmented" role="group" aria-label="기본 난이도">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} type="button" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
              {{ easy: '쉬움', normal: '보통', hard: '어려움' }[d]}
            </button>
          ))}
        </div>
        <label class="seed-field">
          시드
          <input value={seed} spellcheck={false} onInput={(e) => setSeed((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </section>

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
        {busy && <p class="status">{busy}</p>}
      </section>
    </main>
  );
}
