import { k as __i18n_k } from '../i18n/index';
import { isPitcherRole, ROLE_LABELS, type AmateurRecord, type Role } from '../draftroom';
import type { Player } from '../model/types';

export const roleLabel = (role: Role) => ROLE_LABELS[role];

export const handedness = (p: Pick<Player, 'throws' | 'bats'>) => __i18n_k("ui.format.handedness.0fdaea08", { throws: p.throws, bats: p.bats });

const num = (x: unknown) => (typeof x === 'number' ? x : 0);
const rate = (x: unknown) => (typeof x === 'number' ? x.toFixed(3).replace(/^0/, '') : '-');

export function innings(outs: number) {
  return `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ''}`;
}

/** One-line amateur record, e.g. "21경기 66.1이닝 5승 평균자책점 2.58 탈삼진 75 볼넷 19". */
export function recordLine(r: AmateurRecord) {
  if (r.kind === 'pitcher') {
    const era = typeof r.era === 'number' ? r.era.toFixed(2) : '-';
    return __i18n_k("ui.format.recordLine.63774e36", { games: r.games, innings: innings(num(r.outs)), num: num(r.wins), era: era, num2: num(r.k), num3: num(r.bb) });
  }
  return __i18n_k("ui.format.recordLine.c622e7fe", { games: r.games, rate: rate(r.avg), rate2: rate(r.ops), num: num(r.hr), num2: num(r.rbi), num3: num(r.sb) });
}

export const toolKeysFor = (role: Role) =>
  isPitcherRole(role) ? (['stuff', 'command', 'breaking', 'stamina'] as const) : (['contact', 'power', 'speed', 'defense', 'eye'] as const);

export const militaryLabel = { pending: __i18n_k("ui.format.militaryLabel.pending.90125b88"), serving: __i18n_k("ui.format.militaryLabel.serving.9a692056"), served: __i18n_k("ui.format.militaryLabel.served.2c31bd1f"), exempt: __i18n_k("ui.format.militaryLabel.exempt.882fd3b5") } as const;

/** 만 원 amounts in a tight space: "64.6억", "3,000만". */
export const moneyShort = (manwon: number) => (Math.abs(manwon) >= 10000 ? __i18n_k("ui.format.moneyShort.db0fc332", { value: (manwon / 10000).toFixed(1).replace(/\.0$/, '') }) : __i18n_k("ui.format.moneyShort.cd1481f0", { value: manwon.toLocaleString('ko-KR') }));

/** 만 원 amounts as "1억 7,500만" / "3,000만". */
export function money(manwon: number) {
  if (!manwon) return '-';
  const eok = Math.floor(manwon / 10000),
    rest = manwon % 10000;
  if (!eok) return __i18n_k("ui.format.money.cd1481f0", { value: rest.toLocaleString('ko-KR') });
  return rest ? __i18n_k("ui.format.money.a0e34170", { eok: eok, value: rest.toLocaleString('ko-KR') }) : __i18n_k("ui.format.money.0b019595", { eok: eok });
}

/** A typed amount in 억 ("12", "12.5", "1,200", "30억"), or null while it is not a number yet (V0.8.1). */
export function parseEok(text: string): number | null {
  const t = text.replace(/[,\s억]/g, '');
  if (!/^\d*\.?\d*$/.test(t) || !/\d/.test(t)) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

