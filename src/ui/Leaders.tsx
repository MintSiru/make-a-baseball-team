import { useState } from 'preact/hooks';
import type { LeagueState } from '../league/state';
import { leaders, rates, seasonStats } from '../league/views';
import { positionKey, useSort } from './sort';

type View = 'leaders' | 'batters' | 'pitchers';
const f3 = rates.fmt3;
const f2 = (x: number) => x.toFixed(2);

export function Leaders({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const [view, setView] = useState<View>('leaders');
  const [qualifiedOnly, setQualifiedOnly] = useState(true);
  const data = leaders(league);
  const block = (title: string, rows: { id: string; name: string; team: string; value: string }[]) => (
    <div class="leader-block" key={title}>
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p class="muted">기록 없음</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                {r.name}
              </button>{' '}
              <span class="muted">{r.team}</span>
              <span class="num leader-value">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
  return (
    <section aria-labelledby="leaders-title">
      <h2 id="leaders-title">{league.year} 기록</h2>
      <div class="segmented" role="group" aria-label="보기">
        {(
          [
            ['leaders', '부문별 순위'],
            ['batters', '타자 전체'],
            ['pitchers', '투수 전체'],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      <p class="muted">
        비율 기록은 규정타석 {data.qualifying.pa}타석, 규정이닝 {data.qualifying.innings}이닝 이상. 제목을 누르면 정렬됩니다.
      </p>
      {view === 'leaders' && (
        <>
          <h3>타자</h3>
          <div class="leader-grid">{data.batting.map((c) => block(c.title, c.rows))}</div>
          <h3>투수</h3>
          <div class="leader-grid">{data.pitching.map((c) => block(c.title, c.rows))}</div>
        </>
      )}
      {view !== 'leaders' && (
        <label class="check">
          <input type="checkbox" checked={qualifiedOnly} onChange={() => setQualifiedOnly(!qualifiedOnly)} /> 규정 {view === 'batters' ? '타석' : '이닝'} 채운 선수만
        </label>
      )}
      {view === 'batters' && <BatterTable league={league} onPlayer={onPlayer} qualifiedOnly={qualifiedOnly} />}
      {view === 'pitchers' && <PitcherTable league={league} onPlayer={onPlayer} qualifiedOnly={qualifiedOnly} />}
    </section>
  );
}

type Stats = ReturnType<typeof seasonStats>;

function BatterTable({ league, onPlayer, qualifiedOnly }: { league: LeagueState; onPlayer: (id: string) => void; qualifiedOnly: boolean }) {
  const rows = seasonStats(league).batters.filter((r) => !qualifiedOnly || r.qualified);
  type R = Stats['batters'][number];
  const col = (k: keyof R) => ({ value: (r: R) => r[k] as number });
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r: R) => r.name },
      team: { value: (r: R) => r.team },
      pos: { value: (r: R) => positionKey(r.pos), first: 1 },
      g: col('g'), pa: col('pa'), avg: col('avg'), obp: col('obp'), slg: col('slg'), ops: col('ops'), hr: col('hr'), rbi: col('rbi'), r: col('r'), sb: col('sb'), bb: col('bb'), k: col('k'), babip: col('babip'), wrc: col('wrc'), war: col('war'),
    },
    { key: 'ops', dir: -1 },
  );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table stats-table">
        <thead>
          <tr>
            {th('name', '이름')}
            {th('team', '구단')}
            {th('pos', '포지션')}
            {th('g', '경기', true)}
            {th('pa', '타석', true)}
            {th('avg', '타율', true)}
            {th('obp', '출루율', true)}
            {th('slg', '장타율', true)}
            {th('ops', 'OPS', true)}
            {th('hr', '홈런', true)}
            {th('rbi', '타점', true)}
            {th('r', '득점', true)}
            {th('sb', '도루', true)}
            {th('bb', '볼넷', true)}
            {th('k', '삼진', true)}
            {th('babip', 'BABIP', true)}
            {th('wrc', 'wRC+', true)}
            {th('war', 'WAR', true)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} class="player-row">
              <td>
                <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                  {r.name}
                </button>
              </td>
              <td>{r.team}</td>
              <td>{r.pos}</td>
              <td class="num">{r.g}</td>
              <td class="num">{r.pa}</td>
              <td class="num">{f3(r.avg)}</td>
              <td class="num">{f3(r.obp)}</td>
              <td class="num">{f3(r.slg)}</td>
              <td class="num strong">{f3(r.ops)}</td>
              <td class="num">{r.hr}</td>
              <td class="num">{r.rbi}</td>
              <td class="num">{r.r}</td>
              <td class="num">{r.sb}</td>
              <td class="num">{r.bb}</td>
              <td class="num">{r.k}</td>
              <td class="num">{f3(r.babip)}</td>
              <td class="num">{r.wrc}</td>
              <td class="num">{r.war.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sorted.length && <p class="muted">아직 기록이 없습니다.</p>}
    </div>
  );
}

function PitcherTable({ league, onPlayer, qualifiedOnly }: { league: LeagueState; onPlayer: (id: string) => void; qualifiedOnly: boolean }) {
  const rows = seasonStats(league).pitchers.filter((r) => !qualifiedOnly || r.qualified);
  type R = Stats['pitchers'][number];
  const col = (k: keyof R, first?: 1 | -1) => ({ value: (r: R) => r[k] as number, first });
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r: R) => r.name },
      team: { value: (r: R) => r.team },
      g: col('g'), gs: col('gs'), w: col('w'), l: col('l'), sv: col('sv'), hld: col('hld'), outs: col('outs'), era: col('era', 1), whip: col('whip', 1), fip: col('fip', 1), k: col('k'), bb: col('bb'), k9: col('k9'), bb9: col('bb9', 1), babip: col('babip', 1), war: col('war'),
    },
    { key: 'era', dir: 1 },
  );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table stats-table">
        <thead>
          <tr>
            {th('name', '이름')}
            {th('team', '구단')}
            {th('g', '경기', true)}
            {th('gs', '선발', true)}
            {th('w', '승', true)}
            {th('l', '패', true)}
            {th('sv', '세', true)}
            {th('hld', '홀', true)}
            {th('outs', '이닝', true)}
            {th('era', 'ERA', true)}
            {th('whip', 'WHIP', true)}
            {th('fip', 'FIP', true)}
            {th('k', '삼진', true)}
            {th('bb', '볼넷', true)}
            {th('k9', 'K/9', true)}
            {th('bb9', 'BB/9', true)}
            {th('babip', 'BABIP', true)}
            {th('war', 'WAR', true)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} class="player-row">
              <td>
                <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                  {r.name}
                </button>
              </td>
              <td>{r.team}</td>
              <td class="num">{r.g}</td>
              <td class="num">{r.gs}</td>
              <td class="num">{r.w}</td>
              <td class="num">{r.l}</td>
              <td class="num">{r.sv}</td>
              <td class="num">{r.hld}</td>
              <td class="num">{rates.ip(r.outs)}</td>
              <td class="num strong">{f2(r.era)}</td>
              <td class="num">{f2(r.whip)}</td>
              <td class="num">{f2(r.fip)}</td>
              <td class="num">{r.k}</td>
              <td class="num">{r.bb}</td>
              <td class="num">{r.k9.toFixed(1)}</td>
              <td class="num">{r.bb9.toFixed(1)}</td>
              <td class="num">{f3(r.babip)}</td>
              <td class="num">{r.war.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sorted.length && <p class="muted">아직 기록이 없습니다.</p>}
    </div>
  );
}
