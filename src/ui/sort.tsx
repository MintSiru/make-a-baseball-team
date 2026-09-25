/* Sortable table columns: click a heading to sort by it, click again to reverse. Numbers start from the
   largest (best grade first), text from ㄱ; age starts from the youngest. */
import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';

type Value = string | number;
export interface SortColumn<T> {
  value: (row: T) => Value;
  /** Direction of the first click: 1 ascending, -1 descending. Defaults: text ascending, numbers descending. */
  first?: 1 | -1;
}

const compare = (a: Value, b: Value) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ko'));

/** Position order used when sorting by position: catcher, infield, outfield, then pitchers. */
export const POSITION_ORDER: Record<string, number> = { 포수: 1, '1루수': 2, '2루수': 3, '3루수': 4, 유격수: 5, 좌익수: 6, 중견수: 7, 우익수: 8, 내야수: 9, 외야수: 10, 선발투수: 11, 불펜투수: 12 };
export const positionKey = (label: string) => POSITION_ORDER[label] ?? 99;

export function useSort<T, K extends string>(rows: T[], columns: Record<K, SortColumn<T>>, initial?: { key: K; dir: 1 | -1 }) {
  const [sort, setSort] = useState<{ key: K; dir: 1 | -1 } | null>(initial ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns[sort.key];
    // Stable: equal values keep the incoming order.
    return rows
      .map((row, i) => ({ row, i }))
      .sort((a, b) => compare(col.value(a.row), col.value(b.row)) * sort.dir || a.i - b.i)
      .map((x) => x.row);
  }, [rows, sort]);

  const toggle = (key: K) =>
    setSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === 1 ? -1 : 1 };
      const col = columns[key];
      const sample = rows.length ? col.value(rows[0]!) : 0;
      return { key, dir: col.first ?? (typeof sample === 'number' ? -1 : 1) };
    });

  /** A column heading that sorts its table (a render function, so focus stays on the button). */
  const th = (k: K, children: ComponentChildren, num?: boolean) => {
    const active = sort?.key === k;
    return (
      <th key={k} class={num ? 'num' : undefined} aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button type="button" class="sort-head" onClick={() => toggle(k)}>
          {children}
          <span class="sort-mark" aria-hidden="true">
            {active ? (sort!.dir === 1 ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };
  return { sorted, th };
}
