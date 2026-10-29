'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseCircle, type Icon } from '@/components/icons';
import { gsap, growFrom, isMobile, prefersReducedMotion, shrinkTo } from './motion';
import { useDrag } from './use-drag';
type Props = {
  open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode;
  icon?: Icon; size?: 'sm' | 'md' | 'lg'; busy?: boolean; tone?: 'default' | 'danger'; className?: string;
};
let scrollLocks=0;
let originalOverflow='';
// A stacked confirmation must not unlock its parent, nor leave the page locked when both close.
export function lockBodyScroll(){if(scrollLocks++===0){originalOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}let released=false;return()=>{if(released)return;released=true;if(--scrollLocks===0)document.body.style.overflow=originalOverflow;};}
const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
export function portalTarget() { return typeof document === 'undefined' ? null : document.getElementById('workspace-portal') ?? document.body; }
// Dialog on desktop, bottom sheet on phones. It grows out of the control that opened it and returns to it on close.
export function Modal({ open, onClose, title, description, children, footer, size = 'md', busy = false, tone = 'default', icon:HeaderIcon, className = '' }: Props) {
  const [rendered, setRendered] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const origin = useRef<DOMRect | null>(null);
  const sheet = useRef(false);
  const titleId = useId(), descriptionId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  if (open && !rendered) setRendered(true);
  useLayoutEffect(() => {
    if (!open) return;
    // Remember the opener before focus moves, so the panel can grow from it and focus can return to it.
    trigger.current = document.activeElement as HTMLElement | null;
    origin.current = trigger.current && trigger.current !== document.body ? trigger.current.getBoundingClientRect() : null;
  }, [open]);
  useLayoutEffect(() => {
    if (!rendered || !panel.current || !backdrop.current) return;
    const el = panel.current, shade = backdrop.current;
    if (open) {
      sheet.current = isMobile();
      gsap.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.28 });
      if (sheet.current && !prefersReducedMotion()) gsap.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.42, ease: 'expo.out' });
      else growFrom(el, origin.current);
      const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(focusable);
      requestAnimationFrame(() => (first ?? el).focus({ preventScroll: true }));
      return lockBodyScroll();
    }
    gsap.to(shade, { opacity: 0, duration: 0.22 });
    const done = () => { setRendered(false); requestAnimationFrame(()=>{const target=trigger.current;if(target&&document.contains(target)&&!target.closest('[data-modal-open="false"]'))target.focus({preventScroll:true});}); };
    if (sheet.current && !prefersReducedMotion()) gsap.to(el, { yPercent: 100, y: 0, duration: 0.26, ease: 'power2.in', onComplete: done });
    else { const rect = trigger.current && document.contains(trigger.current) ? trigger.current.getBoundingClientRect() : origin.current; shrinkTo(el, rect).eventCallback('onComplete', done); }
  }, [open, rendered]);
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      // With a confirmation stacked on top, only the topmost dialog reacts.
      const panels = document.querySelectorAll('.modal-panel');
      if (panels[panels.length - 1] !== panel.current) return;
      if (event.key === 'Escape' && !busy) { event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(focusable)].filter(item => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy]);
  const drag = useDrag({
    axis: 'y',
    onMove: ({ dy }) => { if (sheet.current && panel.current) gsap.set(panel.current, { y: Math.max(0, dy) }); },
    onEnd: ({ dy, vy }) => {
      if (!sheet.current || !panel.current) return;
      if ((dy > 110 || vy > 0.55) && !busy) closeRef.current();
      else gsap.to(panel.current, { y: 0, duration: 0.3, ease: 'back.out(1.6)' });
    },
  });
  const target = rendered ? portalTarget() : null;
  if (!rendered || !target) return null;
  return createPortal(<div className="modal-root">
    <div ref={backdrop} className="modal-backdrop" onClick={() => { if (!busy) onClose(); }}/>
    <div ref={panel} data-modal-open={open} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} className={`modal-panel modal-${size} modal-tone-${tone} ${className}`}>
      <div className="modal-grip" {...drag}><span aria-hidden="true"/></div>
      <header className="modal-header" {...drag}><div className="modal-heading">{HeaderIcon?<span className="modal-heading-icon" aria-hidden="true"><HeaderIcon/></span>:null}<div className="modal-heading-text"><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div></div><button type="button" className="modal-close" aria-label="Cerrar" disabled={busy} onClick={onClose}><CloseCircle aria-hidden="true"/></button></header>
      {children ? <div className="modal-body">{children}</div> : null}
      {footer ? <footer className="modal-footer">{footer}</footer> : null}
    </div>
  </div>, target);
}
