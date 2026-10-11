import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* The front office (V0.6): the owner's goals and verdicts, the accounts, fans and tickets, the staff and
   the ballpark. One section at a time behind a segmented control. */
import { useState } from 'preact/hooks';
import { goalText, STANCE_LABEL } from '../league/parent';
import { cityById } from '../club/cities';
import { PARENT_COMPANY_TYPES } from '../club/types';
import type { Action } from '../league/actions';
import { projectOptions, type ProjectKind } from '../league/ballpark';
import { capFloorFor, capTotal } from '../league/cap';
import { projectedPayroll, STADIUM_PLANS } from '../league/expansion';
import { boom, leaguePrice } from '../league/fans';
import { projectedReport, supportLabel } from '../league/finance';
import { MANAGER_STYLES, STAFF_EFFECTS, STAFF_LABELS, STAFF_ROLES } from '../league/staff';
import { AlumnusTag } from './Alumni';
import { firstTeamIds, type ClubReport, type LeagueState } from '../league/state';
import { booksOf } from '../league/foreigncap';
import { usd } from '../league/foreign';
import { FANS } from '../league/tuning';
import { checkStadiumName, STADIUM_NAME_MAX } from '../league/userclub';
import { salaryCapFor } from '../rules/kbo2026';
import { money } from './format';
import { Help } from './Help';
import { RivalryBox, TwelveSettingField } from './Twelve';
import { favourites } from '../league/life';
import { FACILITIES, FACILITY_KINDS, facilityLevel, facilityOptions, facilityUpkeep } from '../league/facilities';

type Section = 'summary' | 'owner' | 'money' | 'fans' | 'staff' | 'ballpark' | 'facilities' | 'rival' | 'ledger';
const SECTIONS: [Section, string][] = [
  ['summary', __i18n_k("ui.office.sECTIONS.3ea27a4d")],
  ['owner', __i18n_k("ui.office.sECTIONS.cf76b767")],
  ['money', __i18n_k("ui.office.sECTIONS.9cc23f63")],
  ['fans', __i18n_k("ui.office.sECTIONS.592df4d2")],
  ['staff', __i18n_k("ui.office.sECTIONS.c6e93014")],
  ['ballpark', __i18n_k("ui.office.sECTIONS.c2998c5f")],
  ['facilities', __i18n_k("ui.office.sECTIONS.b4de61be")],
  ['rival', __i18n_k("ui.office.sECTIONS.a91a78ef")],
  ['ledger', __i18n_k("ui.office.sECTIONS.024b01c3")],
];

/** 억 with one decimal ("101.9억"), for reports. */
const eok = (n: number) => (n ? __i18n_k("ui.office.eok.db0fc332", { value: (Math.round(n / 1000) / 10).toLocaleString('ko-KR') }) : '-');
const signed = (n: number) => (n < 0 ? `−${eok(-n)}` : n > 0 ? `+${eok(n)}` : '0');
const people = (n: number) => __i18n_k("ui.office.people.d8e22743", { value: Math.round(n).toLocaleString('ko-KR') });

const REVENUE: [keyof ClubReport['revenue'], string][] = [
  ['gate', __i18n_k("ui.office.rEVENUE.78819cd4")],
  ['broadcast', __i18n_k("ui.office.rEVENUE.64e095c0")],
  ['sponsors', __i18n_k("ui.office.rEVENUE.271e26a5")],
  ['naming', __i18n_k("ui.office.rEVENUE.07ad0206")],
  ['merchandise', __i18n_k("ui.office.rEVENUE.a4c284ac")],
  ['concessions', __i18n_k("ui.office.rEVENUE.555b670f")],
  ['postseason', __i18n_k("ui.office.rEVENUE.bd1bbac3")],
];
const EXPENSES: [keyof ClubReport['expenses'], string][] = [
  ['players', __i18n_k("ui.office.eXPENSES.13aa5c72")],
  ['staff', __i18n_k("ui.office.eXPENSES.7e237d70")],
  ['frontOffice', __i18n_k("ui.office.eXPENSES.dc589bb4")],
  ['gameDays', __i18n_k("ui.office.eXPENSES.4b416dde")],
  ['ballpark', __i18n_k("ui.office.eXPENSES.cef6bc71")],
  ['farm', __i18n_k("ui.office.eXPENSES.c89e0231")],
  ['marketing', __i18n_k("ui.office.eXPENSES.24c6b09f")],
];

function ReportTable({ reports }: { reports: { title: string; r: ClubReport }[] }) {
  const total = (r: ClubReport, side: 'revenue' | 'expenses') => Object.values(r[side]).reduce((a, b) => a + b, 0);
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table report-table">
        <thead>
          <tr>
            <th />
            {__i18n_display(reports.map((x) => (
              <th key={x.title} class="num">
                {__i18n_display(x.title)}
              </th>
            )))}
          </tr>
        </thead>
        <tbody>
          <tr class="report-head">
            <th colSpan={reports.length + 1}>{__i18n_t("ui.office.reportTable.1acbb6c3")}</th>
          </tr>
          {__i18n_display(REVENUE.filter(([k]) => reports.some((x) => x.r.revenue[k])).map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{__i18n_display(label)}</th>
              {__i18n_display(reports.map((x) => (
                <td key={x.title} class="num">
                  {__i18n_display(eok(x.r.revenue[k]))}
                </td>
              )))}
            </tr>
          )))}
          <tr class="report-sum">
            <th scope="row">{__i18n_t("ui.office.reportTable.7928fec2")}</th>
            {__i18n_display(reports.map((x) => (
              <td key={x.title} class="num strong">
                {__i18n_display(eok(total(x.r, 'revenue')))}
              </td>
            )))}
          </tr>
          <tr class="report-head">
            <th colSpan={reports.length + 1}>{__i18n_t("ui.office.reportTable.9636df7e")}</th>
          </tr>
          {__i18n_display(EXPENSES.map(([k, label]) => (
            <tr key={k}>
              <th scope="row">{__i18n_display(label)}</th>
              {__i18n_display(reports.map((x) => (
                <td key={x.title} class="num">
                  {__i18n_display(eok(x.r.expenses[k]))}
                </td>
              )))}
            </tr>
          )))}
          <tr class="report-sum">
            <th scope="row">{__i18n_t("ui.office.reportTable.0e0bf71e")}</th>
            {__i18n_display(reports.map((x) => (
              <td key={x.title} class="num strong">
                {__i18n_display(eok(total(x.r, 'expenses')))}
              </td>
            )))}
          </tr>
          <tr class="report-sum">
            <th scope="row">{__i18n_t("ui.office.reportTable.467ac3b5")}</th>
            {__i18n_display(reports.map((x) => (
              <td key={x.title} class={`num strong ${x.r.operating >= 0 ? 'plus' : 'minus'}`}>
                {__i18n_display(signed(x.r.operating))}
              </td>
            )))}
          </tr>
          <tr>
            <th scope="row">{__i18n_t("ui.office.reportTable.bdee14e5")}</th>
            {__i18n_display(reports.map((x) => (
              <td key={x.title} class="num">
                {__i18n_display(x.r.cashFlows != null ? signed(x.r.cashFlows) : '-')}
              </td>
            )))}
          </tr>
          <tr>
            <th scope="row">{__i18n_t("ui.office.reportTable.8ebca1f0")}</th>
            {__i18n_display(reports.map((x) => (
              <td key={x.title} class="num">
                {__i18n_display(eok(x.r.support))}
              </td>
            )))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Office({ league, onAct, setMsg, onPlayer }: { league: LeagueState; onAct: (a: Action) => void; setMsg: (m: string) => void; onPlayer?: (id: string) => void }) {
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
  // V0.12: the owner's budget paid at opening, and where the fund should end the season.
  const budget = u.seasonSupport?.year === league.year && inSeason ? u.seasonSupport : null;
  const tickets = club?.seasonTickets?.year === league.year ? club.seasonTickets : null;
  const expectedFund = u.fund + (current?.operating ?? 0) - (tickets?.paid ?? 0);

  return (
    <>
      <div class="segmented office-tabs" role="group" aria-label={__i18n_t("ui.office.office.6bc69497")}>
        {__i18n_display(SECTIONS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)}>
            {__i18n_display(label)}
          </button>
        )))}
      </div>

      {__i18n_display(section === 'summary' && (
        <div class="cards">
          <div class="card">
            <p class="card-label">{__i18n_t("ui.office.office.4f7776dd")}</p>
            <p class="card-value">{__i18n_display(u.fund < 0 ? `−${money(-u.fund)}` : money(u.fund))}</p>
            <p class="card-sub">
              {__i18n_display(budget ? __i18n_k("ui.office.office.e2a98cef", { money: money(budget.amount) }) : __i18n_k("ui.office.office.1f9754ab", { money: money(u.support ?? 0) }))} ({__i18n_display(PARENT_COMPANY_TYPES[u.settings.parentType].label)})
            </p>
          </div>
          {__i18n_display(budget && current && (
            <div class="card">
              <p class="card-label">{__i18n_t("ui.office.office.a549279b", { year: league.year })}</p>
              <p class={`card-value ${expectedFund < 0 ? 'minus' : ''}`}>{__i18n_display(expectedFund < 0 ? `−${money(-expectedFund)}` : money(expectedFund))}</p>
              <p class="card-sub">{__i18n_display(expectedFund < 0 ? __i18n_k("ui.office.office.b127ecc4") : __i18n_k("ui.office.office.fb59150d"))}</p>
            </div>
          ))}
          <div class="card">
            <p class="card-label">{__i18n_t("ui.office.office.26719725", { payYear: payYear })}</p>
            <p class="card-value">{__i18n_display(money(projectedPayroll(league, u.teamId, payYear)))}</p>
            <p class="card-sub">{__i18n_t("ui.office.office.43fc4f2a", { money: money(u.payrollBudget) })}</p>
          </div>
          <div class="card">
            <p class="card-label">{__i18n_t("ui.office.office.e4762814")}</p>
            <p class="card-value">{__i18n_display(Math.round(u.trust ?? 60))}</p>
            <p class="card-sub">{__i18n_display(ev ? __i18n_k("ui.office.office.35024d86", { year: ev.year, value: ev.change >= 0 ? '+' : '', value2: Math.round(ev.change * 100) }) : __i18n_k("ui.office.office.d7179635"))}</p>
          </div>
          <div class="card">
            <p class="card-label">{__i18n_display(inSeason ? __i18n_k("ui.office.office.d6202a74", { year: league.year }) : __i18n_k("ui.office.office.ddb533ae"))}</p>
            <p class="card-value">{__i18n_display(avgNow ? people(avgNow) : last?.homeGames ? people(last.fans / last.homeGames) : '-')}</p>
            <p class="card-sub">{__i18n_t("ui.office.office.49d5c582", { value: team.stadium.capacity.toLocaleString('ko-KR'), value2: gate?.sellouts ? __i18n_k("ui.office.office.4df2ece0", { sellouts: gate.sellouts }) : '' })}</p>
          </div>
          <div class="card">
            <p class="card-label">{__i18n_display(inSeason ? __i18n_k("ui.office.office.c7828ad8", { year: league.year }) : __i18n_k("ui.office.office.c7921155"))}</p>
            <p class="card-value">{__i18n_display(current ? signed(current.operating) : last ? signed(last.operating) : '-')}</p>
            <p class="card-sub">{__i18n_t("ui.office.office.4f849627")}</p>
          </div>
          <div class="card">
            <p class="card-label">{__i18n_t("ui.office.office.b2f10443", { year: league.year })}</p>
            <p class="card-value">{__i18n_display(money(capTotal(league, u.teamId, league.year)))}</p>
            <p class="card-sub">{__i18n_t("ui.office.office.a5785887", { money: money(salaryCapFor(league.year)), value: capFloorFor(league.year) ? __i18n_k("ui.office.office.75c3db8c", { money: money(capFloorFor(league.year)!) }) : '' })}</p>
          </div>
          {__i18n_display(firstTeamIds(league).includes(u.teamId) && league.phase === 'regular' && (
            <div class="card">
              <p class="card-label">{__i18n_t("ui.office.office.2f4e295b")}</p>
              <p class="card-value">{__i18n_display(usd(booksOf(league, u.teamId).spent))}</p>
              <p class="card-sub">{__i18n_t("ui.office.office.e38a2ec4", { usd: usd(booksOf(league, u.teamId).cap), value: (league.foreignCap?.[u.teamId] ?? []).at(-1)?.over ? __i18n_k("ui.office.office.fe9a9481", { streak: (league.foreignCap![u.teamId]!).at(-1)!.streak }) : '' })}</p>
            </div>
          ))}
        </div>
      ))}

      {__i18n_display(section === 'owner' && (
        <>
          <p>{__i18n_t("ui.office.office.23e06536", { name: team.parent.name, label: PARENT_COMPANY_TYPES[u.settings.parentType].label, summary: PARENT_COMPANY_TYPES[u.settings.parentType].summary })}</p>
          <div class="cards">
            <div class="card">
              <p class="card-label">{__i18n_t("ui.office.office.690b214a")}</p>
              <p class="card-value">{__i18n_display(money(u.support ?? 0))}</p>
              <p class="card-sub">{__i18n_t("ui.office.office.2a6ceb48", { supportLabel: supportLabel(u.settings.parentType) })}</p>
            </div>
            <div class="card">
              <p class="card-label">{__i18n_t("ui.office.office.02690edc")}</p>
              <p class="card-value">{__i18n_display(Math.round(u.trust ?? 60))} / 100</p>
              <p class="card-sub">{__i18n_display(u.settings.firing ? __i18n_k("ui.office.office.b02603a1") : __i18n_k("ui.office.office.10d70f14"))}</p>
            </div>
            {__i18n_display(club?.sponsor && (
              <div class="card">
                <p class="card-label">{__i18n_t("ui.office.office.2d7807db")}</p>
                <p class="card-value small">{__i18n_display(club.sponsor.name)}</p>
                <p class="card-sub">{__i18n_t("ui.office.office.40d56696", { money: money(club.sponsor.annual), until: club.sponsor.until, goalText: goalText(club.sponsor.goal), value: club.sponsor.risk ? __i18n_k("ui.office.office.e42a1180", { value: Math.round(club.sponsor.risk * 100) }) : '', value2: club.sponsor.missed ? __i18n_k("ui.office.office.1e437410", { missed: club.sponsor.missed }) : '' })}</p>
              </div>
            ))}
            {__i18n_display(u.mayor && (
              <div class="card">
                <p class="card-label">{__i18n_t("ui.office.office.7f591410")}</p>
                <p class={`card-value small ${u.mayor.stance === 'friendly' ? 'plus' : u.mayor.stance === 'hostile' ? 'minus' : ''}`}>
                  {__i18n_display(u.mayor.name)} · {__i18n_display(STANCE_LABEL[u.mayor.stance])}
                </p>
                <p class="card-sub">{__i18n_t("ui.office.office.fac6e6a5", { since: u.mayor.since, until: u.mayor.until, until2: u.mayor.until, value: u.mayor.stance === 'friendly' ? '+15%' : u.mayor.stance === 'hostile' ? __i18n_k("ui.office.office.82a36c44") : __i18n_k("ui.office.office.82f499a9") })}</p>
              </div>
            ))}
          </div>
          {__i18n_display(u.settings.parentType === 'citizen' && (
            <p class="muted small">{__i18n_t("ui.office.office.a2b02ead")}</p>
          ))}
          {__i18n_display(u.parentGifts?.length ? (
            <p class="small">{__i18n_t("ui.office.office.59e4b678", { value: u.parentGifts.map((g) => __i18n_k("ui.office.office.6be558c9", { name: g.name, money: money(g.annual), from: g.from, to: g.to })).join(', ') })}</p>
          ) : null)}
          {__i18n_display(u.fired && <p class="notice warn">{__i18n_t("ui.office.office.667abded", { fired: u.fired })}</p>)}
          <h3>{__i18n_display(goals ? __i18n_k("ui.office.office.b7fa9f1b", { year: goals.year }) : __i18n_k("ui.office.office.2fbea43b"))}</h3>
          {__i18n_display(goals ? (
            <ul class="plain">
              <li>{__i18n_t("ui.office.office.fea44625", { rank: goals.rank })}</li>
              <li>{__i18n_t("ui.office.office.a2ca70d0", { value: goals.fans.toLocaleString('ko-KR') })}</li>
              <li>{__i18n_t("ui.office.office.fa6a357a", { money: money(-goals.result) })}</li>
            </ul>
          ) : (
            <p class="muted">{__i18n_t("ui.office.office.0e94c3fe")}</p>
          ))}
          <h3>{__i18n_t("ui.office.office.a5e22b1c")}</h3>
          {__i18n_display(u.evaluations?.length ? (
            <div class="table-wrap">
              <table class="record-table">
                <thead>
                  <tr>
                    <th class="num">{__i18n_t("ui.office.office.d5bc99dd")}</th>
                    <th>{__i18n_t("ui.office.office.d3bb3576")}</th>
                    <th>{__i18n_t("ui.office.office.f3384bbb")}</th>
                    <th>{__i18n_t("ui.office.office.9cc23f63")}</th>
                    <th class="num">{__i18n_t("ui.office.office.5911d7fd")}</th>
                    <th class="num">{__i18n_t("ui.office.office.02690edc")}</th>
                  </tr>
                </thead>
                <tbody>
                  {__i18n_display([...u.evaluations].reverse().map((e) => (
                    <tr key={e.year}>
                      <td class="num">{__i18n_display(e.year)}</td>
                      {__i18n_display(e.lines.map((l) => (
                        <td key={l.label} class={l.ok ? 'plus' : 'minus'}>
                          {__i18n_display(l.ok ? __i18n_k("ui.office.office.f3b8c1b4") : __i18n_k("ui.office.office.a72490af"))} <span class="muted small">{__i18n_display(l.text)}</span>
                        </td>
                      )))}
                      <td class="num">
                        {__i18n_display(e.change >= 0 ? '+' : '')}
                        {__i18n_display(Math.round(e.change * 100))}%
                      </td>
                      <td class="num">{__i18n_display(Math.round(e.trust))}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          ) : (
            <p class="muted">{__i18n_t("ui.office.office.cc66b5b6")}</p>
          ))}
        </>
      ))}

      {__i18n_display(section === 'money' && (
        <>
          <Help title={__i18n_t("ui.office.office.43aae799")}>{__i18n_t("ui.office.office.d22c946b")}</Help>
          {__i18n_display(current || reports.length ? (
            <ReportTable
              reports={[
                ...(current ? [{ title: __i18n_k("ui.office.office.title.21d87f74", { year: league.year }), r: current }] : []),
                ...reports
                  .slice(-3)
                  .reverse()
                  .map((r) => ({ title: String(r.year), r })),
              ]}
            />
          ) : (
            <p class="muted">{__i18n_t("ui.office.office.4bf4deac")}</p>
          ))}
        </>
      ))}

      {__i18n_display(section === 'fans' && club && (
        <>
          <div class="cards">
            <div class="card">
              <p class="card-label">{__i18n_t("ui.office.office.31f5808f")}</p>
              <p class="card-value">{__i18n_display(club.popularity.toLocaleString('ko-KR'))}</p>
              <p class="card-sub">{__i18n_t("ui.office.office.a60ee308")}</p>
            </div>
            <div class="card">
              <p class="card-label">{__i18n_t("ui.office.office.229dfa7f")}</p>
              <p class="card-value">{__i18n_display(club.interest >= 0.3 ? __i18n_k("ui.office.office.3f164c51") : club.interest >= 0.1 ? __i18n_k("ui.office.office.5cd0d95b") : club.interest > -0.1 ? '보통' : club.interest > -0.3 ? __i18n_k("ui.office.office.e5218525") : __i18n_k("ui.office.office.d5228f84"))}</p>
              <p class="card-sub">{__i18n_t("ui.office.office.645c0d08")}</p>
            </div>
            <div class="card">
              <p class="card-label">{__i18n_display(inSeason ? __i18n_k("ui.office.office.22619ed5", { year: league.year }) : __i18n_k("ui.office.office.385f86ad"))}</p>
              <p class="card-value">{__i18n_display(gate?.games ? people(gate.fans / gate.games) : last?.homeGames ? people(last.fans / last.homeGames) : '-')}</p>
              <p class="card-sub">{__i18n_t("ui.office.office.6a3a7463", { value: gate?.games ? __i18n_k("ui.office.office.7fc98ae2", { games: gate.games, people: people(gate.fans), sellouts: gate.sellouts }) : last ? __i18n_k("ui.office.office.47deea69", { people: people(last.fans) }) : '', value2: boom(league.year).toFixed(2) })}</p>
            </div>
          </div>
          <h3>{__i18n_t("ui.office.office.d69ae5fd")}</h3>
          <p class="muted small">{__i18n_t("ui.office.office.605b7278")}</p>
          <ol class="plain favourites">
            {__i18n_display(favourites(league, u.teamId, 5).map(({ p, love }) => (
              <li key={p.id}>
                {__i18n_display(p.name)} <span class="muted small">{__i18n_display(love)}</span>
              </li>
            )))}
          </ol>
          <h3>{__i18n_t("ui.office.office.59af3a03")}</h3>
          <p class="muted">{__i18n_t("ui.office.office.1310da3f", { value: priceWon(1).toLocaleString('ko-KR') })}</p>
          <label class="inline-form">
            객단가
            <select value={club.price.toFixed(2)} onChange={(e) => act({ kind: 'ticketPrice', level: Number((e.currentTarget as HTMLSelectElement).value) })} aria-label={__i18n_t("ui.office.office.59af3a03")}>
              {__i18n_display(Array.from({ length: Math.round((FANS.priceMax - FANS.priceMin) / 0.05) + 1 }, (_, i) => Math.round((FANS.priceMin + i * 0.05) * 100) / 100).map((lv) => (
                <option key={lv} value={lv.toFixed(2)}>{__i18n_t("ui.office.office.c586fe06", { value: Math.round(lv * 100), value2: priceWon(lv).toLocaleString('ko-KR') })}</option>
              )))}
            </select>
          </label>
          <h3>{__i18n_t("ui.office.office.9e4505ff")}</h3>
          <p class="muted">{__i18n_t("ui.office.office.627a6285", { value: tickets ? __i18n_k("ui.office.office.57f49a0f", { value: tickets.sold.toLocaleString('ko-KR'), value2: Math.round(tickets.discount * 100), money: money(tickets.paid) }) : '' })}</p>
          <label class="inline-form">
            {__i18n_display(inSeason ? __i18n_k("ui.office.office.611da534") : __i18n_k("ui.office.office.c9ebe16b"))}
            <select value={String(club.seasonTicketDiscount ?? 0)} onChange={(e) => act({ kind: 'seasonTickets', discount: Number((e.currentTarget as HTMLSelectElement).value) })} aria-label={__i18n_t("ui.office.office.c6f740eb")}>
              {__i18n_display([0, 0.1, 0.2, 0.3].map((d) => (
                <option key={d} value={String(d)}>
                  {__i18n_display(d ? __i18n_k("ui.office.office.b23ee876", { value: Math.round(d * 100) }) : __i18n_k("ui.office.office.d25e7359"))}
                </option>
              )))}
            </select>
          </label>
          <h3>{__i18n_t("ui.office.office.24c6b09f")}</h3>
          <p class="muted">{__i18n_t("ui.office.office.fd6ec273", { money: money(FANS.marketing.base) })}</p>
          <label class="inline-form">
            연간 마케팅비
            <select value={String(club.marketing)} onChange={(e) => act({ kind: 'marketing', amount: Number((e.currentTarget as HTMLSelectElement).value) })} aria-label={__i18n_t("ui.office.office.f3365803")}>
              {__i18n_display(Array.from({ length: FANS.marketing.max / 50_000 + 1 }, (_, i) => i * 50_000).map((v) => (
                <option key={v} value={String(v)}>
                  {__i18n_display(v ? money(v) : '0')}
                </option>
              )))}
            </select>
          </label>
        </>
      ))}

      {__i18n_display(section === 'staff' && club && (
        <>
          <p class="muted">{__i18n_t("ui.office.office.719f91f5")}</p>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table">
              <thead>
                <tr>
                  <th>{__i18n_t("ui.office.office.9e7bc39f")}</th>
                  <th>{__i18n_t("ui.office.office.9aa18e50")}</th>
                  <th class="num">{__i18n_t("ui.office.office.89dbf513")}</th>
                  <th class="num">{__i18n_t("ui.office.office.6c620e5c")}</th>
                  <th class="num">{__i18n_t("ui.office.office.cbf383ec")}</th>
                  <th>{__i18n_t("ui.office.office.b4116369")}</th>
                  <th>{__i18n_t("ui.office.office.135e66f0")}</th>
                </tr>
              </thead>
              <tbody>
                {__i18n_display(STAFF_ROLES.map((role) => {
                  const m = club.staff?.[role];
                  return (
                    <tr key={role}>
                      <th scope="row">{__i18n_display(STAFF_LABELS[role])}</th>
                      <td>
                        {__i18n_display(m?.name ?? '-')}
                        {__i18n_display(m?.style && <span class="muted"> · {__i18n_display(MANAGER_STYLES[m.style].label)}</span>)}
                        <AlumnusTag league={league} m={m} onPlayer={onPlayer} />
                      </td>
                      <td class="num strong">{__i18n_display(m?.rating ?? '-')}</td>
                      <td class="num">{__i18n_display(m?.age ?? '-')}</td>
                      <td class="num">{__i18n_display(m ? money(m.salary) : '-')}</td>
                      <td>{__i18n_display(m ? __i18n_k("ui.office.office.9c7dfa36", { until: m.until }) : '-')}</td>
                      <td class="muted small">
                        {__i18n_display(STAFF_EFFECTS[role])}
                        {__i18n_display(m?.style ? ` (${MANAGER_STYLES[m.style].note})` : '')}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </>
      ))}

      {__i18n_display(section === 'ballpark' && (
        <>
          <div class="cards">
            <div class="card">
              <p class="card-label">{__i18n_t("ui.office.office.5b164a3b")}</p>
              <p class="card-value small">{__i18n_display(team.stadium.name)}</p>
              <p class="card-sub">{__i18n_t("ui.office.office.705a9981", { value: team.stadium.capacity.toLocaleString('ko-KR'), value2: team.stadium.ownership === 'longTermOperation' ? __i18n_k("ui.office.office.9886484b") : __i18n_k("ui.office.office.3446f47b"), value3: team.stadium.park ? __i18n_k("ui.office.office.cf01af49", { value: team.stadium.park.toFixed(2) }) : '', value4: building ? __i18n_k("ui.office.office.a3d78ace", { opens: plan.opens, value: plan.seats?.toLocaleString('ko-KR') }) : '' })}</p>
            </div>
          </div>
          <h3>{__i18n_t("ui.office.office.dd5f98fe")}</h3>
          <p class="muted">{__i18n_t("ui.office.office.3239d1e3")}</p>
          <div class="table-wrap">
            <table class="record-table">
              <tbody>
                {__i18n_display(projectOptions(league).map((o) => (
                  <tr key={o.kind}>
                    <th scope="row">{__i18n_display(o.label)}</th>
                    <td class="muted small">{__i18n_display(o.note)}</td>
                    <td class="num">{__i18n_display(money(o.cost))}</td>
                    <td>
                      <button type="button" disabled={!!o.blocked} title={__i18n_displayText(o.blocked ?? '')} onClick={() => act({ kind: 'stadiumProject', project: o.kind as ProjectKind })}>{__i18n_t("ui.office.office.e89cc866")}</button>
                      {__i18n_display(o.blocked && <div class="muted small">{__i18n_display(o.blocked)}</div>)}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          {__i18n_display(!!u.projects?.length && (
            <>
              <h3>{__i18n_t("ui.office.office.0a2532f5")}</h3>
              <ul class="plain">
                {__i18n_display(u.projects.map((p, i) => (
                  <li key={i}>{__i18n_t("ui.office.office.5f9fb35e", { label: p.label, money: money(p.cost), opens: p.opens, value: p.opens > league.year || (p.opens === league.year && league.phase === 'offseason') ? __i18n_k("ui.office.office.ec76e26b") : __i18n_k("ui.office.office.0616e1f0") })}</li>
                )))}
              </ul>
            </>
          ))}
          <h3>{__i18n_t("ui.office.office.f61c862b")}</h3>
          <form class="inline-form" onSubmit={rename(stadiumName, 'current')}>
            <label>
              지금 홈구장
              <input value={stadiumName} maxLength={STADIUM_NAME_MAX} onInput={(e) => setStadiumName((e.currentTarget as HTMLInputElement).value)} />
            </label>
            <button type="submit">{__i18n_t("ui.office.office.75b73b7f")}</button>
          </form>
          {__i18n_display((building || u.projects?.some((p) => p.kind === 'newPark' && p.opens > league.year)) && (
            <form class="inline-form" onSubmit={rename(future, 'new')}>
              <label>
                새 구장 이름
                <input value={future} placeholder={__i18n_displayText(__i18n_k("ui.office.office.d7422702", { value: cityById(u.settings.cityId)?.name ?? '' }))} maxLength={STADIUM_NAME_MAX} onInput={(e) => setFuture((e.currentTarget as HTMLInputElement).value)} />
              </label>
              <button type="submit">{__i18n_t("ui.office.office.be42a39b")}</button>
            </form>
          ))}
        </>
      ))}

      {__i18n_display(section === 'facilities' && <Facilities league={league} act={act} />)}

      {__i18n_display(section === 'rival' && (
        <>
          {__i18n_display(league.twelve ? (
            <RivalryBox league={league} />
          ) : (
            <>
              <p>{__i18n_t("ui.office.office.8a0c79d3")}</p>
              <TwelveSettingField
                value={u.settings.twelve ?? { mode: 'off' }}
                from={Math.max(u.firstTeamYear, league.phase === 'offseason' ? (league.offseason?.year ?? league.year) + 1 : league.year)}
                onChange={(setting) => act({ kind: 'twelveSetting', setting })}
              />
              {__i18n_display(u.twelveNo?.length ? <p class="muted small">{__i18n_t("ui.office.office.ef2d2d30", { value: u.twelveNo.join(', ') })}</p> : null)}
            </>
          ))}
        </>
      ))}

      {__i18n_display(section === 'ledger' && (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table ledger">
            <tbody>
              {__i18n_display([...u.ledger]
                .reverse()
                .slice(0, 60)
                .map((l, i) => (
                  <tr key={i}>
                    <td class="num">{__i18n_display(l.year)}</td>
                    <td>{__i18n_display(l.label)}</td>
                    <td class={`num ${l.amount > 0 ? 'plus' : l.amount < 0 ? 'minus' : ''}`}>{__i18n_display(l.amount ? signed(l.amount) : '')}</td>
                  </tr>
                )))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

/** Ballpark improvements and training facilities (V0.10): what is built, what is under way, and the next level of each. */
function Facilities({ league, act }: { league: LeagueState; act: (a: Action) => void }) {
  const u = league.user!;
  const options = facilityOptions(league);
  const upkeep = facilityUpkeep(league, u.teamId);
  const works = (u.facilityWorks ?? []).filter((w) => (u.facilities?.[w.kind] ?? 0) < w.level);
  return (
    <>
      <p class="muted">{__i18n_t("ui.office.facilities.40f51d90", { value: ' ', value2: upkeep.ballpark ? __i18n_k("ui.office.facilities.26b4e2d2", { money: money(upkeep.ballpark) }) : __i18n_k("ui.office.facilities.d58fa73a"), value3: upkeep.training ? __i18n_k("ui.office.facilities.26b4e2d2", { money: money(upkeep.training) }) : __i18n_k("ui.office.facilities.d58fa73a") })}</p>
      {__i18n_display(works.length > 0 && <p>{__i18n_t("ui.office.facilities.48f9a41d", { value: works.map((w) => __i18n_k("ui.office.facilities.40c13d17", { label: FACILITIES[w.kind].label, level: w.level, opens: w.opens })).join(', ') })}</p>)}
      {__i18n_display((['ballpark', 'training'] as const).map((group) => (
        <div key={group}>
          <h3>{__i18n_display(group === 'ballpark' ? __i18n_k("ui.office.facilities.51cd520c") : __i18n_k("ui.office.facilities.3de88399"))}</h3>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table facilities">
              <thead>
                <tr>
                  <th>{__i18n_t("ui.office.facilities.b4de61be")}</th>
                  <th>{__i18n_t("ui.office.facilities.d07eb370")}</th>
                  <th>{__i18n_t("ui.office.facilities.cd6f9480")}</th>
                  <th class="num">{__i18n_t("ui.office.facilities.47546b51")}</th>
                  <th class="num">{__i18n_t("ui.office.facilities.e5e81174")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {__i18n_display(FACILITY_KINDS.filter((k) => FACILITIES[k].group === group).map((kind) => {
                  const spec = FACILITIES[kind];
                  const level = facilityLevel(league, kind);
                  const o = options.find((x) => x.kind === kind);
                  const nextLevel = o ? spec.levels[o.level - 1]! : null;
                  return (
                    <tr key={kind}>
                      <td>
                        <strong>{__i18n_display(spec.label)}</strong>
                        <div class="muted small">{__i18n_display(spec.note)}</div>
                      </td>
                      <td class="small">{__i18n_display(level ? __i18n_k("ui.office.facilities.ae6cf329", { level: level, effect: spec.levels[level - 1]!.effect }) : __i18n_k("ui.office.facilities.d58fa73a"))}</td>
                      <td class="small">{__i18n_display(nextLevel ? __i18n_k("ui.office.facilities.4f82a0da", { level: o!.level, effect: nextLevel.effect, opens: o!.opens }) : __i18n_k("ui.office.facilities.14ab5a3d"))}</td>
                      <td class="num">{__i18n_display(nextLevel ? money(nextLevel.cost) : '-')}</td>
                      <td class="num">{__i18n_display(nextLevel ? __i18n_k("ui.office.facilities.26b4e2d2", { money: money(nextLevel.upkeep) }) : '-')}</td>
                      <td>
                        {__i18n_display(o && (
                          <button type="button" disabled={!!o.blocked} title={__i18n_displayText(o.blocked ?? '')} onClick={() => act({ kind: 'facility', facility: kind })}>{__i18n_t("ui.office.facilities.c9f20f50")}</button>
                        ))}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      )))}
      {__i18n_display(options[0]?.blocked && <p class="muted small">{__i18n_display(options[0].blocked)}</p>)}
    </>
  );
}
