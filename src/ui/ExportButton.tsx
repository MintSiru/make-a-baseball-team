/* 2.0.78 (the user's requests: 선수단·선수 창·순위표·시즌 기록표를 엑셀로): a button that builds a workbook and hands it
   over as a .xlsx download. */
import { useState } from 'preact/hooks';
import { displayText as __i18n_displayText, t as __i18n_t } from '../i18n/index';
import { xlsx, type XlsxSheet } from './xlsx';

/** Hands the workbook to the browser as a download (a name in plain letters: some browsers drop a non-ASCII one). */
export function downloadWorkbook(sheets: XlsxSheet[], name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([xlsx(sheets) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `${name}.xlsx`.replace(/[^A-Za-z0-9._-]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function ExportButton({ name, make, title, cls = 'small' }: { name: string; make: () => XlsxSheet[] | Promise<XlsxSheet[]>; title?: string; cls?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      downloadWorkbook(await make(), name);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" class={`${cls} export-button`} disabled={busy} title={title ? __i18n_displayText(title) : undefined} onClick={() => void run()}>
      {busy ? __i18n_t("ui.exportButton.text.14bcb533") : __i18n_t("ui.exportButton.text.8c338f8c")}
    </button>
  );
}
