import { render } from 'preact';
import { App } from './ui/App';
import { applyDisplay, loadDisplay } from './ui/display';
import './ui/styles.css';

applyDisplay(loadDisplay());
render(<App />, document.getElementById('app')!);
