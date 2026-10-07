import { render } from 'preact';
import { App } from './ui/App';
import { applyDisplay, loadDisplay } from './ui/display';
import { Guard } from './ui/Recovery';
import './ui/styles.css';

applyDisplay(loadDisplay());
// 1.4.1: whatever breaks, the page offers a way back (backups, a save file, a new game) instead of staying blank.
render(
  <Guard>
    <App />
  </Guard>,
  document.getElementById('app')!,
);
