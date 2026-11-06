/* 2.0.78 (the user's request: 선수 세부 창의 정보도 엑셀로): the player's page as a workbook — each tab (and each of the
   records' views) opened in turn and what it shows written down as it reads: its tables, grade bars, lists of terms,
   percentile bars and lists, under their headings. One sheet a tab; the page is put back as it was. */
import { cellValue, type XlsxCell, type XlsxSheet } from './xlsx';

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The rows a part of the page reads as, in the order it shows them. */
export function blockRows(root: Element, skip: (el: Element) => boolean = () => false): XlsxCell[][] {
  const rows: XlsxCell[][] = [];
  const gap = () => {
    if (rows.length && rows[rows.length - 1]!.length) rows.push([]);
  };
  const visit = (el: Element) => {
    if (skip(el)) return;
    const tag = el.tagName;
    if (el.getAttribute('aria-hidden') === 'true' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'SVG' || tag === 'svg' || tag === 'SCRIPT') return;
    if (/^H[1-6]$/.test(tag)) {
      gap();
      rows.push([text(el)]);
      return;
    }
    if (tag === 'TABLE') {
      for (const tr of el.querySelectorAll('tr')) {
        const cells = [...tr.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH');
        const row: XlsxCell[] = [];
        for (const c of cells) {
          row.push(cellValue(text(c)));
          // A cell spanning columns keeps the columns under it lined up.
          for (let k = 1; k < Number(c.getAttribute('colspan') ?? 1); k++) row.push('');
        }
        if (row.some((x) => x !== '')) rows.push(row);
      }
      gap();
      return;
    }
    if (el.classList.contains('gradebar')) {
      // "55 → 60": now and what he becomes.
      const num = text(el.querySelector('.gradebar-num'));
      const m = num.match(/^(\d+)(?:\s*→\s*(\d+))?/);
      rows.push([text(el.querySelector('.gradebar-label')), m ? Number(m[1]) : num, m?.[2] ? Number(m[2]) : '', text(el.querySelector('.gradebar-note'))]);
      return;
    }
    if (tag === 'DL') {
      for (const dt of el.querySelectorAll('dt')) {
        const dd = dt.nextElementSibling?.tagName === 'DD' ? dt.nextElementSibling : null;
        rows.push([text(dt), cellValue(text(dd))]);
      }
      gap();
      return;
    }
    if (el.classList.contains('savant-bars')) {
      for (const li of el.querySelectorAll(':scope > li')) rows.push([text(li.querySelector('.savant-label')), cellValue(text(li.querySelector('.savant-value'))), cellValue(text(li.querySelector('.savant-dot')))]);
      gap();
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      for (const li of el.querySelectorAll(':scope > li')) {
        const t = text(li);
        if (t) rows.push([t]);
      }
      gap();
      return;
    }
    if (tag === 'P' && !el.closest('table') && el.children.length === 0) {
      const t = text(el);
      if (t) rows.push([t]);
      return;
    }
    for (const c of el.children) visit(c);
  };
  visit(root);
  while (rows.length && !rows[rows.length - 1]!.length) rows.pop();
  return rows;
}

/** A tab's name without the count beside it. */
const label = (b: Element) => text(b).replace(/\s*\d+$/, '');

const tick = () => new Promise<void>((done) => setTimeout(() => requestAnimationFrame(() => done()), 30));

/** Every tab of the player's page (`panel`), its records' views one by one, as sheets. */
export async function panelSheets(panel: Element, title: string): Promise<XlsxSheet[]> {
  const sheets: XlsxSheet[] = [];
  const width = (rows: XlsxCell[][]) => Math.max(1, ...rows.map((r) => r.length));
  const sheet = (name: string, rows: XlsxCell[][]) => rows.length && sheets.push({ name, rows, widths: Array.from({ length: width(rows) }, (_, i) => (i === 0 ? 18 : 10)) });
  // The head: who he is, the summary under his name.
  const head = panel.querySelector('.profile-head');
  const summary = panel.querySelector('.pp-summary, .summary-strip');
  sheet(title, [...(head ? blockRows(head) : []), [], ...(summary ? blockRows(summary) : [])]);
  const tabsNow = () => [...panel.querySelectorAll<HTMLButtonElement>('.profile-parts [role=tab]')];
  const was = tabsNow().findIndex((b) => b.getAttribute('aria-selected') === 'true');
  const count = tabsNow().length;
  for (let t = 0; t < count; t++) {
    const tab = tabsNow()[t];
    if (!tab) continue;
    tab.click();
    await tick();
    const part = panel.querySelector('[role=tabpanel]');
    if (!part) continue;
    const views = [...part.querySelectorAll<HTMLButtonElement>('.record-views button')];
    if (!views.length) {
      sheet(label(tab), blockRows(part));
      continue;
    }
    const viewWas = views.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
    for (let i = 0; i < views.length; i++) {
      // (The buttons are drawn anew with each view.)
      const b = panel.querySelectorAll<HTMLButtonElement>('[role=tabpanel] .record-views button')[i];
      if (!b) continue;
      b.click();
      await tick();
      const now = panel.querySelector('[role=tabpanel]')!;
      sheet(`${label(tab)}·${label(b)}`, blockRows(now, (el) => el.classList.contains('record-views')));
    }
    if (viewWas >= 0) {
      panel.querySelectorAll<HTMLButtonElement>('[role=tabpanel] .record-views button')[viewWas]?.click();
      await tick();
    }
  }
  if (was >= 0) {
    panel.querySelectorAll<HTMLButtonElement>('.profile-parts [role=tab]')[was]?.click();
    await tick();
  }
  return sheets;
}
