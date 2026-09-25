/* Browser smoke test: opens the built dist/index.html from file:// in real Chromium.
   Founds an expansion club (afterFutures), makes every decision up to its first first-team season,
   visits every screen, reloads to check the autosave, then checks layouts at four sizes and the
   spectator path on a phone-sized screen.
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
const status = (page) => page.locator('.status').first().textContent();
const waitStatus = (page, text, timeout = 120_000) => page.waitForFunction((t) => document.querySelector('.status')?.textContent?.includes(t), text, { timeout });
const noOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `${label}: page scrolls sideways by ${overflow}px`);
};

/** Makes every pending decision the way the scouts suggest (draft picks: the first one by hand). */
async function decideAll(page, log) {
  let handPicked = false;
  for (let i = 0; i < 80; i++) {
    const decision = page.locator('#decision-title');
    if (!(await decision.count())) return;
    const title = (await decision.textContent()) ?? '';
    log.push(title);
    if (title === '신인 드래프트') {
      if (!handPicked) {
        const name = await page.locator('.pick-table .link').first().textContent();
        await page.locator('button.pick').first().click();
        handPicked = true;
        await page.waitForFunction((n) => !document.querySelector('.pick-table .link') || document.querySelector('.decision')?.textContent?.includes(n), name);
      } else await page.getByRole('button', { name: '스카우트에게 맡기기' }).click();
    } else {
      await page.getByRole('button', { name: '스카우트 추천으로 채우기' }).click();
      const confirm = page.getByRole('button', { name: '확정' });
      if (await confirm.isDisabled()) {
        failures.push(`${title}: scout recommendation is not a valid decision (${await page.locator('.notice.inline').textContent()})`);
        return;
      }
      await confirm.click();
    }
    await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
    await page.waitForTimeout(50);
  }
  failures.push('too many decisions');
}

async function playSeason(page) {
  await page.getByRole('button', { name: '정규시즌 끝까지' }).click();
  await page.getByRole('button', { name: '포스트시즌 진행' }).waitFor({ timeout: 90_000 });
  await page.getByRole('button', { name: '포스트시즌 진행' }).click();
  await page.getByRole('button', { name: '다음 시즌으로' }).waitFor({ timeout: 90_000 });
  await page.getByRole('button', { name: '다음 시즌으로' }).click();
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled && !document.querySelector('.status')?.textContent?.includes('진행 중'), null, { timeout: 90_000 });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // 1. Found a club.
  const t0 = Date.now();
  await page.goto(url);
  await page.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
  check((await page.locator('.choice-grid').first().locator('.choice').count()) >= 10, 'candidate cities listed');
  await page.getByLabel('구단명').fill('울산 고래단');
  await page.getByLabel('약칭').fill('고래');
  await page.getByLabel('모기업 이름').fill('가상그룹');
  check((await page.locator('.stars').textContent())?.includes('★'), 'felt difficulty shown');
  await page.screenshot({ path: join(shots, 'new-game.png'), fullPage: true });
  await page.getByRole('button', { name: '창단 신청' }).click();
  await page.locator('#decision-title').waitFor({ timeout: 120_000 });
  console.log(`founded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  check((await page.locator('#decision-title').textContent()) === '창단 트라이아웃', 'tryout comes first');
  check((await page.locator('h1').textContent()) === '울산 고래단', 'masthead shows the club');
  const log = [];
  await decideAll(page, log);

  // 2. The rest of 2026, the first draft, then the futures year.
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  check((await page.locator('.roster tbody tr').count()) > 0, 'tryout signings on the roster');
  await playSeason(page);
  await decideAll(page, log);
  check(log.filter((t) => t === '신인 드래프트').length >= 15, `first draft gives many picks (${log.filter((t) => t === '신인 드래프트').length})`);
  await waitStatus(page, '2027 정규시즌');
  await page.getByRole('button', { name: '1주', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('fieldset.controls')?.disabled);
  await page.getByRole('button', { name: '우리 구단', exact: true }).click();
  check((await page.locator('.club-facts').textContent())?.includes('퓨처스'), 'futures record shown in 2027');
  await page.screenshot({ path: join(shots, 'my-club-futures.png'), fullPage: false });

  // 3. Into the first team: free agents, special draft, foreign players.
  const before = log.length;
  await playSeason(page);
  await page.screenshot({ path: join(shots, 'decision.png'), fullPage: false });
  await decideAll(page, log);
  const winter = log.slice(before);
  for (const t of ['특별지명', '외국인 선수 계약']) check(winter.includes(t), `winter before the first team includes ${t} (${winter.filter((x) => x !== '신인 드래프트').join(', ')})`);
  await waitStatus(page, '2028 정규시즌');
  await page.getByRole('button', { name: '순위', exact: true }).click();
  check((await page.locator('.standings tbody tr').count()) === 11, 'eleven clubs in 2028');
  check((await page.locator('.standings').textContent())?.includes('울산 고래단'), 'our club in the standings');

  // 4. Every screen, the player dialog, reload.
  for (const tab of ['기록', '구단', '역대', '드래프트 후보', '우리 구단']) await page.getByRole('button', { name: tab, exact: true }).click();
  await page.locator('.roster .link').first().click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: join(shots, 'player.png') });
  await page.keyboard.press('Escape');
  const saved = await status(page);
  await page.reload();
  await waitStatus(page, '정규시즌', 60_000);
  const autosave = (await page.locator('.save-actions .muted').textContent()) ?? '';
  if (autosave.includes('자동 저장됨')) check((await status(page)) === saved, `reload restores the game (${saved} → ${await status(page)})`);

  // 5. Layouts.
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    for (const tab of ['우리 구단', '순위', '기록', '구단', '역대', '드래프트 후보']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await noOverflow(page, `${width}x${height} ${tab}`);
    }
    await page.getByRole('button', { name: '우리 구단', exact: true }).click();
    await page.screenshot({ path: join(shots, `${width}x${height}.png`) });
    console.log(`ok ${width}x${height}`);
  }
  check(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  await context.close();

  // 6. Phone: the founding form fits, and the spectator path works.
  const phone = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const p2 = await phone.newPage();
  await p2.goto(url);
  await p2.getByRole('heading', { name: '2026년, KBO 11번째 구단 창단' }).waitFor();
  await noOverflow(p2, '320 new game');
  await p2.screenshot({ path: join(shots, 'new-game-320.png'), fullPage: true });
  await p2.getByRole('button', { name: '구단 없이 리그만 관전' }).click();
  await waitStatus(p2, '2026 정규시즌');
  check((await p2.locator('.standings tbody tr').count()) === 10, 'spectator league has ten clubs');
  await phone.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`browser smoke passed (${SIZES.length} screen sizes)`);
