'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Driver, DriveStep } from 'driver.js';
import { canSeeTour, tourById, tourForPath, type Tour } from '@/modules/help/tours';
import { usePreferences } from './preferences';
import { useToast } from './toast';
type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
type ToursContext = { start: (id: string) => void };
const Context = createContext<ToursContext | null>(null);
const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
const darkTheme = () => ['dark', 'gradient'].includes(document.documentElement.dataset.theme ?? '') || (document.documentElement.dataset.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
function firstVisible(selectors: string[]) {
  for (const selector of selectors) for (const element of document.querySelectorAll(selector)) {
    if (element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden') return element;
  }
  return null;
}
// Steps whose element is not on screen (role, current view, empty list, phone layout) are skipped.
function buildSteps(tour: Tour): DriveStep[] {
  return tour.steps.flatMap(step => {
    const popover = { title: step.title, description: step.body, ...(step.illustration ? { popoverClass: `aj-tour aj-tour-${step.illustration}` } : {}) };
    if (!step.targets) return [{ popover }];
    const element = firstVisible(step.targets);
    return element ? [{ element, popover }] : [];
  });
}
// Content can stream in after a navigation: wait briefly until a targeted step is on screen.
async function resolveSteps(tour: Tour) {
  const details = tour.prepare === 'intake' ? document.querySelector<HTMLDetailsElement>('#ficha-cliente') : null;
  if (details) {
    details.open = true;
    for (let elapsed = 0; elapsed < 4500 && !details.querySelector('[data-tour="intake-link"]') && !details.querySelector('[role="alert"]'); elapsed += 150) await wait(150);
  }
  const targeted = tour.steps.some(step => step.targets);
  for (let elapsed = 0; ; elapsed += 150) {
    const steps = buildSteps(tour);
    if (!targeted || steps.some(step => step.element) || elapsed >= 3000) return steps;
    await wait(150);
  }
}
// Guided tours (driver.js). With automatic tours on, each screen's tour runs once.
export function TourProvider({ role, children }: { role: Role; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { preferences, update } = usePreferences();
  const active = useRef<Driver | null>(null);
  const pending = useRef<string | null>(null);
  const seen = useRef(preferences.tours.seen);
  const generation = useRef(0);
  useEffect(() => { seen.current = preferences.tours.seen; }, [preferences.tours.seen]);
  const markSeen = useCallback((id: string) => {
    if (seen.current.includes(id)) return;
    seen.current = [...seen.current, id];
    update({ tours: { seen: seen.current } });
  }, [update]);
  const run = useCallback(async (tour: Tour) => {
    const request = ++generation.current;
    active.current?.destroy();
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const steps = await resolveSteps(tour);
    if (generation.current !== request) return;
    if (!steps.length) { toast({ kind: 'info', title: 'Nada que señalar todavía', message: 'Este recorrido necesita registros en pantalla. Inténtalo de nuevo cuando haya datos.' }); return; }
    // driver.js (and its CSS) only downloads the first time a tour runs.
    const { driver } = await import('./tour-engine');
    if (generation.current !== request) return;
    const instance: Driver = driver({
      steps, showProgress: steps.length > 1, progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente', prevBtnText: 'Anterior', doneBtnText: 'Listo',
      popoverClass: 'aj-tour', disableActiveInteraction: true, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, overlayColor: darkTheme() ? '#000' : '#10201a', overlayOpacity: darkTheme() ? 0.62 : 0.5, stagePadding: 6, stageRadius: 12, smoothScroll: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      onPopoverRender: popover => {
        popover.wrapper.setAttribute('role', 'dialog');
        popover.wrapper.setAttribute('aria-label', `Recorrido: ${tour.title}`);
        popover.closeButton.setAttribute('aria-label', 'Cerrar recorrido');
        popover.nextButton.focus({ preventScroll: true });
      },
      onDestroyed: () => { if (active.current === instance) active.current = null; markSeen(tour.id); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); },
    });
    active.current = instance;
    instance.drive();
  }, [markSeen, toast]);
  const start = useCallback((id: string) => {
    const tour = tourById(id);
    if (!tour || !canSeeTour(tour, role)) return;
    if (!tour.route || pathname === tour.route.split('?')[0] || tourForPath(pathname)?.id === tour.id || (tour.context === 'client' && /^\/crm\/clientes\/[^/]+$/.test(pathname) && pathname !== '/crm/clientes/nuevo')) { window.setTimeout(() => void run(tour), 350); return; }
    pending.current = tour.id;
    router.push(tour.route);
  }, [pathname, role, router, run]);
  useEffect(() => {
    generation.current++;
    active.current?.destroy();
    const requested = pending.current ? tourById(pending.current) : null;
    pending.current = null;
    if (requested) { void run(requested); return; }
    if (!preferences.tours.enabled) return;
    const tour = tourForPath(pathname);
    if (!tour || !canSeeTour(tour, role) || seen.current.includes(tour.id)) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible' && !document.querySelector('[role="dialog"]')) void run(tour);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pathname, preferences.tours.enabled, role, run]);
  useEffect(() => () => { generation.current++; active.current?.destroy(); }, []);
  const value = useMemo(() => ({ start }), [start]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTours() {
  const value = useContext(Context);
  if (!value) throw new Error('useTours requires TourProvider');
  return value;
}
