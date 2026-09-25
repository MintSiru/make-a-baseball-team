/* The front office (V0.6): the owner's goals and verdicts, the accounts, fans and tickets, the staff and
   the ballpark. One section at a time behind a segmented control. */
import { useState } from 'preact/hooks';
import { cityById } from '../club/cities';
import { PARENT_COMPANY_TYPES } from '../club/types';
import type { Action } from '../league/actions';
import { projectOptions, type ProjectKind } from '../league/ballpark';
import { capFloorFor, capTotal } from '../league/cap';
import { projectedPayroll, STADIUM_PLANS } from '../league/expansion';
import { boom, leaguePrice } from '../league/fans';
import { projectedReport, supportLabel } from '../league/finance';
import { MANAGER_STYLES, STAFF_EFFECTS, STAFF_LABELS, STAFF_ROLES } from '../league/staff';
import type { ClubReport, LeagueState } from '../league/state';
import { FANS } from '../league/tuning';
import { checkStadiumName, STADIUM_NAME_MAX } from '../league/userclub';
import { salaryCapFor } from '../rules/kbo2026';
import { money } from './format';

type Section = 'summary' | 'owner' | 'money' | 'fans' | 'staff' | 'ballpark' | 'ledger';
const SECTIONS: [Section, string][] = [
  ['summary', '요약'],
  ['owner', '모기업'],
  ['money', '재정'],
  ['fans', '관중 · 티켓'],
  ['staff', '스태프'],
  ['ballpark', '구장'],
  ['ledger', '자금 내역'],
];

/** 억 with one decimal ("101.9억"), for reports. */
const eok = (n: number) => (n ? `${(Math.round(n / 1000) / 10).toLocaleString('ko-KR')}억` : '-');
const signed = (n: number) => (n < 0 ? `−${eok(-n)}` : n > 0 ? `+${eok(n)}` : '0');
const people = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}명`;

const REVENUE: [keyof ClubReport['revenue'], string][] = [
  ['gate', '입장 수입'],
  ['broadcast', '중계권 분배'],
  ['sponsors', '스폰서 · 광고'],
  ['naming', '명명권'],
  ['merchandise', '상품'],
  ['concessions', '식음료 · 임대'],
  ['postseason', '포스트시즌 배당'],
];
const EXPENSES: [keyof ClubReport['expenses'], string][] = [
  ['players', '선수 연봉'],
  ['staff', '코칭스태프 · 프런트 팀장'],
  ['frontOffice', '프런트 · 운영'],
  ['gameDays', '홈경기 운영'],
  ['ballpark', '구장 사용 · 관리'],
  ['farm', '2군 · 잔류군 시설'],
  ['marketing', '마케팅'],
];

function ReportTable({ reports }: { reports: { title: string; r: ClubReport }[] }) {
  const total = (r: ClubReport, side: 'revenue' | 'expenses') => Object.values(r[side]).reduce((a, b) => a + b, 0);
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table report-table">
        <thead>
          <tr>
            <th />
            {reports.map((x) => (
              <th key={x.title} class="num">
                {x.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr class="report-head">
            <th colSpan={reports.length + 1}>수입</th>
          </tr>
          {REVENUE.filter(([k]) => reports.some((x) => x.r.revenue[k])).map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{label}</th>
              {reports.map((x) => (
                <td key={x.title} class="num">
                  {eok(x.r.revenue[k])}
                </td>
              ))}
            </tr>
          ))}
          <tr class="report-sum">
            <th scope="row">수입 합계</th>
            {reports.map((x) => (
              <td key={x.title} class="num strong">
                {eok(total(x.r, 'revenue'))}
              </td>
            ))}
          </tr>
          <tr class="report-head">
            <th colSpan={reports.length + 1}>지출</th>
          </tr>
          {EXPENSES.map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{label}</th>
              {reports.map((x) => (
                <td key={x.title} class="num">
                  {eok(x.r.expenses[k])}
                </td>
              ))}
            </tr>
          ))}
          <tr class="report-sum">
            <th scope="row">지출 합계</th>
            {reports.map((x) => (
              <td key={x.title} class="num strong">
                {eok(total(x.r, 'expenses'))}
              </td>
            ))}
          </tr>
          <tr class="report-sum">
            <th scope="row">운영 결과</th>
            {reports.map((x) => (
              <td key={x.title} class={`num strong ${x.r.operating >= 0 ? 'plus' : 'minus'}`}>
                {signed(x.r.operating)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">그 밖의 지출·수입 (계약금·위약금·이적료 등)</th>
            {reports.map((x) => (
              <td key={x.title} class="num">
                {x.r.cashFlows != null ? signed(x.r.cashFlows) : '-'}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">모기업(지자체·투자자) 지원</th>
            {reports.map((x) => (
              <td key={x.title} class="num">
                {eok(x.r.support)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Office({ league, onAct, setMsg }: { league: LeagueState; onAct: (a: Action) => void; setMsg: (m: string) => void }) {
  const [section, setSection] = useState<Section>('summary');
  const u = league.user!;
  const team = league.teams.find((t) => t.id === u.teamId)!;
  const club = league.clubs?.[u.teamId];
  const reports = club?.reports ?? [];
  const last = reports.at(-1);
  const inSeason = league.phase === 'regular' || league.phase === 'postseason';
  const current = inSeason && league.clubs?.[u.teamId] ? projectedReport(league, u.teamId) : null;
  const gate = league.gate?.[u.teamId];
  const payYear = league.phase === 'offseason' && league.offseason ? league.offseason.year + 1 : league.year;
  const plan = STADIUM_PLANS[u.settings.stadium];
  const building = !!plan.opens && league.year < plan.opens;
  const [stadiumName, setStadiumName] = useState(team.stadium.name);
  const [future, setFuture] = useState(u.newStadiumName ?? '');
  const rename = (name: string, which: 'current' | 'new') => (e: Event) => {
    e.preventDefault();
    const problem = checkStadiumName(name);
    setMsg(problem ?? '');
    if (!problem) onAct({ kind: 'renameStadium', name, which });
  };
  const act = (a: Action) => {
    setMsg('');
    onAct(a);
  };
  const ev = u.evaluations?.at(-1);
  const goals = u.goals;
  const avgNow = gate?.games ? gate.fans / gate.games : null;
  const priceWon = (level: number) => Math.round(leaguePrice(league.year) * level * 10000);

  return (
    <>
      <div class="segmented office-tabs" role="group" aria-label="구단 운영">
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </div>

      {section === 'summary' && (
        <div class="cards">
          <div class="card">
            <p class="card-label">구단 자금</p>
            <p class="card-value">{u.fund < 0 ? `−${money(-u.fund)}` : money(u.fund)}</p>
            <p class="card-sub">
              올해 지원 한도 {money(u.support ?? 0)} ({PARENT_COMPANY_TYPES[u.settings.parentType].label})
            </p>
          </div>
          <div class="card">
            <p class="card-label">{payYear}년 연봉 / 예산</p>
            <p class="card-value">{money(projectedPayroll(league, u.teamId, payYear))}</p>
            <p class="card-sub">예산 {money(u.payrollBudget)}</p>
          </div>
          <div class="card">
            <p class="card-label">모기업 신뢰도</p>
            <p class="card-value">{Math.round(u.trust ?? 60)}</p>
            <p class="card-sub">{ev ? `${ev.year} 평가: 예산 ${ev.change >= 0 ? '+' : ''}${Math.round(ev.change * 100)}%` : '첫 평가는 1군 첫 시즌 뒤'}</p>
          </div>
          <div class="card">
            <p class="card-label">{inSeason ? `${league.year} 경기당 관중` : '지난 시즌 경기당 관중'}</p>
            <p class="card-value">{avgNow ? people(avgNow) : last?.homeGames ? people(last.fans / last.homeGames) : '-'}</p>
            <p class="card-sub">
              {team.stadium.capacity.toLocaleString('ko-KR')}석{gate?.sellouts ? ` · 매진 ${gate.sellouts}번` : ''}
            </p>
          </div>
          <div class="card">
            <p class="card-label">{inSeason ? `${league.year} 예상 운영 결과` : '지난 시즌 운영 결과'}</p>
            <p class="card-value">{current ? signed(current.operating) : last ? signed(last.operating) : '-'}</p>
            <p class="card-sub">수입 − 지출 (모기업 지원 전)</p>
          </div>
          <div class="card">
            <p class="card-label">경쟁균형세 · 상위 40명 ({league.year})</p>
            <p class="card-value">{money(capTotal(league, u.teamId, league.year))}</p>
            <p class="card-sub">
              상한 {money(salaryCapFor(league.year))}
              {capFloorFor(league.year) ? ` · 하한 ${money(capFloorFor(league.year)!)}` : ''}
            </p>
          </div>
        </div>
      )}

      {section === 'owner' && (
        <>
          <p>
            {team.parent.name} · {PARENT_COMPANY_TYPES[u.settings.parentType].label}. {PARENT_COMPANY_TYPES[u.settings.parentType].summary} 모기업은 해마다 목표를 주고 겨울에 평가해서 다음 해 지원 한도와 연봉 예산을
            최대 10%까지 늘리거나 줄입니다.
          </p>
          <div class="cards">
            <div class="card">
              <p class="card-label">올해 지원 한도</p>
              <p class="card-value">{money(u.support ?? 0)}</p>
              <p class="card-sub">{supportLabel(u.settings.parentType)} · 적자를 이만큼까지 메워 줌</p>
            </div>
            <div class="card">
              <p class="card-label">신뢰도</p>
              <p class="card-value">{Math.round(u.trust ?? 60)} / 100</p>
              <p class="card-sub">{u.settings.firing ? '15 아래로 떨어지면 해임될 수 있음' : '샌드박스: 해임 없음'}</p>
            </div>
            {club?.sponsor && (
              <div class="card">
                <p class="card-label">명명권 스폰서</p>
                <p class="card-value small">{club.sponsor.name}</p>
                <p class="card-sub">
                  연 {money(club.sponsor.annual)} · {club.sponsor.until}년까지
                </p>
              </div>
            )}
          </div>
          {u.fired && <p class="notice warn">{u.fired}년 겨울, 모기업이 단장을 해임했습니다. 새 게임을 시작하거나 이 구단을 계속 지켜볼 수 있습니다.</p>}
          <h3>{goals ? `${goals.year} 목표` : '목표'}</h3>
          {goals ? (
            <ul class="plain">
              <li>성적: {goals.rank}위 이내</li>
              <li>관중: 경기당 {goals.fans.toLocaleString('ko-KR')}명</li>
              <li>재정: 운영 결과(계약금 등 포함)가 {money(-goals.result)} 적자 이내</li>
            </ul>
          ) : (
            <p class="muted">1군에 들어가는 시즌부터 목표가 생깁니다.</p>
          )}
          <h3>지난 평가</h3>
          {u.evaluations?.length ? (
            <div class="table-wrap">
              <table class="record-table">
                <thead>
                  <tr>
                    <th class="num">연도</th>
                    <th>성적</th>
                    <th>관중</th>
                    <th>재정</th>
                    <th class="num">예산</th>
                    <th class="num">신뢰도</th>
                  </tr>
                </thead>
                <tbody>
                  {[...u.evaluations].reverse().map((e) => (
                    <tr key={e.year}>
                      <td class="num">{e.year}</td>
                      {e.lines.map((l) => (
                        <td key={l.label} class={l.ok ? 'plus' : 'minus'}>
                          {l.ok ? '달성' : '미달'} <span class="muted small">{l.text}</span>
                        </td>
                      ))}
                      <td class="num">
                        {e.change >= 0 ? '+' : ''}
                        {Math.round(e.change * 100)}%
                      </td>
                      <td class="num">{Math.round(e.trust)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p class="muted">아직 평가가 없습니다.</p>
          )}
        </>
      )}

      {section === 'money' && (
        <>
          <p class="muted">
            시즌이 끝나면 결산합니다. 수입에서 지출을 뺀 운영 결과와 한 해 동안 자금에서 쓴 돈(계약금·위약금 등)을 합쳐 적자가 나면 모기업이 지원 한도까지 메우고, 넘는 만큼은 구단 자금에서 나갑니다. 흑자는
            구단 자금으로 쌓입니다. 구장 공사비는 지원 대상이 아니라 자금에서 바로 나갑니다.
          </p>
          {current || reports.length ? (
            <ReportTable
              reports={[
                ...(current ? [{ title: `${league.year} (예상)`, r: current }] : []),
                ...reports
                  .slice(-3)
                  .reverse()
                  .map((r) => ({ title: String(r.year), r })),
              ]}
            />
          ) : (
            <p class="muted">아직 결산한 시즌이 없습니다.</p>
          )}
        </>
      )}

      {section === 'fans' && club && (
        <>
          <div class="cards">
            <div class="card">
              <p class="card-label">팬층</p>
              <p class="card-value">{club.popularity.toLocaleString('ko-KR')}</p>
              <p class="card-sub">보통 경기에 올 만한 팬 (2025년 기준, 리그 평균 약 19,000)</p>
            </div>
            <div class="card">
              <p class="card-label">팬 분위기</p>
              <p class="card-value">{club.interest >= 0.3 ? '뜨거움' : club.interest >= 0.1 ? '좋음' : club.interest > -0.1 ? '보통' : club.interest > -0.3 ? '식음' : '냉랭'}</p>
              <p class="card-sub">성적·가을야구·스타·프랜차이즈 선수·마케팅을 따라감</p>
            </div>
            <div class="card">
              <p class="card-label">{inSeason ? `${league.year} 관중` : '지난 시즌 관중'}</p>
              <p class="card-value">{gate?.games ? people(gate.fans / gate.games) : last?.homeGames ? people(last.fans / last.homeGames) : '-'}</p>
              <p class="card-sub">
                {gate?.games ? `홈 ${gate.games}경기 · 누적 ${people(gate.fans)} · 매진 ${gate.sellouts}번` : last ? `누적 ${people(last.fans)}` : ''} · 리그 흥행 지수 {boom(league.year).toFixed(2)}
              </p>
            </div>
          </div>
          <h3>티켓 가격</h3>
          <p class="muted">
            리그 평균 객단가 {priceWon(1).toLocaleString('ko-KR')}원 기준. 가격을 올리면 경기당 수입은 늘지만 관중이 줄고, 매진되는 구단이라면 올려도 빈자리가 덜 생깁니다. 바로 적용됩니다.
          </p>
          <label class="inline-form">
            객단가
            <select value={club.price.toFixed(2)} onChange={(e) => act({ kind: 'ticketPrice', level: Number((e.currentTarget as HTMLSelectElement).value) })} aria-label="티켓 가격">
              {Array.from({ length: Math.round((FANS.priceMax - FANS.priceMin) / 0.05) + 1 }, (_, i) => Math.round((FANS.priceMin + i * 0.05) * 100) / 100).map((lv) => (
                <option key={lv} value={lv.toFixed(2)}>
                  {Math.round(lv * 100)}% · {priceWon(lv).toLocaleString('ko-KR')}원
                </option>
              ))}
            </select>
          </label>
          <h3>마케팅</h3>
          <p class="muted">연 {money(FANS.marketing.base)}이 기본입니다. 더 쓰면 겨울마다 팬 분위기가 조금 좋아지고, 덜 쓰면 식습니다. 지출은 결산에 들어갑니다.</p>
          <label class="inline-form">
            연간 마케팅비
            <select value={String(club.marketing)} onChange={(e) => act({ kind: 'marketing', amount: Number((e.currentTarget as HTMLSelectElement).value) })} aria-label="마케팅비">
              {Array.from({ length: FANS.marketing.max / 50_000 + 1 }, (_, i) => i * 50_000).map((v) => (
                <option key={v} value={String(v)}>
                  {v ? money(v) : '0'}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {section === 'staff' && club && (
        <>
          <p class="muted">코칭스태프와 프런트 팀장은 겨울에 바꿉니다 (계약 만료자가 있거나 첫 겨울에 결정 화면이 나옵니다). 등급 50이 리그 평균입니다.</p>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table">
              <thead>
                <tr>
                  <th>자리</th>
                  <th>이름</th>
                  <th class="num">등급</th>
                  <th class="num">나이</th>
                  <th class="num">연봉</th>
                  <th>계약</th>
                  <th>하는 일</th>
                </tr>
              </thead>
              <tbody>
                {STAFF_ROLES.map((role) => {
                  const m = club.staff?.[role];
                  return (
                    <tr key={role}>
                      <th scope="row">{STAFF_LABELS[role]}</th>
                      <td>
                        {m?.name ?? '-'}
                        {m?.style && <span class="muted"> · {MANAGER_STYLES[m.style].label}</span>}
                      </td>
                      <td class="num strong">{m?.rating ?? '-'}</td>
                      <td class="num">{m?.age ?? '-'}</td>
                      <td class="num">{m ? money(m.salary) : '-'}</td>
                      <td>{m ? `${m.until}년까지` : '-'}</td>
                      <td class="muted small">
                        {STAFF_EFFECTS[role]}
                        {m?.style ? ` (${MANAGER_STYLES[m.style].note})` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === 'ballpark' && (
        <>
          <div class="cards">
            <div class="card">
              <p class="card-label">홈구장</p>
              <p class="card-value small">{team.stadium.name}</p>
              <p class="card-sub">
                {team.stadium.capacity.toLocaleString('ko-KR')}석 · {team.stadium.ownership === 'longTermOperation' ? '장기 관리 위탁 (식음료·광고 수익 구단)' : '지자체 소유 임대'}
                {team.stadium.park ? ` · 구장 계수 ${team.stadium.park.toFixed(2)}` : ''}
                {building ? ` · ${plan.opens}년 새 구장 ${plan.seats?.toLocaleString('ko-KR')}석` : ''}
              </p>
            </div>
          </div>
          <h3>구장 공사</h3>
          <p class="muted">공사비는 구단 자금에서 바로 나갑니다 (모기업 지원은 운영 적자만 메웁니다). 비시즌(포스트시즌이 끝난 뒤 오프시즌 결정을 하는 동안)에 시작할 수 있고, 한 번에 하나씩 진행합니다. 증축·펜스 공사는 다음 시즌 개막 전에 끝납니다.</p>
          <div class="table-wrap">
            <table class="record-table">
              <tbody>
                {projectOptions(league).map((o) => (
                  <tr key={o.kind}>
                    <th scope="row">{o.label}</th>
                    <td class="muted small">{o.note}</td>
                    <td class="num">{money(o.cost)}</td>
                    <td>
                      <button type="button" disabled={!!o.blocked} title={o.blocked ?? ''} onClick={() => act({ kind: 'stadiumProject', project: o.kind as ProjectKind })}>
                        시작
                      </button>
                      {o.blocked && <div class="muted small">{o.blocked}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!u.projects?.length && (
            <>
              <h3>공사 기록</h3>
              <ul class="plain">
                {u.projects.map((p, i) => (
                  <li key={i}>
                    {p.label} · {money(p.cost)} · {p.opens}년 {p.opens > league.year || (p.opens === league.year && league.phase === 'offseason') ? '완공 예정' : '완공'}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>구장 이름</h3>
          <form class="inline-form" onSubmit={rename(stadiumName, 'current')}>
            <label>
              지금 홈구장
              <input value={stadiumName} maxLength={STADIUM_NAME_MAX} onInput={(e) => setStadiumName((e.currentTarget as HTMLInputElement).value)} />
            </label>
            <button type="submit">바꾸기</button>
          </form>
          {(building || u.projects?.some((p) => p.kind === 'newPark' && p.opens > league.year)) && (
            <form class="inline-form" onSubmit={rename(future, 'new')}>
              <label>
                새 구장 이름
                <input value={future} placeholder={`${cityById(u.settings.cityId)?.name ?? ''} 신구장`} maxLength={STADIUM_NAME_MAX} onInput={(e) => setFuture((e.currentTarget as HTMLInputElement).value)} />
              </label>
              <button type="submit">정하기</button>
            </form>
          )}
        </>
      )}

      {section === 'ledger' && (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table ledger">
            <tbody>
              {[...u.ledger]
                .reverse()
                .slice(0, 60)
                .map((l, i) => (
                  <tr key={i}>
                    <td class="num">{l.year}</td>
                    <td>{l.label}</td>
                    <td class={`num ${l.amount > 0 ? 'plus' : l.amount < 0 ? 'minus' : ''}`}>{l.amount ? signed(l.amount) : ''}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
