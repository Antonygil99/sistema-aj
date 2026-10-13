'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { portalTarget } from './modal';
type Tip = { text: string; left: number; top: number };
// One tooltip for the whole workspace: elements with data-tooltip show it on hover or keyboard focus. Sidebar items
// only need it when their label is hidden (compact sidebar, gradient theme); data-tooltip-always shows it anyway.
// It is position: fixed in the portal, so the scrollable sidebar never clips it. The accessible name stays on the
// element itself (aria-label), so the bubble is visual only.
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    const target = (node: EventTarget | null) => node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null;
    const wanted = (element: HTMLElement) => element.dataset.tooltipAlways !== undefined || Boolean(element.closest('.workspace.is-compact .workspace-sidebar'));
    const show = (node: EventTarget | null) => {
      const element = target(node);
      if (!element || !wanted(element) || !element.dataset.tooltip) { setTip(null); return; }
      const rect = element.getBoundingClientRect();
      setTip({ text: element.dataset.tooltip, left: rect.right + 12, top: rect.top + rect.height / 2 });
    };
    const hide = () => setTip(null);
    const onOver = (event: PointerEvent) => { if (event.pointerType !== 'touch') show(event.target); };
    const onFocus = (event: FocusEvent) => { if ((event.target as Element | null)?.matches?.(':focus-visible')) show(event.target); else hide(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerover', onOver); document.removeEventListener('focusin', onFocus); document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', hide, true);
    };
  }, []);
  const host = portalTarget();
  return tip && host ? createPortal(<div className="ui-tooltip" role="presentation" style={{ left: tip.left, top: tip.top }}>{tip.text}</div>, host) : null;
}
