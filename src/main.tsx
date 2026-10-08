import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { onLocale } from './i18n/index';
import { applyLocale, storedLocale } from './i18n/runtime';
import { App } from './ui/App';
import { applyDisplay, loadDisplay } from './ui/display';
import { Guard } from './ui/Recovery';
import './ui/styles.css';

applyDisplay(loadDisplay());
applyLocale(storedLocale(), false);

/** A new display language redraws the page in place (the game and the screen stay where they are). */
function Root() {
  const [, redraw] = useState(0);
  useEffect(() => onLocale(() => redraw((n) => n + 1)), []);
  // 1.4.1: whatever breaks, the page offers a way back (backups, a save file, a new game) instead of staying blank.
  return (
    <Guard>
      <App />
    </Guard>
  );
}
render(<Root />, document.getElementById('app')!);
