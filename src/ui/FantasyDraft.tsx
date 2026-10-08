/* 판타지 드래프트의 지명판 (1.6.0): the whole league on the board, our scouts' order first, with where each played,
   his pay next season and how many years he is signed for. */
import { useMemo, useState } from 'preact/hooks';
import { fantasyBoard, fantasyKinds, fantasyPay, fantasyRound, fantasyTeamAt, type FantasyDraft } from '../league/fantasy';
import { salaryIn } from '../league/contracts';
import { ageIn } from '../league/players';
import type { LeagueState } from '../league/state';
import { positionLabel, shortName } from '../league/views';
import type { PlayerId } from '../model/types';
import { money } from './format';
import { gradeClass } from './grades';
import { positionKey, useSort } from './sort';

const KINDS: [string, string][] = [
  ['all', '전체'],
  ['SP', '선발'],
  ['RP', '불펜'],
  ['C', '포수'],
  ['IF', '내야'],
  ['OF', '외야'],
  ['rookie', '신인'],
];
const KIND_TARGET: Record<string, number> = { SP: 13, RP: 15, C: 5, IF: 12, OF: 10 };

export function FantasyBoard({ league, onPlayer, onPick }: { league: LeagueState; onPlayer: (id: PlayerId) => void; onPick: (id: PlayerId) => void }) {
  const f = league.offseason!.fantasy as FantasyDraft;
  const u = league.user!;
  const next = f.year + 1;
  const [kind, setKind] = useState('all');
  const board = useMemo(() => fantasyBoard(league, f, 400), [f.next]);
  const rows = useMemo(() => board.filter((x) => kind === 'all' || (kind === 'rookie' ? !x.from : x.kind === kind)).slice(0, 150), [board, kind]);
  const years = (id: PlayerId) => (league.players[id]!.contract?.salaries ?? []).filter((x) => x.season >= next).length;
  const { sorted, th } = useSort(rows, {
    score: { value: (x) => x.score },
    name: { value: (x) => x.p.name },
    pos: { value: (x) => positionKey(positionLabel(x.p)), first: 1 },
    age: { value: (x) => ageIn(x.p, next), first: 1 },
    from: { value: (x) => (x.from ? shortName(league, x.from) : '~'), first: 1 },
    current: { value: (x) => x.p.scouting.current },
    future: { value: (x) => x.p.scouting.futureValue },
    pay: { value: (x) => salaryIn(x.p, next) },
    years: { value: (x) => years(x.p.id) },
  });
  const counts = fantasyKinds(league);
  const ours = f.picks.filter((x) => x.teamId === u.teamId);
  // Who picks before our next turn after this one (the snake turns at the ends).
  let until = 0;
  for (let i = f.next + 1; i < f.order.length * f.rounds && fantasyTeamAt(f, i) !== u.teamId; i++) until++;
  return (
    <>
      <p>
        {fantasyRound(f)}라운드 / {f.rounds}라운드 · 전체 {f.next + 1}번째 지명. 남은 선수 {f.pool.length}명. 이번 지명 뒤 다른 구단이 {until}명을 먼저 뽑습니다.
      </p>
      <p class="muted small">
        지명 순서(추첨, 짝수 라운드는 거꾸로): {f.order.map((id) => shortName(league, id)).join(' → ')}
      </p>
      <dl class="facts compact">
        {(['SP', 'RP', 'C', 'IF', 'OF'] as const).map((k) => (
          <div key={k}>
            <dt>{KINDS.find((x) => x[0] === k)![1]}</dt>
            <dd class={(counts[k] ?? 0) < KIND_TARGET[k]! / 2 ? 'warn' : undefined}>
              {counts[k] ?? 0} / {KIND_TARGET[k]}
            </dd>
          </div>
        ))}
        <div>
          <dt>{next} 연봉 합계</dt>
          <dd>
            {money(fantasyPay(league, f))} / 예산 {money(u.payrollBudget)}
          </dd>
        </div>
      </dl>
      {ours.length > 0 && (
        <p class="muted small">
          지명한 선수 {ours.length}명: {ours.slice(-8).map((x) => league.players[x.id]?.name ?? '').join(', ')}
          {ours.length > 8 ? ' …' : ''}
        </p>
      )}
      <div class="segmented" role="group" aria-label="포지션">
        {KINDS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <p class="muted small">"평가"는 스카우트의 순위 기준: 공개 등급(젊은 선수는 미래 등급을 섞음)에 우리 구단에 모자란 포지션, 나이, 샐러리캡을 넘는 연봉을 따집니다. 제목을 누르면 정렬됩니다.</p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table pick-table">
          <thead>
            <tr>
              {th('score', '평가', true)}
              {th('name', '이름')}
              {th('pos', '포지션')}
              {th('age', '나이', true)}
              {th('from', '전 소속')}
              {th('current', '현재', true)}
              {th('future', '미래', true)}
              {th('pay', `${next} 연봉`, true)}
              {th('years', '계약', true)}
              <th aria-label="지명" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((x) => (
              <tr key={x.p.id} class="player-row">
                <td class="num">{Math.round(x.score)}</td>
                <td>
                  <button type="button" class="link" onClick={() => onPlayer(x.p.id)}>
                    {x.p.name}
                  </button>
                  {!x.from && <span class="tag">신인</span>}
                </td>
                <td>{positionLabel(x.p)}</td>
                <td class="num">{ageIn(x.p, next)}</td>
                <td class="muted">{x.from ? shortName(league, x.from) : x.p.origin.pathway}</td>
                <td class={`num ${gradeClass(x.p.scouting.current)}`}>{x.p.scouting.current}</td>
                <td class={`num strong ${gradeClass(x.p.scouting.futureValue)}`}>{x.p.scouting.futureValue}</td>
                <td class="num">{x.from ? money(salaryIn(x.p, next)) : '신인 계약'}</td>
                <td class="num">{x.from ? `${years(x.p.id)}년` : '-'}</td>
                <td>
                  <button type="button" class="pick" onClick={() => onPick(x.p.id)}>
                    지명
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
