'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { riseIn } from './motion';
export type Illustration = 'prospectos' | 'clientes' | 'documentos' | 'polizas' | 'cotizaciones' | 'pagos' | 'renovaciones' | 'siniestros' | 'actividades' | 'busqueda' | 'usuarios';
// unDraw illustrations (unDraw license), recolored to the CRM green and served from /public/illustrations.
export function EmptyState({ illustration, title, message, action, compact = false }: { illustration: Illustration; title: string; message: string; action?: ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current) riseIn(ref.current.children, 0.07); }, [illustration, title]);
  return <div ref={ref} className={`empty-state${compact ? ' is-compact' : ''}`}>
    {/* eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image adds nothing for vectors */}
    <img src={`/illustrations/${illustration}.svg`} alt="" width={240} height={180} loading="lazy" decoding="async"/>
    <h3>{title}</h3>
    <p>{message}</p>
    {action ? <div className="empty-state-action">{action}</div> : null}
  </div>;
}
