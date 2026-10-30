/* 2.0.62 (the user's mockups, 새 UI): founding a club on one sheet — the way to play on top (a free club, a scenario,
   or the league alone), the choices down the left with their name in the margin, each option showing what it means
   in numbers and bars, and the application on the right adding up the money as the choices change. */
import { useState } from 'preact/hooks';
import { k as __i18n_k, t as __i18n_t } from '../../i18n/index';
import { PARENT_COMPANY_TYPES, type ParentCompanyType } from '../../club/types';
import { budgetFor, foundingRisks, STADIUM_PLANS } from '../../league/expansion';
import { medalConditions, SCENARIOS, type ScenarioId } from '../../league/scenarios';
import { PARENT } from '../../league/tuning';
import type { Difficulty, ExpansionSettings } from '../../league/state';
import { CLEAR_MARK } from '../clears';
import { accentStyle } from '../display';
import { money } from '../format';
import { Help } from '../Help';
import { COLORS, recommended, TAKEN, type FoundingForm } from '../NewGame';
import { DIFFICULTY_LABEL, DIFFICULTY_NOTE } from '../Settings';
import { TwelveSettingField } from '../Twelve';

type Stadium = ExpansionSettings['stadium'];

function Row({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <section class="ng-row" aria-label={label}>
      <h3 class="ng-label">{label}</h3>
      <div class="ng-field">{children}</div>
    </section>
  );
}

/** A bar of `v` against `max`. */
const Bar = ({ v, max }: { v: number; max: number }) => (
  <span class="ng-bar" aria-hidden="true">
    <i style={{ width: `${Math.round(Math.max(0, Math.min(1, v / Math.max(1, max))) * 100)}%` }} />
  </span>
);

export function NextNewGame({
  f,
  initialSeed,
  busy,
  onFound,
  onSpectate,
}: {
  f: FoundingForm;
  initialSeed: string;
  busy: string | null;
  onFound: (settings: ExpansionSettings, seed: string) => void;
  onSpectate: (seed: string) => void;
}) {
  const { def, locked, city, y0 } = f;
  const [mode, setMode] = useState<'free' | 'scenario'>(def && !def.free ? 'scenario' : 'free');
  const [homes, setHomes] = useState<'new' | 'shared'>(f.shared.some((c) => c.id === f.cityId) ? 'shared' : 'new');
  const eras = SCENARIOS.filter((x) => x.free);
  const goals = SCENARIOS.filter((x) => !x.free);
  const seed = f.seed.trim() || initialSeed;
  // An empty name takes the one shown in its place: the sheet is complete as it opens.
  const rec = recommended(city.id, city.name, f.color, f.name, f.short, f.parentName);
  const name = f.name.trim() || rec.name;
  const short = f.short.trim() || rec.short;
  const parentName = f.parentName.trim() || (f.parentType === 'citizen' ? __i18n_k("ui.newGame.newGame.7afbb51f", { name: city.name }) : rec.parentName);
  const settings: ExpansionSettings = { ...f.settings, name, short, parentName };
  const b = budgetFor(settings);
  const problems = [name.length > 12 && __i18n_k("ui.newGame.newGame.problems.a750915c"), short.length > 4 && __i18n_k("ui.newGame.newGame.problems.5354cd82"), TAKEN.includes(short) && __i18n_k("ui.newGame.newGame.problems.45ec712a")].filter(Boolean) as string[];
  const parentTypes = Object.keys(PARENT_COMPANY_TYPES) as ParentCompanyType[];
  const money3 = parentTypes.map((t) => ({ t, b: budgetFor({ ...settings, parentType: t }), support: PARENT.support[t] }));
  const maxFund = Math.max(...money3.map((x) => x.b.fund)),
    maxPay = Math.max(...money3.map((x) => x.b.payrollBudget)),
    maxSupport = Math.max(...money3.map((x) => x.support));
  const list = homes === 'shared' ? f.shared : f.cities;
  const maxPop = Math.max(...[...f.cities, ...f.shared].map((c) => c.population));
  const parentNow = def?.legacy && f.parentType === 'namingRights' ? 'conglomerate' : f.parentType;
  const left = b.fund - b.entryFee - b.developmentFund;
  const eraYear = (era: number | undefined) => 2026 + (era ?? 0);
  const pick = (id: ScenarioId | null) => f.pickScenario(id);
  return (
    <main class="page new-game next-new" style={accentStyle(f.color, f.dark)}>
      <h2 class="ng-title">{def?.north ? __i18n_t("ui.newGame.text.226e8bb5", { y0 }) : __i18n_t("ui.newGame.newGame.f0854faa", { y0 })}</h2>

      <div class="mode-cards" role="radiogroup" aria-label={__i18n_t("ui.next.newGame.text.a52b898e")}>
        <button type="button" role="radio" class="mode-card" aria-checked={mode === 'free'} onClick={() => (setMode('free'), def && !def.free && pick(null))}>
          <strong>{__i18n_t("ui.next.newGame.text.1d4597df")}</strong>
          <span class="chips">
            <span>2026</span>
            {eras.map((x) => (
              <span key={x.id}>{x.north ? __i18n_t("ui.next.newGame.text.098a6d9a") : eraYear(x.era)}</span>
            ))}
          </span>
        </button>
        <button type="button" role="radio" class="mode-card" aria-checked={mode === 'scenario'} onClick={() => (setMode('scenario'), (!def || def.free) && pick(goals[0]!.id))}>
          <strong>{__i18n_t("ui.next.newGame.text.4ca5847f")}</strong>
          <span class="chips">
            <span>{__i18n_t("ui.next.newGame.text.ee149165", { n: goals.length })}</span>
            <span>{__i18n_t("ui.next.newGame.text.9705e8f9")}</span>
          </span>
        </button>
        <button type="button" class="mode-card" disabled={!!busy} onClick={() => onSpectate(seed)}>
          <strong>{__i18n_t("ui.next.newGame.text.db98581b")}</strong>
          <span class="chips">
            <span>{__i18n_t("ui.next.newGame.text.1a9d93ef")}</span>
          </span>
        </button>
      </div>

      <div class="ng-layout">
        <div class="ng-form">
          {mode === 'free' ? (
            <Row label={__i18n_t("ui.next.newGame.text.4b8b4a20")}>
              <div class="chip-row" role="radiogroup" aria-label={__i18n_t("ui.next.newGame.text.4b8b4a20")}>
                <button type="button" role="radio" class="chip-btn" aria-checked={!def} onClick={() => pick(null)}>
                  {__i18n_t("ui.next.newGame.text.29397734")}
                </button>
                {eras.map((x) => (
                  <button key={x.id} type="button" role="radio" class="chip-btn" aria-checked={def?.id === x.id} onClick={() => pick(x.id)}>
                    {x.north ? x.title : `${eraYear(x.era)} · ${x.title}`}
                  </button>
                ))}
              </div>
            </Row>
          ) : (
            <Row label={__i18n_t("ui.next.newGame.text.4ca5847f")}>
              <div class="scen-grid" role="radiogroup" aria-label={__i18n_t("ui.next.newGame.text.4ca5847f")}>
                {goals.map((x) => (
                  <button key={x.id} type="button" role="radio" class="pick-card" aria-checked={def?.id === x.id} onClick={() => pick(x.id)}>
                    <strong>
                      {x.title}
                      {f.clears[x.id] && <span class="clear-mark"> {CLEAR_MARK[f.clears[x.id]!]}</span>}
                    </strong>
                    <span class="muted small">{x.tagline}</span>
                    <span class="stars" aria-label={__i18n_k("ui.newGame.newGame.2eae7ab4", { stars: x.stars })}>
                      {'★'.repeat(x.stars)}
                      <span class="off">{'★'.repeat(5 - x.stars)}</span>
                    </span>
                  </button>
                ))}
              </div>
              {def && !def.free && (
                <div class="scenario-brief">
                  {def.story.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <p>
                    <span class="stamp info">{__i18n_t("ui.next.newGame.text.2fbea43b")}</span> {def.goal}
                  </p>
                  {medalConditions(def).length > 0 && (
                    <ul class="medal-list">
                      {medalConditions(def).map((text, i) => (
                        <li key={i}>
                          {['🥇', '🥈', '🥉'][i]} {text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Row>
          )}

          <Row label={__i18n_t("ui.next.newGame.text.58756112")}>
            <div class="ng-names">
              <label>
                <span>{__i18n_t("ui.next.newGame.text.3417788b")}</span>
                <input value={f.name} maxLength={12} disabled={locked.has('name')} placeholder={rec.name} onInput={(e) => f.setName((e.currentTarget as HTMLInputElement).value)} />
              </label>
              <label class="short">
                <span>{__i18n_t("ui.next.newGame.text.7d2842b0")}</span>
                <input value={f.short} maxLength={4} disabled={locked.has('short')} placeholder={rec.short} onInput={(e) => f.setShort((e.currentTarget as HTMLInputElement).value)} />
              </label>
              <div class="dots" role="radiogroup" aria-label={__i18n_t("ui.newGame.newGame.4b828e65")}>
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === f.color} aria-label={c} class="dot" style={{ background: c }} disabled={locked.has('color')} onClick={() => f.setColor(c)} />
                ))}
                <label class="dot custom" style={{ background: COLORS.includes(f.color) ? undefined : f.color }} title={__i18n_t("ui.next.newGame.text.d12a906a")}>
                  <input type="color" value={f.color} disabled={locked.has('color')} aria-label={__i18n_t("ui.next.newGame.text.d12a906a")} onInput={(e) => f.setColor((e.currentTarget as HTMLInputElement).value)} />
                </label>
              </div>
            </div>
          </Row>

          <Row label={__i18n_t("ui.next.newGame.text.e9211ac8")}>
            {f.shared.length > 0 && (
              <div class="quiet-tabs" role="tablist" aria-label={__i18n_t("ui.next.newGame.text.e9211ac8")}>
                <button type="button" role="tab" aria-selected={homes === 'new'} onClick={() => setHomes('new')}>
                  {__i18n_t("ui.next.newGame.text.7f999d65")} <span class="num">{f.cities.length}</span>
                </button>
                <button type="button" role="tab" aria-selected={homes === 'shared'} onClick={() => setHomes('shared')}>
                  {__i18n_t("ui.next.newGame.text.2d71cd31")} <span class="num">{f.shared.length}</span>
                </button>
              </div>
            )}
            <div class="city-grid">
              {list.map((c) => (
                <button key={c.id} type="button" class="pick-card city" aria-pressed={c.id === f.cityId} disabled={locked.has('cityId')} onClick={() => f.setCityId(c.id)} title={`${c.competition}. ${c.note}`}>
                  <strong>{c.name}</strong>
                  <Bar v={c.population} max={maxPop} />
                  <span class="city-facts">
                    <span>{__i18n_t("ui.next.newGame.text.5781354d", { n: Math.round(c.population / 10000) })}</span>
                    <span>
                      {__i18n_t("ui.next.newGame.text.a566fa28", { n: (c.stadium.seats / 1000).toFixed(1) })}
                      {!c.stadium.real && <em class="minus"> {__i18n_t("ui.next.newGame.text.ee33dfee")}</em>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Row>

          <Row label={__i18n_t("ui.next.newGame.text.cf76b767")}>
            <div class="parent-grid">
              {money3.map(({ t, b: m, support }) => (
                <button key={t} type="button" class="pick-card parent" title={PARENT_COMPANY_TYPES[t].summary} aria-pressed={t === parentNow} disabled={(locked.has('parentType') && t !== f.parentType) || (!!def?.legacy && t === 'namingRights')} onClick={() => f.setParentType(t)}>
                  <strong>{PARENT_COMPANY_TYPES[t].label}</strong>
                  <span class="meter">
                    <span>{__i18n_t("ui.next.newGame.text.94b7652e")}</span>
                    <Bar v={m.fund} max={maxFund} />
                  </span>
                  <span class="meter">
                    <span>{__i18n_t("ui.next.newGame.text.cbf383ec")}</span>
                    <Bar v={m.payrollBudget} max={maxPay} />
                  </span>
                  <span class="meter">
                    <span>{__i18n_t("ui.next.newGame.text.3397eb88")}</span>
                    <Bar v={support} max={maxSupport} />
                  </span>
                </button>
              ))}
            </div>
            <label class="ng-underline">
              <span>{f.parentType === 'citizen' ? __i18n_k("ui.newGame.newGame.607afb0c") : f.parentType === 'namingRights' ? __i18n_k("ui.newGame.newGame.47ed7893") : __i18n_k("ui.newGame.newGame.cf76b767")}</span>
              <input value={f.parentName} maxLength={20} disabled={locked.has('parentName')} placeholder={parentName} onInput={(e) => f.setParentName((e.currentTarget as HTMLInputElement).value)} />
            </label>
          </Row>

          <Row label={__i18n_t("ui.next.newGame.text.48bea069")}>
            <div class="timeline-pick" role="radiogroup" aria-label={__i18n_t("ui.next.newGame.text.48bea069")}>
              <button type="button" role="radio" class="timeline" aria-checked={f.promotion === 'afterFutures'} disabled={locked.has('promotion')} onClick={() => f.setPromotion('afterFutures')}>
                <span>
                  <b>{y0}</b> {__i18n_t("ui.next.newGame.text.15d3e44b")}
                </span>
                <span>
                  <b>{y0 + 1}</b> {__i18n_t("ui.next.newGame.text.51439b09")}
                </span>
                <span class="debut">
                  <b>{y0 + 2}</b> {__i18n_t("ui.next.newGame.text.f3290301")}
                </span>
              </button>
              <button type="button" role="radio" class="timeline" aria-checked={f.promotion === 'immediate'} disabled={locked.has('promotion')} onClick={() => f.setPromotion('immediate')}>
                <span>
                  <b>{y0}</b> {__i18n_t("ui.next.newGame.text.51f97e03")}
                </span>
                <span class="debut">
                  <b>{y0 + 1}</b> {__i18n_t("ui.next.newGame.text.f3290301")}
                </span>
                <span class="none">—</span>
              </button>
            </div>
          </Row>

          <Row label={__i18n_t("ui.next.newGame.text.e8ee93fa")}>
            <div class="segmented" role="group" aria-label={__i18n_t("ui.next.newGame.text.e8ee93fa")}>
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                <button key={d} type="button" aria-pressed={f.difficulty === d} disabled={locked.has('difficulty')} title={DIFFICULTY_NOTE[d]} onClick={() => f.setDifficulty(d)}>
                  {DIFFICULTY_LABEL[d]}
                </button>
              ))}
            </div>
          </Row>

          <Row label={__i18n_t("ui.next.newGame.text.5715c57d")}>
            <label class="switch">
              <input type="checkbox" role="switch" checked={f.guide} disabled={locked.has('tutorial')} onChange={(e) => f.setGuide((e.currentTarget as HTMLInputElement).checked)} />
              <span>{__i18n_t("ui.next.newGame.text.40cf6b1c")}</span>
            </label>
            <label class="switch">
              <input type="checkbox" role="switch" checked={f.autoPrep} disabled={locked.has('autoPrep')} onChange={(e) => f.setAutoPrep((e.currentTarget as HTMLInputElement).checked)} />
              <span>{__i18n_t("ui.next.newGame.text.27d292e8")}</span>
            </label>
          </Row>

          <details class="ng-more">
            <summary>{__i18n_t("ui.next.newGame.text.4fcb5176")}</summary>
            <Row label={__i18n_t("ui.newGame.newGame.5b164a3b")}>
              <div class="parent-grid">
                {(Object.keys(STADIUM_PLANS) as Stadium[]).map((k) => (
                  <button key={k} type="button" class="pick-card" aria-pressed={k === f.stadium} onClick={() => f.setStadium(k)}>
                    <strong>{STADIUM_PLANS[k].label}</strong>
                    <span class="muted small">{k === 'existing' ? __i18n_k("ui.newGame.newGame.bae3c0d0", { name: city.stadium.name, value: city.stadium.seats.toLocaleString('ko-KR') }) : __i18n_k("ui.newGame.newGame.67558972", { opens: STADIUM_PLANS[k].opens, name: city.stadium.name })}</span>
                  </button>
                ))}
              </div>
            </Row>
            {!def?.legacy && (
              <Row label={__i18n_t("ui.newGame.newGame.a91a78ef")}>
                <TwelveSettingField value={f.twelveSetting} from={f.twelveFrom} onChange={f.setTwelve} />
              </Row>
            )}
            <Row label={__i18n_t("ui.next.newGame.text.c7c703d5")}>
              <label class="switch">
                <input type="checkbox" role="switch" checked={f.firing} disabled={locked.has('firing')} onChange={(e) => f.setFiring((e.currentTarget as HTMLInputElement).checked)} />
                <span>{__i18n_t("ui.next.newGame.text.5836da78")}</span>
              </label>
              <label class="switch">
                <input type="checkbox" role="switch" checked={f.board ?? (!f.firing || !!def?.legacy)} onChange={(e) => f.setBoard((e.currentTarget as HTMLInputElement).checked)} />
                <span>{__i18n_t("ui.next.newGame.text.03f83ca5")}</span>
              </label>
            </Row>
            <Row label={__i18n_t("ui.next.newGame.text.94277611")}>
              <input class="ng-seed" value={f.seed} spellcheck={false} aria-label={__i18n_t("ui.next.newGame.text.94277611")} onInput={(e) => f.setSeed((e.currentTarget as HTMLInputElement).value)} />
            </Row>
          </details>
        </div>

        <aside class="ng-receipt" aria-labelledby="ng-receipt-name">
          <p class="receipt-kicker">{__i18n_t("ui.next.newGame.text.c8ed7f00", { year: y0 })}</p>
          <h3 id="ng-receipt-name">{name}</h3>
          <dl class="receipt-facts">
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.e9211ac8")}</dt>
              <dd>
                {city.name} · {__i18n_t("ui.next.newGame.text.6c263851", { n: city.stadium.seats.toLocaleString('ko-KR') })}
              </dd>
            </div>
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.cf76b767")}</dt>
              <dd>
                {PARENT_COMPANY_TYPES[parentNow].label} · {parentName}
              </dd>
            </div>
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.48bea069")}</dt>
              <dd>{f.promotion === 'afterFutures' ? __i18n_t("ui.next.newGame.text.8ba1ac8b", { year: y0 + 2 }) : __i18n_t("ui.next.newGame.text.d27597e6", { year: y0 + 1 })}</dd>
            </div>
            {def && (
              <div>
                <dt>{__i18n_t("ui.next.newGame.text.4ca5847f")}</dt>
                <dd>{def.title}</dd>
              </div>
            )}
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.e8ee93fa")}</dt>
              <dd>{DIFFICULTY_LABEL[f.difficulty]}</dd>
            </div>
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.dcac98c1")}</dt>
              <dd>{f.firing ? __i18n_t("ui.next.newGame.text.d657270f") : __i18n_t("ui.next.newGame.text.d58fa73a")}</dd>
            </div>
          </dl>
          <dl class="receipt-money">
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.79595746")}</dt>
              <dd>{money(b.fund)}</dd>
            </div>
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.7b2c5aa8")}</dt>
              <dd>− {money(b.entryFee)}</dd>
            </div>
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.63088f52")}</dt>
              <dd>− {money(b.developmentFund)}</dd>
            </div>
            <div class="total">
              <dt>{__i18n_t("ui.next.newGame.text.c6c82fe6")}</dt>
              <dd class={left < 0 ? 'minus' : undefined}>{money(left)}</dd>
            </div>
            <div>
              <dt>{__i18n_t("ui.next.newGame.text.bf23ebc0")}</dt>
              <dd>{money(b.payrollBudget)}</dd>
            </div>
            <div>
              <dt>
                {__i18n_t("ui.next.newGame.text.ed2c09d1")} <Help title={__i18n_t("ui.newGame.newGame.9404ca30")}><RiskList settings={settings} /></Help>
              </dt>
              <dd class="stars" aria-label={__i18n_k("ui.newGame.newGame.b454ddd9", { stars: f.stars })}>
                {'★'.repeat(f.stars)}
                <span class="off">{'★'.repeat(5 - f.stars)}</span>
              </dd>
            </div>
          </dl>
          <p class="receipt-note">{__i18n_t("ui.next.newGame.text.307b2df9")}</p>
          {problems.length > 0 && <p class="notice">{problems[0]}</p>}
          <button type="button" class="apply" disabled={problems.length > 0 || !!busy} onClick={() => onFound(settings, seed)}>
            {__i18n_t("ui.newGame.newGame.ab1bc6c2")}
          </button>
          {busy && (
            <p class="status" role="status">
              {busy}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function RiskList({ settings }: { settings: ExpansionSettings }) {
  return (
    <ul>
      {foundingRisks(settings).map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
