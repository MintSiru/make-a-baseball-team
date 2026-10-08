import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
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
  ['all', __i18n_k("ui.fantasyDraft.kINDS.934dd25e")],
  ['SP', __i18n_k("ui.fantasyDraft.kINDS.a88271df")],
  ['RP', __i18n_k("ui.fantasyDraft.kINDS.5b8607a3")],
  ['C', __i18n_k("ui.fantasyDraft.kINDS.5f31470d")],
  ['IF', __i18n_k("ui.fantasyDraft.kINDS.0c733fda")],
  ['OF', __i18n_k("ui.fantasyDraft.kINDS.aa487065")],
  ['rookie', __i18n_k("ui.fantasyDraft.kINDS.95c461d4")],
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
      <p>{__i18n_t("ui.fantasyDraft.fantasyBoard.0cdc8de0", { fantasyRound: fantasyRound(f), rounds: f.rounds, value: f.next + 1, length: f.pool.length, until: until })}</p>
      <p class="muted small">{__i18n_t("ui.fantasyDraft.fantasyBoard.9044acc9", { value: f.order.map((id) => shortName(league, id)).join(' → ') })}</p>
      <dl class="facts compact">
        {__i18n_display((['SP', 'RP', 'C', 'IF', 'OF'] as const).map((k) => (
          <div key={k}>
            <dt>{__i18n_display(KINDS.find((x) => x[0] === k)![1])}</dt>
            <dd class={(counts[k] ?? 0) < KIND_TARGET[k]! / 2 ? 'warn' : undefined}>
              {__i18n_display(counts[k] ?? 0)} / {__i18n_display(KIND_TARGET[k])}
            </dd>
          </div>
        )))}
        <div>
          <dt>{__i18n_t("ui.fantasyDraft.fantasyBoard.601988eb", { next: next })}</dt>
          <dd>{__i18n_t("ui.fantasyDraft.fantasyBoard.8971b2ac", { money: money(fantasyPay(league, f)), money2: money(u.payrollBudget) })}</dd>
        </div>
      </dl>
      {__i18n_display(ours.length > 0 && (
        <p class="muted small">{__i18n_t("ui.fantasyDraft.fantasyBoard.bd1a75b2", { length: ours.length, value: ours.slice(-8).map((x) => league.players[x.id]?.name ?? '').join(', '), value2: ours.length > 8 ? ' …' : '' })}</p>
      ))}
      <div class="segmented" role="group" aria-label={__i18n_t("ui.fantasyDraft.fantasyBoard.81922a91")}>
        {__i18n_display(KINDS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {__i18n_display(label)}
          </button>
        )))}
      </div>
      <p class="muted small">{__i18n_t("ui.fantasyDraft.fantasyBoard.b1c1f810")}</p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table pick-table">
          <thead>
            <tr>
              {__i18n_display(th('score', __i18n_k("ui.fantasyDraft.fantasyBoard.0ca35448"), true))}
              {__i18n_display(th('name', __i18n_k("ui.fantasyDraft.fantasyBoard.9aa18e50")))}
              {__i18n_display(th('pos', __i18n_k("ui.fantasyDraft.fantasyBoard.81922a91")))}
              {__i18n_display(th('age', __i18n_k("ui.fantasyDraft.fantasyBoard.6c620e5c"), true))}
              {__i18n_display(th('from', __i18n_k("ui.fantasyDraft.fantasyBoard.508ec37e")))}
              {__i18n_display(th('current', __i18n_k("ui.fantasyDraft.fantasyBoard.001e4be2"), true))}
              {__i18n_display(th('future', __i18n_k("ui.fantasyDraft.fantasyBoard.6e0caec5"), true))}
              {__i18n_display(th('pay', __i18n_k("ui.fantasyDraft.fantasyBoard.982c159c", { next: next }), true))}
              {__i18n_display(th('years', __i18n_k("ui.fantasyDraft.fantasyBoard.b4116369"), true))}
              <th aria-label={__i18n_t("ui.fantasyDraft.fantasyBoard.68a26d9d")} />
            </tr>
          </thead>
          <tbody>
            {__i18n_display(sorted.map((x) => (
              <tr key={x.p.id} class="player-row">
                <td class="num">{__i18n_display(Math.round(x.score))}</td>
                <td>
                  <button type="button" class="link" onClick={() => onPlayer(x.p.id)}>
                    {__i18n_display(x.p.name)}
                  </button>
                  {__i18n_display(!x.from && <span class="tag">{__i18n_t("ui.fantasyDraft.fantasyBoard.95c461d4")}</span>)}
                </td>
                <td>{__i18n_display(positionLabel(x.p))}</td>
                <td class="num">{__i18n_display(ageIn(x.p, next))}</td>
                <td class="muted">{__i18n_display(x.from ? shortName(league, x.from) : x.p.origin.pathway)}</td>
                <td class={`num ${gradeClass(x.p.scouting.current)}`}>{__i18n_display(x.p.scouting.current)}</td>
                <td class={`num strong ${gradeClass(x.p.scouting.futureValue)}`}>{__i18n_display(x.p.scouting.futureValue)}</td>
                <td class="num">{__i18n_display(x.from ? money(salaryIn(x.p, next)) : __i18n_k("ui.fantasyDraft.fantasyBoard.e100568e"))}</td>
                <td class="num">{__i18n_display(x.from ? __i18n_k("ui.fantasyDraft.fantasyBoard.044a2535", { years: years(x.p.id) }) : '-')}</td>
                <td>
                  <button type="button" class="pick" onClick={() => onPick(x.p.id)}>{__i18n_t("ui.fantasyDraft.fantasyBoard.68a26d9d")}</button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </>
  );
}
