import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
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
  tryout: __i18n_k("ui.decision.tITLES.tryout.432ea5f0"),
  draftPick: __i18n_k("ui.decision.tITLES.draftPick.7bd24a81"),
  specialDraft: __i18n_k("ui.decision.tITLES.specialDraft.c6ab1579"),
  released: __i18n_k("ui.decision.tITLES.released.9eb3f222"),
  foreign: __i18n_k("ui.decision.tITLES.foreign.7f403bab"),
  roster: __i18n_k("ui.decision.tITLES.roster.ea826f46"),
  military: __i18n_k("ui.decision.tITLES.military.82af035c"),
  rookieBonus: __i18n_k("ui.decision.tITLES.rookieBonus.cb4f65a6"),
  development: __i18n_k("ui.decision.tITLES.development.e8d66117"),
  camp: __i18n_k("ui.decision.tITLES.camp.cdea7675"),
  faRound: __i18n_k("ui.decision.tITLES.faRound.eefed8f1"),
  faOptions: __i18n_k("ui.decision.tITLES.faOptions.1eacf031"),
  faProtect: __i18n_k("ui.decision.tITLES.faProtect.a614eb1d"),
  faCompensation: __i18n_k("ui.decision.tITLES.faCompensation.f44acc34"),
  salaries: __i18n_k("ui.decision.tITLES.salaries.d8bea6b5"),
  secondProtect: __i18n_k("ui.decision.tITLES.secondProtect.66fc3475"),
  secondPick: __i18n_k("ui.decision.tITLES.secondPick.7021a262"),
  foreignRenew: __i18n_k("ui.decision.tITLES.foreignRenew.bcddbf3b"),
  posting: __i18n_k("ui.decision.tITLES.posting.563f17a2"),
  returnee: __i18n_k("ui.decision.tITLES.returnee.05ae3968"),
  sponsor: __i18n_k("ui.decision.tITLES.sponsor.3c4370aa"),
  staff: __i18n_k("ui.decision.tITLES.staff.b72feac0"),
  rival: __i18n_k("ui.decision.tITLES.rival.427e4250"),
  rivalProtect: __i18n_k("ui.decision.tITLES.rivalProtect.bc489ffa"),
  retire: __i18n_k("ui.decision.tITLES.retire.7ebe7c63"),
  national: __i18n_k("ui.decision.tITLES.national.e3a9398c"),
  scandal: __i18n_k("ui.decision.tITLES.scandal.562ddfd9"),
  dispute: __i18n_k("ui.decision.tITLES.dispute.8cc0c1f5"),
  meddle: __i18n_k("ui.decision.tITLES.meddle.8a1f72de"),
  fantasyPick: __i18n_k("ui.decision.tITLES.fantasyPick.bc92c419"),
};

/** What the scouts hear about major league interest, from the public grade. */
const mlbInterest = (p: Player) => (p.scouting.current >= 68 ? __i18n_k("ui.decision.mlbInterest.79138429") : p.scouting.current >= 63 ? '높음' : p.scouting.current >= 60 ? '보통' : '낮음');

const SALARY_CHOICES: [SalaryChoice, string][] = [
  ['merit', __i18n_k("ui.decision.sALARY_CHOICES.c6019963")],
  ['ask', __i18n_k("ui.decision.sALARY_CHOICES.0eece949")],
  ['freeze', __i18n_k("ui.decision.sALARY_CHOICES.851e7fc6")],
  ['extension', __i18n_k("ui.decision.sALARY_CHOICES.6fa413a8")],
];

const lastWar = (p: Player) => p.career.filter((c) => !c.level).at(-1)?.war;
const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const POSITION_NAMES: Record<Position, string> = { C: __i18n_k("ui.decision.pOSITION_NAMES.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("ui.decision.pOSITION_NAMES.sS.3e24c7f1"), LF: __i18n_k("ui.decision.pOSITION_NAMES.lF.73836db2"), CF: __i18n_k("ui.decision.pOSITION_NAMES.cF.56780b2a"), RF: __i18n_k("ui.decision.pOSITION_NAMES.rF.a28a0ef8") };
const toolLabel = (k: string) => (k === 'balanced' ? __i18n_k("ui.decision.toolLabel.cdd2ca7b") : ((TOOL_LABELS as Record<string, string>)[k] ?? k));
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
        aria-label={__i18n_displayText(on > 0 ? __i18n_k("ui.decision.selectAllCell.e31bdbe5") : target < ids.length ? __i18n_k("ui.decision.selectAllCell.324272ea", { target: target }) : __i18n_k("ui.decision.selectAllCell.c764a797"))}
        title={__i18n_displayText(on > 0 ? __i18n_k("ui.decision.selectAllCell.e31bdbe5") : target < ids.length ? __i18n_k("ui.decision.selectAllCell.d70c12fd", { target: target }) : __i18n_k("ui.decision.selectAllCell.c764a797"))}
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
    <p class={over > 0 ? 'notice warn' : 'muted'}>{__i18n_t("ui.decision.foreignCapLine.da9d4e52", { next: next, usd: usd(total), usd2: usd(cap), value: over > 0 ? __i18n_k("ui.decision.foreignCapLine.4f534145", { usd: usd(over) }) : '' })}</p>
  );
}

function BulkBar({ label = __i18n_k("ui.decision.bulkBar.e24fb552"), options, onApply }: { label?: string; options: [string, string][]; onApply: (value: string) => void }) {
  return (
    <div class="bulk-bar" role="group" aria-label={__i18n_displayText(label)}>
      <span class="muted small">{__i18n_display(label)}</span>
      {__i18n_display(options.map(([v, text]) => (
        <button key={v} type="button" onClick={() => onApply(v)}>
          {__i18n_display(text)}
        </button>
      )))}
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
            {__i18n_display(!control && (radio || !toggle ? <th aria-label={__i18n_t("ui.decision.playerTable.08109e41")} /> : <SelectAllCell ids={sorted.map((p) => p.id)} selected={selected} toggle={toggle} max={max} />))}
            {__i18n_display(th('name', __i18n_k("ui.decision.playerTable.9aa18e50")))}
            {__i18n_display(th('pos', __i18n_k("ui.decision.playerTable.81922a91")))}
            {__i18n_display(th('age', __i18n_k("ui.decision.playerTable.6c620e5c"), true))}
            <th>{__i18n_t("ui.decision.playerTable.ccbb09a7")}</th>
            {__i18n_display(th('current', __i18n_k("ui.decision.playerTable.001e4be2"), true))}
            {__i18n_display(th('future', __i18n_k("ui.decision.playerTable.6e0caec5"), true))}
            {__i18n_display(extra && (extra.sort ? th('extra', extra.title, true) : <th class="num">{__i18n_display(extra.title)}</th>))}
            {__i18n_display(control && <th>{__i18n_t("ui.decision.playerTable.0c5ee2a0")}</th>)}
          </tr>
        </thead>
        <tbody>
          {__i18n_display(sorted.map((p) => (
            <tr key={p.id} class="player-row" aria-selected={selected?.has(p.id)}>
              {__i18n_display(!control && (
                <td>
                  <input
                    type={radio ? 'radio' : 'checkbox'}
                    name={name}
                    checked={selected?.has(p.id)}
                    onChange={() => toggle?.(p.id)}
                    aria-label={__i18n_displayText(__i18n_k("ui.decision.playerTable.23814a70", { name: p.name }))}
                  />
                </td>
              ))}
              <td>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {__i18n_display(p.name)}
                </button>
                {__i18n_display(p.contract?.kind === 'development' && <span class="tag">{__i18n_t("ui.decision.playerTable.818f3b79")}</span>)}
              </td>
              <td>{__i18n_display(positionLabel(p))}</td>
              <td class="num">{__i18n_display(ageIn(p, year))}</td>
              <td class="muted">
                {__i18n_display(p.teamId
                  ? shortName(league, p.teamId)
                  : poolEntry(league, p.id)
                    ? kboLine(league, p)
                    : p.service.postedIn !== undefined
                      ? __i18n_k("ui.decision.playerTable.378a9635", { postedIn: p.service.postedIn })
                      : p.origin.kind === 'foreign'
                        ? `${p.archetype} · ${p.education.pathText}`
                        : p.career.length
                          ? __i18n_k("ui.decision.playerTable.e16b5dd5")
                          : p.origin.pathway)}
              </td>
              <td class={`num ${gradeClass(p.scouting.current)}`}>{__i18n_display(p.scouting.current)}</td>
              <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{__i18n_display(p.scouting.futureValue)}</td>
              {__i18n_display(extra && <td class="num">{__i18n_display(extra.value(p))}</td>)}
              {__i18n_display(control && <td>{__i18n_display(control(p))}</td>)}
            </tr>
          )))}
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
            {__i18n_display(th('rank', __i18n_k("ui.decision.draftTable.d15876f1"), true))}
            {__i18n_display(th('name', __i18n_k("ui.decision.draftTable.9aa18e50")))}
            {__i18n_display(th('pos', __i18n_k("ui.decision.draftTable.81922a91")))}
            {__i18n_display(th('age', __i18n_k("ui.decision.draftTable.6c620e5c"), true))}
            <th>{__i18n_t("ui.decision.draftTable.af2feed6")}</th>
            {__i18n_display(th('current', __i18n_k("ui.decision.draftTable.001e4be2"), true))}
            {__i18n_display(th('future', __i18n_k("ui.decision.draftTable.6e0caec5"), true))}
            {__i18n_display(th('velocity', __i18n_k("ui.decision.draftTable.b8c2e079"), true))}
            <th aria-label={__i18n_t("ui.decision.draftTable.68a26d9d")} />
          </tr>
        </thead>
        <tbody>
          {__i18n_display(sorted.slice(0, 150).map((p) => (
            <tr key={p.id} class="player-row">
              <td class="num">{__i18n_display(p.amateur.draftRank)}</td>
              <td>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {__i18n_display(p.name)}
                </button>
                {__i18n_display(recommended.has(p.id) && <span class="tag">{__i18n_t("ui.decision.draftTable.53acdb0d")}</span>)}
                {__i18n_display(p.amateur.intent === 'college' && <span class="tag">{__i18n_t("ui.decision.draftTable.ae5aa8c0")}</span>)}
                {__i18n_display(p.amateur.intent === 'abroad' && <span class="tag">{__i18n_t("ui.decision.draftTable.b9b5f9ea")}</span>)}
              </td>
              <td>{__i18n_display(positionLabel(p))}</td>
              <td class="num">{__i18n_display(ageIn(p, year + 1))}</td>
              <td class="muted">{__i18n_display(p.origin.pathway)}</td>
              <td class={`num ${gradeClass(p.scouting.current)}`}>{__i18n_display(p.scouting.current)}</td>
              <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{__i18n_display(p.scouting.futureValue)}</td>
              <td class="num">{__i18n_display(p.velocity ?? '-')}</td>
              <td>
                <button type="button" class="pick" onClick={() => onPick(p.id)}>{__i18n_t("ui.decision.draftTable.68a26d9d")}</button>
              </td>
            </tr>
          )))}
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
    <p class="muted">{__i18n_t("ui.decision.decision.budgetLine.e9273c2f", { money: money(u.fund), next: next, money2: money(projectedPayroll(league, u.teamId, next)), money3: money(u.payrollBudget) })}</p>
  );

  // The free-agent market has its own screen (V0.8).
  if (d.kind === 'faRound') return <FaMarket league={league} onSubmit={onSubmit} onPlayer={onPlayer} />;

  let body: ComponentChildren = null;
  switch (d.kind) {
    case 'tryout':
    case 'released':
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.3a50ab1f", { value: d.kind === 'tryout' && u.settings.scenario === 'steel'
              ? __i18n_k("ui.decision.decision.09fd3350")
              : d.kind === 'tryout'
              ? __i18n_k("ui.decision.decision.a744187e")
              : __i18n_k("ui.decision.decision.b8168578"), value2: ' ', max: d.max, size: selected.size })}</p>
          <PlayerTable league={league} players={byValue(d.candidates)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.max} />
        </>
      );
      break;
    case 'draftPick': {
      const draft = league.offseason!.draft!;
      const mine = Object.values(league.players).filter((p) => p.teamId === u.teamId && p.origin.draftYear === draft.year && p.origin.overallPick);
      body = (
        <>
          <p>{__i18n_rich("ui.decision.decision.0a4eef4a", { value: draft.year + 1, label: d.label, overall: d.overall, length: draft.pool.length, length2: mine.length, value2: ' ', value3: <span class="muted">{__i18n_display(mine.map((p) => p.name).join(', ') || __i18n_k("ui.decision.decision.d58fa73a"))}</span> })}</p>
          <p class="muted">{__i18n_t("ui.decision.decision.bd4cd855")}</p>
          <DraftTable league={league} onPlayer={onPlayer} onPick={(id) => onSubmit({ kind: 'draftPick', id })} />
        </>
      );
      break;
    }
    case 'specialDraft': {
      const count = Object.keys(special).length;
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.a4684b26", { protectedCount: d.protectedCount, money: money(d.fee), value: ' ', count: count, money2: money(count * d.fee) })}</p>
          {__i18n_display(budgetLine)}
          {__i18n_display(Object.entries(d.lists).map(([teamId, ids]) => (
            <details key={teamId} open={!special[teamId]}>
              <summary>
                {__i18n_display(league.teams.find((t) => t.id === teamId)?.name)}
                {__i18n_display(special[teamId] && ` → ${league.players[special[teamId]!]!.name}`)}
              </summary>
              <PlayerTable
                league={league}
                name={`special-${teamId}`}
                radio
                players={byValue(ids).slice(0, 12)}
                selected={new Set(special[teamId] ? [special[teamId]!] : [])}
                toggle={(id) => setSpecial((prev) => (prev[teamId] === id ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== teamId)) : { ...prev, [teamId]: id }))}
                onPlayer={onPlayer}
                extra={{ title: __i18n_k("ui.decision.decision.title.cbf383ec"), value: (p) => money(salaryIn(p, next)), sort: (p) => salaryIn(p, next) }}
              />
            </details>
          )))}
        </>
      );
      break;
    }
    case 'foreign': {
      const groups: [string, (p: Player) => boolean][] = [
        [__i18n_k("ui.decision.decision.groups.1ec91f4e"), (p) => !p.origin.asiaQuota && isPitcher(p)],
        [__i18n_k("ui.decision.decision.groups.7759e37f"), (p) => !p.origin.asiaQuota && !isPitcher(p)],
        [__i18n_k("ui.decision.decision.groups.c66942ff"), (p) => !!p.origin.asiaQuota],
      ];
      const cands = d.candidates.map((id) => league.players[id]!);
      // Between rounds the old picks may name players who have left the talks, until the reset below runs.
      const picked = [...selected].filter((id) => d.candidates.includes(id));
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.6febc0f0", { regular: d.regular, value: d.asia ? __i18n_k("ui.decision.decision.18aec1f8", { asia: d.asia }) : '' })}</p>
          {__i18n_display((d.round ?? 1) > 1 && (
            <div class="notice">
              <strong>{__i18n_t("ui.decision.decision.227600ec", { round: d.round })}</strong>
              <ul class="plain small">
                {__i18n_display((d.log ?? []).map((line) => (
                  <li key={line}>{__i18n_display(line)}</li>
                )))}
              </ul>
            </div>
          ))}
          {__i18n_display(budgetLine)}
          <ForeignCapLine
            league={league}
            next={next}
            adding={picked.map((id) => ({ p: league.players[id]!, total: d.terms?.[id] ? dealTotal(d.terms[id]!, offerOf(league, id, d.terms[id]!, choices)) : usdTotal(league.players[id]!.contract) }))}
          />
          {__i18n_display(groups.map(([title, test]) => (
            <div key={title}>
              <h4>{__i18n_display(title)}</h4>
              <PlayerTable
                league={league}
                players={cands.filter(test).sort((a, b) => b.scouting.current - a.scouting.current)}
                selected={selected}
                toggle={toggle}
                onPlayer={onPlayer}
                extra={{
                  title: __i18n_k("ui.decision.decision.title.aff747f0"),
                  value: (p) => (p.contract?.usd ? `${usd(usdTotal(p.contract))} (${usd(p.contract.usd.bonus)}·${usd(p.contract.usd.salary)}·${usd(p.contract.usd.options)})` : '-'),
                  sort: (p) => usdTotal(p.contract),
                }}
              />
            </div>
          )))}
          {__i18n_display(d.terms && <ForeignOffers league={league} ids={picked} terms={d.terms} choices={choices} choose={choose} />)}
          <p class="muted">{__i18n_t("ui.decision.decision.05982f20")}</p>
        </>
      );
      break;
    }
    case 'roster':
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.3a851d9b", { limit: d.limit, release: d.release, size: selected.size })}</p>
          <PlayerTable
            league={league}
            players={d.candidates.map((id) => league.players[id]!).sort((a, b) => keepValue(a, next) - keepValue(b, next))}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            max={d.release}
            extra={{ title: __i18n_k("ui.decision.decision.title.cbf383ec"), value: (p) => money(salaryIn(p, next)), sort: (p) => salaryIn(p, next) }}
          />
          {__i18n_display(selected.size > 0 && (
            <fieldset class="develop-picks">
              <legend>{__i18n_t("ui.decision.decision.e8a27ced")}</legend>
              {__i18n_display([...selected].map((id) => (
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
                  />{__i18n_display(' ')}
                  {__i18n_display(league.players[id]!.name)}
                </label>
              )))}
            </fieldset>
          ))}
        </>
      );
      break;
    case 'military': {
      const players = d.candidates.map((id) => league.players[id]!);
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.e50cb9cf", { length: players.length, value: d.social?.length ? __i18n_k("ui.decision.decision.7680ee7b") : '' })}</p>
          <BulkBar
            options={[
              ['stay', __i18n_k("ui.decision.decision.6ec04389")],
              ['sangmu', __i18n_k("ui.decision.decision.20d32027")],
              ['army', __i18n_k("ui.decision.decision.31e4b341")],
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
            extra={{ title: __i18n_k("ui.decision.decision.title.a0ab22c2"), value: (p) => pct(sangmuChance(p, next)), sort: (p) => sangmuChance(p, next) }}
            control={(p) => (
              <span class="row-actions">
                <select value={choices[p.id] ?? (d.forced.includes(p.id) ? '' : 'stay')} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.55c4b55a", { name: p.name }))}>
                  {__i18n_display(d.forced.includes(p.id) ? <option value="">{__i18n_t("ui.decision.decision.57c2654b")}</option> : <option value="stay">{__i18n_t("ui.decision.decision.8a7916dc")}</option>)}
                  {__i18n_display(d.social?.includes(p.id) ? (
                    <option value="social">{__i18n_t("ui.decision.decision.620ee280")}</option>
                  ) : (
                    <>
                      <option value="sangmu">{__i18n_t("ui.decision.decision.ac73dafe")}</option>
                      <option value="army">{__i18n_t("ui.decision.decision.b1da4883")}</option>
                    </>
                  ))}
                </select>
                {__i18n_display(d.social?.includes(p.id) && (
                  <span class="tag warn" title={__i18n_displayText(serviceNote(p))}>{__i18n_t("ui.decision.decision.9c266742")}</span>
                ))}
                {__i18n_display(league.injuries[p.id] && <span class="muted small">{__i18n_t("ui.decision.decision.50a14378")}</span>)}
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
            {__i18n_display(d.final
              ? __i18n_k("ui.decision.decision.58630b41")
              : __i18n_k("ui.decision.decision.7495be17"))}
          </p>
          <p class="muted">{__i18n_t("ui.decision.decision.a486f472", { money: money(u.fund), money2: money(total) })}</p>
          <BulkBar
            options={[['ask', __i18n_k("ui.decision.decision.9b8ab74d")], ...(d.final ? [] : ([['slot', __i18n_k("ui.decision.decision.09ecaf03")]] as [string, string][])), ['none', __i18n_k("ui.decision.decision.d2459c50")]]}
            onApply={(v) => setChoices((prev) => ({ ...prev, ...Object.fromEntries(d.picks.filter((pk) => v !== 'slot' || pk.slot < pk.ask).map((pk) => [pk.id, v])) }))}
          />
          <PlayerTable
            league={league}
            players={d.picks.map((pk) => league.players[pk.id]!)}
            onPlayer={onPlayer}
            extra={{ title: __i18n_k("ui.decision.decision.title.742fda76"), value: (p) => `${money(byId[p.id]!.slot)} · ${money(byId[p.id]!.ask)}`, sort: (p) => byId[p.id]!.ask }}
            control={(p) => {
              const pk = byId[p.id]!;
              const c = choices[p.id] ?? 'ask';
              const chance = d.final ? null : draftContracts.publicChance({ intent: p.amateur.intent ?? null }, bonusOffer(p.id, pk) / 100, pk.ask / 100, u.settings.difficulty as Difficulty);
              return (
                <span class="row-actions">
                  <select value={c} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.40907b5d", { name: p.name }))}>
                    <option value="ask">{__i18n_t("ui.decision.decision.7b3e8e9d", { money: money(pk.ask) })}</option>
                    {__i18n_display(!d.final && pk.slot < pk.ask && <option value="slot">{__i18n_t("ui.decision.decision.9f67d25a", { money: money(pk.slot) })}</option>)}
                    <option value="none">{__i18n_t("ui.decision.decision.2facf7f8")}</option>
                  </select>
                  {__i18n_display(chance !== null && c !== 'none' && <span class="muted">{__i18n_t("ui.decision.decision.7295dfdc", { pct: pct(chance) })}</span>)}
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
          <p>{__i18n_t("ui.decision.decision.0e2167f8", { max: d.max, size: selected.size })}</p>
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
          <p>{__i18n_t("ui.decision.decision.2668622c", { next: next })}</p>
          <p class="muted">{__i18n_t("ui.decision.decision.f44728c3", { length: d.rows.length, money: money(total), money2: money(others), money3: money(total + others), money4: money(u.payrollBudget) })}</p>
          <BulkBar
            options={SALARY_CHOICES.filter(([k]) => k !== 'extension').map(([k, label]) => [k, __i18n_k("ui.decision.decision.efa1c6e5", { label: label })] as [string, string])}
            onApply={(v) => setChoices((prev) => ({ ...prev, ...Object.fromEntries(d.rows.map((r) => [r.id, v])) }))}
          />
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            onPlayer={onPlayer}
            extra={{
              title: __i18n_k("ui.decision.decision.title.76e975b4"),
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
                  <select value={c} onChange={(e) => choose(p.id, (e.currentTarget as HTMLSelectElement).value)} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.544e6610", { name: p.name }))}>
                    {__i18n_display(SALARY_CHOICES.filter(([k]) => k !== 'extension' || r.extension).map(([k, label]) => (
                      <option key={k} value={k}>
                        {__i18n_display(label)} {__i18n_display(k === 'extension' && r.extension ? __i18n_k("ui.decision.decision.fe7a4eb6", { years: r.extension.years, money: money(r.extension.annual) }) : money(salaryOffer(r, k)))}
                      </option>
                    )))}
                  </select>
                  {__i18n_display(r.arbitration && <span class="muted">{__i18n_t("ui.decision.decision.a5488def")}</span>)}
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
          <p>{__i18n_t("ui.decision.decision.9ae171b1", { year: league.offseason?.year, protect: d.protect, size: selected.size })}</p>
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.protect} />
        </>
      );
      break;
    case 'rival':
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.8e274406", { value: d.event
              ? __i18n_k("ui.decision.decision.dc51d0c5")
              : __i18n_k("ui.decision.decision.6347b252", { year: d.year }), value2: ' ', year: d.year, value3: d.year + 1, value4: d.year + 2 })}</p>
          {__i18n_display(d.event && (
            <div class="segmented" role="group" aria-label={__i18n_t("ui.decision.decision.28889241")}>
              <button type="button" aria-pressed={vote} onClick={() => setVote(true)}>{__i18n_t("ui.decision.decision.70830ad8")}</button>
              <button type="button" aria-pressed={!vote} onClick={() => setVote(false)}>{__i18n_t("ui.decision.decision.132b28ee")}</button>
            </div>
          ))}
          {__i18n_display(vote && <RivalForm league={league} value={rival ?? d.suggestion} onChange={setRival} />)}
        </>
      );
      break;
    case 'rivalProtect':
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.b82fa189", { name: league.teams.find((t) => t.id === league.twelve?.teamId)?.name, protect: d.protect, size: selected.size, value: ' ', money: money(d.fee) })}</p>
          <PlayerTable league={league} players={d.candidates.map((id) => league.players[id]!)} selected={selected} toggle={toggle} onPlayer={onPlayer} max={d.protect} />
        </>
      );
      break;
    case 'secondPick':
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.568ff06e", { round: d.round, money: money(d.fee) })}</p>
          <PlayerTable
            league={league}
            players={d.candidates.map((id) => league.players[id]!)}
            onPlayer={onPlayer}
            extra={{ title: __i18n_k("ui.decision.decision.title.cbf383ec"), value: (p) => money(salaryIn(p, next) || salaryIn(p, next - 1)), sort: (p) => salaryIn(p, next - 1) }}
            control={(p) => (
              <button type="button" class="pick" onClick={() => onSubmit({ kind: 'secondPick', id: p.id })}>{__i18n_t("ui.decision.decision.68a26d9d")}</button>
            )}
          />
        </>
      );
      break;
    case 'foreignRenew': {
      const byId = Object.fromEntries(d.rows.map((r) => [r.id, r]));
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.b8589bd1")}</p>
          {__i18n_display(budgetLine)}
          <ForeignCapLine league={league} next={next} adding={d.rows.filter((r) => selected.has(r.id)).map((r) => ({ p: league.players[r.id]!, total: r.ask }))} />
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={(id) => !byId[id]!.leaving && toggle(id)}
            onPlayer={onPlayer}
            extra={{
              title: __i18n_k("ui.decision.decision.title.440e928f"),
              value: (p) => (byId[p.id]!.leaving ? __i18n_k("ui.decision.decision.value.731f5f57", { value: byId[p.id]!.war.toFixed(1) }) : `${byId[p.id]!.war.toFixed(1)} · ${usd(byId[p.id]!.ask)}`),
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
          {__i18n_display(d.ended && <p class="notice warn">{__i18n_display(d.ended)}</p>)}
          <p>{__i18n_t("ui.decision.decision.bc0a5041")}</p>
          <div class="table-wrap">
            <table class="record-table">
              <thead>
                <tr>
                  <th />
                  <th>{__i18n_t("ui.decision.decision.a730ef50")}</th>
                  <th class="num">{__i18n_t("ui.decision.decision.ce9526b7")}</th>
                  <th class="num">{__i18n_t("ui.decision.decision.2622331e")}</th>
                  <th>{__i18n_t("ui.decision.decision.2fbea43b")}</th>
                  <th class="num">{__i18n_t("ui.decision.decision.a2e65260")}</th>
                </tr>
              </thead>
              <tbody>
                {__i18n_display(d.offers.map((o, i) => (
                  <tr key={o.name}>
                    <td>
                      <input type="radio" name="sponsor" checked={pick === String(i)} onChange={() => choose('pick', String(i))} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.23814a70", { name: o.name }))} />
                    </td>
                    <td>
                      {__i18n_display(o.name)}
                      {__i18n_display(i === 0 && <span class="tag">{__i18n_t("ui.decision.decision.994331cf")}</span>)}
                    </td>
                    <td class="num">{__i18n_display(money(o.annual))}</td>
                    <td class="num">{__i18n_t("ui.decision.decision.044a2535", { years: o.years })}</td>
                    <td>{__i18n_display(goalText(o.goal))}</td>
                    <td class="num">{__i18n_display(o.risk ? pct(o.risk) : '-')}</td>
                  </tr>
                )))}
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
          <p>{__i18n_t("ui.decision.decision.26242ff4")}</p>
          <p class="muted">{__i18n_t("ui.decision.decision.c2eefb9f", { money: money(u.fund) })}</p>
          <div class="table-wrap" tabIndex={0}>
            <table class="record-table staff-table">
              <thead>
                <tr>
                  <th>{__i18n_t("ui.decision.decision.9e7bc39f")}</th>
                  <th>{__i18n_t("ui.decision.decision.d07eb370")}</th>
                  <th class="num">{__i18n_t("ui.decision.decision.89dbf513")}</th>
                  <th class="num">{__i18n_t("ui.decision.decision.cbf383ec")}</th>
                  <th>{__i18n_t("ui.decision.decision.b4116369")}</th>
                  <th>{__i18n_t("ui.decision.decision.08109e41")}</th>
                </tr>
              </thead>
              <tbody>
                {__i18n_display(d.rows.map((row) => (
                  <tr key={row.role}>
                    <th scope="row">
                      {__i18n_display(STAFF_LABELS[row.role])}
                      <div class="muted small">{__i18n_display(STAFF_EFFECTS[row.role])}</div>
                    </th>
                    <td>
                      {__i18n_display(row.current.name)}
                      {__i18n_display(row.current.style && <span class="muted"> · {__i18n_display(MANAGER_STYLES[row.current.style].label)}</span>)}
                      <AlumnusTag league={league} m={row.current} onPlayer={onPlayer} />
                    </td>
                    <td class="num strong">{__i18n_display(row.current.rating)}</td>
                    <td class="num">{__i18n_display(money(row.current.salary))}</td>
                    <td>{__i18n_display(row.expiring ? <span class="tag warn">{__i18n_t("ui.decision.decision.36009eb0")}</span> : __i18n_k("ui.decision.decision.9c7dfa36", { until: row.current.until }))}</td>
                    <td>
                      <select value={choices[row.role] ?? ''} onChange={(e) => choose(row.role, (e.currentTarget as HTMLSelectElement).value)} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.5e8b41fb", { value: STAFF_LABELS[row.role] }))}>
                        <option value="">{__i18n_display(row.expiring ? __i18n_k("ui.decision.decision.994331cf") : __i18n_k("ui.decision.decision.bb3ad48c"))}</option>
                        {__i18n_display(row.candidates.map((c) => (
                          <option key={c.id} value={c.id}>{__i18n_t("ui.decision.decision.ac4dcaa2", { value: c.playerId ? (isLegend(c) ? __i18n_k("ui.decision.decision.c4104e94") : __i18n_k("ui.decision.decision.b99806f6")) : '', name: c.name, rating: c.rating, money: money(c.salary), value2: c.style ? ` · ${MANAGER_STYLES[c.style].label}` : '', value3: row.buyout ? __i18n_k("ui.decision.decision.abbee6cd", { money: money(row.buyout) }) : '' })}</option>
                        )))}
                      </select>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          {__i18n_display(d.rows.some((r) => r.candidates.some((c) => c.playerId)) && (
            <>
              <h4>{__i18n_t("ui.decision.decision.d378d082")}</h4>
              <ul class="plain small">
                {__i18n_display(d.rows.flatMap((r) =>
                  r.candidates
                    .filter((c) => c.playerId)
                    .map((c) => (
                      <li key={c.id}>
                        <strong>{__i18n_display(STAFF_LABELS[r.role])}</strong> {__i18n_display(c.name)} {__i18n_t("ui.decision.decision.286dd552", { rating: c.rating })}
                        <AlumnusTag league={league} m={c} onPlayer={onPlayer} />
                      </li>
                    )),
                ))}
              </ul>
              <p class="muted small">{__i18n_t("ui.decision.decision.24df0a1f")}</p>
            </>
          ))}
        </>
      );
      break;
    }
    case 'returnee': {
      const rows = new Map(d.rows.map((r) => [r.id, r]));
      const cost = d.rows.filter((r) => selected.has(r.id)).reduce((a, r) => a + r.annual, 0);
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.156e8525")}</p>
          <p class="muted">{__i18n_t("ui.decision.decision.a734d51e", { next: next, money: money(projectedPayroll(league, u.teamId, next)), money2: money(cost), money3: money(u.payrollBudget) })}</p>
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: __i18n_k("ui.decision.decision.title.98d4ca5a"), value: (p) => __i18n_k("ui.decision.decision.value.49f7c0cd", { years: rows.get(p.id)!.years, money: money(rows.get(p.id)!.annual), abroad: rows.get(p.id)!.abroad }), sort: (p) => rows.get(p.id)!.annual }}
          />
        </>
      );
      break;
    }
    case 'posting': {
      const pick = choices.pick ?? 'none';
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.80e2f8e3")}</p>
          <label class="check">
            <input type="radio" name="posting" checked={pick === 'none'} onChange={() => choose('pick', 'none')} /> 아무도 포스팅하지 않음
          </label>
          <PlayerTable
            league={league}
            players={d.candidates.map((id) => league.players[id]!)}
            onPlayer={onPlayer}
            extra={{ title: __i18n_k("ui.decision.decision.title.11ab7c2a"), value: (p) => `${mlbInterest(p)} · ${money(salaryIn(p, next - 1))}`, sort: (p) => p.scouting.current }}
            control={(p) => (
              <label class="check">
                <input type="radio" name="posting" checked={pick === p.id} onChange={() => choose('pick', p.id)} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.fd515c2c", { name: p.name }))} /> 포스팅
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
        ['obey', __i18n_k("ui.decision.decision.options.53383ff3"), __i18n_k("ui.decision.decision.options.eb25a1f9", { obey: MEDDLE.obey, value: d.order === 'star' ? __i18n_k("ui.decision.decision.options.67a619bd") : '' })],
        ['refuse', __i18n_k("ui.decision.decision.options.c3df1fb6"), __i18n_k("ui.decision.decision.options.ffe07d91", { refuse: d.refuse })],
      ];
      const current = d.order === 'manager' ? league.clubs?.[u.teamId]?.staff?.manager : null;
      body = (
        <>
          {__i18n_display(d.lines.map((line) => (
            <p key={line}>{__i18n_display(line)}</p>
          )))}
          {__i18n_display(current && d.manager && (
            <p class="muted small">{__i18n_t("ui.decision.decision.074a9a6f", { name: current.name, rating: current.rating, value: MANAGER_STYLES[current.style ?? 'balanced']?.label ?? '', name2: d.manager.name, rating2: d.manager.rating, value2: MANAGER_STYLES[d.manager.style ?? 'balanced']?.label ?? '' })}</p>
          ))}
          <p class="muted small">{__i18n_t("ui.decision.decision.5399f1da", { value: Math.round(u.trust ?? 60) })}</p>
          <div class="choice-grid" role="radiogroup" aria-label={__i18n_t("ui.decision.decision.2c0219be")}>
            {__i18n_display(options.map(([k, label, note]) => (
              <button key={k} type="button" class="choice" role="radio" aria-checked={pick === k} aria-pressed={pick === k} onClick={() => choose('pick', k)}>
                <strong>{__i18n_display(label)}</strong>
                <span class="muted small">{__i18n_display(note)}</span>
              </button>
            )))}
          </div>
        </>
      );
      break;
    }
    case 'dispute': {
      const pick = choices.pick ?? 'settle';
      const options: [string, string, string][] = [
        ['settle', __i18n_k("ui.decision.decision.options.a8824da0"), __i18n_k("ui.decision.decision.options.48f99f2f", { money: money(d.settle) })],
        ['fight', __i18n_k("ui.decision.decision.options.16d15266"), __i18n_k("ui.decision.decision.options.df5bf5d4", { money: money(d.legal), money2: money(d.loss) })],
      ];
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.b449053e", { firm: d.firm, investor: d.investor })}</p>
          <div class="choice-grid" role="radiogroup" aria-label={__i18n_t("ui.decision.decision.99b43eba")}>
            {__i18n_display(options.map(([k, label, note]) => (
              <button key={k} type="button" class="choice" role="radio" aria-checked={pick === k} aria-pressed={pick === k} onClick={() => choose('pick', k)}>
                <strong>{__i18n_display(label)}</strong>
                <span class="muted small">{__i18n_display(note)}</span>
              </button>
            )))}
          </div>
          {__i18n_display(budgetLine)}
        </>
      );
      break;
    }
    case 'scandal': {
      const p = league.players[d.id];
      const pick = choices.pick ?? 'extra';
      const options: [string, string, string][] = [
        ['release', __i18n_k("ui.decision.decision.options.e16b5dd5"), __i18n_k("ui.decision.decision.options.391ff34c")],
        ['extra', __i18n_k("ui.decision.decision.options.f678166c"), __i18n_k("ui.decision.decision.options.f4422979", { value: 20 })],
        ['none', __i18n_k("ui.decision.decision.options.a5cf5786"), __i18n_k("ui.decision.decision.options.88aff6b5")],
      ];
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.a787e695", { value: p ? (
              <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                {__i18n_display(p.name)}
              </button>
            ) : (
              __i18n_k("ui.decision.decision.c37450d6")
            ), value2: ' ', penalty: d.penalty })}</p>
          <p>{__i18n_t("ui.decision.decision.2d99e48b")}</p>
          <div class="choice-grid" role="radiogroup" aria-label={__i18n_t("ui.decision.decision.de29eaee")}>
            {__i18n_display(options.map(([k, label, note]) => (
              <button key={k} type="button" class="choice" role="radio" aria-checked={pick === k} aria-pressed={pick === k} onClick={() => choose('pick', k)}>
                <strong>{__i18n_display(label)}</strong>
                <span class="muted small">{__i18n_display(note)}</span>
              </button>
            )))}
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
          <p>{__i18n_t("ui.decision.decision.dc0de877", { value: e ? `${e.year} ${e.name}` : __i18n_k("ui.decision.decision.3243618b"), length: d.rows.length, size: selected.size })}</p>
          {__i18n_display(e && <p class="muted small">{__i18n_t("ui.decision.decision.0da343fb", { from: e.dates.from, to: e.dates.to })}</p>)}
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: __i18n_k("ui.decision.decision.title.2926977b"), value: (p) => [row[p.id]!.injured ? __i18n_k("ui.decision.decision.value.501fb802") : __i18n_k("ui.decision.decision.value.9ec14632"), row[p.id]!.exemption ? __i18n_k("ui.decision.decision.value.dbb93a2e") : ''].filter(Boolean).join(' · ') }}
          />
        </>
      );
      break;
    }
    case 'retire': {
      const chance = Object.fromEntries(d.rows.map((r) => [r.id, r.chance]));
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.c36dc672", { size: selected.size })}</p>
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{ title: __i18n_k("ui.decision.decision.title.d82979cd"), value: (p) => `${lastWar(p)?.toFixed(1) ?? '-'} · ${pct(chance[p.id] ?? 0)}`, sort: (p) => chance[p.id] ?? 0 }}
          />
        </>
      );
      break;
    }
    case 'faOptions':
      body = (
        <>
          <p>{__i18n_t("ui.decision.decision.b9c4b849", { value: ' ', size: selected.size })}</p>
          {__i18n_display(budgetLine)}
          <PlayerTable
            league={league}
            players={d.rows.map((r) => league.players[r.id]!)}
            selected={selected}
            toggle={toggle}
            onPlayer={onPlayer}
            extra={{
              title: __i18n_k("ui.decision.decision.title.e196e6a3"),
              value: (p) => {
                const r = d.rows.find((x) => x.id === p.id)!;
                return __i18n_k("ui.decision.decision.value.a06038b7", { years: r.years, eokText: eokText(r.annual), value: lastWar(p)?.toFixed(1) ?? '-' });
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
          <p>{__i18n_t("ui.decision.decision.b176e269", { shortName: shortName(league, d.from), grade: d.grade, name: eulreul(fa.name), protect: d.protect, size: selected.size, shortName2: shortName(league, d.from) })}</p>
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
          <p>{__i18n_t("ui.decision.decision.4802c776", { grade: d.grade, name: iga(fa.name), shortName: ro(shortName(league, d.to)), shortName2: shortName(league, d.to), money: money(d.withPlayer), value: ' ', money2: money(d.cashOnly) })}</p>
          <label class="check">
            <input type="radio" name="comp" checked={pick === 'cash'} onChange={() => choose('pick', 'cash')} /> 보상금만 {__i18n_display(money(d.cashOnly))}
          </label>
          <PlayerTable
            league={league}
            name="comp"
            radio
            players={d.list.map((id) => league.players[id]!).slice(0, 40)}
            selected={new Set(pick !== 'cash' ? [pick] : [])}
            toggle={(id) => choose('pick', id)}
            onPlayer={onPlayer}
            extra={{ title: __i18n_k("ui.decision.decision.title.cbf383ec"), value: (p) => money(salaryIn(p, next) || salaryIn(p, next - 1)), sort: (p) => salaryIn(p, next - 1) }}
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
          <p>{__i18n_t("ui.decision.decision.4b466648", { next: next })}</p>
          <BulkBar
            label={__i18n_t("ui.decision.decision.6cd016ed")}
            options={[
              ['balanced', __i18n_k("ui.decision.decision.ee2c7d2f")],
              ['weak', __i18n_k("ui.decision.decision.56eeb285")],
              ['strong', __i18n_k("ui.decision.decision.74534644")],
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
                  <select value={cur.focus} onChange={(e) => setPlan(p, { focus: (e.currentTarget as HTMLSelectElement).value })} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.a9963324", { name: p.name }))}>
                    {__i18n_display(focusOptions(p).map((k) => (
                      <option key={k} value={k}>
                        {__i18n_display(toolLabel(k))}
                      </option>
                    )))}
                  </select>
                  {__i18n_display(isPitcher(p) ? (
                    <select value={cur.role} onChange={(e) => setPlan(p, { role: (e.currentTarget as HTMLSelectElement).value as 'SP' | 'RP' })} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.5f3c1e51", { name: p.name }))}>
                      <option value="SP">{__i18n_t("ui.decision.decision.a88271df")}</option>
                      <option value="RP">{__i18n_t("ui.decision.decision.5b8607a3")}</option>
                    </select>
                  ) : (
                    <select value={cur.position ?? ''} onChange={(e) => setPlan(p, { position: (e.currentTarget as HTMLSelectElement).value as Position })} aria-label={__i18n_displayText(__i18n_k("ui.decision.decision.b897af26", { name: p.name }))}>
                      {__i18n_display(POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {__i18n_display(POSITION_NAMES[pos])}
                          {__i18n_display(pos === p.position ? __i18n_k("ui.decision.decision.f91f5c25") : (p.alt ?? []).includes(pos) ? __i18n_k("ui.decision.decision.de4f6f2e") : '')}
                        </option>
                      )))}
                    </select>
                  ))}
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
      <h2 id="decision-title">{__i18n_display(TITLES[d.kind])}</h2>
      {__i18n_display(decisionTip(d.kind) && (
        <Help title={__i18n_t("ui.decision.decision.dcde1318")}>
          {__i18n_display(decisionTip(d.kind)!.body.map((line) => (
            <p key={line}>{__i18n_display(line)}</p>
          )))}
        </Help>
      ))}
      {__i18n_display(body)}
      <div class="actions">
        {__i18n_display(d.kind === 'draftPick' ? (
          <button type="button" onClick={() => onSubmit({ kind: 'draftPick', id: null })}>{__i18n_t("ui.decision.decision.ef320e15")}</button>
        ) : d.kind === 'fantasyPick' ? (
          <>
            <button type="button" onClick={() => onSubmit({ kind: 'fantasyPick', id: null })}>{__i18n_t("ui.decision.decision.34a2fe1f")}</button>
            {__i18n_display(d.round < 10 && (
              <button type="button" onClick={() => onSubmit({ kind: 'fantasyPick', id: null, autoUntil: 10 })}>{__i18n_t("ui.decision.decision.4f929425")}</button>
            ))}
            <button type="button" onClick={() => onSubmit({ kind: 'fantasyPick', id: null, autoUntil: d.rounds })}>{__i18n_t("ui.decision.decision.5d21ee8a")}</button>
          </>
        ) : d.kind === 'secondPick' ? (
          <>
            <button type="button" onClick={() => onSubmit({ kind: 'secondPick', id: null })}>{__i18n_t("ui.decision.decision.2f99d7ad")}</button>
            <button type="button" onClick={() => onSubmit(autoDecision(league) as DecisionInput)}>{__i18n_t("ui.decision.decision.ef320e15")}</button>
          </>
        ) : (
          <>
            <button type="button" class="primary" disabled={!!problem} onClick={() => input && onSubmit(input)}>{__i18n_t("ui.decision.decision.55536106")}</button>
            <button type="button" onClick={recommend}>
              {__i18n_display(d.kind === 'camp' ? __i18n_k("ui.decision.decision.3d05078a") : __i18n_k("ui.decision.decision.abd43abb"))}
            </button>
          </>
        ))}
        {__i18n_display(problem && <span class="notice inline">{__i18n_display(problem)}</span>)}
      </div>
      {__i18n_display(advice && (
        <section class="advice" aria-label={__i18n_t("ui.decision.decision.b129d572")}>
          <h3>{__i18n_display(d.kind === 'camp' ? __i18n_k("ui.decision.decision.a36f47df") : __i18n_k("ui.decision.decision.e2e5d4ea"))}</h3>
          <p>{__i18n_display(advice.rule)}</p>
          <ul class="plain small">
            {__i18n_display(advice.picks.map((x) => (
              <li key={x}>{__i18n_display(x)}</li>
            )))}
          </ul>
          <p class="muted small">{__i18n_t("ui.decision.decision.fa9a6711", { tradeoff: advice.tradeoff })}</p>
        </section>
      ))}
    </section>
  );
}
