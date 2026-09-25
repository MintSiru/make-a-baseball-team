/* Browser smoke test: opens the built dist/index.html from file:// in real Chromium at four screen sizes.
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

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
try {
  for (const [width, height] of SIZES) {
    const tag = `${width}x${height}`;
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await page.goto(url);
    await page.getByRole('heading', { name: 'KBO 신구단' }).waitFor();
    await page.locator('.player-row').first().waitFor();

    check((await page.locator('.player-row').count()) === 400, `${tag}: expected 400 prospects`);
    const firstName = await page.locator('.player-row .link').first().textContent();
    check((await page.locator('#profile-name').textContent()) === firstName, `${tag}: first prospect not shown by default`);

    // Pick another prospect.
    const third = page.locator('.player-row .link').nth(2);
    const thirdName = await third.textContent();
    await third.click();
    check((await page.locator('#profile-name').textContent()) === thirdName, `${tag}: profile did not follow the selection`);
    check((await page.locator('.grades tbody tr').count()) >= 4, `${tag}: scouting grades missing`);
    const profileTop = await page.locator('.profile').evaluate((el) => el.getBoundingClientRect().top);
    check(profileTop >= -1 && profileTop < height, `${tag}: scouting report not in view after selecting (top ${profileTop})`);

    // Filter catchers.
    await page.getByRole('button', { name: '포수', exact: true }).click();
    const roles = await page.locator('.player-row td:nth-child(3)').allTextContents();
    check(roles.length > 0 && roles.every((r) => r === '포수'), `${tag}: catcher filter shows other positions`);

    // No page-level horizontal scrolling; wide tables scroll inside their own box.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `${tag}: page scrolls sideways by ${overflow}px`);

    await page.screenshot({ path: join(shots, `${tag}.png`), fullPage: false });

    // The world survives a reload (autosave), or the page says it cannot autosave.
    const seed = await page.locator('.seed input').inputValue();
    await page.reload();
    await page.locator('.player-row').first().waitFor();
    const autosave = (await page.locator('.save-actions .muted').textContent()) ?? '';
    const reloaded = await page.locator('.seed input').inputValue();
    check(autosave.includes('자동 저장됨') ? reloaded === seed : autosave.includes('진행 파일로 저장'), `${tag}: autosave did not restore seed`);

    // A new seed builds a different class.
    await page.locator('.seed input').fill('smoke-seed');
    await page.getByRole('button', { name: '새로 만들기' }).click();
    await page.waitForFunction(() => document.querySelector('.seed input')?.value === 'smoke-seed');
    const newFirst = await page.locator('.player-row .link').first().textContent();
    check(newFirst !== firstName || seed === 'smoke-seed', `${tag}: new seed did not change the class`);

    check(errors.length === 0, `${tag}: page errors: ${errors.join(' | ')}`);
    await context.close();
    console.log(`ok ${tag}`);
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`browser smoke: ${SIZES.length} screen sizes passed`);
