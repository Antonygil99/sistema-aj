'use client';
import 'driver.js/dist/driver.css';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver, type DriveStep } from 'driver.js';
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
    const popover = { title: step.title, description: step.body };
    if (!step.targets) return [{ popover }];
    const element = firstVisible(step.targets);
    return element ? [{ element, popover }] : [];
  });
}
// Content can stream in after a navigation: wait briefly until a targeted step is on screen.
async function resolveSteps(tour: Tour) {
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
  useEffect(() => { seen.current = preferences.tours.seen; }, [preferences.tours.seen]);
  const markSeen = useCallback((id: string) => {
    if (seen.current.includes(id)) return;
    seen.current = [...seen.current, id];
    update({ tours: { seen: seen.current } });
  }, [update]);
  const run = useCallback(async (tour: Tour) => {
    active.current?.destroy();
    const steps = await resolveSteps(tour);
    if (!steps.length) { toast({ kind: 'info', title: 'Nada que señalar todavía', message: 'Este recorrido necesita registros en pantalla. Inténtalo de nuevo cuando haya datos.' }); return; }
    const instance: Driver = driver({
      steps, showProgress: steps.length > 1, progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente', prevBtnText: 'Anterior', doneBtnText: 'Listo',
      popoverClass: 'aj-tour', overlayColor: darkTheme() ? '#000' : '#10201a', overlayOpacity: darkTheme() ? 0.62 : 0.5, stagePadding: 6, stageRadius: 12, smoothScroll: true,
      onPopoverRender: popover => {
        popover.wrapper.setAttribute('role', 'dialog');
        popover.wrapper.setAttribute('aria-label', `Recorrido: ${tour.title}`);
        popover.closeButton.setAttribute('aria-label', 'Cerrar recorrido');
        popover.nextButton.focus({ preventScroll: true });
      },
      onDestroyed: () => { if (active.current === instance) active.current = null; markSeen(tour.id); },
    });
    active.current = instance;
    instance.drive();
  }, [markSeen, toast]);
  const start = useCallback((id: string) => {
    const tour = tourById(id);
    if (!tour || !canSeeTour(tour, role)) return;
    if (!tour.route || tourForPath(pathname)?.id === tour.id) { window.setTimeout(() => void run(tour), 350); return; }
    pending.current = tour.id;
    router.push(tour.route);
  }, [pathname, role, router, run]);
  useEffect(() => {
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
  useEffect(() => () => active.current?.destroy(), []);
  const value = useMemo(() => ({ start }), [start]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTours() {
  const value = useContext(Context);
  if (!value) throw new Error('useTours requires TourProvider');
  return value;
}
