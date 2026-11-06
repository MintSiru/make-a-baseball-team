/* 2.0.78 (the user's request): the squad screen exports its players' records and ratings as an Excel workbook. */
import { describe, expect, it } from 'vitest';
import { rosterView } from '../src/league/views';
import { squadWorkbook } from '../src/ui/next/Squad';
import { cellValue, colName, crc32, xlsx } from '../src/ui/xlsx';
import { loadSave } from './helpers';

/** The files of a stored zip, by its central directory (and each one's CRC checked). */
function unzip(b: Uint8Array): Map<string, string> {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const end = b.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const n = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const crc = v.getUint32(at + 16, true);
    const size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(b.subarray(at + 46, at + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = b.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out.set(name, dec.decode(data));
    at += 46 + nameLen;
  }
  return out;
}

describe('2.0.78: the squad as an Excel workbook', () => {
  it('writes a valid .xlsx: the first team’s records, ratings and Savant numbers, numbers as numbers', () => {
    const s = loadSave('2.0.77');
    const rows = rosterView(s, s.user!.teamId).active;
    const sheets = squadWorkbook(s, rows);
    expect(sheets.map((x) => x.name)).toEqual(['투수 기록', '타자 기록', '투수 능력치', '타자 능력치', '투수 세이버', '타자 세이버']);
    // 2.0.78: the Savant numbers — each measure and its percentile, and the run values.
    const sab = sheets[5]!;
    expect(sab.rows[0]).toEqual(expect.arrayContaining(['xwOBA', 'xwOBA 백분위']));
    expect(sab.rows[0]).toEqual(expect.arrayContaining(['타격 런 밸류', '타격 런 밸류 백분위']));
    const at = sab.rows[0]!.indexOf('xwOBA 백분위');
    const pcts = sab.rows.slice(1).map((x) => x[at]).filter((x) => x !== '');
    expect(pcts.length).toBeGreaterThan(0);
    for (const v of pcts) expect(v as number).toBeGreaterThanOrEqual(1);
    expect(sheets[4]!.rows.length).toBe(rows.filter((r) => r.pitcher).length + 1);
    const pit = sheets[0]!, bat = sheets[1]!, rat = sheets[3]!;
    expect(pit.rows.length).toBe(rows.filter((r) => r.pitcher).length + 1);
    expect(bat.rows.length).toBe(rows.filter((r) => !r.pitcher).length + 1);
    // Headings once each (the season and both detail pages): ERA and WAR for pitchers, OPS and wRC+ for hitters.
    expect(pit.rows[0]!.filter((h) => h === 'ERA').length).toBe(1);
    expect(pit.rows[0]).toEqual(expect.arrayContaining(['ERA', 'FIP', 'WHIP', 'WAR']));
    expect(bat.rows[0]).toEqual(expect.arrayContaining(['OPS', 'wRC+', 'wOBA', 'WAR']));
    expect(bat.rows[0]!.filter((h) => h === 'OPS').length).toBe(1);
    // A hitter's ratings now and to come, as numbers.
    const h = rows.find((r) => !r.pitcher)!;
    const line = rat.rows.find((x) => x[1] === h.name)!;
    const p = s.players[h.id]!;
    expect(line).toContain(p.scouting.tools.contact);
    expect(typeof line[rat.rows[0]!.indexOf('나이')]).toBe('number');
    // The file: a zip with the workbook's parts, each sheet's rows in it.
    const files = unzip(xlsx(sheets));
    expect([...files.keys()]).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet6.xml']));
    expect(files.get('xl/workbook.xml')).toContain('name="타자 능력치"');
    const sheet2 = files.get('xl/worksheets/sheet2.xml')!;
    expect(sheet2).toContain(h.name);
    expect(sheet2).toContain(`r="${colName(bat.rows[0]!.length - 1)}${bat.rows.length}"`);
  });

  it('keeps baseball’s text as text', () => {
    expect(cellValue('12')).toBe(12);
    expect(cellValue('3.45')).toBe(3.45);
    expect(cellValue('.287')).toBe('.287');
    expect(cellValue('3-2')).toBe('3-2');
    expect(cellValue('10.5%')).toBe('10.5%');
    expect(colName(0)).toBe('A');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
    expect(colName(51)).toBe('AZ');
  });
});
