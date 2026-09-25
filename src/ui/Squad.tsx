/* A club's players, one squad at a time (1군 / 퓨처스 / 잔류군 / 군 복무), pitchers and hitters in
   separate tables with the numbers that matter for each. Every heading sorts. The user's club adds a
   column of move buttons. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { usd } from '../league/foreign';
import type { LeagueState } from '../league/state';
import { rates, rosterView } from '../league/views';
import { money } from './format';
import { positionKey, useSort } from './sort';

export type Row = ReturnType<typeof rosterView>['active'][number];
export type SquadKey = 'active' | 'futures' | 'third' | 'military';

const SQUADS: { key: SquadKey; label: string; note?: string }[] = [
  { key: 'active', label: '1군' },
  { key: 'futures', label: '퓨처스' },
  { key: 'third', label: '잔류군', note: '퓨처스 경기에 나가지 않고 재활·훈련하는 선수들입니다. 경기에 나가는 것만큼은 아니지만 훈련한 시간도 성장에 반영됩니다.' },
  { key: 'military', label: '군 복무' },
];

const f3 = rates.fmt3;
const salaryText = (r: Row) => (r.usd ? usd(r.usd) : money(r.salary));

function Name({ r, onPlayer }: { r: Row; onPlayer: (id: string) => void }) {
  return (
    <td class="name-cell">
      <button type="button" class="link" onClick={() => onPlayer(r.id)}>
        {r.name}
      </button>
      {r.foreign && <span class="tag">외국인</span>}
      {r.development && <span class="tag">육성</span>}
      {r.injured && <span class="tag warn">부상</span>}
      {r.away && <span class="tag">대표팀</span>}
    </td>
  );
}

function PitcherTable({ rows, onPlayer, actions }: { rows: Row[]; onPlayer: (id: string) => void; actions?: (r: Row) => ComponentChildren }) {
  const p = (r: Row) => r.stats.pit;
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r) => r.name },
      pos: { value: (r) => positionKey(r.pos), first: 1 },
      age: { value: (r) => r.age, first: 1 },
      grade: { value: (r) => r.grade },
      future: { value: (r) => r.future },
      g: { value: (r) => p(r)?.g ?? 0 },
      wl: { value: (r) => (p(r)?.w ?? 0) - (p(r)?.l ?? 0) },
      svh: { value: (r) => (p(r)?.sv ?? 0) + (p(r)?.hld ?? 0) },
      ip: { value: (r) => p(r)?.outs ?? 0 },
      era: { value: (r) => (p(r)?.outs ? rates.era(p(r)!) : 99), first: 1 },
      whip: { value: (r) => (p(r)?.outs ? rates.whip(p(r)!) : 99), first: 1 },
      k: { value: (r) => p(r)?.k ?? 0 },
      salary: { value: (r) => r.salary + r.usd * 0.14 },
    },
    { key: 'pos', dir: 1 },
  );
  if (!rows.length) return null;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table squad-table">
        <thead>
          <tr>
            {th('name', '투수')}
            {th('pos', '보직')}
            {th('age', '나이', true)}
            {th('grade', '현재', true)}
            {th('future', '미래', true)}
            {th('g', '경기', true)}
            {th('wl', '승-패', true)}
            {th('svh', '세/홀', true)}
            {th('ip', '이닝', true)}
            {th('era', 'ERA', true)}
            {th('whip', 'WHIP', true)}
            {th('k', '삼진', true)}
            {th('salary', '연봉', true)}
            {actions && <th class="actions-head">관리</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const x = p(r);
            return (
              <tr key={r.id} class="player-row">
                <Name r={r} onPlayer={onPlayer} />
                <td>
                  {r.pos.replace('투수', '')}
                  {r.starterInPen && <span class="muted"> (선발형)</span>}
                </td>
                <td class="num">{r.age}</td>
                <td class="num">{r.grade}</td>
                <td class="num strong">{r.future}</td>
                <td class="num">{x?.g ?? '-'}</td>
                <td class="num">{x ? `${x.w}-${x.l}` : '-'}</td>
                <td class="num">{x ? `${x.sv}/${x.hld}` : '-'}</td>
                <td class="num">{x ? rates.ip(x.outs) : '-'}</td>
                <td class="num strong">{x?.outs ? rates.era(x).toFixed(2) : '-'}</td>
                <td class="num">{x?.outs ? rates.whip(x).toFixed(2) : '-'}</td>
                <td class="num">{x?.k ?? '-'}</td>
                <td class="num">{salaryText(r)}</td>
                {actions && <td>{actions(r)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HitterTable({ rows, onPlayer, actions }: { rows: Row[]; onPlayer: (id: string) => void; actions?: (r: Row) => ComponentChildren }) {
  const b = (r: Row) => r.stats.bat;
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r) => r.name },
      pos: { value: (r) => positionKey(r.pos), first: 1 },
      age: { value: (r) => r.age, first: 1 },
      grade: { value: (r) => r.grade },
      future: { value: (r) => r.future },
      g: { value: (r) => b(r)?.g ?? 0 },
      avg: { value: (r) => (b(r)?.ab ? rates.avg(b(r)!) : 0) },
      hr: { value: (r) => b(r)?.hr ?? 0 },
      rbi: { value: (r) => b(r)?.rbi ?? 0 },
      sb: { value: (r) => b(r)?.sb ?? 0 },
      ops: { value: (r) => (b(r)?.pa ? rates.ops(b(r)!) : 0) },
      salary: { value: (r) => r.salary + r.usd * 0.14 },
    },
    { key: 'pos', dir: 1 },
  );
  if (!rows.length) return null;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table squad-table">
        <thead>
          <tr>
            {th('name', '야수')}
            {th('pos', '포지션')}
            {th('age', '나이', true)}
            {th('grade', '현재', true)}
            {th('future', '미래', true)}
            {th('g', '경기', true)}
            {th('avg', '타율', true)}
            {th('hr', '홈런', true)}
            {th('rbi', '타점', true)}
            {th('sb', '도루', true)}
            {th('ops', 'OPS', true)}
            {th('salary', '연봉', true)}
            {actions && <th class="actions-head">관리</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const x = b(r);
            return (
              <tr key={r.id} class="player-row">
                <Name r={r} onPlayer={onPlayer} />
                <td>{r.pos}</td>
                <td class="num">{r.age}</td>
                <td class="num">{r.grade}</td>
                <td class="num strong">{r.future}</td>
                <td class="num">{x?.g ?? '-'}</td>
                <td class="num">{x?.ab ? f3(rates.avg(x)) : '-'}</td>
                <td class="num">{x?.hr ?? '-'}</td>
                <td class="num">{x?.rbi ?? '-'}</td>
                <td class="num">{x?.sb ?? '-'}</td>
                <td class="num strong">{x?.pa ? f3(rates.ops(x)) : '-'}</td>
                <td class="num">{salaryText(r)}</td>
                {actions && <td>{actions(r)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The squads of `teamId` behind a segmented control. `actions` gets the squad the row is in. */
export function Squad({
  league,
  teamId,
  onPlayer,
  actions,
  toolbar,
}: {
  league: LeagueState;
  teamId: string;
  onPlayer: (id: string) => void;
  actions?: (squad: SquadKey) => ((r: Row) => ComponentChildren) | undefined;
  toolbar?: ComponentChildren;
}) {
  const roster = rosterView(league, teamId);
  // A club not in the first team yet (the expansion club's first year) opens on its futures squad.
  const [key, setKey] = useState<SquadKey>(roster.active.length ? 'active' : 'futures');
  const rows = roster[key];
  const note = SQUADS.find((x) => x.key === key)?.note;
  const futuresNumbers = key === 'futures' || key === 'third' || key === 'military';
  return (
    <div class="squad">
      <div class="squad-bar">
        <div class="segmented" role="group" aria-label="선수단">
          {SQUADS.map((x) => (
            <button key={x.key} type="button" aria-pressed={key === x.key} onClick={() => setKey(x.key)}>
              {x.label} <span class="count">{roster[x.key].length}</span>
            </button>
          ))}
        </div>
        {toolbar}
      </div>
      {note && <p class="muted">{note}</p>}
      {futuresNumbers && <p class="muted">기록은 올해 퓨처스리그(상무 포함) 성적입니다.</p>}
      {!rows.length && <p class="empty">선수가 없습니다.</p>}
      <PitcherTable rows={rows.filter((r) => r.pitcher)} onPlayer={onPlayer} actions={actions?.(key)} />
      <HitterTable rows={rows.filter((r) => !r.pitcher)} onPlayer={onPlayer} actions={actions?.(key)} />
    </div>
  );
}
