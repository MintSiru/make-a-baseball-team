import { k as __i18n_k } from '../i18n/index';
/* What the game is and is not (V0.13, docs/PLAN-1.0.md §3): a free fan game that keeps the real club names
   without logos. Shown in the sidebar, the settings tab and the README. */
export const DISCLAIMER = __i18n_k("core.about.dISCLAIMER.27f31bd5");

export const REPO_URL = 'https://github.com/MintSiru/make-a-baseball-team';
export const ISSUES_URL = `${REPO_URL}/issues`;
export const RULES_URL = `${REPO_URL}/blob/main/docs/RULES.md`;

/** Libraries bundled into the page, with their licences. */
export const OPEN_SOURCE: { name: string; license: string; url: string }[] = [
  { name: 'Preact', license: 'MIT', url: 'https://github.com/preactjs/preact' },
  { name: 'Anthropic TypeScript SDK', license: 'MIT', url: 'https://github.com/anthropics/anthropic-sdk-typescript' },
];
