import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { draftContracts, TOOL_LABELS, type Difficulty } from '../draftroom';
import { salaryIn, usdTotal } from '../league/contracts';
import { usd } from '../league/foreign';
import { kboLine, poolEntry } from '../league/foreignpool';
import { autoDecision, checkDecision, faAsk, projectedPayroll, type DecisionInput } from '../league/expansion';
import { sangmuChance } from '../league/offseason';
import { ageIn, isPitcher, keepValue } from '../league/players';
import type { Decision as DecisionT, LeagueState } from '../league/state';
import { faAsk as ownAsk, focusOptions, payrollWithout, salaryOffer, type CampPlan, type MilitaryOrder, type SalaryChoice } from '../league/userclub';
import { marketValue } from '../league/market';
import { eulreul, iga, ro } from '../league/josa';
import { positionLabel, shortName } from '../league/views';
import { MANAGER_STYLES, STAFF_EFFECTS, STAFF_LABELS } from '../league/staff';
import type { Position } from '../model/position';
import type { Player, PlayerId, TeamId } from '../model/types';
import { money } from './format';
import { positionKey, useSort, type SortColumn } from './sort';

interface Props {
  league: LeagueState;
  onSubmit: (input: DecisionInput) => void;
  onPlayer: (id: PlayerId) => void;
}

const TITLES: Record<DecisionT['kind'], string> = {
  tryout: '창단 트라이아웃',
  draftPick: '신인 드래프트',
  freeAgents: 'FA 영입 (신생구단 특례)',
  specialDraft: '특별지명',
  released: '방출선수 영입',
  foreign: '외국인 선수 계약',
  roster: '소속선수 정리',
  military: '병역',
  ownFreeAgents: 'FA 재계약',
  rookieBonus: '신인 계약금 협상',
  development: '육성선수 계약',
  camp: '스프링캠프',
  faMarket: 'FA 시장',
  faProtect: 'FA 보상 · 보호선수 명단',
  faCompensation: 'FA 보상 · 보상선수 지명',
  salaries: '연봉 협상',
  secondProtect: '2차 드래프트 · 보호선수 명단',
  secondPick: '2차 드래프트',
  foreignRenew: '외국인 선수 재계약',
  posting: '포스팅 (메이저리그 진출)',
  returnee: '해외 복귀 선수',
  sponsor: '명명권 스폰서 계약',
  staff: '코칭스태프 · 프런트',
};

/** What the scouts hear about major league interest, from the public grade. */
const mlbInterest = (p: Player) => (p.scouting.current >= 68 ? '매우 높음' : p.scouting.current >= 63 ? '높음' : p.scouting.current >= 60 ? '보통' : '낮음');

const SALARY_CHOICES: [SalaryChoice, string][] = [
  ['merit', '고과대로'],
  ['ask', '요구액 수용'],
  ['freeze', '동결'],
  ['extension', '다년계약 제안'],
];

const FA_BIDS: [string, string, number][] = [
  ['none', '제시 안 함', 0],
  ['base', '시장가', 1],
  ['p10', '시장가 +10%', 1.1],
  ['p20', '시장가 +20%', 1.2],
];

const lastWar = (p: Player) => p.career.filter((c) => !c.level).at(-1)?.war;
const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const POSITION_NAMES: Record<Position, string> = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수' };
const toolLabel = (k: string) => (k === 'balanced' ? '고르게' : ((TOOL_LABELS as Record<string, string>)[k] ?? k));
const pct = (x: number) => `${Math.round(x * 100)}%`;

type Extra = { title: string; value: (p: Player) => string; sort?: (p: Player) => number };

/** Sortable player columns shared by the decision tables: name, position, age, current, future (+ one extra). */
function usePlayerSort(players: Player[], year: number, extra?: Extra) {
  const columns: Record<string, SortColumn<Player>> = {
    name: { value: (p) => p.name },
    pos: { value: (p) => positionKey(positionLabel(p)), first: 1 },
    age: { value: (p) => ageIn(p, year), first: 1 },
    current: { value: (p) => p.scouting.current },
    future: { value: (p) => p.scouting.futureValue },
    extra: { value: (p) => extra?.sort?.(p) ?? 0 },
  };
  return useSort(players, columns);
}

function PlayerTable({
  league,
  players,
  selected,
  toggle,
  onPlayer,
  extra,
  name,
  radio,
  control,
}: {
  league: LeagueState;
  players: Player[];
  selected?: Set<PlayerId>;
  toggle?: (id: PlayerId) => void;
  onPlayer: (id: PlayerId) => void;
  extra?: Extra;
  name?: string;
  radio?: boolean;
  /** A control per row instead of the checkbox (select boxes). */
  control?: (p: Player) => ComponentChildren;
}) {
  const year = league.offseason ? league.offseason.year + 1 : league.year + 1;
  const { sorted, th } = usePlayerSort(players, year, extra);
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table pick-table">
        <thead>
          <tr>
            {!control && <th aria-label="선택" />}
            {th('name', '이름')}
            {th('pos', '포지션')}
            {th('age', '나이', true)}
            <th>경력</th>
            {th('current', '현재', true)}
            {th('future', '미래', true)}
            {extra && (extra.sort ? th('extra', extra.title, true) : <th class="num">{extra.title}</th>)}
            {control && <th>결정</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} class="player-row" aria-selected={selected?.has(p.id)}>
              {!control && (
                <td>
                  <input
                    type={radio ? 'radio' : 'checkbox'}
                    name={name}
                    checked={selected?.has(p.id)}
                    onChange={() => toggle?.(p.id)}
                    aria-label={`${p.name} 선택`}
                  />
                </td>
              )}
              <td>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>
                {p.contract?.kind === 'development' && <span class="tag">육성</span>}
              </td>
              <td>{positionLabel(p)}</td>
              <td class="num">{ageIn(p, year)}</td>
              <td class="muted">
                {p.teamId
                  ? shortName(league, p.teamId)
                  : poolEntry(league, p.id)
                    ? kboLine(league, p)
                    : p.service.postedIn !== undefined
                      ? `메이저리그 (${p.service.postedIn}년 포스팅)`
                      : p.origin.kind === 'foreign'
                        ? p.education.pathText
                        : p.career.length
                          ? '방출'
                          : p.origin.pathway}
              </td>
              <td class="num">{p.scouting.current}</td>
              <td class="num strong">{p.scouting.futureValue}</td>
              {extra && <td class="num">{extra.value(p)}</td>}
              {control && <td>{control(p)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The draft board on the clock: every heading sorts, the scouts' top three are marked. */
function DraftTable({ league, onPlayer, onPick }: { league: LeagueState; onPlayer: (id: PlayerId) => void; onPick: (id: PlayerId) => void }) {
  const draft = league.offseason!.draft!;
  const pool = useMemo(() => draft.pool.map((id) => league.players[id]!).sort((a, b) => a.amateur.draftRank - b.amateur.draftRank), [draft.pool.length]);
  const recommended = useMemo(() => {
    const score = (p: Player) => p.scouting.futureValue * 0.6 + p.scouting.current * 0.4;
    return new Set([...pool].sort((a, b) => score(b) - score(a) || a.amateur.draftRank - b.amateur.draftRank).slice(0, 3).map((p) => p.id));
  }, [pool]);
  const year = draft.year;
  const { sorted, th } = useSort(pool, {
    rank: { value: (p) => p.amateur.draftRank, first: 1 },
    name: { value: (p) => p.name },
    pos: { value: (p) => positionKey(positionLabel(p)), first: 1 },
    age: { value: (p) => ageIn(p, year + 1), first: 1 },
    current: { value: (p) => p.scouting.current },
    future: { value: (p) => p.scouting.futureValue },
    velocity: { value: (p) => p.velocity ?? 0 },
  });
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table pick-table">
        <thead>
          <tr>
            {th('rank', '순위', true)}
            {th('name', '이름')}
            {th('pos', '포지션')}
            {th('age', '나이', true)}
            <th>구분</th>
            {th('current', '현재', true)}
            {th('future', '미래', true)}
            {th('velocity', '구속', true)}
            <th aria-label="지명" />
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 150).map((p) => (
            <tr key={p.id} class="player-row">
              <td class="num">{p.amateur.draftRank}</td>
              <td>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>
                {recommended.has(p.id) && <span class="tag">팀장 추천</span>}
                {p.amateur.intent === 'college' && <span class="tag">진학 희망</span>}
                {p.amateur.intent === 'abroad' && <span class="tag">해외 관심</span>}
              </td>
              <td>{positionLabel(p)}</td>
              <td class="num">{ageIn(p, year + 1)}</td>
              <td class="muted">{p.origin.pathway}</td>
              <td class="num">{p.scouting.current}</td>
              <td class="num strong">{p.scouting.futureValue}</td>
              <td class="num">{p.velocity ?? '-'}</td>
              <td>
                <button type="button" class="pick" onClick={() => onPick(p.id)}>
                  지명
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Decision({ league, onSubmit, onPlayer }: Props) {
  const d = league.pending!;
  const u = league.user!;
  const next = league.offseason ? league.offseason.year + 1 : league.year + 1;
  const [selected, setSelected] = useState<Set<PlayerId>>(new Set());
  const [special, setSpecial] = useState<Record<TeamId, PlayerId>>({});
  const [choices, setChoices] = useState<Record<PlayerId, string>>({});
  const [develop, setDevelop] = useState<Set<PlayerId>>(new Set());
  const [plans, setPlans] = useState<Record<PlayerId, CampPlan>>({});
  // Consecutive decisions of one kind (draft picks, compensation per free agent) start from a clean slate.
  const stage =
    d.kind === 'draftPick'
      ? String(d.overall)
      : d.kind === 'rookieBonus'
        ? String(d.final)
        : d.kind === 'faProtect' || d.kind === 'faCompensation'
          ? d.fa
          : d.kind === 'secondPick'
            ? `${d.round}-${d.candidates.length}`
            : '';
  useEffect(() => {
    setSelected(new Set());
    setSpecial({});
    setChoices({});
    setDevelop(new Set());
    setPlans({});
  }, [d.kind, stage]);

  const toggle = (id: PlayerId) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const choose = (id: PlayerId, v: string) => setChoices((prev) => ({ ...prev, [id]: v }));

  const bonusOffer = (id: PlayerId, pick: { slot: number; ask: number }) => {
    const c = choices[id] ?? 'ask';
    return c === 'ask' ? pick.ask : c === 'slot' ? pick.slot : 0;
  };

  const input: DecisionInput | null = useMemo(() => {
    switch (d.kind) {
      case 'draftPick':
        return null;
      case 'specialDraft':
        return { kind: 'specialDraft', picks: special };
      case 'military':
        return { kind: 'military', orders: Object.fromEntries(Object.entries(choices).filter(([, v]) => v === 'sangmu' || v === 'army')) as Record<PlayerId, MilitaryOrder> };
      case 'rookieBonus':
        return { kind: 'rookieBonus', offers: Object.fromEntries(d.picks.map((pk) => [pk.id, bonusOffer(pk.id, pk)])) };
      case 'camp':
        return { kind: 'camp', plans };
      case 'faMarket': {
        const offers: Record<PlayerId, { annual: number; years: number }> = {};
        for (const [id, c] of Object.entries(choices)) {
          const k = FA_BIDS.find((b) => b[0] === c)?.[2] ?? 0;
          if (!k) continue;
          const base = marketValue(league.players[id]!, next);
          offers[id] = { annual: Math.round((base.annual * k) / 1000) * 1000, years: base.years };
        }
        return { kind: 'faMarket', offers };
      }
      case 'faProtect':
        return { kind: 'faProtect', ids: [...selected] };
      case 'salaries':
        return { kind: 'salaries', choices: choices as Record<PlayerId, SalaryChoice> };
      case 'secondProtect':
        return { kind: 'secondProtect', ids: [...selected] };
      case 'secondPick':
        return null;
      case 'foreignRenew':
        return { kind: 'foreignRenew', keep: [...selected] };
      case 'posting':
        return { kind: 'posting', id: choices.pick && choices.pick !== 'none' ? choices.pick : null };
      case 'sponsor':
        return { kind: 'sponsor', index: Number(choices.pick ?? 0) };
      case 'staff':
        return { kind: 'staff', hires: Object.fromEntries(Object.entries(choices).filter(([, v]) => v)) };
      case 'faCompensation':
        return { kind: 'faCompensation', player: choices.pick && choices.pick !== 'cash' ? choices.pick : null };
      case 'roster':
        return { kind: 'roster', ids: [...selected], develop: [...develop].filter((id) => selected.has(id)) };
      default:
        return { kind: d.kind, ids: [...selected] } as DecisionInput;
    }
  }, [d, selected, special, choices, plans, develop]);
  const problem = input ? checkDecision(league, input) : null;

  const recommend = () => {
    const a = autoDecision(league);
    if (!a) return;
    switch (a.kind) {
      case 'specialDraft':
        setSpecial(a.picks);
        break;
      case 'military':
        setChoices(Object.fromEntries((d as Extract<DecisionT, { kind: 'military' }>).candidates.map((id) => [id, a.orders[id] ?? 'stay'])));
        break;
      case 'rookieBonus': {
        const picks = (d as Extract<DecisionT, { kind: 'rookieBonus' }>).picks;
        setChoices(Object.fromEntries(picks.map((pk) => [pk.id, a.offers[pk.id] === pk.ask ? 'ask' : a.offers[pk.id] === pk.slot ? 'slot' : 'none'])));
        break;
      }
      case 'camp':
        setPlans(a.plans);
        break;
      case 'faMarket':
        setChoices(Object.fromEntries(Object.keys(a.offers).map((id) => [id, 'base'])));
        break;
      case 'faCompensation':
        setChoices({ pick: a.player ?? 'cash' });
        break;
      case 'salaries':
        setChoices(a.choices);
        break;
      case 'foreignRenew':
        setSelected(new Set(a.keep));
        break;
      case 'posting':
        setChoices({ pick: a.id ?? 'none' });
        break;
      case 'sponsor':
        setChoices({ pick: String(a.index) });
        break;
      case 'staff':
        setChoices(a.hires as Record<string, string>);
        break;
      default:
        if ('ids' in a) setSelected(new Set(a.ids));
    }
  };

  const byValue = (ids: PlayerId[]) => ids.map((id) => league.players[id]!).sort((a, b) => keepValue(b, next) - keepValue(a, next));
  const budgetLine = (
    <p class="muted">
      구단 자금 {money(u.fund)} · {next}년 연봉 {money(projectedPayroll(league, u.teamId, next))} / 예산 {money(u.payrollBudget)}
    </p>
  );

  let body: ComponentChildren = null;
  switch (d.kind) {
    case 'tryout':
    case 'released':
      body = (
        <>
          <p>
            {d.kind === 'tryout'
              ? '독립리그·해외 복귀 선수와 최근 방출된 프로 선수들이 트라이아웃에 왔습니다. 계약할 선수를 고르세요.'
              : '다른 구단이 방출한 선수들입니다. 신생구단은 다른 구단보다 먼저 계약할 수 있습니다.'}{' '}
            최대 {d.max}명 · 선택 {selected.size}명
          </p>
          <PlayerTable league={league} players={byValue(d.candidates)} selected={selected} toggle={toggle} onPlayer={onPlayer} />
        </>
      );
      break;
    case 'draftPick': {
      const draft = league.offseason!.draft!;
      const mine = Object.values(league.players).filter((p) => p.teamId === u.teamId && p.origin.draftYear === draft.year && p.origin.overallPick);
      body = (
        <>
          <p>
            {draft.year + 1} 신인 드래프트 {d.label} · 전체 {d.overall}순위 차례입니다. 남은 후보 {draft.pool.length}명. 지명한 선수 {mine.length}명:{' '}
            <span class="muted">{mine.map((p) => p.name).join(', ') || '없음'}</span>
          </p>
          <p class="muted">제목을 누르면 정렬됩니다. 계약금은 드래프트가 끝난 뒤 선수마다 협상합니다.</p>
          <DraftTable league={league} onPlayer={onPlayer} onPick={(id) => onSubmit({ kind: 'draftPick', id })} />
        </>
      );
      break;
    }
    case 'freeAgents':
      body = (
        <>
          <p>1군 진입을 앞두고 FA를 최대 {d.max}명까지 보상선수 없이 영입할 수 있습니다. 선택 {selected.size}명</p>
          {budgetLine}
          <PlayerTable
            league={league}
            players={byValue(d.candidates)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '요구 연봉 · 최근 WAR', value: (p) => `${money(faAsk(league, p, next))} · ${lastWar(p)?.toFixed(1) ?? '-'}`, sort: (p) => faAsk(league, p, next) }}
          />
        </>
      );
      break;
    case 'ownFreeAgents': {
      const kept = [...selected].reduce((a, id) => a + ownAsk(league.players[id]!, next), 0);
      body = (
        <>
          <p>우리 선수 {d.candidates.length}명이 FA 자격을 얻었습니다. 붙잡을 선수를 고르세요. 고르지 않은 선수는 다른 구단과 협상합니다.</p>
          <p class="muted">
            {next}년 연봉 (FA 제외) {money(payrollWithout(league, u.teamId, next, d.candidates))} + 재계약 {money(kept)} / 예산 {money(u.payrollBudget)}
          </p>
          <PlayerTable
            league={league}
            players={byValue(d.candidates)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '요구 연봉 · 최근 WAR', value: (p) => `${money(ownAsk(p, next))} · ${lastWar(p)?.toFixed(1) ?? '-'}`, sort: (p) => ownAsk(p, next) }}
          />
        </>
      );
      break;
    }
    case 'specialDraft': {
      const count = Object.keys(special).length;
      body = (
        <>
          <p>
            기존 구단이 보호선수 {d.protectedCount}명을 묶었습니다. 구단마다 보호되지 않은 선수 1명을 데려올 수 있고, 1명에 {money(d.fee)}을 원소속 구단에 냅니다. 선택{' '}
            {count}명 · 보상금 {money(count * d.fee)}
          </p>
          {budgetLine}
          {Object.entries(d.lists).map(([teamId, ids]) => (
            <details key={teamId} open={!special[teamId]}>
              <summary>
                {league.teams.find((t) => t.id === teamId)?.name}
                {special[teamId] && ` → ${league.players[special[teamId]!]!.name}`}
              </summary>
              <PlayerTable
                league={league}
                name={`special-${teamId}`}
                radio
                players={byValue(ids).slice(0, 12)}
                selected={new Set(special[teamId] ? [special[teamId]!] : [])}
                toggle={(id) => setSpecial((prev) => (prev[teamId] === id ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== teamId)) : { ...prev, [teamId]: id }))}
                onPlayer={onPlayer}
                extra={{ title: '연봉', value: (p) => money(salaryIn(p, next)), sort: (p) => salaryIn(p, next) }}
              />
            </details>
          ))}
        </>
      );
      break;
    }
    case 'foreign': {
      const groups: [string, (p: Player) => boolean][] = [
        ['외국인 투수', (p) => !p.origin.asiaQuota && isPitcher(p)],
        ['외국인 타자', (p) => !p.origin.asiaQuota && !isPitcher(p)],
        ['아시아쿼터', (p) => !!p.origin.asiaQuota],
      ];
      const cands = d.candidates.map((id) => league.players[id]!);
      body = (
        <>
          <p>
            외국인 {d.regular}명{d.asia ? `, 아시아쿼터 ${d.asia}명` : ''}을 더 계약할 수 있습니다. 신규 외국인은 총액 100만 달러, 아시아쿼터는 20만 달러까지입니다. 경력 칸에
            MLB·트리플A·일본·독립리그 이력이 있고, 다른 구단이 방출하거나 재계약하지 않은 KBO 경력 외국인은 KBO 기록이 나옵니다 (방출 뒤 재취업도 신규 계약이라 같은 상한).
          </p>
          {budgetLine}
          {groups.map(([title, test]) => (
            <div key={title}>
              <h4>{title}</h4>
              <PlayerTable
                league={league}
                players={cands.filter(test).sort((a, b) => b.scouting.current - a.scouting.current)}
                selected={selected}
                toggle={toggle}
                onPlayer={onPlayer}
                extra={{
                  title: '총액 (계약금·연봉·옵션)',
                  value: (p) => (p.contract?.usd ? `${usd(usdTotal(p.contract))} (${usd(p.contract.usd.bonus)}·${usd(p.contract.usd.salary)}·${usd(p.contract.usd.options)})` : '-'),
                  sort: (p) => usdTotal(p.contract),
                }}
              />
            </div>
          ))}
          <p class="muted">계약금과 연봉은 보장액이고, 옵션은 좋은 시즌(투수 WAR 2.5, 타자 2.0 이상)을 보내면 시즌 뒤 구단 자금에서 나갑니다. 연봉 예산에는 보장액이 원화로 잡힙니다.</p>
        </>
      );
      break;
    }
    case 'roster':
      body = (
        <>
          <p>
            소속선수 한도는 {d.limit}명입니다. {d.release}명 이상 정리하세요. 정리한 선수 중 원하는 선수는 육성선수로 다시 계약해 남길 수 있습니다 (한도 밖). 선택 {selected.size}명
          </p>
          <PlayerTable
            league={league}
            players={d.candidates.map((id) => league.players[id]!).sort((a, b) => keepValue(a, next) - keepValue(b, next))}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '연봉', value: (p) => money(salaryIn(p, next)), sort: (p) => salaryIn(p, next) }}
          />
          {selected.size > 0 && (
            <fieldset class="develop-picks">
              <legend>육성선수로 남길 선수</legend>
              {[...selected].map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={develop.has(id)}
                    onChange={() =>
                      setDevelop((prev) => {
                        const s = new Set(prev);
                        if (s.has(id)) s.delete(id);
                        else s.add(id);
                        return s;
                      })
                    }
                  />{' '}
                  {league.players[id]!.name}
                </label>
              ))}
            </fieldset>
          )}
        </>
      );
      break;
    case 'military': {
      const players = d.candidates.map((id) => league.players[id]!);
      body = (
        <>
          <p>
            군 미필 선수 {players.length}명입니다. 상무에 지원하면 합격할 때만 입대하고 (퓨처스리그에서 상무 소속으로 뜀), 현역은 바로 입대합니다. 둘 다 18개월 뒤 6월에 돌아옵니다.
            만 28세 이상은 올해 입대해야 합니다.
          </p>
          <PlayerTable
            league={league}
            players={players}
            onPlayer={onPlayer}
            extra={{ title: '상무 합격 가능성', value: (p) => pct(sangmuChance(p, next)), sort: (p) => sangmuChance(p, next) }}
            control={(p) => (
              <select value={choices[p.id] ?? (d.forced.includes(p.id) ? '' : 'stay')} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${p.name} 병역`}>
                {d.forced.includes(p.id) ? <option value="">골라야 함</option> : <option value="stay">미룸</option>}
                <option value="sangmu">상무 지원</option>
                <option value="army">현역 입대</option>
              </select>
            )}
          />
        </>
      );
      break;
    }
    case 'rookieBonus': {
      const byId = Object.fromEntries(d.picks.map((pk) => [pk.id, pk]));
      const total = d.picks.reduce((a, pk) => a + bonusOffer(pk.id, pk), 0);
      body = (
        <>
          <p>
            {d.final
              ? '더 달라고 한 선수들입니다. 요구액을 받아들이지 않으면 계약하지 않고 떠납니다.'
              : '지명한 선수마다 계약금을 한 번 제시합니다. 선수는 받아들이거나, 더 요구하거나, 거절하고 떠납니다. 진학 희망·해외 관심 선수는 거절하기 쉽습니다.'}
          </p>
          <p class="muted">
            구단 자금 {money(u.fund)} · 제시 합계 {money(total)}
          </p>
          <PlayerTable
            league={league}
            players={d.picks.map((pk) => league.players[pk.id]!)}
            onPlayer={onPlayer}
            extra={{ title: '슬롯 · 요구액', value: (p) => `${money(byId[p.id]!.slot)} · ${money(byId[p.id]!.ask)}`, sort: (p) => byId[p.id]!.ask }}
            control={(p) => {
              const pk = byId[p.id]!;
              const c = choices[p.id] ?? 'ask';
              const chance = d.final ? null : draftContracts.publicChance({ intent: p.amateur.intent ?? null }, bonusOffer(p.id, pk) / 100, pk.ask / 100, u.settings.difficulty as Difficulty);
              return (
                <span class="row-actions">
                  <select value={c} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${p.name} 계약금`}>
                    <option value="ask">요구액 {money(pk.ask)}</option>
                    {!d.final && pk.slot < pk.ask && <option value="slot">슬롯 {money(pk.slot)}</option>}
                    <option value="none">포기</option>
                  </select>
                  {chance !== null && c !== 'none' && <span class="muted">수락 {pct(chance)}</span>}
                </span>
              );
            }}
          />
        </>
      );
      break;
    }
    case 'development':
      body = (
        <>
          <p>
            지명받지 못한 선수 중에서 육성선수를 뽑습니다. 소속선수 68명 한도 밖이고, 5월 1일부터 정식선수로 등록할 수 있습니다. 최대 {d.max}명 · 선택 {selected.size}명
          </p>
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} />
        </>
      );
      break;
    case 'faMarket': {
      const players = d.candidates.map((id) => league.players[id]!);
      const outside = Object.entries(choices).filter(([id, c]) => c !== 'none' && league.players[id]!.teamId !== u.teamId).length;
      const cost = input && input.kind === 'faMarket' ? Object.values(input.offers).reduce((a, o) => a + o.annual, 0) : 0;
      body = (
        <>
          <p>
            올겨울 FA {players.length}명입니다. 다른 구단 FA는 {d.limit}명까지 영입할 수 있고 (지금 {outside}명), 우리 FA를 붙잡으려면 우리도 제시해야 합니다. 선수는 받은 제안 중 가장 좋은 곳과 계약하고
            (원소속 구단을 조금 더 선호), A·B등급 FA를 데려오면 원소속 구단에 보상선수와 보상금을 줍니다.
          </p>
          <p class="muted">
            {next}년 연봉 (FA 제외) {money(payrollWithout(league, u.teamId, next, players.filter((p) => p.teamId === u.teamId).map((p) => p.id)))} + 제시 합계 {money(cost)} / 예산 {money(u.payrollBudget)} · 등급 A: 보상선수(보호 20명 외)+연봉 200% 또는 300%, B: 보상선수(보호 25명 외)+100% 또는 200%, C: 150%
          </p>
          <PlayerTable
            league={league}
            players={players.sort((a, b) => Number(b.teamId === u.teamId) - Number(a.teamId === u.teamId) || b.scouting.current - a.scouting.current)}
            onPlayer={onPlayer}
            extra={{
              title: '등급 · 최근 WAR · 시장가',
              value: (p) => {
                const m = marketValue(p, next);
                return `${d.grades[p.id]} · ${lastWar(p)?.toFixed(1) ?? '-'} · ${m.years}년 연 ${money(m.annual)}`;
              },
              sort: (p) => marketValue(p, next).annual,
            }}
            control={(p) => (
              <select value={choices[p.id] ?? 'none'} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${p.name} 제시`}>
                {FA_BIDS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                    {p.teamId === u.teamId && k === 'base' ? ' (재계약)' : ''}
                  </option>
                ))}
              </select>
            )}
          />
        </>
      );
      break;
    }
    case 'salaries': {
      const byId = Object.fromEntries(d.rows.map((r) => [r.id, r]));
      const total = d.rows.reduce((a, r) => a + salaryOffer(r, (choices[r.id] as SalaryChoice) ?? 'merit'), 0);
      const others = payrollWithout(league, u.teamId, next, d.rows.map((r) => r.id));
      body = (
        <>
          <p>
            {next}년 연봉 협상입니다. 구단 고과(지난 시즌 성적으로 매긴 금액)로 제시하면 대부분 도장을 찍지만, 요구액보다 적으면 거절할 수 있습니다. 합의가 안 된 3년 차 이상 선수는 연봉 중재를
            신청할 수 있고, 중재위원회는 대개 고과를 따릅니다. FA를 1~2년 앞둔 주축 선수에게는 비FA 다년계약을 제안할 수 있습니다.
          </p>
          <p class="muted">
            협상 대상 {d.rows.length}명 · 제시 합계 {money(total)} + 나머지 {money(others)} = {money(total + others)} / 예산 {money(u.payrollBudget)}
          </p>
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            onPlayer={onPlayer}
            extra={{
              title: '작년 · 고과 · 요구 · WAR',
              value: (p) => {
                const r = byId[p.id]!;
                return `${money(r.prev)} · ${money(r.merit)} · ${money(r.ask)} · ${lastWar(p)?.toFixed(1) ?? '-'}`;
              },
              sort: (p) => byId[p.id]!.merit,
            }}
            control={(p) => {
              const r = byId[p.id]!;
              const c = (choices[p.id] as SalaryChoice) ?? 'merit';
              return (
                <span class="row-actions">
                  <select value={c} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${p.name} 연봉`}>
                    {SALARY_CHOICES.filter(([k]) => k !== 'extension' || r.extension).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label} {k === 'extension' && r.extension ? `(${r.extension.years}년 연 ${money(r.extension.annual)})` : money(salaryOffer(r, k))}
                      </option>
                    ))}
                  </select>
                  {r.arbitration && <span class="muted">중재 가능</span>}
                </span>
              );
            }}
          />
        </>
      );
      break;
    }
    case 'secondProtect':
      body = (
        <>
          <p>
            {league.offseason?.year} 2차 드래프트입니다. 보호할 선수 {d.protect}명을 고르세요 (지금 {selected.size}명). 보호하지 않은 선수는 다른 구단이 지명할 수 있고, 지명되면 라운드별 양도금(4억·3억·2억·1억)을
            받습니다. 입단 3년 차까지의 선수, 올겨울 FA 계약 선수, 외국인은 저절로 빠집니다. 군 복무 중인 선수도 대상입니다.
          </p>
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} />
        </>
      );
      break;
    case 'secondPick':
      body = (
        <>
          <p>
            2차 드래프트 {d.round}라운드, 우리 차례입니다. 다른 구단 보호선수 밖의 선수를 지명하면 원소속 구단에 {money(d.fee)}을 냅니다. 지명하지 않으면 이번 2차 드래프트에서 빠집니다.
          </p>
          <PlayerTable
            league={league}
            players={d.candidates.map((id) => league.players[id]!)}
            onPlayer={onPlayer}
            extra={{ title: '연봉', value: (p) => money(salaryIn(p, next) || salaryIn(p, next - 1)), sort: (p) => salaryIn(p, next - 1) }}
            control={(p) => (
              <button type="button" class="pick" onClick={() => onSubmit({ kind: 'secondPick', id: p.id })}>
                지명
              </button>
            )}
          />
        </>
      );
      break;
    case 'foreignRenew': {
      const byId = Object.fromEntries(d.rows.map((r) => [r.id, r]));
      body = (
        <>
          <p>
            계약이 끝나는 외국인 선수입니다. 재계약할 선수를 고르세요. 좋은 시즌을 보낸 선수는 더 많이 요구하고, 몇몇은 MLB·일본으로 떠나기로 해서 붙잡을 수 없습니다. 재계약하지 않으면 새
            외국인 선수를 뽑습니다.
          </p>
          {budgetLine}
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={(id) => !byId[id]!.leaving && toggle(id)}
            onPlayer={onPlayer}
            extra={{
              title: 'WAR · 요구 총액',
              value: (p) => (byId[p.id]!.leaving ? `${byId[p.id]!.war.toFixed(1)} · 해외 진출` : `${byId[p.id]!.war.toFixed(1)} · ${usd(byId[p.id]!.ask)}`),
              sort: (p) => byId[p.id]!.war,
            }}
          />
        </>
      );
      break;
    }
    case 'sponsor': {
      const pick = choices.pick ?? '0';
      body = (
        <>
          <p>
            명명권 계약이 끝났습니다. 지금 스폰서와 재계약하거나 새 스폰서를 받을 수 있습니다. 새 스폰서를 받으면 구단명과 약칭이 스폰서 이름으로 바뀝니다 (키움 히어로즈 방식). 명명권료는 구단 인기와 성적을
            따라갑니다.
          </p>
          <div class="table-wrap">
            <table class="record-table">
              <thead>
                <tr>
                  <th />
                  <th>스폰서</th>
                  <th class="num">연간</th>
                  <th class="num">기간</th>
                </tr>
              </thead>
              <tbody>
                {d.offers.map((o, i) => (
                  <tr key={o.name}>
                    <td>
                      <input type="radio" name="sponsor" checked={pick === String(i)} onChange={() => choose('pick', String(i))} aria-label={`${o.name} 선택`} />
                    </td>
                    <td>
                      {o.name}
                      {i === 0 && <span class="tag">재계약</span>}
                    </td>
                    <td class="num">{money(o.annual)}</td>
                    <td class="num">{o.years}년</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
      break;
    }
    case 'staff': {
      body = (
        <>
          <p>
            감독과 코치, 프런트 팀장을 정합니다. 계약이 끝난 사람은 바꾸지 않으면 2년 재계약합니다. 계약 기간이 남은 사람을 바꾸면 남은 연봉을 위약금으로 냅니다. 등급 50이 리그 평균입니다.
          </p>
          <p class="muted">구단 자금 {money(u.fund)}</p>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table staff-table">
              <thead>
                <tr>
                  <th>자리</th>
                  <th>지금</th>
                  <th class="num">등급</th>
                  <th class="num">연봉</th>
                  <th>계약</th>
                  <th>선택</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((row) => (
                  <tr key={row.role}>
                    <th scope="row">
                      {STAFF_LABELS[row.role]}
                      <div class="muted small">{STAFF_EFFECTS[row.role]}</div>
                    </th>
                    <td>
                      {row.current.name}
                      {row.current.style && <span class="muted"> · {MANAGER_STYLES[row.current.style].label}</span>}
                    </td>
                    <td class="num strong">{row.current.rating}</td>
                    <td class="num">{money(row.current.salary)}</td>
                    <td>{row.expiring ? <span class="tag warn">만료</span> : `${row.current.until}년까지`}</td>
                    <td>
                      <select value={choices[row.role] ?? ''} onChange={(e) => choose(row.role, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${STAFF_LABELS[row.role]} 선택`}>
                        <option value="">{row.expiring ? '재계약' : '유지'}</option>
                        {row.candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · 등급 {c.rating} · 연 {money(c.salary)}
                            {c.style ? ` · ${MANAGER_STYLES[c.style].label}` : ''}
                            {row.buyout ? ` (위약금 ${money(row.buyout)})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
      break;
    }
    case 'returnee': {
      const rows = new Map(d.rows.map((r) => [r.id, r]));
      const cost = d.rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + r.annual, 0);
      body = (
        <>
          <p>
            우리 구단이 포스팅으로 메이저리그에 보낸 선수가 KBO 복귀를 원합니다. 포스팅한 구단이 보류권을 갖고 있어 다른 구단과는 계약할 수 없습니다. 데려올 선수를 고르세요. 고르지 않은
            선수는 보류권을 풀어 주며, 다른 구단이 데려갈 수 있습니다. 조건은 KBO 시절 기록과 나이로 정한 다년 계약이고, 해외에서 보낸 시간만큼 나이를 먹었습니다.
          </p>
          <p class="muted">
            {next}년 연봉 {money(projectedPayroll(league, u.teamId, next))} + 복귀 {money(cost)} / 예산 {money(u.payrollBudget)}
          </p>
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '조건 · 해외', value: (p) => `${rows.get(p.id)!.years}년 연 ${money(rows.get(p.id)!.annual)} · ${rows.get(p.id)!.abroad}년`, sort: (p) => rows.get(p.id)!.annual }}
          />
        </>
      );
      break;
    }
    case 'posting': {
      const pick = choices.pick ?? 'none';
      body = (
        <>
          <p>
            7시즌을 채운 선수가 메이저리그 진출을 위해 포스팅을 요청했습니다. 한 겨울에 1명만 포스팅할 수 있습니다. 메이저리그 구단과 30일 안에 계약하면 보장 금액의 20%(2,500만 달러 초과분은
            17.5%, 5,000만 달러 초과분은 15%)를 이적료로 받고, 계약하지 못하면 선수는 팀에 남습니다.
          </p>
          <label class="check">
            <input type="radio" name="posting" checked={pick === 'none'} onChange={() => choose('pick', 'none')} /> 아무도 포스팅하지 않음
          </label>
          <PlayerTable
            league={league}
            players={d.candidates.map((id) => league.players[id]!)}
            onPlayer={onPlayer}
            extra={{ title: 'MLB 관심 · 연봉', value: (p) => `${mlbInterest(p)} · ${money(salaryIn(p, next - 1))}`, sort: (p) => p.scouting.current }}
            control={(p) => (
              <label class="check">
                <input type="radio" name="posting" checked={pick === p.id} onChange={() => choose('pick', p.id)} aria-label={`${p.name} 포스팅`} /> 포스팅
              </label>
            )}
          />
        </>
      );
      break;
    }
    case 'faProtect': {
      const fa = league.players[d.fa]!;
      body = (
        <>
          <p>
            {shortName(league, d.from)}에서 {d.grade}등급 FA {eulreul(fa.name)} 데려왔습니다. 보호할 선수 {d.protect}명을 고르세요 (지금 {selected.size}명). {shortName(league, d.from)} 쪽은 나머지 선수 중 1명과
            보상금을 받거나, 보상금만 받습니다. 외국인, 올겨울 영입한 FA, 올해 뽑은 신인은 저절로 보호됩니다.
          </p>
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} />
        </>
      );
      break;
    }
    case 'faCompensation': {
      const fa = league.players[d.fa]!;
      const pick = choices.pick ?? 'cash';
      body = (
        <>
          <p>
            우리 {d.grade}등급 FA {iga(fa.name)} {ro(shortName(league, d.to))} 떠났습니다. {shortName(league, d.to)}의 보호선수 밖에서 1명을 데려오고 보상금 {money(d.withPlayer)}을 받거나, 보상금만{' '}
            {money(d.cashOnly)} 받을 수 있습니다.
          </p>
          <label class="check">
            <input type="radio" name="comp" checked={pick === 'cash'} onChange={() => choose('pick', 'cash')} /> 보상금만 {money(d.cashOnly)}
          </label>
          <PlayerTable
            league={league}
            name="comp"
            radio
            players={d.list.map((id) => league.players[id]!).slice(0, 40)}
            selected={new Set(pick !== 'cash' ? [pick] : [])}
            toggle={(id) => choose('pick', id)}
            onPlayer={onPlayer}
            extra={{ title: '연봉', value: (p) => money(salaryIn(p, next) || salaryIn(p, next - 1)), sort: (p) => salaryIn(p, next - 1) }}
          />
        </>
      );
      break;
    }
    case 'camp': {
      const players = d.players.map((id) => league.players[id]!).sort((a, b) => ageIn(a, next) - ageIn(b, next));
      const plan = (p: Player) => ({ focus: p.plan?.focus ?? 'balanced', role: p.role, position: p.position, ...plans[p.id] });
      const setPlan = (p: Player, change: CampPlan) => setPlans((prev) => ({ ...prev, [p.id]: { ...prev[p.id], ...change } }));
      body = (
        <>
          <p>
            {next} 시즌 스프링캠프입니다. 선수마다 훈련 방향을 정할 수 있습니다: 고른 능력은 더 빨리, 나머지는 조금 느리게 자랍니다. 투수는 선발·불펜 보직을, 야수는 포지션을 바꿀 수
            있고, 포지션을 바꾼 야수는 한 시즌 동안 수비가 서툽니다. 바꾸지 않은 선수는 지난해 계획을 이어갑니다.
          </p>
          <PlayerTable
            league={league}
            players={players}
            onPlayer={onPlayer}
            control={(p) => {
              const cur = plan(p);
              return (
                <span class="row-actions">
                  <select value={cur.focus} onChange={(e) => setPlan(p, { focus: (e.currentTarget as HTMLSelectElement).value })} aria-label={`${p.name} 훈련 방향`}>
                    {focusOptions(p).map((k) => (
                      <option key={k} value={k}>
                        {toolLabel(k)}
                      </option>
                    ))}
                  </select>
                  {isPitcher(p) ? (
                    <select value={cur.role} onChange={(e) => setPlan(p, { role: (e.currentTarget as HTMLSelectElement).value as 'SP' | 'RP' })} aria-label={`${p.name} 보직`}>
                      <option value="SP">선발</option>
                      <option value="RP">불펜</option>
                    </select>
                  ) : (
                    <select value={cur.position ?? ''} onChange={(e) => setPlan(p, { position: (e.currentTarget as HTMLSelectElement).value as Position })} aria-label={`${p.name} 포지션`}>
                      {POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {POSITION_NAMES[pos]}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              );
            }}
          />
        </>
      );
      break;
    }
  }

  return (
    <section class="decision" aria-labelledby="decision-title">
      <h2 id="decision-title">{TITLES[d.kind]}</h2>
      {body}
      <div class="actions">
        {d.kind === 'draftPick' ? (
          <button type="button" onClick={() => onSubmit({ kind: 'draftPick', id: null })}>
            스카우트에게 맡기기
          </button>
        ) : d.kind === 'secondPick' ? (
          <>
            <button type="button" onClick={() => onSubmit({ kind: 'secondPick', id: null })}>
              지명 안 함
            </button>
            <button type="button" onClick={() => onSubmit(autoDecision(league) as DecisionInput)}>
              스카우트에게 맡기기
            </button>
          </>
        ) : (
          <>
            <button type="button" class="primary" disabled={!!problem} onClick={() => input && onSubmit(input)}>
              확정
            </button>
            <button type="button" onClick={recommend}>
              {d.kind === 'camp' ? '코치 추천으로 채우기' : '스카우트 추천으로 채우기'}
            </button>
          </>
        )}
        {problem && <span class="notice inline">{problem}</span>}
      </div>
    </section>
  );
}
