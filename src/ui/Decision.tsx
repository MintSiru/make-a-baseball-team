import { adviceFor, type Advice } from '../league/advice';
import { AlumnusTag } from './Alumni';
import { isLegend } from '../league/alumni';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Help } from './Help';
import { decisionTip } from './tutorial';
import { draftContracts, TOOL_LABELS, type Difficulty } from '../draftroom';
import { salaryIn, usdTotal } from '../league/contracts';
import { usd } from '../league/foreign';
import { dealTotal } from '../league/foreigntalks';
import { ForeignOffers, offerOf, offersFor, RenewOffers, renewOffersFor } from './ForeignTalks';
import { eventById } from '../league/international';
import { kboLine, poolEntry } from '../league/foreignpool';
import { autoDecision, checkDecision, projectedPayroll, type DecisionInput } from '../league/expansion';
import { sangmuChance } from '../league/offseason';
import { ageIn, isPitcher, keepValue } from '../league/players';
import type { Decision as DecisionT, LeagueState, RivalSettings } from '../league/state';
import { focusOptions, payrollWithout, salaryOffer, type CampPlan, type MilitaryOrder, type SalaryChoice } from '../league/userclub';
import { eok as eokText } from '../league/fa';
import { FaMarket } from './FaMarket';
import { eulreul, iga, ro } from '../league/josa';
import { positionLabel, shortName } from '../league/views';
import { MANAGER_STYLES, STAFF_EFFECTS, STAFF_LABELS } from '../league/staff';
import type { Position } from '../model/position';
import type { Player, PlayerId, TeamId } from '../model/types';
import { money } from './format';
import { serviceNote } from '../league/military';
import { goalText } from '../league/parent';
import { capPlayers, foreignCap, foreignCost } from '../league/foreigncap';
import { gradeClass } from './grades';
import { positionKey, useSort, type SortColumn } from './sort';
import { RivalForm } from './Twelve';
import { FantasyBoard } from './FantasyDraft';
import { MEDDLE } from '../league/scenarios';

interface Props {
  league: LeagueState;
  onSubmit: (input: DecisionInput) => void;
  onPlayer: (id: PlayerId) => void;
}

const TITLES: Record<DecisionT['kind'], string> = {
  tryout: '창단 트라이아웃',
  draftPick: '신인 드래프트',
  specialDraft: '특별지명',
  released: '방출선수 영입',
  foreign: '외국인 선수 계약',
  roster: '소속선수 정리',
  military: '병역',
  rookieBonus: '신인 계약금 협상',
  development: '육성선수 계약',
  camp: '스프링캠프',
  faRound: 'FA 시장',
  faOptions: 'FA 구단 옵션',
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
  rival: '12구단 창단',
  rivalProtect: '12구단 특별지명 · 보호선수 명단',
  retire: '은퇴 의사 · 설득',
  national: '국가대표 차출',
  scandal: '징계 · 구단 대응',
  dispute: '지분 분쟁',
  meddle: '구단주의 지시',
  fantasyPick: '판타지 드래프트',
};

/** What the scouts hear about major league interest, from the public grade. */
const mlbInterest = (p: Player) => (p.scouting.current >= 68 ? '매우 높음' : p.scouting.current >= 63 ? '높음' : p.scouting.current >= 60 ? '보통' : '낮음');

const SALARY_CHOICES: [SalaryChoice, string][] = [
  ['merit', '고과대로'],
  ['ask', '요구액 수용'],
  ['freeze', '동결'],
  ['extension', '다년계약 제안'],
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

/**
 * The header checkbox of a pick list (V0.7.6): with nothing picked it picks everyone (or the first `max`
 * in the current order); with anyone picked it clears the list.
 */
function SelectAllCell({ ids, selected, toggle, max }: { ids: PlayerId[]; selected?: Set<PlayerId>; toggle: (id: PlayerId) => void; max?: number }) {
  const on = ids.filter((id) => selected?.has(id)).length;
  // The limit is for the whole decision: players picked in the other lists count against it.
  const room = max == null ? ids.length : Math.max(0, max - ((selected?.size ?? 0) - on));
  const target = Math.min(room, ids.length);
  const flip = () => {
    if (on > 0) for (const id of ids) selected?.has(id) && toggle(id);
    else for (const id of ids.slice(0, target)) toggle(id);
  };
  return (
    <th>
      <input
        type="checkbox"
        aria-label={on > 0 ? '모두 해제' : target < ids.length ? `위에서 ${target}명 선택` : '모두 선택'}
        title={on > 0 ? '모두 해제' : target < ids.length ? `지금 정렬 순서로 위에서 ${target}명 선택` : '모두 선택'}
        disabled={on === 0 && target === 0}
        checked={on > 0 && on >= target}
        ref={(el) => {
          if (el) el.indeterminate = on > 0 && on < target;
        }}
        onChange={flip}
      />
    </th>
  );
}

/** Buttons that set one choice for every row that allows it (일괄 지정, V0.7.6). */
/** The foreign salary cap for next season with these contracts (V0.7.8): a warning when they go over. */
function ForeignCapLine({ league, next, adding }: { league: LeagueState; next: number; adding: { p: Player; total: number }[] }) {
  const u = league.user!;
  const staying = capPlayers(league, u.teamId, next).filter((p) => !adding.some((a) => a.p.id === p.id));
  const regular = adding.filter((a) => !a.p.origin.asiaQuota);
  const cap = foreignCap(league, u.teamId, next, [...staying, ...regular.map((a) => a.p)]);
  const total = foreignCost(staying) + regular.reduce((a, x) => a + x.total, 0);
  const over = total - cap;
  return (
    <p class={over > 0 ? 'notice warn' : 'muted'}>
      {next}년 외국인 샐러리캡: 외국인 3명 총액(옵션 포함) {usd(total)} / 상한 {usd(cap)} (400만 달러 + 재계약 선수의 연차당 10만 달러; 아시아쿼터는 별도)
      {over > 0 ? ` — ${usd(over)} 초과. 시즌 뒤 초과분의 50%를 제재금으로 내고, 2년 연속이면 100%와 2라운드 지명권 9순위 하락입니다.` : ''}
    </p>
  );
}

function BulkBar({ label = '일괄 지정', options, onApply }: { label?: string; options: [string, string][]; onApply: (value: string) => void }) {
  return (
    <div class="bulk-bar" role="group" aria-label={label}>
      <span class="muted small">{label}</span>
      {options.map(([v, text]) => (
        <button key={v} type="button" onClick={() => onApply(v)}>
          {text}
        </button>
      ))}
    </div>
  );
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
  max,
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
  /** Most players the decision takes: "select all" picks this many from the top of the current order. */
  max?: number;
}) {
  const year = league.offseason ? league.offseason.year + 1 : league.year + 1;
  const { sorted, th } = usePlayerSort(players, year, extra);
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table pick-table">
        <thead>
          <tr>
            {!control && (radio || !toggle ? <th aria-label="선택" /> : <SelectAllCell ids={sorted.map((p) => p.id)} selected={selected} toggle={toggle} max={max} />)}
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
                        ? `${p.archetype} · ${p.education.pathText}`
                        : p.career.length
                          ? '방출'
                          : p.origin.pathway}
              </td>
              <td class={`num ${gradeClass(p.scouting.current)}`}>{p.scouting.current}</td>
              <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{p.scouting.futureValue}</td>
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
              <td class={`num ${gradeClass(p.scouting.current)}`}>{p.scouting.current}</td>
              <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{p.scouting.futureValue}</td>
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
  const [rival, setRival] = useState<RivalSettings | null>(d.kind === 'rival' ? d.suggestion : null);
  const [vote, setVote] = useState(true);
  // 1.5.0: why the scouts recommend it, shown once the recommendation is filled in.
  const [advice, setAdvice] = useState<Advice | null>(null);
  // Consecutive decisions of one kind (draft picks, compensation per free agent) start from a clean slate.
  const stage =
    d.kind === 'draftPick' || d.kind === 'fantasyPick'
      ? String(d.overall)
      : d.kind === 'rookieBonus'
        ? String(d.final)
        : d.kind === 'faProtect' || d.kind === 'faCompensation'
          ? d.fa
          : d.kind === 'secondPick'
            ? `${d.round}-${d.candidates.length}`
            : d.kind === 'rival'
              ? String(d.year)
              : d.kind === 'foreign'
                ? String(d.round ?? 1)
                : d.kind === 'meddle'
                  ? `${d.date}-${d.order}`
                  : '';
  useEffect(() => {
    setSelected(new Set());
    setSpecial({});
    setChoices({});
    setDevelop(new Set());
    setPlans({});
    setRival(d.kind === 'rival' ? d.suggestion : null);
    setVote(true);
    setAdvice(null);
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
      case 'fantasyPick':
        return null;
      case 'meddle':
        return { kind: 'meddle', answer: (choices.pick ?? 'obey') as 'obey' | 'refuse' };
      case 'specialDraft':
        return { kind: 'specialDraft', picks: special };
      case 'military':
        return { kind: 'military', orders: Object.fromEntries(Object.entries(choices).filter(([, v]) => v === 'sangmu' || v === 'army' || v === 'social')) as Record<PlayerId, MilitaryOrder> };
      case 'rookieBonus':
        return { kind: 'rookieBonus', offers: Object.fromEntries(d.picks.map((pk) => [pk.id, bonusOffer(pk.id, pk)])) };
      case 'camp':
        return { kind: 'camp', plans };
      case 'faRound':
        return null;
      case 'faOptions':
        return { kind: 'faOptions', keep: [...selected] };
      case 'faProtect':
        return { kind: 'faProtect', ids: [...selected] };
      case 'salaries':
        return { kind: 'salaries', choices: choices as Record<PlayerId, SalaryChoice> };
      case 'secondProtect':
        return { kind: 'secondProtect', ids: [...selected] };
      case 'secondPick':
        return null;
      case 'foreignRenew':
        return { kind: 'foreignRenew', keep: [...selected], offers: renewOffersFor(d.rows, [...selected], choices) };
      case 'foreign': {
        const ids = [...selected].filter((id) => d.candidates.includes(id));
        return { kind: 'foreign', ids, offers: offersFor(league, ids, d.terms, choices) };
      }
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
      case 'rival':
        return { kind: 'rival', settings: vote ? (rival ?? d.suggestion) : null };
      case 'rivalProtect':
        return { kind: 'rivalProtect', ids: [...selected] };
      case 'scandal':
        return { kind: 'scandal', answer: (choices.pick ?? 'extra') as 'release' | 'extra' | 'none' };
      case 'dispute':
        return { kind: 'dispute', answer: (choices.pick ?? 'settle') as 'settle' | 'fight' };
      default:
        return { kind: d.kind, ids: [...selected] } as DecisionInput;
    }
  }, [d, selected, special, choices, plans, develop, rival, vote]);
  const problem = input ? checkDecision(league, input) : null;

  const recommend = () => {
    const a = autoDecision(league);
    if (!a) return;
    setAdvice(adviceFor(league));
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
      case 'faCompensation':
        setChoices({ pick: a.player ?? 'cash' });
        break;
      case 'salaries':
        setChoices(a.choices);
        break;
      case 'foreignRenew':
      case 'faOptions':
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
      case 'rival':
        setRival(a.settings);
        setVote(true);
        break;
      case 'scandal':
      case 'dispute':
      case 'meddle':
        setChoices({ pick: a.answer });
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

  // The free-agent market has its own screen (V0.8).
  if (d.kind === 'faRound') return <FaMarket league={league} onSubmit={onSubmit} onPlayer={onPlayer} />;

  let body: ComponentChildren = null;
  switch (d.kind) {
    case 'tryout':
    case 'released':
      body = (
        <>
          <p>
            {d.kind === 'tryout' && u.settings.scenario === 'steel'
              ? '은퇴한 선수들과 드래프트에서 지명받지 못한 선수들이 강철 파이터즈의 트라이아웃에 왔습니다. 첫 선수단은 이들로만 꾸립니다(특별지명 없음). 노장은 오래 버티지 못하니 젊은 선수도 함께 고르세요.'
              : d.kind === 'tryout'
              ? '독립리그·해외 복귀 선수와 최근 방출된 프로 선수들이 트라이아웃에 왔습니다. 계약할 선수를 고르세요.'
              : '다른 구단이 방출한 선수들입니다. 신생구단은 다른 구단보다 먼저 계약할 수 있습니다.'}{' '}
            최대 {d.max}명 · 선택 {selected.size}명
          </p>
          <PlayerTable league={league} players={byValue(d.candidates)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.max} />
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
      // Between rounds the old picks may name players who have left the talks, until the reset below runs.
      const picked = [...selected].filter((id) => d.candidates.includes(id));
      body = (
        <>
          <p>
            외국인 {d.regular}명{d.asia ? `, 아시아쿼터 ${d.asia}명` : ''}을 더 계약할 수 있습니다. 신규 외국인은 총액 100만 달러, 아시아쿼터는 20만 달러까지입니다. 경력 칸에
            MLB·트리플A·일본·독립리그 이력이 있고, 다른 구단이 방출하거나 재계약하지 않은 KBO 경력 외국인은 KBO 기록이 나옵니다 (방출 뒤 재취업도 신규 계약이라 같은 상한).
          </p>
          {(d.round ?? 1) > 1 && (
            <div class="notice">
              <strong>외국인 협상 {d.round}차 (최대 3차)</strong>
              <ul class="plain small">
                {(d.log ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {budgetLine}
          <ForeignCapLine
            league={league}
            next={next}
            adding={picked.map((id) => ({ p: league.players[id]!, total: d.terms?.[id] ? dealTotal(d.terms[id]!, offerOf(league, id, d.terms[id]!, choices)) : usdTotal(league.players[id]!.contract) }))}
          />
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
          {d.terms && <ForeignOffers league={league} ids={picked} terms={d.terms} choices={choices} choose={choose} />}
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
            max={d.release}
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
            {d.social?.length ? ' 큰 수술 뒤 병역판정 4급을 받은 선수는 상무·현역 대신 사회복무요원(21개월, 그동안 경기 출전 불가)으로 복무하며, 재활 중에 소집되면 재활과 복무를 함께 합니다.' : ''}
          </p>
          <BulkBar
            options={[
              ['stay', '모두 미룸'],
              ['sangmu', '모두 상무 지원'],
              ['army', '모두 현역 입대'],
            ]}
            onApply={(v) =>
              setChoices((prev) => ({
                ...prev,
                // 4급 players can only go to social service; the forced ones cannot stay.
                ...Object.fromEntries(
                  players.filter((p) => (v === 'stay' ? !d.forced.includes(p.id) : !d.social?.includes(p.id))).map((p) => [p.id, v]),
                ),
              }))
            }
          />
          <PlayerTable
            league={league}
            players={players}
            onPlayer={onPlayer}
            extra={{ title: '상무 합격 가능성', value: (p) => pct(sangmuChance(p, next)), sort: (p) => sangmuChance(p, next) }}
            control={(p) => (
              <span class="row-actions">
                <select value={choices[p.id] ?? (d.forced.includes(p.id) ? '' : 'stay')} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${p.name} 병역`}>
                  {d.forced.includes(p.id) ? <option value="">골라야 함</option> : <option value="stay">미룸</option>}
                  {d.social?.includes(p.id) ? (
                    <option value="social">사회복무요원 소집</option>
                  ) : (
                    <>
                      <option value="sangmu">상무 지원</option>
                      <option value="army">현역 입대</option>
                    </>
                  )}
                </select>
                {d.social?.includes(p.id) && (
                  <span class="tag warn" title={serviceNote(p)}>
                    4급
                  </span>
                )}
                {league.injuries[p.id] && <span class="muted small">재활 중</span>}
              </span>
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
            구단 자금 {money(u.fund)} · 제시 합계 {money(total)} · 슬롯 금액까지는 자금이 모자라도 줄 수 있습니다(시즌 뒤 모기업이 메우고 신뢰도가 조금 떨어짐)
          </p>
          <BulkBar
            options={[['ask', '모두 요구액'], ...(d.final ? [] : ([['slot', '모두 슬롯 금액']] as [string, string][])), ['none', '모두 포기']]}
            onApply={(v) => setChoices((prev) => ({ ...prev, ...Object.fromEntries(d.picks.filter((pk) => v !== 'slot' || pk.slot < pk.ask).map((pk) => [pk.id, v])) }))}
          />
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
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.max} />
        </>
      );
      break;
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
          <BulkBar
            options={SALARY_CHOICES.filter(([k]) => k !== 'extension').map(([k, label]) => [k, `모두 ${label}`] as [string, string])}
            onApply={(v) => setChoices((prev) => ({ ...prev, ...Object.fromEntries(d.rows.map((r) => [r.id, v])) }))}
          />
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
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.protect} />
        </>
      );
      break;
    case 'rival':
      body = (
        <>
          <p>
            {d.event
              ? `KBO 이사회가 12번째 구단 창단을 논의합니다. 찬성하면 라이벌이 될 구단의 모습을 직접 정합니다. 반대하면 이번 겨울은 부결되고, 몇 해 뒤 다시 논의될 수 있습니다.`
              : `${d.year}년 겨울, 12번째 구단이 창단합니다. 라이벌이 될 구단의 모습을 정하세요.`}{' '}
            새 구단은 {d.year}년 신인 드래프트에서 우선지명 2명과 매 라운드 첫 지명권을 받고, {d.year + 1}년 퓨처스리그를 거쳐 {d.year + 2}년 1군에 들어옵니다. 그 직전 겨울 특별지명에서
            우리 구단도 보호선수 20명 밖의 1명을 내주고 10억을 받습니다.
          </p>
          {d.event && (
            <div class="segmented" role="group" aria-label="창단 표결">
              <button type="button" aria-pressed={vote} onClick={() => setVote(true)}>
                찬성 (창단)
              </button>
              <button type="button" aria-pressed={!vote} onClick={() => setVote(false)}>
                반대 (부결)
              </button>
            </div>
          )}
          {vote && <RivalForm league={league} value={rival ?? d.suggestion} onChange={setRival} />}
        </>
      );
      break;
    case 'rivalProtect':
      body = (
        <>
          <p>
            12구단 {league.teams.find((t) => t.id === league.twelve?.teamId)?.name}의 특별지명입니다. 보호할 선수 {d.protect}명을 고르세요 (지금 {selected.size}명). 보호하지 않은 선수 중 1명이 지명되면 보상금{' '}
            {money(d.fee)}을 받습니다. 외국인, 올가을 지명된 신인, 올겨울 FA 계약 선수는 저절로 빠집니다. 고르지 않고 확정하면 스카우트가 가치 높은 순으로 채웁니다.
          </p>
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.protect} />
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
          <ForeignCapLine league={league} next={next} adding={d.rows.filter((r) => selected.has(r.id)).map((r) => ({ p: league.players[r.id]!, total: r.ask }))} />
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
          <RenewOffers league={league} rows={d.rows} ids={[...selected]} choices={choices} choose={choose} />
        </>
      );
      break;
    }
    case 'sponsor': {
      const pick = choices.pick ?? '0';
      body = (
        <>
          {d.ended && <p class="notice warn">{d.ended}</p>}
          <p>
            명명권 계약이 끝났습니다. 지금 스폰서와 재계약하거나 새 스폰서를 받을 수 있습니다. 새 스폰서를 받으면 구단명과 약칭이 스폰서 이름으로 바뀝니다 (키움 히어로즈 방식). 명명권료는 구단 인기와 성적을
            따라갑니다. 스폰서마다 원하는 목표가 다르고, 많이 주는 곳일수록 목표가 높고 목표를 못 채우면 계약 도중에 해지할 수 있습니다 (두 해 연속이면 더 쉽게).
          </p>
          <div class="table-wrap">
            <table class="record-table">
              <thead>
                <tr>
                  <th />
                  <th>스폰서</th>
                  <th class="num">연간</th>
                  <th class="num">기간</th>
                  <th>목표</th>
                  <th class="num">미달 시 해지</th>
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
                    <td>{goalText(o.goal)}</td>
                    <td class="num">{o.risk ? pct(o.risk) : '-'}</td>
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
                      <AlumnusTag league={league} m={row.current} onPlayer={onPlayer} />
                    </td>
                    <td class="num strong">{row.current.rating}</td>
                    <td class="num">{money(row.current.salary)}</td>
                    <td>{row.expiring ? <span class="tag warn">만료</span> : `${row.current.until}년까지`}</td>
                    <td>
                      <select value={choices[row.role] ?? ''} onChange={(e) => choose(row.role, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${STAFF_LABELS[row.role]} 선택`}>
                        <option value="">{row.expiring ? '재계약' : '유지'}</option>
                        {row.candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.playerId ? (isLegend(c) ? '[레전드] ' : '[선수 출신] ') : ''}
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
          {d.rows.some((r) => r.candidates.some((c) => c.playerId)) && (
            <>
              <h4>선수 출신 후보</h4>
              <ul class="plain small">
                {d.rows.flatMap((r) =>
                  r.candidates
                    .filter((c) => c.playerId)
                    .map((c) => (
                      <li key={c.id}>
                        <strong>{STAFF_LABELS[r.role]}</strong> {c.name} (등급 {c.rating})
                        <AlumnusTag league={league} m={c} onPlayer={onPlayer} />
                      </li>
                    )),
                )}
              </ul>
              <p class="muted small">쉬고 있는 구단 레전드는 자리마다 후보로 나옵니다. 레전드를 친정에 데려오면 팬들이 반기고, 계약 기간 중에 내보내면 실망합니다. 지도자 능력은 등급으로 보세요.</p>
            </>
          )}
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
    case 'fantasyPick':
      body = <FantasyBoard league={league} onPlayer={onPlayer} onPick={(id) => onSubmit({ kind: 'fantasyPick', id })} />;
      break;
    case 'meddle': {
      const pick = choices.pick ?? 'obey';
      const options: [string, string, string][] = [
        ['obey', '따른다', `구단주가 흡족해합니다 (신뢰도 +${MEDDLE.obey}).${d.order === 'star' ? ' 마감까지 거물을 데려오지 못하면 크게 실망합니다.' : ''}`],
        ['refuse', '거절한다', `단장의 판단을 지키지만 신뢰도가 ${d.refuse} 떨어집니다. 신뢰도는 겨울 평가의 출발점이고, 15 아래로 떨어지면 해임됩니다.`],
      ];
      const current = d.order === 'manager' ? league.clubs?.[u.teamId]?.staff?.manager : null;
      body = (
        <>
          {d.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {current && d.manager && (
            <p class="muted small">
              지금 감독 {current.name} (등급 {current.rating}, {MANAGER_STYLES[current.style ?? 'balanced']?.label ?? ''}) → 구단주 추천 {d.manager.name} (등급 {d.manager.rating}, {MANAGER_STYLES[d.manager.style ?? 'balanced']?.label ?? ''})
            </p>
          )}
          <p class="muted small">구단주 신뢰도 {Math.round(u.trust ?? 60)} / 100</p>
          <div class="choice-grid" role="radiogroup" aria-label="구단주 지시에 대한 대응">
            {options.map(([k, label, note]) => (
              <button key={k} type="button" class="choice" role="radio" aria-checked={pick === k} aria-pressed={pick === k} onClick={() => choose('pick', k)}>
                <strong>{label}</strong>
                <span class="muted small">{note}</span>
              </button>
            ))}
          </div>
        </>
      );
      break;
    }
    case 'dispute': {
      const pick = choices.pick ?? 'settle';
      const options: [string, string, string][] = [
        ['settle', '합의', `${money(d.settle)}을 주고 끝냅니다. 모기업이 없는 구단이라 투자자들의 신뢰가 조금 떨어집니다.`],
        ['fight', '소송', `올겨울 소송비 ${money(d.legal)}. 내년 겨울 판정에서 이기면 신뢰가 오르고, 지면 ${money(d.loss)}에 지분을 되사야 하며 매각설로 팬 분위기가 가라앉습니다.`],
      ];
      body = (
        <>
          <p>
            {d.firm} {d.investor} 회장이 창단 때 넣은 돈이 대여금이 아니라 지분 40%를 받기로 한 투자였다며 상사중재를 신청했습니다. 구단의 대응을 고르세요.
          </p>
          <div class="choice-grid" role="radiogroup" aria-label="지분 분쟁 대응">
            {options.map(([k, label, note]) => (
              <button key={k} type="button" class="choice" role="radio" aria-checked={pick === k} aria-pressed={pick === k} onClick={() => choose('pick', k)}>
                <strong>{label}</strong>
                <span class="muted small">{note}</span>
              </button>
            ))}
          </div>
          {budgetLine}
        </>
      );
      break;
    }
    case 'scandal': {
      const p = league.players[d.id];
      const pick = choices.pick ?? 'extra';
      const options: [string, string, string][] = [
        ['release', '방출', '팬들은 단호한 대응을 반깁니다. 남은 연봉은 그대로 냅니다. 1군 최소 인원 때문에 지금 방출할 수 없으면 자체 징계로 바뀝니다.'],
        ['extra', '구단 자체 징계', `KBO 징계에 ${20}경기 출장정지와 벌금을 더합니다. 팬들의 실망이 조금 누그러집니다.`],
        ['none', 'KBO 징계만 따름', '선수를 지키지만 팬들의 비판을 받습니다.'],
      ];
      body = (
        <>
          <p>
            {p ? (
              <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                {p.name}
              </button>
            ) : (
              '선수'
            )}{' '}
            · KBO 징계: {d.penalty}
          </p>
          <p>구단의 대응을 고르세요.</p>
          <div class="choice-grid" role="radiogroup" aria-label="구단 대응">
            {options.map(([k, label, note]) => (
              <button key={k} type="button" class="choice" role="radio" aria-checked={pick === k} aria-pressed={pick === k} onClick={() => choose('pick', k)}>
                <strong>{label}</strong>
                <span class="muted small">{note}</span>
              </button>
            ))}
          </div>
        </>
      );
      break;
    }
    case 'national': {
      const e = eventById(d.event);
      const row = Object.fromEntries(d.rows.map((r) => [r.id, r]));
      body = (
        <>
          <p>
            {e ? `${e.year} ${e.name}` : '국가대표'} 대표팀에 우리 선수 {d.rows.length}명이 뽑혔습니다. 구단은 차출을 거부할 수 없지만, 부상이나 컨디션을 이유로 제외를 요청할 수
            있습니다. 다친 선수는 빠지고, 건강한 선수는 대표팀이 받아들일 때만 빠집니다. 건강한 선수를 빼 달라고 하면 팬들이 실망하고, 병역 특례가 걸린 대회라면 선수 본인도
            서운해합니다. 제외를 요청할 선수를 고르세요 (선택 {selected.size}명).
          </p>
          {e && <p class="muted small">대회 기간 {e.dates.from} ~ {e.dates.to}</p>}
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '상태', value: (p) => [row[p.id]!.injured ? '부상' : '건강', row[p.id]!.exemption ? '병역 특례 기회' : ''].filter(Boolean).join(' · ') }}
          />
        </>
      );
      break;
    }
    case 'retire': {
      const chance = Object.fromEntries(d.rows.map((r) => [r.id, r.chance]));
      body = (
        <>
          <p>
            올 시즌을 끝으로 은퇴하겠다는 우리 선수들입니다. 붙잡고 싶은 선수를 고르면 단장이 직접 만나 한 시즌 더 뛰어 달라고 설득합니다. 젊고 아직 잘하는 선수일수록 마음을 돌리기
            쉽습니다. 고르지 않은 선수와 설득에 실패한 선수는 은퇴합니다. 선택 {selected.size}명
          </p>
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: '최근 WAR · 설득 가능성', value: (p) => `${lastWar(p)?.toFixed(1) ?? '-'} · ${pct(chance[p.id] ?? 0)}`, sort: (p) => chance[p.id] ?? 0 }}
          />
        </>
      );
      break;
    }
    case 'faOptions':
      body = (
        <>
          <p>
            보장 기간이 끝나는 FA 계약에 구단 옵션이 있습니다. 실행할 선수를 고르세요 (정해 둔 연봉으로 계약이 늘어납니다). 고르지 않은 선수는 보상 없이 FA 시장에 나갑니다. 선택{' '}
            {selected.size}명
          </p>
          {budgetLine}
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{
              title: '옵션 조건 · 최근 WAR',
              value: (p) => {
                const r = d.rows.find((x) => x.id === p.id)!;
                return `${r.years}년 연 ${eokText(r.annual)} · ${lastWar(p)?.toFixed(1) ?? '-'}`;
              },
              sort: (p) => d.rows.find((x) => x.id === p.id)!.annual,
            }}
          />
        </>
      );
      break;
    case 'faProtect': {
      const fa = league.players[d.fa]!;
      body = (
        <>
          <p>
            {shortName(league, d.from)}에서 {d.grade}등급 FA {eulreul(fa.name)} 데려왔습니다. 보호할 선수 {d.protect}명을 고르세요 (지금 {selected.size}명). {shortName(league, d.from)} 쪽은 나머지 선수 중 1명과
            보상금을 받거나, 보상금만 받습니다. 외국인, 올겨울 영입한 FA, 올해 뽑은 신인은 저절로 보호됩니다.
          </p>
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.protect} />
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
          <BulkBar
            label="훈련 방향 일괄"
            options={[
              ['balanced', '모두 고르게'],
              ['weak', '약점 보완'],
              ['strong', '강점 강화'],
            ]}
            onApply={(v) =>
              setPlans((prev) => {
                const out = { ...prev };
                for (const p of players) {
                  // The public grade of each trainable tool: the lowest for 약점 보완, the highest for 강점 강화.
                  const tools = focusOptions(p).filter((k) => k !== 'balanced');
                  const grade = (k: string) => (p.scouting.tools as Record<string, number>)[k] ?? 50;
                  const focus = v === 'balanced' ? 'balanced' : [...tools].sort((a, b) => (v === 'weak' ? grade(a) - grade(b) : grade(b) - grade(a)))[0]!;
                  out[p.id] = { ...out[p.id], focus };
                }
                return out;
              })
            }
          />
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
                          {pos === p.position ? ' (지금)' : (p.alt ?? []).includes(pos) ? ' (부포지션, 적응 없음)' : ''}
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
      {decisionTip(d.kind) && (
        <Help title="이 결정은?">
          {decisionTip(d.kind)!.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Help>
      )}
      {body}
      <div class="actions">
        {d.kind === 'draftPick' ? (
          <button type="button" onClick={() => onSubmit({ kind: 'draftPick', id: null })}>
            스카우트에게 맡기기
          </button>
        ) : d.kind === 'fantasyPick' ? (
          <>
            <button type="button" onClick={() => onSubmit({ kind: 'fantasyPick', id: null })}>
              이번 지명만 스카우트에게
            </button>
            {d.round < 10 && (
              <button type="button" onClick={() => onSubmit({ kind: 'fantasyPick', id: null, autoUntil: 10 })}>
                10라운드까지 맡기기
              </button>
            )}
            <button type="button" onClick={() => onSubmit({ kind: 'fantasyPick', id: null, autoUntil: d.rounds })}>
              남은 지명 모두 맡기기
            </button>
          </>
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
      {advice && (
        <section class="advice" aria-label="추천 이유">
          <h3>{d.kind === 'camp' ? '코치 추천 이유' : '스카우트 추천 이유'}</h3>
          <p>{advice.rule}</p>
          <ul class="plain small">
            {advice.picks.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p class="muted small">다르게 고르면: {advice.tradeoff}</p>
        </section>
      )}
    </section>
  );
}
