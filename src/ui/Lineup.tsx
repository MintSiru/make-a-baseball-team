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
const Grade = ({ g }: { g: number }) => <td class={`num grade-cell t${gradeTier(g)} ${g >= 60 ? 'plus' : g < 40 ? 'minus' : ''}`}>{g || '-'}</td>;

/** 종합 · 구위/제구/변화구/체력 · 최고 구속. */
const ArmLine = ({ p }: { p: { grade: number; tools: { stuff: number; command: number; breaking: number; stamina: number }; velocity: number | null } }) => (
  <span title="현재 · 구위/제구/변화구/체력 · 최고 구속">
    <strong>{p.grade}</strong> ({p.tools.stuff}/{p.tools.command}/{p.tools.breaking}/{p.tools.stamina}){p.velocity ? ` · ${p.velocity}km/h` : ''}
  </span>
);

const f3 = (x: number | null) => (x == null ? '-' : rates.fmt3(x));

export function Lineup({ league, teamId, onPlayer, onAct }: { league: LeagueState; teamId: string; onPlayer: (id: string) => void; onAct?: (a: Action) => void }) {
  const [vs, setVs] = useState<'R' | 'L'>('R');
  const v = lineupView(league, teamId, vs);
  if (!v || v.lineup.length < 9) return <p class="muted">1군 선수가 모자라 라인업을 짤 수 없습니다.</p>;
  const next = v.starters.find((x) => x.next) ?? v.starters[0];
  const field = [
    ...v.lineup.filter((b) => b.pos !== 'DH').map((b) => ({ pos: b.pos as string, id: b.id, name: b.name, number: b.number, grade: b.grade })),
    ...(next ? [{ pos: 'P', id: next.id, name: next.name, number: undefined, grade: next.grade }] : []),
  ];
  const dh = v.lineup.find((b) => b.pos === 'DH');
  const style = v.style && v.style !== 'balanced' ? MANAGER_STYLES[v.style] : null;
  return (
    <div class="lineup">
      <div class="segmented" role="group" aria-label="상대 선발">
        <button type="button" aria-pressed={vs === 'R'} onClick={() => setVs('R')}>
          상대 우완 선발
        </button>
        <button type="button" aria-pressed={vs === 'L'} onClick={() => setVs('L')}>
          상대 좌완 선발
        </button>
      </div>
      {style && (
        <p class="small">
          감독 성향: <strong>{style.label}</strong> <span class="muted">({style.note})</span>
        </p>
      )}
      {v.resting.length > 0 && (
        <p class="notice">
          다음 경기({v.resting[0]!.date.slice(5).replace('-', '/')}) 휴식 예정: {v.resting.map((r) => `${r.name}(${r.pos})`).join(', ')} — 감독이 체력 관리로 쉬게 합니다.
        </p>
      )}
      {onAct && teamId === league.user?.teamId && <CardEditor league={league} vs={vs} lineup={v.lineup} starters={v.starters} onAct={onAct} />}
      <Help title="라인업을 짜는 방식">
        감독이 평소 짜는 라인업입니다 (직접 관리에서 정한 플래툰·불펜 보직과 단장 라인업 카드의 고정 자리 반영). 타격과 포지션별 수비를 함께 따져 9명과 수비 위치를 정하고, 가장 좋은 타자 셋을 1·2·4번, 다음 둘을 3·5번에 둡니다(작전형 감독은 출루·발 빠른 타자를 앞에, 거포를 중심에). 시즌 중에는 주전 포수가 5~6경기에 한 번, 34세 이상은 11~12경기에 한 번꼴로 쉽니다. 부상·대표팀 선수는 빠집니다. 능력치는 스카우팅 등급(20~80)이며, 투수는 현재 (구위/제구/변화구/체력) 순입니다.
      </Help>
      <div class="lineup-grid">
        <svg viewBox="0 0 400 320" class="diamond" role="img" aria-label="수비 위치">
          <path d="M200 300 L40 140 A230 230 0 0 1 360 140 Z" class="grass" />
          <path d="M200 290 L290 200 L200 115 L110 200 Z" class="infield" />
          {field.map((f) => {
            const [x, y] = SPOTS[f.pos] ?? [0, 0];
            return (
              <g key={f.pos} class="spot" onClick={() => onPlayer(f.id)}>
                <rect x={x - 50} y={y - 16} width={100} height={32} rx={6} />
                <text x={x} y={y - 2} text-anchor="middle" class="spot-pos">
                  {f.pos === 'P' ? '선발' : f.pos}
                  {f.number != null ? ` #${f.number}` : ''} · {f.grade}
                </text>
                <text x={x} y={y + 12} text-anchor="middle" class="spot-name">
                  {onField(f.name)}
                </text>
              </g>
            );
          })}
        </svg>
        <div>
          <h3>타순</h3>
          <table class="record-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>타자</th>
                <th>위치</th>
                <th>타</th>
                <th class="num" title="현재 종합 등급">현재</th>
                <th class="num" title="컨택">컨</th>
                <th class="num" title="파워">파</th>
                <th class="num" title="선구안">선</th>
                <th class="num" title="주력">주</th>
                <th class="num" title="수비">수</th>
                <th class="num">타율</th>
                <th class="num">OPS</th>
                <th class="num">홈런</th>
              </tr>
            </thead>
            <tbody>
              {v.lineup.map((b) => (
                <tr key={b.id}>
                  <td class="num">{b.order}</td>
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(b.id)}>
                      {b.name}
                    </button>
                    {b.fixed && <span class="tag" title="단장이 고정한 자리">고정</span>}
                  </td>
                  <td>{b.pos}</td>
                  <td>{b.bats}</td>
                  <td class={`num strong ${gradeClass(b.grade)}`}>{b.grade}</td>
                  <Grade g={b.tools.contact} />
                  <Grade g={b.tools.power} />
                  <Grade g={b.tools.eye} />
                  <Grade g={b.tools.speed} />
                  <Grade g={b.tools.defense} />
                  <td class="num">{f3(b.avg)}</td>
                  <td class="num strong">{f3(b.ops)}</td>
                  <td class="num">{b.hr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dh && <p class="muted small">지명타자: {dh.name}</p>}
        </div>
      </div>
      <div class="lineup-grid">
        <div>
          <h3>선발 로테이션</h3>
          <ol class="plain">
            {v.starters.map((p) => (
              <li key={p.id}>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>{' '}
                <span class="muted small">
                  {p.throws}투 · <ArmLine p={p} /> · {p.w}승 {p.l}패 · ERA {p.era == null ? '-' : p.era.toFixed(2)}
                </span>
                {p.next && <span class="tag">다음 등판</span>}
                {p.mine && <span class="tag" title="단장이 정한 로테이션">지정</span>}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3>불펜</h3>
          <ol class="plain">
            {v.bullpen.map((p) => (
              <li key={p.id}>
                <span class="tag">{p.role}</span>{' '}
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>{' '}
                <span class="muted small">
                  {p.throws}투 · <ArmLine p={p} /> · {p.sv}세 {p.hld}홀 · ERA {p.era == null ? '-' : p.era.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
          <h3>벤치</h3>
          <p>{v.bench.length ? v.bench.map((b) => `${b.name}(${b.pos} ${b.grade}${b.injured ? '·부상' : ''})`).join(', ') : '-'}</p>
        </div>
      </div>
    </div>
  );
}

// ── The general manager's lineup card (V0.8) ────────────────────────────────────────────────────────

const FIELD: FieldPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const FIELD_NAMES: Record<FieldPos, string> = { C: '포수', '1B': '1루', '2B': '2루', '3B': '3루', SS: '유격', LF: '좌익', CF: '중견', RF: '우익', DH: '지명' };
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
    ? `고정한 자리: 우완 상대 ${fixedCount(saved.R)} · 좌완 상대 ${fixedCount(saved.L)} · 로테이션 ${saved.rotation.length}명${saved.rest ? '' : ' · 고정 선수는 쉬지 않음'}`
    : '모두 감독에게 맡기고 있습니다.';
  return (
    <div class="lineup-card">
      <p class="small">
        <strong>단장 라인업 카드</strong> · {summary}{' '}
        <button type="button" class="link" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '접기' : '직접 짜기'}
        </button>
      </p>
      {open && (
        <div class="card-editor">
          <p class="muted small">
            고정한 자리는 그 선수가 그 위치에서 그 타순에 나섭니다. 비운 자리는 감독이 남은 선수와 위치로 채우고 타순도 감독 방식대로 넣습니다. 고정한 선수가 다치거나 1군에 없으면 감독이 대신 채웁니다. 지금 보고
            있는 상대 {vs === 'R' ? '우완' : '좌완'} 선발용 라인업입니다.
          </p>
          <table class="record-table card-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>타자</th>
                <th>위치</th>
                <th class="muted">지금</th>
              </tr>
            </thead>
            <tbody>
              {list.map((slot, i) => {
                const now = lineup[i];
                return (
                  <tr key={i}>
                    <td class="num">{i + 1}</td>
                    <td>
                      <select value={slot?.id ?? ''} onChange={(e) => pick(i, (e.currentTarget as HTMLSelectElement).value)} aria-label={`${i + 1}번 타자`}>
                        <option value="">감독에게</option>
                        {hitters.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.position ?? '투'} {p.scouting.current})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={slot?.pos ?? ''}
                        disabled={!slot}
                        onChange={(e) => slot && setSlot(i, { ...slot, pos: (e.currentTarget as HTMLSelectElement).value as FieldPos })}
                        aria-label={`${i + 1}번 수비 위치`}
                      >
                        {!slot && <option value="">-</option>}
                        {FIELD.map((pos) => (
                          <option key={pos} value={pos}>
                            {FIELD_NAMES[pos]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td class="muted small">{now ? `${now.name} (${now.pos})` : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div class="row-actions">
            <button type="button" onClick={() => setCard((c) => ({ ...c, [vs]: lineup.slice(0, 9).map((b) => ({ id: b.id, pos: b.pos as FieldPos })) }))}>
              지금 라인업 그대로 고정
            </button>
            <button type="button" onClick={() => setCard((c) => ({ ...c, [vs]: c[vs === 'R' ? 'L' : 'R'].map((x) => (x ? { ...x } : null)) }))}>
              {vs === 'R' ? '좌완' : '우완'} 상대 라인업 복사
            </button>
            <button type="button" onClick={() => setCard((c) => ({ ...c, [vs]: Array(9).fill(null) }))}>
              이 라인업 모두 감독에게
            </button>
          </div>
          <h4>선발 로테이션</h4>
          <div class="rotation-picks">
            {[0, 1, 2, 3, 4].map((i) => (
              <label key={i}>
                {i + 1}선발
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
                  aria-label={`${i + 1}선발`}
                >
                  <option value="">감독에게{starters[i] && !card.rotation[i] ? ` (${starters[i]!.name})` : ''}</option>
                  {arms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role === 'SP' ? '선발' : '불펜'} {p.scouting.current})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label class="check">
            <input type="checkbox" checked={card.rest} onChange={(e) => setCard((c) => ({ ...c, rest: (e.currentTarget as HTMLInputElement).checked }))} /> 고정한 선수도 감독의 휴식일에는 쉬게 하기
          </label>
          <div class="row-actions">
            <button type="button" class="primary" disabled={!!problem || !changed} onClick={() => onAct({ kind: 'lineupCard', card })}>
              카드 저장
            </button>
            <button type="button" disabled={!saved} onClick={() => onAct({ kind: 'lineupCard', card: null })}>
              모두 감독에게 돌려주기
            </button>
            {problem && <span class="notice inline">{problem}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

