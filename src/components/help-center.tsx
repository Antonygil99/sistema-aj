'use client';
import { useId } from 'react';
import Link from 'next/link';
import { ArrowRight2, PlayCircle, TickCircle } from '@/components/icons';
import { canSeeTour, tours, type Tour } from '@/modules/help/tours';
import { Modal } from './ui/modal';
import { usePreferences } from './ui/preferences';
type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
// Help Center: turn automatic tours on or off, replay this screen's tour, or open any module or component tour.
export function HelpCenter({ open, onClose, role, current, onStart }: { open: boolean; onClose: () => void; role: Role; current: Tour | null; onStart: (id: string) => void }) {
  const { preferences, update } = usePreferences();
  const labelId = useId(), hintId = useId();
  const seen = new Set(preferences.tours.seen);
  const visible = tours.filter(tour => tour.listed !== false && canSeeTour(tour, role));
  const item = (tour: Tour) => <li key={tour.id}><button type="button" className="help-item" onClick={() => onStart(tour.id)}>
    <span className="help-item-text"><strong>{tour.title}</strong><small>{tour.summary}</small></span>
    {seen.has(tour.id) ? <span className="help-state is-seen"><TickCircle aria-hidden="true"/>Visto</span> : <span className="help-state">Nuevo</span>}
    <ArrowRight2 className="help-item-arrow" aria-hidden="true"/>
  </button></li>;
  return <Modal open={open} onClose={onClose} title="Centro de ayuda" description="Recorridos guiados por cada módulo y componente del sistema." size="md" className="help-center">
    <div className="help-switch-row">
      <div><strong id={labelId}>Recorridos automáticos</strong><p id={hintId}>La primera vez que abras cada módulo te mostraremos un recorrido corto.</p></div>
      <button type="button" role="switch" className="switch" aria-checked={preferences.tours.enabled} aria-labelledby={labelId} aria-describedby={hintId} onClick={() => update({ tours: { enabled: !preferences.tours.enabled } })}><span aria-hidden="true"/></button>
    </div>
    {current && canSeeTour(current, role) ? <section className="help-current" aria-label="Esta pantalla">
      <div><span className="eyebrow">ESTA PANTALLA</span><strong>{current.title}</strong><p>{current.summary}</p></div>
      <button type="button" className="button" onClick={() => onStart(current.id)}><PlayCircle aria-hidden="true"/>Iniciar recorrido</button>
    </section> : null}
    <Link className="help-release-link" href="/novedades" onClick={onClose}>Novedades de Sistema AJ<ArrowRight2 aria-hidden="true"/></Link>
    <p className="help-group-label">Funciones nuevas</p>
    <ul className="help-list">{visible.filter(tour => tour.kind === 'feature').map(item)}</ul>
    <p className="help-group-label">Componentes</p>
    <ul className="help-list">{visible.filter(tour => tour.kind === 'component').map(item)}</ul>
    <p className="help-group-label">Módulos</p>
    <ul className="help-list">{visible.filter(tour => tour.kind === 'module').map(item)}</ul>
    {seen.size ? <button type="button" className="text-button help-reset" onClick={() => update({ tours: { seen: [] } })}>Volver a marcar todos como nuevos</button> : null}
  </Modal>;
}
