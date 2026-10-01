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
  ['off', '없음', '11구단 체제로 계속합니다.'],
  ['year', '연도 지정', '정한 해 겨울에 12번째 구단이 창단합니다.'],
  ['event', '창단 제안 이벤트', '1군 3년 차 겨울부터 해마다 KBO 이사회가 12구단 창단을 논의할 수 있고, 반대표를 던질 수도 있습니다.'],
];

/** The twelfth-club setting: off, a founding winter, or the board's offer. `from`: the earliest founding winter. */
export function TwelveSettingField({ value, from, onChange }: { value: TwelveSetting; from: number; onChange: (v: TwelveSetting) => void }) {
  const years = Array.from({ length: 14 }, (_, i) => from + i);
  const year = value.year ?? from + 2;
  return (
    <div class="twelve-setting">
      <div class="segmented" role="group" aria-label="12구단 창단">
        {MODES.map(([mode, label]) => (
          <button key={mode} type="button" aria-pressed={value.mode === mode} onClick={() => onChange(mode === 'year' ? { mode, year } : { mode })}>
            {label}
          </button>
        ))}
      </div>
      {value.mode === 'year' && (
        <label class="inline-field">
          창단 연도
          <select value={year} onChange={(e) => onChange({ mode: 'year', year: Number((e.currentTarget as HTMLSelectElement).value) })}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년 겨울 창단 → {y + 1} 퓨처스 → {y + 2} 1군
              </option>
            ))}
          </select>
        </label>
      )}
      <p class="muted small">
        {MODES.find((m) => m[0] === value.mode)![2]}{' '}
        {value.mode !== 'off' &&
          '창단 때 라이벌 구단의 이름·연고지·모기업·운영 성향·감독 스타일과 리그 방식(단일 리그 또는 드림·매직 양대 리그)을 직접 정하고, 1군 진입 직전 겨울 특별지명에서 우리 구단도 보호선수 20명 밖의 1명을 내줍니다.'}
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
          {rivalCities(league).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · 시장 {c.market} · {c.stadium.name} {c.stadium.seats.toLocaleString('ko-KR')}석
            </option>
          ))}
        </select>
      </label>
      {city && <p class="muted small">{city.competition}. 1군 진입 전까지 지자체가 구장을 1만 2천 석 이상으로 고칩니다 (게임 가정).</p>}
      <div class="fields">
        <label>
          모기업 형태
          <select value={value.parentType} onChange={(e) => set('parentType', (e.currentTarget as HTMLSelectElement).value as ParentCompanyType)}>
            {(Object.keys(PARENT_COMPANY_TYPES) as ParentCompanyType[]).map((t) => (
              <option key={t} value={t}>
                {PARENT_COMPANY_TYPES[t].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {value.parentType === 'citizen' ? '운영 주체' : value.parentType === 'namingRights' ? '메인 스폰서' : '모기업'} 이름
          <input value={value.parentName} maxLength={20} onInput={(e) => set('parentName', (e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <fieldset class="choice-set">
        <legend>단장 성향</legend>
        <div class="choice-grid">
          {(Object.keys(GM_STYLES) as GmStyle[]).map((g) => (
            <button key={g} type="button" class="choice" aria-pressed={value.gm === g} onClick={() => set('gm', g)}>
              <strong>{GM_STYLES[g].label}</strong>
              <span class="muted">{GM_STYLES[g].note}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset class="choice-set">
        <legend>감독 스타일</legend>
        <div class="choice-grid">
          {(Object.keys(MANAGER_STYLES) as ManagerStyle[]).map((m) => (
            <button key={m} type="button" class="choice" aria-pressed={value.manager === m} onClick={() => set('manager', m)}>
              <strong>{MANAGER_STYLES[m].label}</strong>
              <span class="muted">{MANAGER_STYLES[m].note}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset class="choice-set">
        <legend>12구단 리그 방식</legend>
        <div class="choice-grid">
          {(
            [
              ['single', '단일 리그', '12개 구단이 한 리그. 144경기(라이벌 14경기, 나머지 13경기), 지금처럼 5위까지 포스트시즌'],
              [
                'two',
                '양대 리그 (드림·매직)',
                '1999~2000년처럼 6개 구단씩 두 리그. 같은 리그 14경기, 다른 리그 12~13경기. 각 리그 1위가 다른 리그 2위와 플레이오프, 3위가 다른 리그 2위보다 승률이 높으면 준플레이오프',
              ],
            ] as [LeagueFormat, string, string][]
          ).map(([f, label, note]) => (
            <button key={f} type="button" class="choice" aria-pressed={value.format === f} onClick={() => set('format', f)}>
              <strong>{label}</strong>
              <span class="muted">{note}</span>
            </button>
          ))}
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
      <p>
        <span class="swatch" style={{ background: team.color }} aria-hidden="true" /> <strong>{team.name}</strong> · {team.region} · {team.parent.name} · 단장 {GM_STYLES[tw.gm].label} · 감독{' '}
        {MANAGER_STYLES[tw.manager].label}
      </p>
      <p class="muted">
        {tw.founded}년 창단 · {tw.firstTeam}년 1군 진입 · {tw.format === 'two' ? `양대 리그${side ? ` (우리: ${LEAGUE_NAMES[side]})` : ''}` : '단일 리그'}
      </p>
      {played && (
        <p>
          올 시즌 맞대결{' '}
          <strong>
            {now.w}승 {now.l}패{now.t ? ` ${now.t}무` : ''}
          </strong>
        </p>
      )}
      {total.seasons > 0 && (
        <p>
          통산 {total.seasons}시즌 {total.w}승 {total.l}패{total.t ? ` ${total.t}무` : ''}
        </p>
      )}
      {tw.picks && tw.picks.length > 0 && <p class="muted small">특별지명: {tw.picks.map((x) => `${league.teams.find((t) => t.id === x.from)?.short ?? x.from} ${x.name}`).join(', ')}</p>}
    </div>
  );
}
