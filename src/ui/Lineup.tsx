import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* The club at a glance (V0.7): who plays where on the field today, the batting order against a
   right- or left-handed starter, the rotation (next starter marked) and the bullpen by role. For the
   user's club (V0.8) the general manager's lineup card: spots and positions he fixes, the rotation order. */
import { useEffect, useState } from 'preact/hooks';
import type { Action } from '../league/actions';
import type { FieldPos } from '../league/engine/types';
import { checkLineupCard } from '../league/entry';
import { isPitcher } from '../league/players';
import type { LeagueState, LineupCard, LineupSlot } from '../league/state';
import { MANAGER_STYLES } from '../league/staff';
import { lineupView, rates } from '../league/views';
import { gradeTier } from './display';
import { gradeClass } from './grades';
import { Help } from './Help';

const SPOTS: Record<string, [number, number]> = {
  CF: [200, 40],
  LF: [80, 78],
  RF: [320, 78],
  SS: [145, 140],
  '2B': [255, 140],
  '3B': [70, 205],
  '1B': [330, 205],
  P: [200, 212],
  C: [200, 292],
};

/** Long names (foreign players) show their last word so they fit on the field. */
const onField = (name: string) => (name.length > 5 && name.includes(' ') ? name.split(' ').at(-1)! : name);

/** A 20–80 grade cell, coloured above 60 and below 40. */
const Grade = ({ g }: { g: number }) => <td class={`num grade-cell t${gradeTier(g)} ${g >= 60 ? 'plus' : g < 40 ? 'minus' : ''}`}>{__i18n_display(g || '-')}</td>;

/** 종합 · 구위/제구/변화구/체력 · 최고 구속. */
const ArmLine = ({ p }: { p: { grade: number; tools: { stuff: number; command: number; breaking: number; stamina: number }; velocity: number | null } }) => (
  <span title={__i18n_t("ui.lineup.armLine.50898354")}>
    <strong>{__i18n_display(p.grade)}</strong> ({__i18n_display(p.tools.stuff)}/{__i18n_display(p.tools.command)}/{__i18n_display(p.tools.breaking)}/{__i18n_display(p.tools.stamina)}){__i18n_display(p.velocity ? ` · ${p.velocity}km/h` : '')}
  </span>
);

const f3 = (x: number | null) => (x == null ? '-' : rates.fmt3(x));

export function Lineup({ league, teamId, onPlayer, onAct }: { league: LeagueState; teamId: string; onPlayer: (id: string) => void; onAct?: (a: Action) => void }) {
  const [vs, setVs] = useState<'R' | 'L'>('R');
  const v = lineupView(league, teamId, vs);
  if (!v || v.lineup.length < 9) return <p class="muted">{__i18n_t("ui.lineup.lineup.a99fd3fe")}</p>;
  const next = v.starters.find((x) => x.next) ?? v.starters[0];
  const field = [
    ...v.lineup.filter((b) => b.pos !== 'DH').map((b) => ({ pos: b.pos as string, id: b.id, name: b.name, number: b.number, grade: b.grade })),
    ...(next ? [{ pos: 'P', id: next.id, name: next.name, number: undefined, grade: next.grade }] : []),
  ];
  const dh = v.lineup.find((b) => b.pos === 'DH');
  const style = v.style && v.style !== 'balanced' ? MANAGER_STYLES[v.style] : null;
  return (
    <div class="lineup">
      <div class="segmented" role="group" aria-label={__i18n_t("ui.lineup.lineup.673abc38")}>
        <button type="button" aria-pressed={vs === 'R'} onClick={() => setVs('R')}>{__i18n_t("ui.lineup.lineup.ada149f8")}</button>
        <button type="button" aria-pressed={vs === 'L'} onClick={() => setVs('L')}>{__i18n_t("ui.lineup.lineup.b044607c")}</button>
      </div>
      {__i18n_display(style && (
        <p class="small">{__i18n_rich("ui.lineup.lineup.9cb053aa", { value: <strong>{__i18n_display(style.label)}</strong>, value2: <span class="muted">({__i18n_display(style.note)})</span> })}</p>
      ))}
      {__i18n_display(v.resting.length > 0 && (
        <p class="notice">{__i18n_t("ui.lineup.lineup.66d9ed37", { value: v.resting[0]!.date.slice(5).replace('-', '/'), value2: v.resting.map((r) => `${r.name}(${r.pos})`).join(', ') })}</p>
      ))}
      {__i18n_display(onAct && teamId === league.user?.teamId && <CardEditor league={league} vs={vs} lineup={v.lineup} starters={v.starters} onAct={onAct} />)}
      <Help title={__i18n_t("ui.lineup.lineup.a17455c9")}>{__i18n_t("ui.lineup.lineup.3e29b7e7")}</Help>
      <div class="lineup-grid">
        <svg viewBox="0 0 400 320" class="diamond" role="img" aria-label={__i18n_t("ui.lineup.lineup.7a9dc5f1")}>
          <path d="M200 300 L40 140 A230 230 0 0 1 360 140 Z" class="grass" />
          <path d="M200 290 L290 200 L200 115 L110 200 Z" class="infield" />
          {__i18n_display(field.map((f) => {
            const [x, y] = SPOTS[f.pos] ?? [0, 0];
            return (
              <g key={f.pos} class="spot" onClick={() => onPlayer(f.id)}>
                <rect x={x - 50} y={y - 16} width={100} height={32} rx={6} />
                <text x={x} y={y - 2} text-anchor="middle" class="spot-pos">
                  {__i18n_display(f.pos === 'P' ? __i18n_k("ui.lineup.lineup.a88271df") : f.pos)}
                  {__i18n_display(f.number != null ? ` #${f.number}` : '')} · {__i18n_display(f.grade)}
                </text>
                <text x={x} y={y + 12} text-anchor="middle" class="spot-name">
                  {__i18n_display(onField(f.name))}
                </text>
              </g>
            );
          }))}
        </svg>
        <div>
          <h3>{__i18n_t("ui.lineup.lineup.790bde97")}</h3>
          <table class="record-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>{__i18n_t("ui.lineup.lineup.5db174c6")}</th>
                <th>{__i18n_t("ui.lineup.lineup.3d9d982d")}</th>
                <th>{__i18n_t("ui.lineup.lineup.8198fd54")}</th>
                <th class="num" title={__i18n_t("ui.lineup.lineup.c9495a96")}>{__i18n_t("ui.lineup.lineup.001e4be2")}</th>
                <th class="num" title={__i18n_t("ui.lineup.lineup.5edb7838")}>{__i18n_t("ui.lineup.lineup.22b8c755")}</th>
                <th class="num" title={__i18n_t("ui.lineup.lineup.99517041")}>{__i18n_t("ui.lineup.lineup.4c537d13")}</th>
                <th class="num" title={__i18n_t("ui.lineup.lineup.ac886d4a")}>{__i18n_t("ui.lineup.lineup.22dc8896")}</th>
                <th class="num" title={__i18n_t("ui.lineup.lineup.4038619b")}>{__i18n_t("ui.lineup.lineup.752244cf")}</th>
                <th class="num" title={__i18n_t("ui.lineup.lineup.ed9be858")}>{__i18n_t("ui.lineup.lineup.c04eb2ef")}</th>
                <th class="num">{__i18n_t("ui.lineup.lineup.1eb19e0a")}</th>
                <th class="num">OPS</th>
                <th class="num">{__i18n_t("ui.lineup.lineup.9162d3a3")}</th>
              </tr>
            </thead>
            <tbody>
              {__i18n_display(v.lineup.map((b) => (
                <tr key={b.id}>
                  <td class="num">{__i18n_display(b.order)}</td>
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(b.id)}>
                      {__i18n_display(b.name)}
                    </button>
                    {__i18n_display(b.fixed && <span class="tag" title={__i18n_t("ui.lineup.lineup.f8a31f8b")}>{__i18n_t("ui.lineup.lineup.4f48c004")}</span>)}
                  </td>
                  <td>{__i18n_display(b.pos)}</td>
                  <td>{__i18n_display(b.bats)}</td>
                  <td class={`num strong ${gradeClass(b.grade)}`}>{__i18n_display(b.grade)}</td>
                  <Grade g={b.tools.contact} />
                  <Grade g={b.tools.power} />
                  <Grade g={b.tools.eye} />
                  <Grade g={b.tools.speed} />
                  <Grade g={b.tools.defense} />
                  <td class="num">{__i18n_display(f3(b.avg))}</td>
                  <td class="num strong">{__i18n_display(f3(b.ops))}</td>
                  <td class="num">{__i18n_display(b.hr)}</td>
                </tr>
              )))}
            </tbody>
          </table>
          {__i18n_display(dh && <p class="muted small">{__i18n_t("ui.lineup.lineup.8a47b77e", { name: dh.name })}</p>)}
        </div>
      </div>
      <div class="lineup-grid">
        <div>
          <h3>{__i18n_t("ui.lineup.lineup.cad4826e")}</h3>
          <ol class="plain">
            {__i18n_display(v.starters.map((p) => (
              <li key={p.id}>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {__i18n_display(p.name)}
                </button>{__i18n_display(' ')}
                <span class="muted small">
                  {__i18n_rich("ui.lineup.lineup.04abb99c", { throws: p.throws, arm: <ArmLine p={p} />, w: String(p.w), l: String(p.l), era: p.era == null ? '-' : p.era.toFixed(2) })}
                </span>
                {__i18n_display(p.next && <span class="tag">{__i18n_t("ui.lineup.lineup.ae82f6eb")}</span>)}
                {__i18n_display(p.mine && <span class="tag" title={__i18n_t("ui.lineup.lineup.195089c9")}>{__i18n_t("ui.lineup.lineup.678af713")}</span>)}
              </li>
            )))}
          </ol>
        </div>
        <div>
          <h3>{__i18n_t("ui.lineup.lineup.5b8607a3")}</h3>
          <ol class="plain">
            {__i18n_display(v.bullpen.map((p) => (
              <li key={p.id}>
                <span class="tag">{__i18n_display(p.role)}</span>{__i18n_display(' ')}
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {__i18n_display(p.name)}
                </button>{__i18n_display(' ')}
                <span class="muted small">
                  {__i18n_rich("ui.lineup.lineup.087033b5", { throws: p.throws, arm: <ArmLine p={p} />, sv: String(p.sv), hld: String(p.hld), era: p.era == null ? '-' : p.era.toFixed(2) })}
                </span>
              </li>
            )))}
          </ol>
          <h3>{__i18n_t("ui.lineup.lineup.63ae8ec7")}</h3>
          <p>{__i18n_display(v.bench.length ? v.bench.map((b) => __i18n_k("ui.lineup.lineup.262159bf", { name: b.name, pos: b.pos, grade: b.grade, value: b.injured ? __i18n_k("ui.lineup.lineup.cc5713ba") : '' })).join(', ') : '-')}</p>
        </div>
      </div>
    </div>
  );
}

// ── The general manager's lineup card (V0.8) ────────────────────────────────────────────────────────

const FIELD: FieldPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const FIELD_NAMES: Record<FieldPos, string> = { C: __i18n_k("ui.lineup.fIELD_NAMES.c.5f31470d"), '1B': __i18n_k("ui.lineup.fIELD_NAMES.46c6f9a9"), '2B': __i18n_k("ui.lineup.fIELD_NAMES.8011eb7c"), '3B': __i18n_k("ui.lineup.fIELD_NAMES.3b17d1b9"), SS: __i18n_k("ui.lineup.fIELD_NAMES.sS.685e1674"), LF: __i18n_k("ui.lineup.fIELD_NAMES.lF.cab5a283"), CF: __i18n_k("ui.lineup.fIELD_NAMES.cF.545b7e1e"), RF: __i18n_k("ui.lineup.fIELD_NAMES.rF.e3d9e0b4"), DH: __i18n_k("ui.lineup.fIELD_NAMES.dH.68a26d9d") };
const emptyCard = (): LineupCard => ({ R: Array(9).fill(null), L: Array(9).fill(null), rotation: [], rest: true });
const fixedCount = (list: (LineupSlot | null)[]) => list.filter(Boolean).length;

type Row = { id: string; name: string; pos: string; order: number };
type Arm = { id: string; name: string };

function CardEditor({ league, vs, lineup, starters, onAct }: { league: LeagueState; vs: 'R' | 'L'; lineup: Row[]; starters: Arm[]; onAct: (a: Action) => void }) {
  const u = league.user!;
  const saved = u.lineup;
  const [open, setOpen] = useState(false);
  // Players who have left the club since drop out of the draft (they would not play anyway).
  const ours = (id: string) => league.players[id]?.teamId === u.teamId;
  const clean = (c: LineupCard | undefined): LineupCard =>
    c ? { R: c.R.map((x) => (x && ours(x.id) ? { ...x } : null)), L: c.L.map((x) => (x && ours(x.id) ? { ...x } : null)), rotation: c.rotation.filter(ours), rest: c.rest } : emptyCard();
  const [card, setCard] = useState<LineupCard>(() => clean(saved));
  // A saved card (or a cleared one) resets the draft.
  useEffect(() => setCard(clean(saved)), [saved]);
  const active = league.rosters[u.teamId]!.active.map((id) => league.players[id]!);
  const hitters = active.filter((p) => !isPitcher(p) || p.twoWay).sort((a, b) => b.scouting.current - a.scouting.current);
  const arms = active.filter(isPitcher).sort((a, b) => (a.role === b.role ? b.scouting.current - a.scouting.current : a.role === 'SP' ? -1 : 1));
  const list = card[vs];
  const problem = checkLineupCard(league, card);
  const changed = JSON.stringify(card) !== JSON.stringify(saved ?? emptyCard());
  const setSlot = (i: number, slot: LineupSlot | null) => setCard((c) => ({ ...c, [vs]: c[vs].map((x, k) => (k === i ? slot : x)) }));
  const pick = (i: number, id: string) => {
    if (!id) return setSlot(i, null);
    const p = league.players[id]!;
    // Where he plays now, or his own position, or the first one free.
    const taken = new Set(list.filter((x, k) => x && k !== i).map((x) => x!.pos));
    const now = lineup.find((b) => b.id === id)?.pos as FieldPos | undefined;
    const pos = [now, p.position ?? undefined, 'DH' as FieldPos, ...FIELD].find((x): x is FieldPos => !!x && !taken.has(x)) ?? 'DH';
    setSlot(i, { id, pos });
  };
  const summary = saved
    ? __i18n_k("ui.lineup.cardEditor.summary.3ec4bb25", { fixedCount: fixedCount(saved.R), fixedCount2: fixedCount(saved.L), length: saved.rotation.length, value: saved.rest ? '' : __i18n_k("ui.lineup.cardEditor.summary.e3babfd2") })
    : __i18n_k("ui.lineup.cardEditor.summary.07c16200");
  return (
    <div class="lineup-card">
      <p class="small">
        <strong>{__i18n_t("ui.lineup.cardEditor.a7c332ca")}</strong> · {__i18n_display(summary)}{__i18n_display(' ')}
        <button type="button" class="link" onClick={() => setOpen(!open)} aria-expanded={open}>
          {__i18n_display(open ? __i18n_k("ui.lineup.cardEditor.0d2c2495") : __i18n_k("ui.lineup.cardEditor.bc686f79"))}
        </button>
      </p>
      {__i18n_display(open && (
        <div class="card-editor">
          <p class="muted small">{__i18n_t("ui.lineup.cardEditor.545c1224", { value: vs === 'R' ? __i18n_k("ui.lineup.cardEditor.5fbba1d3") : __i18n_k("ui.lineup.cardEditor.c03a5dae") })}</p>
          <table class="record-table card-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>{__i18n_t("ui.lineup.cardEditor.5db174c6")}</th>
                <th>{__i18n_t("ui.lineup.cardEditor.3d9d982d")}</th>
                <th class="muted">{__i18n_t("ui.lineup.cardEditor.d07eb370")}</th>
              </tr>
            </thead>
            <tbody>
              {__i18n_display(list.map((slot, i) => {
                const now = lineup[i];
                const who = slot ? hitters.find((p) => p.id === slot.id) : undefined;
                // Main and listed positions marked (V0.11): anywhere else costs him more in the field.
                const mark = (pos: FieldPos) => (pos === 'DH' || !who ? '' : who.position === pos ? __i18n_k("ui.lineup.cardEditor.mark.2f822934") : (who.alt ?? []).includes(pos as Exclude<FieldPos, 'DH'>) ? __i18n_k("ui.lineup.cardEditor.mark.d4d0388e") : __i18n_k("ui.lineup.cardEditor.mark.43ae42e9"));
                return (
                  <tr key={i}>
                    <td class="num">{__i18n_display(i + 1)}</td>
                    <td>
                      <select value={slot?.id ?? ''} onChange={(e) => pick(i, (e.currentTarget as HTMLSelectElement).value)} aria-label={__i18n_displayText(__i18n_k("ui.lineup.cardEditor.45dd7706", { value: i + 1 }))}>
                        <option value="">{__i18n_t("ui.lineup.cardEditor.2984b900")}</option>
                        {__i18n_display(hitters.map((p) => (
                          <option key={p.id} value={p.id}>
                            {__i18n_display(p.name)} ({__i18n_display(p.position ?? __i18n_k("ui.lineup.cardEditor.28090143"))} {__i18n_display(p.scouting.current)})
                          </option>
                        )))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={slot?.pos ?? ''}
                        disabled={!slot}
                        onChange={(e) => slot && setSlot(i, { ...slot, pos: (e.currentTarget as HTMLSelectElement).value as FieldPos })}
                        aria-label={__i18n_displayText(__i18n_k("ui.lineup.cardEditor.202ba2ba", { value: i + 1 }))}
                      >
                        {__i18n_display(!slot && <option value="">-</option>)}
                        {__i18n_display(FIELD.map((pos) => (
                          <option key={pos} value={pos}>
                            {__i18n_display(FIELD_NAMES[pos])}
                            {__i18n_display(mark(pos))}
                          </option>
                        )))}
                      </select>
                    </td>
                    <td class="muted small">{__i18n_display(now ? `${now.name} (${now.pos})` : '-')}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
          <div class="row-actions">
            <button type="button" onClick={() => setCard((c) => ({ ...c, [vs]: lineup.slice(0, 9).map((b) => ({ id: b.id, pos: b.pos as FieldPos })) }))}>{__i18n_t("ui.lineup.cardEditor.eeca4d4a")}</button>
            <button type="button" onClick={() => setCard((c) => ({ ...c, [vs]: c[vs === 'R' ? 'L' : 'R'].map((x) => (x ? { ...x } : null)) }))}>{__i18n_t("ui.lineup.cardEditor.987bdbce", { value: vs === 'R' ? __i18n_k("ui.lineup.cardEditor.c03a5dae") : __i18n_k("ui.lineup.cardEditor.5fbba1d3") })}</button>
            <button type="button" onClick={() => setCard((c) => ({ ...c, [vs]: Array(9).fill(null) }))}>{__i18n_t("ui.lineup.cardEditor.50422528")}</button>
          </div>
          <h4>{__i18n_t("ui.lineup.cardEditor.cad4826e")}</h4>
          <div class="rotation-picks">
            {__i18n_display([0, 1, 2, 3, 4].map((i) => (
              <label key={i}>
                {__i18n_display(i + 1)}선발
                <select
                  value={card.rotation[i] ?? ''}
                  onChange={(e) => {
                    const id = (e.currentTarget as HTMLSelectElement).value;
                    setCard((c) => {
                      const r = [...c.rotation];
                      if (id) r[i] = id;
                      else r.splice(i, 1);
                      return { ...c, rotation: r.filter(Boolean) };
                    });
                  }}
                  aria-label={__i18n_displayText(__i18n_k("ui.lineup.cardEditor.44016365", { value: i + 1 }))}
                >
                  <option value="">{__i18n_t("ui.lineup.cardEditor.baa70d5e", { value: starters[i] && !card.rotation[i] ? ` (${starters[i]!.name})` : '' })}</option>
                  {__i18n_display(arms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {__i18n_display(p.name)} ({__i18n_display(p.role === 'SP' ? __i18n_k("ui.lineup.cardEditor.a88271df") : __i18n_k("ui.lineup.cardEditor.5b8607a3"))} {__i18n_display(p.scouting.current)})
                    </option>
                  )))}
                </select>
              </label>
            )))}
          </div>
          <label class="check">
            <input type="checkbox" checked={card.rest} onChange={(e) => setCard((c) => ({ ...c, rest: (e.currentTarget as HTMLInputElement).checked }))} /> 고정한 선수도 감독의 휴식일에는 쉬게 하기
          </label>
          <div class="row-actions">
            <button type="button" class="primary" disabled={!!problem || !changed} onClick={() => onAct({ kind: 'lineupCard', card })}>{__i18n_t("ui.lineup.cardEditor.ecee235b")}</button>
            <button type="button" disabled={!saved} onClick={() => onAct({ kind: 'lineupCard', card: null })}>{__i18n_t("ui.lineup.cardEditor.e8b344d7")}</button>
            {__i18n_display(problem && <span class="notice inline">{__i18n_display(problem)}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

