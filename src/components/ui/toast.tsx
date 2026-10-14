'use client';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CloseCircle, Danger, InfoCircle, ShieldSecurity, TickCircle, Warning2 } from '@/components/icons';
import { gsap, isMobile, prefersReducedMotion } from './motion';
import { useDrag } from './use-drag';
import { messageFor } from './client-api';
export type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'security';
export type ToastInput = { kind?: ToastKind; title: string; message?: string; action?: { label: string; href?: string; onClick?: () => void }; duration?: number; dedupe?: string };
type Toast = ToastInput & { id: number; kind: ToastKind };
const ToastContext = createContext<(toast: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastContext);
const icons = { success: TickCircle, error: CloseCircle, warning: Warning2, info: InfoCircle, security: ShieldSecurity };
const durations = { success: 4500, info: 6000, warning: 7000, error: 8000, security: 10000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const recent = useRef(new Map<string, number>());
  const show = useCallback((input: ToastInput) => {
    // The same signal (e.g. an expired session hit by several requests) shows once per 10 s.
    if (input.dedupe) { const last = recent.current.get(input.dedupe) ?? 0; if (Date.now() - last < 10000) return; recent.current.set(input.dedupe, Date.now()); }
    const id = ++counter.current;
    setToasts(current => [...current.slice(-3), { ...input, id, kind: input.kind ?? 'info' }]);
  }, []);
  const remove = useCallback((id: number) => setToasts(current => current.filter(toast => toast.id !== id)), []);
  useEffect(() => {
    function onSecurity(event: Event) {
      const code = (event as CustomEvent<{ code: string }>).detail.code;
      show({ kind: 'security', title: code === 'UNAUTHORIZED' ? 'Sesión finalizada' : 'Acción bloqueada', message: messageFor(code), action: code === 'UNAUTHORIZED' ? { label: 'Volver a entrar', href: '/login' } : undefined, dedupe: 'security:' + code });
    }
    function onOffline() { show({ kind: 'warning', title: 'Sin conexión', message: 'Tus cambios no se guardarán hasta recuperar la red.', dedupe: 'offline' }); }
    function onOnline() { show({ kind: 'success', title: 'Conexión restablecida', dedupe: 'online' }); }
    window.addEventListener('aj:security', onSecurity);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('aj:security', onSecurity); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, [show]);
  const value = useMemo(() => show, [show]);
  return <ToastContext.Provider value={value}>{children}<section className="toast-region" aria-label="Avisos">{toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDone={remove}/>)}</section></ToastContext.Provider>;
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);
  const Icon = icons[toast.kind];
  const dismiss = useCallback((direction = 0) => {
    const el = ref.current;
    if (!el || leaving.current) return;
    leaving.current = true;
    if (timer.current) clearTimeout(timer.current);
    const out = prefersReducedMotion() ? { opacity: 0, duration: 0.15 } : { opacity: 0, x: direction * 220, y: direction ? 0 : -8, duration: 0.24, ease: 'power2.in' };
    gsap.to(el, { ...out, onComplete: () => { gsap.to(el, { height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, duration: 0.18, onComplete: () => onDone(toast.id) }); } });
  }, [onDone, toast.id]);
  const start = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => dismiss(), toast.duration ?? durations[toast.kind]); }, [dismiss, toast.duration, toast.kind]);
  const pause = () => { if (timer.current) clearTimeout(timer.current); };
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    else gsap.fromTo(el, { opacity: 0, y: isMobile() ? -18 : 0, x: isMobile() ? 0 : 28, scale: 0.97 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.42, ease: 'expo.out', clearProps: 'transform' });
    start();
    return pause;
  }, [start]);
  const drag = useDrag({
    axis: 'x',
    onMove: ({ dx }) => { pause(); if (ref.current) gsap.set(ref.current, { x: dx, opacity: Math.max(0.3, 1 - Math.abs(dx) / 260) }); },
    onEnd: ({ dx, vx }) => { if (Math.abs(dx) > 80 || Math.abs(vx) > 0.6) dismiss(Math.sign(dx) || 1); else if (ref.current) { gsap.to(ref.current, { x: 0, opacity: 1, duration: 0.25 }); start(); } },
  });
  const urgent = toast.kind === 'error' || toast.kind === 'security';
  return <div ref={ref} className={`toast toast-${toast.kind}`} role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'} onMouseEnter={pause} onMouseLeave={start} onFocus={pause} onBlur={start} {...drag}>
    <span className="toast-icon" aria-hidden="true">{toast.kind === 'error' ? <Danger/> : <Icon/>}</span>
    <div className="toast-body"><strong>{toast.title}</strong>{toast.message ? <p>{toast.message}</p> : null}
      {toast.action ? toast.action.href ? <Link className="toast-action" href={toast.action.href} onClick={() => dismiss()}>{toast.action.label}</Link> : <button type="button" className="toast-action" onClick={() => { toast.action?.onClick?.(); dismiss(); }}>{toast.action.label}</button> : null}
    </div>
    <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => dismiss()}><CloseCircle aria-hidden="true"/></button>
  </div>;
}
