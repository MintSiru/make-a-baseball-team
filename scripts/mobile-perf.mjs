/* How the game feels on a slow phone (V1.0, docs/PLAN-1.0.md §4 E and V7): the built page at a phone's size with
   the CPU slowed four times (Chrome DevTools' "4x slowdown", a mid-range phone), timing what a player does in
   the first minutes — founding, the first decisions, a week and a month of the season — and the longest task
   that held the screen (a "long task" is 50 ms or more on the page's main thread; the simulation itself runs
   in a worker). Run `npm run build` first.

     CHROMIUM_BIN=/opt/pw-browsers/chromium node scripts/mobile-perf.mjs [slowdown=4] */
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(join(root, 'dist', 'index.html')).href;
const rate = Number(process.argv[2] ?? 4);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
const rows = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const idle = () => page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled && !document.querySelector('.status')?.textContent?.includes('진행 중'), null, { timeout: 600_000 });
  /** Runs one step and records its wall time and the longest main-thread task during it. */
  async function step(label, run) {
    await page.evaluate(() => (window.__long = []));
    const t = Date.now();
    await run();
    const long = await page.evaluate(() => window.__long);
    rows.push({ label, seconds: (Date.now() - t) / 1000, longest: Math.round(Math.max(0, ...long)), long: long.length });
  }
  await step('첫 화면 열기', async () => {
    await page.goto(url);
    await page.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
  });
  await page.getByLabel('구단명').fill('울산 고래단');
  await page.getByLabel('약칭').fill('고래');
  await page.getByLabel('모기업 이름').fill('가상그룹');
  await step('창단 신청 → 첫 결정', async () => {
    await page.getByRole('button', { name: '창단 신청' }).click();
    await page.locator('#decision-title').waitFor({ timeout: 600_000 });
  });
  await page.addLocatorHandler(page.getByRole('alertdialog'), async (dialog) => {
    const all = dialog.getByRole('button', { name: '모두 확인' });
    await ((await all.count()) ? all : dialog.getByRole('button', { name: '확인', exact: true })).click();
  });
  await page.locator('.tutorial').getByRole('button', { name: '튜토리얼 끄기' }).click().catch(() => {});
  for (let i = 0; i < 3 && (await page.locator('#decision-title').count()); i++) {
    const title = await page.locator('#decision-title').textContent();
    await step(`결정 제출: ${title}`, async () => {
      await page.getByRole('button', { name: /추천으로 채우기/ }).click();
      await page.getByRole('button', { name: '확정' }).click();
      await idle();
    });
  }
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  for (const [label, name] of [
    ['하루 진행', '하루'],
    ['1주 진행', '1주'],
    ['한 달 진행', '한 달'],
  ]) {
    if (await page.locator('#decision-title').count()) break;
    await step(label, async () => {
      await page.getByRole('button', { name, exact: true }).click();
      await idle();
    });
  }
  for (const [label, name] of [
    ['순위 탭 열기', '순위'],
    ['기록 탭 열기', '기록'],
    ['우리 구단 탭 열기', '우리 구단'],
  ])
    await step(label, async () => {
      await page.locator('nav.tabs').getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(100);
    });
} finally {
  await browser.close();
}
console.log(`| 조작 (CPU ${rate}배 느리게, 390×844) | 걸린 시간 (초) | 가장 긴 화면 멈춤 (ms) | 50ms 넘은 작업 |`);
console.log('|---|---|---|---|');
for (const r of rows) console.log(`| ${r.label} | ${r.seconds.toFixed(1)} | ${r.longest} | ${r.long} |`);
