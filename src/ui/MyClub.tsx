import { useState } from 'preact/hooks';
import { cityById } from '../club/cities';
import type { Action } from '../league/actions';
import { canMove, canRegister } from '../league/entry';
import { firstTeamSize } from '../league/manager';
import { rosterLimit } from '../league/offseason';
import { developmentIds, registeredIds, type Squad } from '../league/state';
import { OFFSEASON } from '../league/tuning';
import { rosterView } from '../league/views';
import { PARENT_COMPANY_TYPES } from '../club/types';
import { projectedPayroll } from '../league/expansion';
import type { LeagueState } from '../league/state';
import { shortName, standingsView } from '../league/views';
import { money } from './format';
import { RosterTable, type Row } from './TeamRoster';

/** The user's club: identity, money, where it stands, the founding timeline and its roster. */
export function MyClub({ league, onPlayer, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void }) {
  const [msg, setMsg] = useState('');
  const u = league.user!;
  const team = league.teams.find((t) => t.id === u.teamId)!;
  const city = cityById(u.settings.cityId)!;
  const inFirstTeam = league.year >= u.firstTeamYear;
  const row = standingsView(league).find((r) => r.teamId === u.teamId);
  const f = league.futures;
  const myFutures = f ? f.scores.filter((g) => g.home === u.teamId || g.away === u.teamId) : [];
  const fr = f ? myFutures.reduce((a, g) => {
        const [mine, theirs] = g.home === u.teamId ? [g.hs, g.as] : [g.as, g.hs];
        return { w: a.w + (mine > theirs ? 1 : 0), l: a.l + (mine < theirs ? 1 : 0), t: a.t + (mine === theirs ? 1 : 0) };
      }, { w: 0, l: 0, t: 0 })
    : null;
  const payYear = league.phase === 'offseason' && league.offseason ? league.offseason.year + 1 : league.year;
  const steps = [
    { year: 2026, label: '7월 창단 승인 · 트라이아웃' },
    { year: 2026, label: '9월 첫 신인 드래프트 (우선지명)' },
    ...(u.firstTeamYear === 2028 ? [{ year: 2027, label: '퓨처스리그 참가' }] : []),
    { year: u.firstTeamYear - 1, label: '겨울 특별지명 · FA 특례 · 외국인 계약' },
    { year: u.firstTeamYear, label: '1군 진입' },
  ];
  return (
    <section aria-labelledby="myclub-title" style={{ '--accent': team.color } as Record<string, string>}>
      <h2 id="myclub-title">
        <span class="swatch" style={{ background: team.color }} aria-hidden="true" /> {team.name}
      </h2>
      <p class="muted">
        {city.name} · {PARENT_COMPANY_TYPES[u.settings.parentType].label} {team.parent.name} · {team.stadium.name} {team.stadium.capacity.toLocaleString('ko-KR')}석
      </p>
      <dl class="facts club-facts">
        <div>
          <dt>{inFirstTeam ? `${league.year} 1군` : `${league.year} 시즌`}</dt>
          <dd>{inFirstTeam && row ? `${row.rank}위 ${row.w}승 ${row.l}패 ${row.t}무` : fr ? `퓨처스 ${fr.w}승 ${fr.l}패 ${fr.t}무` : '창단 준비'}</dd>
        </div>
        <div>
          <dt>창단 자금</dt>
          <dd>{money(u.fund)}</dd>
        </div>
        <div>
          <dt>{payYear}년 연봉 / 예산</dt>
          <dd>
            {money(projectedPayroll(league, u.teamId, payYear))} / {money(u.payrollBudget)}
          </dd>
        </div>
        <div>
          <dt>1군 진입</dt>
          <dd>{u.firstTeamYear}년</dd>
        </div>
      </dl>

      {league.year <= u.firstTeamYear + 1 && (
        <>
      <h3>창단 일정</h3>
      <ol class="timeline">
        {steps.map((st) => (
          <li key={st.label} class={league.year > st.year || (league.year === st.year && inFirstTeam) ? 'done' : ''}>
            <span class="num">{st.year}</span> {st.label}
          </li>
        ))}
      </ol>
        </>
      )}

      {myFutures.length > 0 && (
        <>
          <h3>최근 퓨처스 경기</h3>
          <ul class="scores">
            {myFutures.slice(-5).reverse().map((g) => (
              <li key={g.id} class="numbers">
                {g.date.slice(5)} {shortName(league, g.away)} {g.as} : {g.hs} {shortName(league, g.home)}
              </li>
            ))}
          </ul>
        </>
      )}

      <Management league={league} onPlayer={onPlayer} onAct={onAct} msg={msg} setMsg={setMsg} />

      {!!u.log?.length && (
        <>
          <h3>구단 소식</h3>
          <ul class="club-log">
            {[...u.log].reverse().slice(0, 15).map((l, i) => (
              <li key={i}>
                <span class="num muted">{l.year}</span> {l.text}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>자금 내역</h3>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table ledger">
          <tbody>
            {[...u.ledger].reverse().slice(0, 30).map((l, i) => (
              <tr key={i}>
                <td class="num">{l.year}</td>
                <td>{l.label}</td>
                <td class="num">{l.amount ? `${l.amount > 0 ? '+' : '−'}${money(Math.abs(l.amount))}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The squads, with the general manager's moves when the roster is run by hand. */
function Management({
  league,
  onPlayer,
  onAct,
  msg,
  setMsg,
}: {
  league: LeagueState;
  onPlayer: (id: string) => void;
  onAct: (a: Action) => void;
  msg: string;
  setMsg: (m: string) => void;
}) {
  const u = league.user!;
  const manual = u.entry === 'manual';
  const roster = rosterView(league, u.teamId);
  const inSeason = league.phase === 'regular';
  const move = (id: string, to: Squad) => {
    const problem = canMove(league, id, to);
    setMsg(problem ?? '');
    if (!problem) onAct({ kind: 'move', id, to });
  };
  const register = (id: string) => {
    const problem = canRegister(league, id);
    setMsg(problem ?? '');
    if (!problem) onAct({ kind: 'register', id });
  };
  const buttons = (squad: Squad) => (r: Row) => (
    <div class="row-actions">
      {squad !== 'active' && !r.development && (
        <button type="button" onClick={() => move(r.id, 'active')}>
          1군 등록
        </button>
      )}
      {squad === 'active' && (
        <button type="button" onClick={() => move(r.id, 'futures')}>
          말소
        </button>
      )}
      {squad !== 'futures' && squad !== 'active' && (
        <button type="button" onClick={() => move(r.id, 'futures')}>
          퓨처스
        </button>
      )}
      {squad !== 'third' && (
        <button type="button" onClick={() => move(r.id, 'third')}>
          잔류군
        </button>
      )}
      {r.development && (
        <button type="button" onClick={() => register(r.id)}>
          정식 등록
        </button>
      )}
    </div>
  );
  const act = manual && inSeason;
  return (
    <>
      <h3>선수단 운영</h3>
      <p class="muted">
        1군 {league.rosters[u.teamId]!.active.length}/{firstTeamSize(league, u.teamId)} · 소속선수 {registeredIds(league, u.teamId).length}/{rosterLimit(league.year)} · 육성선수{' '}
        {developmentIds(league, u.teamId).length}/{OFFSEASON.development.cap}
      </p>
      <div class="entry-mode" role="group" aria-label="엔트리 관리">
        <button type="button" aria-pressed={!manual} onClick={() => onAct({ kind: 'entryMode', mode: 'auto' })}>
          감독에게 맡기기
        </button>
        <button type="button" aria-pressed={manual} onClick={() => onAct({ kind: 'entryMode', mode: 'manual' })}>
          직접 관리
        </button>
        <span class="muted">
          {manual
            ? '1군 등록·말소와 퓨처스·잔류군 배치를 직접 합니다. 말소한 선수는 10일 뒤에 다시 등록할 수 있고, 부상이나 대표팀으로 빠진 자리만 감독이 채웁니다.'
            : '감독이 열흘마다 1군을 다시 짜고, 퓨처스 출전조와 잔류군을 나눕니다.'}
        </span>
      </div>
      {msg && (
        <p class="toast" role="status">
          {msg}
          <button type="button" class="link" onClick={() => setMsg('')} aria-label="닫기">
            ✕
          </button>
        </p>
      )}
      <RosterTable title="1군" rows={roster.active} onPlayer={onPlayer} actions={act ? buttons('active') : undefined} />
      <RosterTable title="퓨처스" rows={roster.futures} onPlayer={onPlayer} actions={act ? buttons('futures') : undefined} />
      <RosterTable
        title="잔류군"
        rows={roster.third}
        onPlayer={onPlayer}
        actions={act ? buttons('third') : undefined}
        note={<p class="muted">퓨처스 경기에 나가지 않고 재활·훈련하는 선수들입니다. 경기에 나가는 것만큼은 아니지만 훈련한 시간도 성장에 반영됩니다.</p>}
      />
      <RosterTable title="군 복무" rows={roster.military} onPlayer={onPlayer} />
    </>
  );
}
