import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
import { useMemo, useState } from 'preact/hooks';
import type { Role } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { roleLabel } from './format';
import { gradeClass } from './grades';
import { useSort } from './sort';

type RoleFilter = 'all' | Role;

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.934dd25e") },
  { id: 'SP', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.a88271df") },
  { id: 'RP', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.5b8607a3") },
  { id: 'C', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.5f31470d") },
  { id: 'IF', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.0c733fda") },
  { id: 'OF', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.aa487065") },
];


interface Props {
  /** The draft held in September of this year (it fills next season's rosters). */
  draftYear: number;
  players: Player[];
  ageOf: (p: Player) => number;
  selectedId: PlayerId | null;
  onSelect: (id: PlayerId) => void;
  /** The user's own scouts' future grade (V0.6), when there is a club. */
  ourView?: (p: Player) => number | null;
}

export function DraftBoard({ draftYear, players, ageOf, selectedId, onSelect, ourView }: Props) {
  const [role, setRole] = useState<RoleFilter>('all');
  const filtered = useMemo(() => players.filter((p) => role === 'all' || p.role === role).sort((a, b) => a.amateur.draftRank - b.amateur.draftRank), [players, role]);
  const { sorted: rows, th } = useSort(filtered, {
    rank: { value: (p) => p.amateur.draftRank, first: 1 },
    name: { value: (p) => p.name },
    role: { value: (p) => ['SP', 'RP', 'C', 'IF', 'OF'].indexOf(p.role), first: 1 },
    path: { value: (p) => p.origin.pathway },
    school: { value: (p) => p.education.school },
    age: { value: (p) => ageOf(p), first: 1 },
    current: { value: (p) => p.scouting.current },
    future: { value: (p) => p.scouting.futureValue },
    velocity: { value: (p) => p.velocity ?? 0 },
    ours: { value: (p) => ourView?.(p) ?? 0 },
  });

  return (
    <section class="board" aria-labelledby="board-title">
      <div class="board-head">
        <h2 id="board-title">{__i18n_t("ui.draftBoard.draftBoard.5fc24b91", { value: draftYear + 1 })}</h2>
        <p class="muted">{__i18n_t("ui.draftBoard.draftBoard.2a2a21d8", { length: rows.length, value: ourView && __i18n_k("ui.draftBoard.draftBoard.371d7382") })}</p>
      </div>
      <div class="controls">
        <div class="segmented" role="group" aria-label={__i18n_t("ui.draftBoard.draftBoard.81922a91")}>
          {__i18n_display(ROLE_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={role === f.id} onClick={() => setRole(f.id)}>
              {__i18n_display(f.label)}
            </button>
          )))}
        </div>
      </div>
      <div class="table-wrap" tabIndex={0} aria-label={__i18n_t("ui.draftBoard.draftBoard.c628b5f2")}>
        <table class="record-table">
          <thead>
            <tr>
              {__i18n_display(th('rank', __i18n_k("ui.draftBoard.draftBoard.d15876f1"), true))}
              {__i18n_display(th('name', __i18n_k("ui.draftBoard.draftBoard.9aa18e50")))}
              {__i18n_display(th('role', __i18n_k("ui.draftBoard.draftBoard.81922a91")))}
              {__i18n_display(th('path', __i18n_k("ui.draftBoard.draftBoard.af2feed6")))}
              {__i18n_display(th('school', __i18n_k("ui.draftBoard.draftBoard.5d24a2fc")))}
              {__i18n_display(th('age', __i18n_k("ui.draftBoard.draftBoard.6c620e5c"), true))}
              {__i18n_display(th('current', __i18n_k("ui.draftBoard.draftBoard.001e4be2"), true))}
              {__i18n_display(th('future', __i18n_k("ui.draftBoard.draftBoard.6e0caec5"), true))}
              {__i18n_display(th('velocity', __i18n_k("ui.draftBoard.draftBoard.b8c2e079"), true))}
              {__i18n_display(ourView && th('ours', __i18n_k("ui.draftBoard.draftBoard.03c90563"), true))}
            </tr>
          </thead>
          <tbody>
            {__i18n_display(rows.map((p) => (
              <tr key={p.id} class="player-row" aria-selected={p.id === selectedId}>
                <td class="num">{__i18n_display(p.amateur.draftRank)}</td>
                <td>
                  <button type="button" class="link" onClick={() => onSelect(p.id)} aria-current={p.id === selectedId ? 'true' : undefined}>
                    {__i18n_display(p.name)}
                  </button>
                  {__i18n_display(p.twoWay && <span class="tag">{__i18n_t("ui.draftBoard.draftBoard.62cb0192")}</span>)}
                </td>
                <td>{__i18n_display(roleLabel(p.role))}</td>
                <td>{__i18n_display(p.origin.pathway)}</td>
                <td>{__i18n_display(p.education.school)}</td>
                <td class="num">{__i18n_display(ageOf(p))}</td>
                <td class={`num ${gradeClass(p.scouting.current)}`}>{__i18n_display(p.scouting.current)}</td>
                <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{__i18n_display(p.scouting.futureValue)}</td>
                <td class="num">{__i18n_display(p.velocity ?? '-')}</td>
                {__i18n_display(ourView && <td class="num strong">{__i18n_display(ourView(p) ?? '-')}</td>)}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
