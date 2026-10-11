import { display as __i18n_display, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* The twelfth club in the screens (V0.9): the setting (new game and the front office), the founding form, and
   the rivalry at a glance. */
import { cityById } from '../club/cities';
import { PARENT_COMPANY_TYPES, type ParentCompanyType } from '../club/types';
import { rivalCities, rivalTeam } from '../league/rival';
import { allTime } from '../league/rivalry';
import { MANAGER_STYLES } from '../league/staff';
import type { GmStyle, LeagueFormat, LeagueState, ManagerStyle, RivalSettings, TwelveSetting } from '../league/state';
import { GM_STYLES, LEAGUE_NAMES, seasonSeries } from '../league/twelve';

const MODES: [TwelveSetting['mode'], string, string][] = [
  ['off', __i18n_k("ui.twelve.mODES.d58fa73a"), __i18n_k("ui.twelve.mODES.4c6c6e01")],
  ['year', __i18n_k("ui.twelve.mODES.353cea95"), __i18n_k("ui.twelve.mODES.5bbed0e3")],
  ['event', __i18n_k("ui.twelve.mODES.5f44e5ea"), __i18n_k("ui.twelve.mODES.5423d96f")],
];

/** The twelfth-club setting: off, a founding winter, or the board's offer. `from`: the earliest founding winter. */
export function TwelveSettingField({ value, from, onChange }: { value: TwelveSetting; from: number; onChange: (v: TwelveSetting) => void }) {
  const years = Array.from({ length: 14 }, (_, i) => from + i);
  const year = value.year ?? from + 2;
  return (
    <div class="twelve-setting">
      <div class="segmented" role="group" aria-label={__i18n_t("ui.twelve.twelveSettingField.427e4250")}>
        {__i18n_display(MODES.map(([mode, label]) => (
          <button key={mode} type="button" aria-pressed={value.mode === mode} onClick={() => onChange(mode === 'year' ? { mode, year } : { mode })}>
            {__i18n_display(label)}
          </button>
        )))}
      </div>
      {__i18n_display(value.mode === 'year' && (
        <label class="inline-field">
          창단 연도
          <select value={year} onChange={(e) => onChange({ mode: 'year', year: Number((e.currentTarget as HTMLSelectElement).value) })}>
            {__i18n_display(years.map((y) => (
              <option key={y} value={y}>{__i18n_t("ui.twelve.twelveSettingField.f3cd0a96", { y: y, value: y + 1, value2: y + 2 })}</option>
            )))}
          </select>
        </label>
      ))}
      <p class="muted small">
        {__i18n_display(MODES.find((m) => m[0] === value.mode)![2])}{__i18n_display(' ')}
        {__i18n_display(value.mode !== 'off' &&
          __i18n_k("ui.twelve.twelveSettingField.6a38406e"))}
      </p>
    </div>
  );
}

/** The founding form: everything the player decides about the rival. */
export function RivalForm({ league, value, onChange }: { league: LeagueState; value: RivalSettings; onChange: (v: RivalSettings) => void }) {
  const set = <K extends keyof RivalSettings>(k: K, v: RivalSettings[K]) => onChange({ ...value, [k]: v });
  const city = cityById(value.cityId);
  return (
    <div class="rival-form">
      <div class="fields">
        <label>
          구단명
          <input value={value.name} maxLength={12} onInput={(e) => set('name', (e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label>
          약칭
          <input value={value.short} maxLength={4} onInput={(e) => set('short', (e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label>
          구단 색 <input type="color" value={value.color} onInput={(e) => set('color', (e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <label class="wide">
        연고지
        <select value={value.cityId} onChange={(e) => set('cityId', (e.currentTarget as HTMLSelectElement).value)}>
          {__i18n_display(rivalCities(league).map((c) => (
            <option key={c.id} value={c.id}>{__i18n_t("ui.twelve.rivalForm.80f89e99", { name: c.name, market: c.market, name2: c.stadium.name, value: c.stadium.seats.toLocaleString('ko-KR') })}</option>
          )))}
        </select>
      </label>
      {__i18n_display(city && <p class="muted small">{__i18n_t("ui.twelve.rivalForm.d3e22d94", { competition: city.competition })}</p>)}
      <div class="fields">
        <label>
          모기업 형태
          <select value={value.parentType} onChange={(e) => set('parentType', (e.currentTarget as HTMLSelectElement).value as ParentCompanyType)}>
            {__i18n_display((Object.keys(PARENT_COMPANY_TYPES) as ParentCompanyType[]).map((t) => (
              <option key={t} value={t}>
                {__i18n_display(PARENT_COMPANY_TYPES[t].label)}
              </option>
            )))}
          </select>
        </label>
        <label>
          {__i18n_display(value.parentType === 'citizen' ? __i18n_k("ui.twelve.rivalForm.607afb0c") : value.parentType === 'namingRights' ? __i18n_k("ui.twelve.rivalForm.47ed7893") : __i18n_k("ui.twelve.rivalForm.cf76b767"))} 이름
          <input value={value.parentName} maxLength={20} onInput={(e) => set('parentName', (e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <fieldset class="choice-set">
        <legend>{__i18n_t("ui.twelve.rivalForm.f6c378d3")}</legend>
        <div class="choice-grid">
          {__i18n_display((Object.keys(GM_STYLES) as GmStyle[]).map((g) => (
            <button key={g} type="button" class="choice" aria-pressed={value.gm === g} onClick={() => set('gm', g)}>
              <strong>{__i18n_display(GM_STYLES[g].label)}</strong>
              <span class="muted">{__i18n_display(GM_STYLES[g].note)}</span>
            </button>
          )))}
        </div>
      </fieldset>
      <fieldset class="choice-set">
        <legend>{__i18n_t("ui.twelve.rivalForm.dc4bfb44")}</legend>
        <div class="choice-grid">
          {__i18n_display((Object.keys(MANAGER_STYLES) as ManagerStyle[]).map((m) => (
            <button key={m} type="button" class="choice" aria-pressed={value.manager === m} onClick={() => set('manager', m)}>
              <strong>{__i18n_display(MANAGER_STYLES[m].label)}</strong>
              <span class="muted">{__i18n_display(MANAGER_STYLES[m].note)}</span>
            </button>
          )))}
        </div>
      </fieldset>
      <fieldset class="choice-set">
        <legend>{__i18n_t("ui.twelve.rivalForm.cce80683")}</legend>
        <div class="choice-grid">
          {__i18n_display((
            [
              ['single', __i18n_k("ui.twelve.rivalForm.94667733"), __i18n_k("ui.twelve.rivalForm.3ab39516")],
              [
                'two',
                __i18n_k("ui.twelve.rivalForm.a2308b8c"),
                __i18n_k("ui.twelve.rivalForm.110c161b"),
              ],
            ] as [LeagueFormat, string, string][]
          ).map(([f, label, note]) => (
            <button key={f} type="button" class="choice" aria-pressed={value.format === f} onClick={() => set('format', f)}>
              <strong>{__i18n_display(label)}</strong>
              <span class="muted">{__i18n_display(note)}</span>
            </button>
          )))}
        </div>
      </fieldset>
    </div>
  );
}

/** The rival and the rivalry's record, for the front office. */
export function RivalryBox({ league }: { league: LeagueState }) {
  const tw = league.twelve;
  const team = rivalTeam(league);
  if (!tw || !team) return null;
  const now = seasonSeries(league);
  const total = allTime(league);
  const played = league.phase !== 'offseason' && now.w + now.l + now.t > 0;
  const side = tw.leagues && league.user ? tw.leagues[league.user.teamId] : undefined;
  return (
    <div class="rivalry-box">
      <p>{__i18n_rich("ui.twelve.rivalryBox.8f237969", { value: <span class="swatch" style={{ background: team.color }} aria-hidden="true" />, value2: <strong>{__i18n_display(team.name)}</strong>, region: team.region, name: team.parent.name, label: GM_STYLES[tw.gm].label, value3: ' ', label2: MANAGER_STYLES[tw.manager].label })}</p>
      <p class="muted">{__i18n_t("ui.twelve.rivalryBox.dff71c74", { founded: tw.founded, firstTeam: tw.firstTeam, value: tw.format === 'two' ? __i18n_k("ui.twelve.rivalryBox.8e1ac6e9", { value: side ? __i18n_k("ui.twelve.rivalryBox.5aac59f8", { value: LEAGUE_NAMES[side] }) : '' }) : __i18n_k("ui.twelve.rivalryBox.94667733") })}</p>
      {__i18n_display(played && (
        <p>{__i18n_rich("ui.twelve.rivalryBox.b9749b8e", { value: ' ', value2: <strong>{__i18n_t("ui.twelve.rivalryBox.eae1f95b", { w: now.w, l: now.l, value: now.t ? __i18n_k("ui.twelve.rivalryBox.136ac74d", { value: now.t }) : '' })}</strong> })}</p>
      ))}
      {__i18n_display(total.seasons > 0 && (
        <p>{__i18n_t("ui.twelve.rivalryBox.3094639b", { seasons: total.seasons, w: total.w, l: total.l, value: total.t ? __i18n_k("ui.twelve.rivalryBox.136ac74d", { value: total.t }) : '' })}</p>
      ))}
      {__i18n_display(tw.picks && tw.picks.length > 0 && <p class="muted small">{__i18n_t("ui.twelve.rivalryBox.282e66d3", { value: tw.picks.map((x) => `${league.teams.find((t) => t.id === x.from)?.short ?? x.from} ${x.name}`).join(', ') })}</p>)}
    </div>
  );
}
