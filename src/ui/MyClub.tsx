/* The user's club in three views: an overview you can read at a glance, the squads (with the general
   manager's moves), and the front office (money, ballpark, club facts). */
import { useState } from 'preact/hooks';
import { cityById } from '../club/cities';
import { PARENT_COMPANY_TYPES } from '../club/types';
import type { Action } from '../league/actions';
import { canMove, canRegister } from '../league/entry';
import { projectedPayroll } from '../league/expansion';
import { firstTeamSize, PEN_ROLE_LABELS, PEN_ROLES } from '../league/manager';
import type { BullpenRole } from '../league/engine/types';
import { rosterLimit } from '../league/offseason';
import { isPitcher } from '../league/players';
import { developmentIds, registeredIds, type LeagueState, type Squad as SquadName } from '../league/state';
import { OFFSEASON } from '../league/tuning';
import { rates, shortName, standingsView } from '../league/views';
import { money } from './format';
import { Squad, type Row, type SquadKey } from './Squad';
import { Office } from './Office';

type View = 'overview' | 'squad' | 'office';

export function MyClub({ league, onPlayer, onAct }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void }) {
  const [view, setView] = useState<View>('overview');
  const [msg, setMsg] = useState('');
  const u = league.user!;
  const team = league.teams.find((t) => t.id === u.teamId)!;
  const city = cityById(u.settings.cityId)!;
  return (
    <section aria-labelledby="myclub-title" style={{ '--accent': team.color } as Record<string, string>}>
      <div class="page-head">
        <div>
          <h2 id="myclub-title">
            <span class="swatch" style={{ background: team.color }} aria-hidden="true" /> {team.name}
          </h2>
          <p class="muted">
            {city.name} · {PARENT_COMPANY_TYPES[u.settings.parentType].label} {team.parent.name} · {team.stadium.name} {team.stadium.capacity.toLocaleString('ko-KR')}석
          </p>
        </div>
        <div class="segmented" role="group" aria-label="우리 구단 보기">
          {(
            [
              ['overview', '개요'],
              ['squad', '선수단'],
              ['office', '구단 운영'],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'overview' && <Overview league={league} onPlayer={onPlayer} />}
      {view === 'squad' && <Management league={league} onPlayer={onPlayer} onAct={onAct} setMsg={setMsg} />}
      {view === 'office' && <Office league={league} onAct={onAct} setMsg={setMsg} />}
      {msg && (
        <p class="toast" role="status">
          {msg}
          <button type="button" class="link" onClick={() => setMsg('')} aria-label="닫기">
            ✕
          </button>
        </p>
      )}
    </section>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────────────────────────

function Overview({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const me = u.teamId;
  const inFirstTeam = league.year >= u.firstTeamYear;
  const table = standingsView(league);
  const row = table.find((r) => r.teamId === me);
  const games = inFirstTeam ? league.scores.filter((g) => g.home === me || g.away === me) : (league.futures?.scores ?? []).filter((g) => g.home === me || g.away === me);
  const record = games.reduce(
    (a, g) => {
      const [mine, theirs] = g.home === me ? [g.hs, g.as] : [g.as, g.hs];
      return { w: a.w + Number(mine > theirs), l: a.l + Number(mine < theirs), t: a.t + Number(mine === theirs) };
    },
    { w: 0, l: 0, t: 0 },
  );
  const payYear = league.phase === 'offseason' && league.offseason ? league.offseason.year + 1 : league.year;
  const payroll = projectedPayroll(league, me, payYear);
  const share = Math.min(1, payroll / Math.max(1, u.payrollBudget));
  const steps = [
    { year: 2026, label: '창단 승인 · 트라이아웃' },
    { year: 2026, label: '첫 신인 드래프트' },
    ...(u.firstTeamYear === 2028 ? [{ year: 2027, label: '퓨처스리그' }] : []),
    { year: u.firstTeamYear - 1, label: '특별지명 · FA · 외국인' },
    { year: u.firstTeamYear, label: '1군 진입' },
  ];
  return (
    <>
      <div class="cards">
        <div class="card">
          <p class="card-label">{inFirstTeam ? `${league.year} 1군 순위` : `${league.year} 퓨처스리그`}</p>
          <p class="card-value">{inFirstTeam && row ? `${row.rank}위` : games.length ? `${record.w}승 ${record.l}패` : '창단 준비'}</p>
          <p class="card-sub">
            {inFirstTeam && row ? `${row.w}승 ${row.l}패 ${row.t}무 · 승률 ${rates.fmt3(row.pct)}${row.gb ? ` · ${row.gb}경기 차` : ''}` : `1군 진입 ${u.firstTeamYear}년`}
          </p>
        </div>
        <div class="card">
          <p class="card-label">{payYear}년 연봉 / 예산</p>
          <p class="card-value">{money(payroll)}</p>
          <div class="bar" aria-hidden="true">
            <span style={{ width: `${Math.round(share * 100)}%` }} class={payroll > u.payrollBudget ? 'over' : ''} />
          </div>
          <p class="card-sub">예산 {money(u.payrollBudget)}</p>
        </div>
        <div class="card">
          <p class="card-label">구단 자금</p>
          <p class="card-value">{money(u.fund)}</p>
          <p class="card-sub">계약금·영입비·옵션에 씀</p>
        </div>
        <div class="card">
          <p class="card-label">소속선수</p>
          <p class="card-value">
            {registeredIds(league, me).length}
            <span class="card-unit">/{rosterLimit(league.year)}명</span>
          </p>
          <p class="card-sub">
            1군 {league.rosters[me]!.active.length}/{firstTeamSize(league, me)} · 육성 {developmentIds(league, me).length}/{OFFSEASON.development.cap}
          </p>
        </div>
      </div>

      {league.year <= u.firstTeamYear && (
        <ol class="stepper" aria-label="창단 일정">
          {steps.map((st) => {
            const done = league.year > st.year || (league.year === st.year && inFirstTeam);
            return (
              <li key={st.label} class={done ? 'done' : ''}>
                <span class="num">{st.year}</span>
                {st.label}
              </li>
            );
          })}
        </ol>
      )}

      <div class="two-col">
        <div>
          <h3>최근 경기</h3>
          {games.length ? (
            <ul class="results">
              {games
                .slice(-8)
                .reverse()
                .map((g) => {
                  const home = g.home === me;
                  const [mine, theirs] = home ? [g.hs, g.as] : [g.as, g.hs];
                  const res = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
                  return (
                    <li key={g.id}>
                      <span class={`result ${res}`}>{res === 'W' ? '승' : res === 'L' ? '패' : '무'}</span>
                      <span class="num score">
                        {mine}:{theirs}
                      </span>
                      {home ? 'vs' : '@'} {shortName(league, home ? g.away : g.home)} <span class="muted">{g.date.slice(5).replace('-', '/')}</span>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p class="empty">아직 경기가 없습니다.</p>
          )}
        </div>
        <div>
          <h3>팀 리더</h3>
          <TeamLeaders league={league} onPlayer={onPlayer} />
        </div>
      </div>

      <h3>구단 소식</h3>
      {u.log?.length ? (
        <ul class="club-log">
          {[...u.log]
            .reverse()
            .slice(0, 10)
            .map((l, i) => (
              <li key={i}>
                <span class="num muted">{l.year}</span> {l.text}
              </li>
            ))}
        </ul>
      ) : (
        <p class="empty">아직 소식이 없습니다.</p>
      )}
    </>
  );
}

/** Our best this season: batting and pitching leaders among the club's first-team (or futures) lines. */
function TeamLeaders({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const me = league.user!.teamId;
  const firstTeam = league.year >= league.user!.firstTeamYear;
  const lines = Object.entries(firstTeam ? league.lines : (league.futures?.lines ?? {})).filter(([, l]) => l.teamId === me);
  type Entry = (typeof lines)[number];
  const games = Math.max(1, ...lines.map(([, l]) => l.bat?.g ?? 0));
  const bats = lines.filter(([id, l]) => l.bat && l.bat.pa >= games * 2 && !isPitcher(league.players[id]!));
  const pits = lines.filter(([, l]) => l.pit && l.pit.outs > 0);
  const best = (xs: Entry[], key: (x: Entry) => number, low = false) => [...xs].sort((a, b) => (low ? key(a) - key(b) : key(b) - key(a)))[0];
  const items: { title: string; entry?: Entry; value: (e: Entry) => string }[] = [
    { title: '타율', entry: best(bats, ([, l]) => rates.avg(l.bat!)), value: ([, l]) => rates.fmt3(rates.avg(l.bat!)) },
    { title: '홈런', entry: best(bats, ([, l]) => l.bat!.hr), value: ([, l]) => `${l.bat!.hr}` },
    { title: 'OPS', entry: best(bats, ([, l]) => rates.ops(l.bat!)), value: ([, l]) => rates.fmt3(rates.ops(l.bat!)) },
    { title: '평균자책점', entry: best(pits.filter(([, l]) => l.pit!.outs >= games * 2), ([, l]) => rates.era(l.pit!), true), value: ([, l]) => rates.era(l.pit!).toFixed(2) },
    { title: '승리', entry: best(pits, ([, l]) => l.pit!.w), value: ([, l]) => `${l.pit!.w}` },
    { title: '세이브', entry: best(pits, ([, l]) => l.pit!.sv), value: ([, l]) => `${l.pit!.sv}` },
  ];
  if (!lines.length) return <p class="empty">아직 기록이 없습니다.</p>;
  return (
    <dl class="leaders-mini">
      {items.map((it) => (
        <div key={it.title}>
          <dt>{it.title}</dt>
          <dd>
            {it.entry ? (
              <>
                <button type="button" class="link" onClick={() => onPlayer(it.entry![0])}>
                  {league.players[it.entry[0]]?.name}
                </button>{' '}
                <span class="num strong">{it.value(it.entry)}</span>
              </>
            ) : (
              '-'
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Squads ───────────────────────────────────────────────────────────────────────────────────────

function Management({ league, onPlayer, onAct, setMsg }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void; setMsg: (m: string) => void }) {
  const u = league.user!;
  const manual = u.entry === 'manual';
  const inSeason = league.phase === 'regular';
  const move = (id: string, to: SquadName) => {
    const problem = canMove(league, id, to);
    setMsg(problem ?? '');
    if (!problem) onAct({ kind: 'move', id, to });
  };
  const register = (id: string) => {
    const problem = canRegister(league, id);
    setMsg(problem ?? '');
    if (!problem) onAct({ kind: 'register', id });
  };
  const buttons = (squad: SquadKey) =>
    manual && inSeason && squad !== 'military'
      ? (r: Row) => {
          const options: [string, string][] = [];
          if (squad !== 'active' && !r.development) options.push(['active', '1군 등록']);
          if (squad === 'active') options.push(['futures', '말소 (퓨처스로)']);
          if (squad === 'third') options.push(['futures', '퓨처스로']);
          if (squad !== 'third') options.push(['third', '잔류군으로']);
          if (r.development) options.push(['register', '정식 등록']);
          if (r.role === 'SP' || r.role === 'RP') options.push(['role', r.role === 'SP' ? '불펜 투수로' : '선발 투수로']);
          const run = (v: string) => {
            if (v === 'register') register(r.id);
            else if (v === 'role') onAct({ kind: 'setRole', id: r.id, role: r.role === 'SP' ? 'RP' : 'SP' });
            else if (v) move(r.id, v as SquadName);
          };
          return (
            <select class="cell-select" aria-label={`${r.name} 관리`} value="" onChange={(e) => run((e.target as HTMLSelectElement).value)}>
              <option value="">이동·보직…</option>
              {options.map(([v, label]) => (
                <option key={v + label} value={v}>
                  {label}
                </option>
              ))}
            </select>
          );
        }
      : undefined;
  const roleControl = (squad: SquadKey) =>
    manual && squad === 'active'
      ? (r: Row) =>
          r.penRole ? (
            <select
              class="cell-select"
              aria-label={`${r.name} 불펜 보직`}
              value={r.penRoleSet ? r.penRole : ''}
              onChange={(e) => onAct({ kind: 'penRole', id: r.id, role: ((e.target as HTMLSelectElement).value || null) as BullpenRole | null })}
            >
              <option value="">감독: {PEN_ROLE_LABELS[r.penRole]}</option>
              {PEN_ROLES.map((x) => (
                <option key={x} value={x}>
                  {PEN_ROLE_LABELS[x]}
                </option>
              ))}
            </select>
          ) : !r.pitcher ? (
            <select
              class="cell-select"
              aria-label={`${r.name} 플래툰`}
              value={r.platoon ?? ''}
              onChange={(e) => onAct({ kind: 'platoon', id: r.id, side: ((e.target as HTMLSelectElement).value || null) as 'L' | 'R' | null })}
            >
              <option value="">매일 출전 후보</option>
              <option value="L">좌완 상대만</option>
              <option value="R">우완 상대만</option>
            </select>
          ) : undefined
      : undefined;
  const toolbar = (
    <div class="segmented" role="group" aria-label="엔트리 관리">
      <button type="button" aria-pressed={!manual} onClick={() => onAct({ kind: 'entryMode', mode: 'auto' })}>
        감독에게 맡기기
      </button>
      <button type="button" aria-pressed={manual} onClick={() => onAct({ kind: 'entryMode', mode: 'manual' })}>
        직접 관리
      </button>
    </div>
  );
  return (
    <>
      <p class="muted">
        {manual
          ? '직접 관리: 1군 등록·말소, 퓨처스·잔류군 배치, 선발·불펜 보직(마무리·셋업맨·필승조·추격조·롱릴리프·원 포인트), 플래툰(좌완·우완 상대 선발)을 정합니다. 정하지 않은 자리는 감독이 채웁니다. 말소한 선수는 10일 뒤 다시 등록할 수 있습니다.'
          : '감독에게 맡기기: 감독이 열흘마다 1군을 다시 짜고, 퓨처스 출전조와 잔류군을 나눕니다.'}
        {manual && !inSeason && ' 선수 이동은 정규시즌 중에 할 수 있습니다.'}
      </p>
      <Squad league={league} teamId={u.teamId} onPlayer={onPlayer} actions={buttons} posControl={roleControl} toolbar={toolbar} />
    </>
  );
}

// ── Front office ─────────────────────────────────────────────────────────────────────────────────

