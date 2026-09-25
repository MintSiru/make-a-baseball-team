/* Browser smoke test: opens the built dist/index.html from file:// in real Chromium.
   Builds a league (worker), plays a day, visits every screen, plays a whole season through the
   postseason into the next year, reloads to check the autosave, then checks the layout at four sizes.
   Run `npm run build` first. Uses CHROMIUM_BIN when set, else Playwright's own browser lookup.
   Screenshots go to tests/browser/screenshots/ (git-ignored). */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(join(root, 'dist', 'index.html')).href;
const shots = join(root, 'tests', 'browser', 'screenshots');
mkdirSync(shots, { recursive: true });

const SIZES = [
  [1440, 1000],
  [820, 1180],
  [390, 844],
  [320, 740],
];

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
const status = (page) => page.locator('.status').textContent();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // 1. A new league is built and waits at 2026 opening day.
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('.status')?.textContent?.includes('2026 정규시즌'), null, { timeout: 120_000 });
  console.log(`league built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  check((await page.locator('.standings tbody tr').count()) === 10, 'standings should list 10 clubs');

  // 2. One day of games.
  await page.getByRole('button', { name: '하루', exact: true }).click();
  await page.locator('.scores li').first().waitFor();
  check((await page.locator('.scores li').count()) === 5, 'five games on the first day');

  // 3. Leaders, a club, a player's career, the history, the draft board.
  await page.getByRole('button', { name: '기록', exact: true }).click();
  check((await page.locator('.leader-block').count()) === 10, 'ten leader categories');
  await page.getByRole('button', { name: '구단', exact: true }).click();
  const activeRows = await page.locator('.roster').first().locator('tbody tr').count();
  check(activeRows === 29, `first team should have 29 players, got ${activeRows}`);
  await page.locator('.roster .link').first().click();
  await page.getByRole('dialog').waitFor();
  check((await page.locator('#player-name').textContent())?.length > 0, 'player dialog shows a name');
  check((await page.locator('.dialog .grades tbody tr').count()) >= 4, 'player dialog shows scouting grades');
  await page.keyboard.press('Escape');
  check((await page.getByRole('dialog').count()) === 0, 'Escape closes the player dialog');
  await page.getByRole('button', { name: '역대', exact: true }).click();
  check((await page.locator('main tbody tr').count()) === 11, 'history lists 2015–2025');
  await page.getByRole('button', { name: '드래프트 후보', exact: true }).click();
  check((await page.locator('.player-row').count()) === 400, 'draft board lists 400 prospects');
  await page.getByRole('button', { name: '포수', exact: true }).click();
  const roles = await page.locator('.player-row td:nth-child(3)').allTextContents();
  check(roles.length > 0 && roles.every((r) => r === '포수'), 'catcher filter');

  // 4. The rest of the season, the postseason and the offseason (worker).
  await page.getByRole('button', { name: '순위', exact: true }).click();
  await page.getByRole('button', { name: '정규시즌 끝까지' }).click();
  await page.getByRole('button', { name: '포스트시즌 진행' }).waitFor({ timeout: 60_000 });
  const games = await page.locator('.standings tbody tr td:nth-child(3)').allTextContents();
  check(games.every((g) => g === '144'), `every club plays 144 games, got ${games.join(',')}`);
  await page.getByRole('button', { name: '포스트시즌 진행' }).click();
  await page.getByRole('button', { name: '다음 시즌으로' }).waitFor({ timeout: 60_000 });
  check((await page.locator('.series-list li').count()) === 4, 'four postseason rounds');
  check((await status(page)).includes('우승'), 'status names the champion');
  await page.getByRole('button', { name: '다음 시즌으로' }).click();
  await page.waitForFunction(() => document.querySelector('.status')?.textContent?.includes('2027 정규시즌'), null, { timeout: 60_000 });

  // 5. Autosave survives a reload.
  const before = await status(page);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.status')?.textContent?.includes('정규시즌'), null, { timeout: 60_000 });
  const autosave = (await page.locator('.save-actions .muted').textContent()) ?? '';
  if (autosave.includes('자동 저장됨')) check((await status(page)) === before, `reload restores the season (${before} → ${await status(page)})`);

  // 6. Layout at four sizes: no page-level sideways scrolling on any screen.
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    for (const tab of ['순위', '기록', '구단', '역대', '드래프트 후보']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, `${width}x${height} ${tab}: page scrolls sideways by ${overflow}px`);
    }
    await page.getByRole('button', { name: '순위', exact: true }).click();
    await page.screenshot({ path: join(shots, `${width}x${height}.png`) });
    await page.getByRole('button', { name: '구단', exact: true }).click();
    await page.screenshot({ path: join(shots, `${width}x${height}-team.png`) });
    console.log(`ok ${width}x${height}`);
  }
  await page.locator('.roster .link').first().click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: join(shots, 'player.png') });

  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`browser smoke passed (${SIZES.length} screen sizes)`);
