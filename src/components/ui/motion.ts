'use client';
import gsap from 'gsap';
// Motion rules: transforms and opacity only, short durations, and a fade-only fallback for reduced motion.
export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
gsap.defaults({ ease: 'power3.out', duration: 0.32, overwrite: 'auto' });
export { gsap };
// Opens a panel as if it grew out of the element that triggered it (shared-element transition).
export function growFrom(panel: HTMLElement, origin: DOMRect | null) {
  if (prefersReducedMotion() || !origin || origin.width === 0) return gsap.fromTo(panel, { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.2, clearProps: 'transform' });
  const box = panel.getBoundingClientRect();
  const x = origin.left + origin.width / 2 - (box.left + box.width / 2);
  const y = origin.top + origin.height / 2 - (box.top + box.height / 2);
  const scale = Math.min(0.6, Math.max(0.12, origin.width / box.width));
  return gsap.fromTo(panel, { x, y, scale, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.46, ease: 'expo.out', clearProps: 'transform' });
}
export function shrinkTo(panel: HTMLElement, origin: DOMRect | null) {
  if (prefersReducedMotion() || !origin || origin.width === 0) return gsap.to(panel, { opacity: 0, scale: 0.98, duration: 0.16 });
  const box = panel.getBoundingClientRect();
  return gsap.to(panel, { x: origin.left + origin.width / 2 - (box.left + box.width / 2), y: origin.top + origin.height / 2 - (box.top + box.height / 2), scale: Math.min(0.6, Math.max(0.12, origin.width / box.width)), opacity: 0, duration: 0.26, ease: 'power2.in' });
}
export function riseIn(targets: gsap.TweenTarget, stagger = 0.05) {
  if (prefersReducedMotion()) return gsap.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: 0.2 });
  return gsap.fromTo(targets, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger, clearProps: 'transform' });
}
