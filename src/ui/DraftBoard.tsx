import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* The draft prospects (2.0.27, the user's request: the tab looked like Draft Room lifted whole). Now the game's own
   list: the class at a glance (how many of each kind, how many our scouts rate highly), filters by position and by
   pathway, one table across the page in the roster's style — his school under his name — and his page opens over it
   like any player's. 2.0.30 (the user's request): a pitcher's pitches, his fastball first. */
import { useMemo, useState } from 'preact/hooks';
import type { Role } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { roleLabel } from './format';
import { gradeClass } from './grades';
import { useSort } from './sort';
import { pathwayLabel } from '../league/amateur';
import { draftPathOf } from '../league/offseason';
import { FASTBALL_LABELS, fastballOf, pitchLabel, repertoire } from '../league/pitches';

type RoleFilter = 'all' | Role;
type PathFilter = 'all' | 'hs' | 'college' | 'other';

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.934dd25e") },
  { id: 'SP', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.a88271df") },
  { id: 'RP', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.5b8607a3") },
  { id: 'C', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.5f31470d") },
  { id: 'IF', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.0c733fda") },
  { id: 'OF', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.aa487065") },
];

/** High school, college (four-year, early entry, two-year) or the rest (independent clubs, back from abroad). */
/** His fastball and his other pitches, best first: the codes, and their names for the tooltip. */
const pitchesOf = (p: Player) => {
  if (p.role !== 'SP' && p.role !== 'RP') return null;
  const fb = fastballOf(p);
  const rest = repertoire(p);
  return { codes: [fb, ...rest.map((x) => x.type)], names: [__i18n_displayText(FASTBALL_LABELS[fb]), ...rest.map((x) => __i18n_displayText(pitchLabel(p, x.type)))] };
};

const pathOf = (p: Player): Exclude<PathFilter, 'all'> => draftPathOf(p);

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
  const [path, setPath] = useState<PathFilter>('all');
  const PATH_FILTERS: { id: PathFilter; label: string }[] = [
    { id: 'all', label: __i18n_k("ui.draftBoard.rOLE_FILTERS.label.934dd25e") },
    { id: 'hs', label: __i18n_t("ui.draftBoard.text.24d8cd41") },
    { id: 'college', label: __i18n_t("ui.draftBoard.text.22aa6019") },
    { id: 'other', label: __i18n_t("ui.draftBoard.text.ba687438") },
  ];
  const filtered = useMemo(
    () => players.filter((p) => (role === 'all' || p.role === role) && (path === 'all' || pathOf(p) === path)).sort((a, b) => a.amateur.draftRank - b.amateur.draftRank),
    [players, role, path],
  );
  // The class at a glance: pitchers and position players, and the top of it.
  const glance = useMemo(() => {
    const pitchers = players.filter((p) => p.role === 'SP' || p.role === 'RP').length;
    const top = players.filter((p) => p.scouting.futureValue >= 60).length;
    const ourTop = ourView ? players.filter((p) => (ourView(p) ?? 0) >= 60).length : null;
    return { pitchers, hitters: players.length - pitchers, top, ourTop };
  }, [players, ourView]);
  const { sorted: rows, th } = useSort(filtered, {
    rank: { value: (p) => p.amateur.draftRank, first: 1 },
    name: { value: (p) => p.name },
    role: { value: (p) => ['SP', 'RP', 'C', 'IF', 'OF'].indexOf(p.role), first: 1 },
    path: { value: (p) => pathwayLabel(p) },
    age: { value: (p) => ageOf(p), first: 1 },
    current: { value: (p) => p.scouting.current },
    future: { value: (p) => p.scouting.futureValue },
    velocity: { value: (p) => p.velocity ?? 0 },
    pitches: { value: (p) => pitchesOf(p)?.codes.length ?? 0 },
    ours: { value: (p) => ourView?.(p) ?? 0 },
  });

  return (
    <section class="board draft-board" aria-labelledby="board-title">
      <div class="squad-bar">
        <div>
          <h2 id="board-title">{__i18n_t("ui.draftBoard.draftBoard.5fc24b91", { value: draftYear + 1 })}</h2>
          <p class="muted small">
            {__i18n_t("ui.draftBoard.text.31fd31bc", { n: players.length, pitchers: glance.pitchers, hitters: glance.hitters, top: glance.top })}
            {__i18n_display(glance.ourTop != null && __i18n_t("ui.draftBoard.text.a183b984", { ours: glance.ourTop }))}
          </p>
        </div>
      </div>
      <div class="controls">
        <div class="segmented" role="group" aria-label={__i18n_t("ui.draftBoard.draftBoard.81922a91")}>
          {__i18n_display(ROLE_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={role === f.id} onClick={() => setRole(f.id)}>
              {__i18n_display(f.label)}
            </button>
          )))}
        </div>
        <div class="segmented" role="group" aria-label={__i18n_t("ui.draftBoard.draftBoard.af2feed6")}>
          {__i18n_display(PATH_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={path === f.id} onClick={() => setPath(f.id)}>
              {__i18n_display(f.label)}
            </button>
          )))}
        </div>
        <span class="muted small">{__i18n_t("ui.draftBoard.draftBoard.2a2a21d8", { length: rows.length, value: ourView ? __i18n_k("ui.draftBoard.draftBoard.371d7382") : '' })}</span>
      </div>
      <div class="table-wrap" tabIndex={0} aria-label={__i18n_t("ui.draftBoard.draftBoard.c628b5f2")}>
        <table class="record-table squad-table draft-table">
          <thead>
            <tr>
              {__i18n_display(th('rank', __i18n_k("ui.draftBoard.draftBoard.d15876f1"), true))}
              {__i18n_display(th('name', __i18n_k("ui.draftBoard.draftBoard.9aa18e50")))}
              {__i18n_display(th('role', __i18n_k("ui.draftBoard.draftBoard.81922a91")))}
              {__i18n_display(th('path', __i18n_k("ui.draftBoard.draftBoard.af2feed6")))}
              {__i18n_display(th('age', __i18n_k("ui.draftBoard.draftBoard.6c620e5c"), true))}
              {__i18n_display(th('current', __i18n_k("ui.draftBoard.draftBoard.001e4be2"), true))}
              {__i18n_display(th('future', __i18n_k("ui.draftBoard.draftBoard.6e0caec5"), true))}
              {__i18n_display(th('velocity', __i18n_k("ui.draftBoard.draftBoard.b8c2e079"), true))}
              {__i18n_display(th('pitches', __i18n_k("ui.playerPanel.text.0685b54a")))}
              {__i18n_display(ourView && th('ours', __i18n_k("ui.draftBoard.draftBoard.03c90563"), true))}
            </tr>
          </thead>
          <tbody>
            {__i18n_display(rows.map((p) => {
              const ours = ourView?.(p) ?? null;
              const pitches = pitchesOf(p);
              return (
                <tr key={p.id} class="player-row" aria-selected={p.id === selectedId}>
                  <td class="num muted">{__i18n_display(p.amateur.draftRank)}</td>
                  <td class="name-cell">
                    <button type="button" class="link strong" onClick={() => onSelect(p.id)}>
                      {__i18n_display(p.name)}
                    </button>
                    {__i18n_display(p.twoWay && <span class="tag">{__i18n_t("ui.draftBoard.draftBoard.62cb0192")}</span>)}
                    <span class="muted small draft-school">{__i18n_display(p.education.school)}</span>
                  </td>
                  <td>{__i18n_display(roleLabel(p.role))}</td>
                  <td>{__i18n_display(pathwayLabel(p))}</td>
                  <td class="num">{__i18n_display(ageOf(p))}</td>
                  <td class={`num ${gradeClass(p.scouting.current)}`}>{__i18n_display(p.scouting.current)}</td>
                  <td class={`num strong ${gradeClass(p.scouting.futureValue)}`}>{__i18n_display(p.scouting.futureValue)}</td>
                  <td class="num">{__i18n_display(p.velocity ?? '-')}</td>
                  <td class="small draft-pitches" title={pitches?.names.join(', ')}>
                    {__i18n_display(pitches ? pitches.codes.join(' · ') : '-')}
                  </td>
                  {__i18n_display(ourView && <td class={`num strong ${gradeClass(ours)}`}>{__i18n_display(ours ?? '-')}</td>)}
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
