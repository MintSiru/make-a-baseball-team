/* Dialogs for keyboards and screen readers (V0.15): Tab stays inside the dialog on top, Escape closes only
   that one, and closing it puts the focus back where it was (the name or button that opened it). Dialogs
   can stack (an alert over a player's page), so only the top one handles the keys. */
import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
interface Entry {
  box: RefObject<HTMLElement>;
  escape: RefObject<(() => void) | undefined>;
}
const stack: Entry[] = [];

function onKey(e: KeyboardEvent) {
  const top = stack.at(-1);
  const box = top?.box.current;
  if (!top || !box) return;
  if (e.key === 'Escape') {
    if (top.escape.current) {
      e.preventDefault();
      top.escape.current();
    }
    return;
  }
  if (e.key !== 'Tab') return;
  const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
  if (!items.length) return;
  const first = items[0]!,
    last = items.at(-1)!;
  const active = document.activeElement;
  const inside = !!active && box.contains(active);
  if (e.shiftKey && (active === first || !inside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !inside)) {
    e.preventDefault();
    first.focus();
  }
}

/** Keeps Tab inside `box` while it is the top dialog, closes it on Escape, and gives the focus back when it closes. */
export function useFocusTrap(box: RefObject<HTMLElement>, onEscape?: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const entry: Entry = { box, escape };
    if (!stack.length) document.addEventListener('keydown', onKey);
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (!stack.length) document.removeEventListener('keydown', onKey);
      // Back to whatever opened it, if it is still on the page.
      if (before && before.isConnected) before.focus();
    };
  }, []);
}
