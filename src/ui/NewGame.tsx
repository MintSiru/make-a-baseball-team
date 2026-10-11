import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
import { useState } from 'preact/hooks';
import { accentStyle } from './display';
import { useDark } from './useDisplay';
import { CITIES, cityById } from '../club/cities';
import { SCENARIOS, scenarioDef, withScenario, type ScenarioId } from '../league/scenarios';
import { setEra, startYear } from '../league/era';
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

const LOCK_LABEL: Record<string, string> = { cityId: __i18n_k("ui.newGame.lOCK_LABEL.cityId.e9211ac8"), parentType: __i18n_k("ui.newGame.lOCK_LABEL.parentType.8611634e"), parentName: __i18n_k("ui.newGame.lOCK_LABEL.parentName.0cfd0aa8"), name: __i18n_k("ui.newGame.lOCK_LABEL.name.3417788b"), short: __i18n_k("ui.newGame.lOCK_LABEL.short.7d2842b0"), difficulty: __i18n_k("ui.newGame.lOCK_LABEL.difficulty.e8ee93fa"), firing: __i18n_k("ui.newGame.lOCK_LABEL.firing.511fefbd"), promotion: __i18n_k("ui.newGame.lOCK_LABEL.promotion.c2eea1df"), stadium: __i18n_k("ui.newGame.lOCK_LABEL.stadium.5b164a3b"), tutorial: __i18n_k("ui.newGame.lOCK_LABEL.tutorial.aae32f40"), autoPrep: __i18n_k("ui.newGame.lOCK_LABEL.autoPrep.b506f73a") };

/** The recommended first game (1.5.0): a big parent, the existing ballpark, a futures year with the guide. */
const NICKNAMES = [__i18n_k("ui.newGame.nICKNAMES.9a844dcf"), __i18n_k("ui.newGame.nICKNAMES.54445580"), __i18n_k("ui.newGame.nICKNAMES.ebdf4f1b"), __i18n_k("ui.newGame.nICKNAMES.2ac748b1")];
function recommended(cityId: string, cityName: string, color: string, name: string, short: string, parentName: string): ExpansionSettings {
  const nick = NICKNAMES[Math.abs([...cityName].reduce((a, c) => a + c.charCodeAt(0), 0)) % NICKNAMES.length]!;
  return {
    name: name.trim() || `${cityName} ${nick}`,
    short: short.trim() || cityName.slice(0, 4),
    color,
    cityId,
    parentType: 'conglomerate',
    parentName: parentName.trim() || __i18n_k("ui.newGame.recommended.parentName.9d3feeed", { cityName: cityName }),
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
    // Its other conditions go back to where a new form starts.
    if (before?.parentType) setParentType('conglomerate');
    if (before?.difficulty) setDifficulty('normal');
    if (before?.firing != null) setFiring(false);
    if (before?.promotion) setPromotion('afterFutures');
    if (before?.tutorial != null) setGuide(true);
    if (before?.autoPrep != null) setAutoPrep(false);
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
    if (f.tutorial != null) setGuide(f.tutorial);
    if (f.autoPrep != null) setAutoPrep(f.autoPrep);
  };
  const city = cityById(cityId)!;
  const cities = locked.has('cityId') ? [city] : CITIES;
  // The twelfth club comes once ours is in the first team.
  // 1.6.0: 「백 투 더 패스트」 founds the club ten years earlier.
  // The page has no league yet: the calendar follows the scenario picked (the ballpark years and the risks too).
  setEra(def?.era ?? 0);
  const y0 = startYear();
  const twelveFrom = promotion === 'immediate' ? y0 + 1 : y0 + 2;
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
    !name.trim() && __i18n_k("ui.newGame.newGame.problems.55d8035e"),
    name.trim().length > 12 && __i18n_k("ui.newGame.newGame.problems.a750915c"),
    !short.trim() && __i18n_k("ui.newGame.newGame.problems.3d9fbf16"),
    short.trim().length > 4 && __i18n_k("ui.newGame.newGame.problems.5354cd82"),
    TAKEN.includes(short.trim()) && __i18n_k("ui.newGame.newGame.problems.45ec712a"),
    !parentName.trim() && __i18n_k("ui.newGame.newGame.problems.628ec02e"),
  ].filter(Boolean) as string[];

  return (
    <main class="page new-game" style={accentStyle(color, dark)}>
      <h2>{__i18n_t("ui.newGame.newGame.f0854faa", { y0: y0 })}</h2>
      <p>{__i18n_t("ui.newGame.newGame.e24b6970", { value: ' ', value2: promotion === 'afterFutures' ? __i18n_k("ui.newGame.newGame.d98092a4", { value: y0 + 1, value2: y0 + 2 }) : __i18n_k("ui.newGame.newGame.cf9d3fe9", { value: y0 + 1 }), value3: guide ? __i18n_k("ui.newGame.newGame.2fd6c9f6") : '' })}</p>

      <section class="form-block" aria-labelledby="ng-scenario">
        <h3 id="ng-scenario">{__i18n_t("ui.newGame.newGame.4ca5847f")}</h3>
        <div class="choice-grid scenario-grid" role="radiogroup" aria-label={__i18n_t("ui.newGame.newGame.4ca5847f")}>
          <button type="button" class="choice" role="radio" aria-checked={!scenario} aria-pressed={!scenario} onClick={() => pickScenario(null)}>
            <strong>{__i18n_t("ui.newGame.newGame.1d4597df")}</strong>
            <span class="muted">{__i18n_t("ui.newGame.newGame.5a30de75")}</span>
          </button>
          {__i18n_display(SCENARIOS.map((x) => (
            <button key={x.id} type="button" class="choice" role="radio" aria-checked={scenario === x.id} aria-pressed={scenario === x.id} onClick={() => pickScenario(x.id)}>
              <strong>{__i18n_display(x.title)}</strong>
              <span class="muted">{__i18n_display(x.tagline)}</span>
              <span class="stars" aria-label={__i18n_displayText(__i18n_k("ui.newGame.newGame.2eae7ab4", { stars: x.stars }))}>
                {__i18n_display('★'.repeat(x.stars))}
                {__i18n_display('☆'.repeat(5 - x.stars))}
              </span>
            </button>
          )))}
        </div>
        {__i18n_display(def && (
          <div class="scenario-brief">
            {__i18n_display(def.story.map((line) => (
              <p key={line}>{__i18n_display(line)}</p>
            )))}
            <p>
              <strong>{__i18n_t("ui.newGame.newGame.2fbea43b")}</strong> {__i18n_display(def.goal)}
            </p>
            <p class="muted small">{__i18n_t("ui.newGame.newGame.1e53e8d1", { value: def.locked.length ? __i18n_k("ui.newGame.newGame.0885fd6d", { value: def.locked.map((k) => LOCK_LABEL[k] ?? k).join(' · ') }) : __i18n_k("ui.newGame.newGame.7f8c9e78") })}</p>
          </div>
        ))}
      </section>

      {__i18n_display(!def && (
      <section class="quick-start" aria-labelledby="ng-quick">
        <h3 id="ng-quick">{__i18n_t("ui.newGame.newGame.4debda00")}</h3>
        <p class="muted small">{__i18n_t("ui.newGame.newGame.e5593665", { name: city.name })}</p>
        <button type="button" class="primary" disabled={!!busy} onClick={() => onFound(recommended(city.id, city.name, color, name, short, parentName), seed.trim() || initialSeed)}>{__i18n_t("ui.newGame.newGame.dcf783da")}</button>
      </section>
      ))}

      <section class="form-block" aria-labelledby="ng-identity">
        <h3 id="ng-identity">{__i18n_t("ui.newGame.newGame.58756112")}</h3>
        <div class="fields">
          <label>
            구단명
            <input value={name} maxLength={12} disabled={locked.has('name')} placeholder={__i18n_displayText(__i18n_k("ui.newGame.newGame.07710ab3", { name: city.name }))} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label>
            약칭
            <input value={short} maxLength={4} disabled={locked.has('short')} placeholder={__i18n_displayText(city.name)} onInput={(e) => setShort((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
        <div class="swatches" role="radiogroup" aria-label={__i18n_t("ui.newGame.newGame.4b828e65")}>
          {__i18n_display(COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={__i18n_displayText(c)} class="swatch-button" style={{ background: c }} onClick={() => setColor(c)} />
          )))}
          <label class="custom-color">
            직접 고르기 <input type="color" value={color} onInput={(e) => setColor((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
      </section>

      <section class="form-block" aria-labelledby="ng-city">
        <h3 id="ng-city">{__i18n_t("ui.newGame.newGame.e9211ac8")}</h3>
        <div class="choice-grid">
          {__i18n_display(cities.map((c) => (
            <button key={c.id} type="button" class="choice" aria-pressed={c.id === cityId} disabled={locked.has('cityId')} onClick={() => setCityId(c.id)}>
              <strong>{__i18n_display(c.name)}</strong>
              <span class="muted">{__i18n_t("ui.newGame.newGame.e6bc2339", { value: Math.round(c.population / 10000), market: c.market })}</span>
              <span class="muted">{__i18n_t("ui.newGame.newGame.67b862d4", { name: c.stadium.name, value: c.stadium.seats.toLocaleString('ko-KR'), value2: c.stadium.real ? '' : __i18n_k("ui.newGame.newGame.a1d2d5e8") })}</span>
            </button>
          )))}
        </div>
        <p class="muted">
          {__i18n_display(city.competition)}. {__i18n_display(city.note)}
        </p>
      </section>

      <section class="form-block" aria-labelledby="ng-parent">
        <h3 id="ng-parent">{__i18n_t("ui.newGame.newGame.cf76b767")}</h3>
        <div class="choice-grid">
          {__i18n_display((Object.keys(PARENT_COMPANY_TYPES) as ParentCompanyType[]).map((t) => (
            <button key={t} type="button" class="choice" aria-pressed={t === parentType} disabled={locked.has('parentType') && t !== parentType} onClick={() => setParentType(t)}>
              <strong>{__i18n_display(PARENT_COMPANY_TYPES[t].label)}</strong>
              <span class="muted">{__i18n_display(PARENT_COMPANY_TYPES[t].summary)}</span>
            </button>
          )))}
        </div>
        <label class="wide">
          {__i18n_display(parentType === 'citizen' ? __i18n_k("ui.newGame.newGame.607afb0c") : parentType === 'namingRights' ? __i18n_k("ui.newGame.newGame.47ed7893") : __i18n_k("ui.newGame.newGame.cf76b767"))} 이름
          <input value={parentName} maxLength={20} disabled={locked.has('parentName')} placeholder={__i18n_displayText(parentType === 'citizen' ? __i18n_k("ui.newGame.newGame.7afbb51f", { name: city.name }) : __i18n_k("ui.newGame.newGame.2b70691d"))} onInput={(e) => setParentName((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </section>

      <section class="form-block" aria-labelledby="ng-mode">
        <h3 id="ng-mode">{__i18n_t("ui.newGame.newGame.65049d47")}</h3>
        <div class="choice-grid mode-grid" role="group" aria-label={__i18n_t("ui.newGame.newGame.48bea069")}>
          <button type="button" class="choice" aria-pressed={promotion === 'afterFutures'} disabled={locked.has('promotion')} onClick={() => setPromotion('afterFutures')}>
            <strong>{__i18n_t("ui.newGame.newGame.a37f4d2d", { value: y0 + 2 })}</strong>
            <span class="muted">{__i18n_t("ui.newGame.newGame.9e3ece5f", { value: y0 + 1 })}</span>
          </button>
          <button type="button" class="choice" aria-pressed={promotion === 'immediate'} disabled={locked.has('promotion')} onClick={() => setPromotion('immediate')}>
            <strong>{__i18n_t("ui.newGame.newGame.bc7fafe1", { value: y0 + 1 })}</strong>
            <span class="muted">{__i18n_t("ui.newGame.newGame.fd80e1e1")}</span>
          </button>
        </div>
        <div class="choice-grid mode-grid" role="group" aria-label={__i18n_t("ui.newGame.newGame.2af9c732")}>
          <button type="button" class="choice" aria-pressed={guide} disabled={locked.has('tutorial')} onClick={() => setGuide(true)}>
            <strong>{__i18n_t("ui.newGame.newGame.a62d1d09")}</strong>
            <span class="muted">{__i18n_t("ui.newGame.newGame.66eecc52")}</span>
          </button>
          <button type="button" class="choice" aria-pressed={!guide} disabled={locked.has('tutorial')} onClick={() => setGuide(false)}>
            <strong>{__i18n_t("ui.newGame.newGame.369bf459")}</strong>
            <span class="muted">{__i18n_t("ui.newGame.newGame.75779c0c")}</span>
          </button>
        </div>
        <label class="check">
          <input type="checkbox" checked={autoPrep} disabled={locked.has('autoPrep')} onChange={(e) => setAutoPrep((e.currentTarget as HTMLInputElement).checked)} /> 1군 데뷔 전 결정(트라이아웃·드래프트·특별지명·FA·외국인 등)은 스카우트 추천대로 처리
        </label>
        <p class="muted small">{__i18n_t("ui.newGame.newGame.790f09c3")}</p>
      </section>

      <details class="form-block advanced">
        <summary>{__i18n_t("ui.newGame.newGame.e2301d27")}</summary>
      <section class="form-block" aria-labelledby="ng-stadium">
        <h3 id="ng-stadium">{__i18n_t("ui.newGame.newGame.5b164a3b")}</h3>
        <div class="choice-grid">
          {__i18n_display((Object.keys(STADIUM_PLANS) as Stadium[]).map((k) => (
            <button key={k} type="button" class="choice" aria-pressed={k === stadium} onClick={() => setStadium(k)}>
              <strong>{__i18n_display(STADIUM_PLANS[k].label)}</strong>
              <span class="muted">{__i18n_display(k === 'existing' ? __i18n_k("ui.newGame.newGame.bae3c0d0", { name: city.stadium.name, value: city.stadium.seats.toLocaleString('ko-KR') }) : __i18n_k("ui.newGame.newGame.67558972", { opens: STADIUM_PLANS[k].opens, name: city.stadium.name }))}</span>
            </button>
          )))}
        </div>
      </section>

      <section class="form-block" aria-labelledby="ng-twelve">
        <h3 id="ng-twelve">{__i18n_t("ui.newGame.newGame.a91a78ef")}</h3>
        <TwelveSettingField value={twelveSetting} from={twelveFrom} onChange={setTwelve} />
      </section>

      <section class="form-block" aria-labelledby="ng-rules">
        <h3 id="ng-rules">{__i18n_t("ui.newGame.newGame.595d660f")}</h3>
        <div class="segmented" role="group" aria-label={__i18n_t("ui.newGame.newGame.c2105165")}>
          {__i18n_display((['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} type="button" aria-pressed={difficulty === d} disabled={locked.has('difficulty')} onClick={() => setDifficulty(d)}>
              {__i18n_display(DIFFICULTY_LABEL[d])}
            </button>
          )))}
        </div>
        <p class="muted small">{__i18n_t("ui.newGame.newGame.2624d548", { value: DIFFICULTY_NOTE[difficulty] })}</p>
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
        <h3 id="ng-summary">{__i18n_t("ui.newGame.newGame.27155f4d")}</h3>
        <dl class="facts">
          <div>
            <dt>{__i18n_t("ui.newGame.newGame.ed2c09d1")}</dt>
            <dd class="stars" aria-label={__i18n_displayText(__i18n_k("ui.newGame.newGame.b454ddd9", { stars: stars }))}>
              {__i18n_display('★'.repeat(stars))}
              {__i18n_display('☆'.repeat(5 - stars))}
            </dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.newGame.newGame.52998cca")}</dt>
            <dd>{__i18n_display(money(b.fund))}</dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.newGame.newGame.c9c8c29f")}</dt>
            <dd>{__i18n_display(money(b.payrollBudget))}</dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.newGame.newGame.71274c51")}</dt>
            <dd>
              {__i18n_display(money(b.entryFee))} · {__i18n_display(money(b.developmentFund))}
            </dd>
          </div>
        </dl>
        <details class="risks" open>
          <summary>{__i18n_t("ui.newGame.newGame.9404ca30")}</summary>
          <ul>
            {__i18n_display(foundingRisks(settings).map((line) => (
              <li key={line}>{__i18n_display(line)}</li>
            )))}
          </ul>
        </details>
        <p class="muted">{__i18n_t("ui.newGame.newGame.603e6670")}</p>
        {__i18n_display(problems.length > 0 && <p class="notice">{__i18n_display(problems[0])}</p>)}
        <div class="actions">
          <button type="button" class="primary" disabled={problems.length > 0 || !!busy} onClick={() => onFound({ ...settings, name: name.trim(), short: short.trim(), parentName: parentName.trim() }, seed.trim() || initialSeed)}>{__i18n_t("ui.newGame.newGame.ab1bc6c2")}</button>
          <button type="button" class="link" disabled={!!busy} onClick={() => onSpectate(seed.trim() || initialSeed)}>{__i18n_t("ui.newGame.newGame.8a735d17")}</button>
        </div>
        {__i18n_display(busy && (
          <p class="status" role="status">
            {__i18n_display(busy)}
          </p>
        ))}
      </section>
    </main>
  );
}
