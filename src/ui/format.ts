import { isPitcherRole, ROLE_LABELS, type AmateurRecord, type Role } from '../draftroom';
import type { Player } from '../model/types';

export const roleLabel = (role: Role) => ROLE_LABELS[role];

export const handedness = (p: Pick<Player, 'throws' | 'bats'>) => `${p.throws}투${p.bats}타`;

const num = (x: unknown) => (typeof x === 'number' ? x : 0);
const rate = (x: unknown) => (typeof x === 'number' ? x.toFixed(3).replace(/^0/, '') : '-');

export function innings(outs: number) {
  return `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ''}`;
}

/** One-line amateur record, e.g. "21경기 66.1이닝 5승 평균자책점 2.58 탈삼진 75 볼넷 19". */
export function recordLine(r: AmateurRecord) {
  if (r.kind === 'pitcher') {
    const era = typeof r.era === 'number' ? r.era.toFixed(2) : '-';
    return `${r.games}경기 ${innings(num(r.outs))}이닝 ${num(r.wins)}승 평균자책점 ${era} 탈삼진 ${num(r.k)} 볼넷 ${num(r.bb)}`;
  }
  return `${r.games}경기 타율 ${rate(r.avg)} OPS ${rate(r.ops)} 홈런 ${num(r.hr)} 타점 ${num(r.rbi)} 도루 ${num(r.sb)}`;
}

export const toolKeysFor = (role: Role) =>
  isPitcherRole(role) ? (['stuff', 'command', 'breaking', 'stamina'] as const) : (['contact', 'power', 'speed', 'defense', 'eye'] as const);

export const militaryLabel = { pending: '미필', serving: '복무 중', served: '군필', exempt: '면제' } as const;
