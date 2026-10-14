'use client';
import { useEffect, useId, type ReactNode } from 'react';
import { Colorfilter, Monitor, Moon, Sun1 } from '@/components/icons';
import { assistantModels, providerLabels, type NotificationSettings, type Theme } from '@/modules/preferences';
import { Modal } from './ui/modal';
import { usePreferences } from './ui/preferences';
export type SettingsSection = 'apariencia' | 'notificaciones' | 'asistentes' | 'ayuda' | 'vistas';
const themes: { value: Theme; label: string; Icon: typeof Sun1 }[] = [
  { value: 'light', label: 'Claro', Icon: Sun1 },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Según el dispositivo', Icon: Monitor },
  { value: 'gradient', label: 'Gradiente', Icon: Colorfilter },
];
type SwitchKey = keyof Pick<NotificationSettings, 'team' | 'toasts' | 'payments' | 'renewals' | 'followUps' | 'emailProspects' | 'emailClaims' | 'emailAgenda' | 'emailDigest'>;
const notificationOptions: { key: SwitchKey; label: string; hint: string }[] = [
  { key: 'team', label: 'Actividad del equipo', hint: 'Lo que tus compañeros registran, editan o suben.' },
  { key: 'toasts', label: 'Avisos emergentes', hint: 'Un aviso en pantalla cuando llega una novedad del equipo.' },
  { key: 'payments', label: 'Recibos vencidos', hint: 'Recordatorio de recibos pendientes con fecha pasada.' },
  { key: 'renewals', label: 'Renovaciones de la semana', hint: 'Pólizas por renovar en los próximos 7 días.' },
  { key: 'followUps', label: 'Seguimientos de entrega', hint: 'Seguimientos de 7, 30 y 90 días a tu cargo.' },
];
// Sent by Sistema AJ to the address you sign in with (src/modules/email).
const emailOptions: { key: SwitchKey; label: string; hint: string }[] = [
  { key: 'emailDigest', label: 'Resumen diario', hint: 'Cada mañana: tu agenda, avisos por revisar, renovaciones, recibos, seguimientos y siniestros abiertos.' },
  { key: 'emailProspects', label: 'Prospectos nuevos', hint: 'Un correo cuando entra un prospecto a tu cargo o sin responsable que no registraste tú.' },
  { key: 'emailClaims', label: 'Siniestros nuevos', hint: 'Un correo cuando se registra un siniestro de una póliza a tu cargo o sin responsable.' },
  { key: 'emailAgenda', label: 'Recordatorios de agenda', hint: 'Tus reuniones: un día antes, a las 8:00 del mismo día y 10 minutos antes.' },
];
const viewLabels: Record<string, Record<string, string>> = {
  clientes: { dossiers: 'Clientes como expedientes', list: 'Clientes como lista' },
  prospectos: { board: 'Prospectos como embudo', list: 'Prospectos como lista' },
  documentos: { grid: 'Documentos como tarjetas', list: 'Documentos como lista' },
};
function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (next: boolean) => void }) {
  const labelId = useId(), hintId = useId();
  return <div className="settings-row">
    <div><strong id={labelId}>{label}</strong><p id={hintId}>{hint}</p></div>
    <button type="button" role="switch" className="switch" aria-checked={checked} aria-labelledby={labelId} aria-describedby={hintId} onClick={() => onChange(!checked)}><span aria-hidden="true"/></button>
  </div>;
}
function Section({ id, title, children }: { id: SettingsSection; title: string; children: ReactNode }) {
  return <section className="settings-section" id={`ajustes-${id}`} aria-labelledby={`ajustes-${id}-titulo`}><h3 id={`ajustes-${id}-titulo`}>{title}</h3>{children}</section>;
}
// Preferences live in the user's account (UserPreference), so they follow them across devices.
export function SettingsDialog({ open, section, onClose, role = 'USER' }: { open: boolean; section: SettingsSection; onClose: () => void; role?: 'USER' | 'ADMIN' | 'SUPERADMIN' }) {
  const { preferences, update } = usePreferences();
  const themeName = useId(), modelName = useId();
  useEffect(() => {
    if (!open || section === 'apariencia') return;
    const timer = window.setTimeout(() => document.getElementById(`ajustes-${section}`)?.scrollIntoView({ block: 'start' }), 260);
    return () => window.clearTimeout(timer);
  }, [open, section]);
  const views = Object.entries(preferences.views).map(([key, value]) => viewLabels[key]?.[value as string]).filter(Boolean);
  return <Modal open={open} onClose={onClose} title="Preferencias" description="Ajusta el sistema a tu manera. Se guardan en tu cuenta y te siguen en cualquier dispositivo." size="md" className="settings-dialog">
    <Section id="apariencia" title="Apariencia">
      <fieldset className="theme-picker"><legend className="sr-only">Tema</legend>
        {themes.map(({ value, label, Icon }) => <label key={value} className="theme-option">
          <input type="radio" name={themeName} value={value} checked={preferences.theme === value} onChange={() => update({ theme: value })}/>
          <span className={`theme-swatch is-${value}`} aria-hidden="true"><i/><i/></span>
          <span className="theme-option-label"><Icon aria-hidden="true"/>{label}</span>
        </label>)}
      </fieldset>
    </Section>
    <Section id="notificaciones" title="Notificaciones">
      {notificationOptions.map(option => <SwitchRow key={option.key} label={option.label} hint={option.hint} checked={preferences.notifications[option.key]} onChange={next => update({ notifications: { [option.key]: next } })}/>)}
      <h4 className="settings-subtitle">Por correo</h4>
      {emailOptions.map(option => <SwitchRow key={option.key} label={option.label} hint={option.hint} checked={preferences.notifications[option.key]} onChange={next => update({ notifications: { [option.key]: next } })}/>)}
    </Section>
    {role === 'SUPERADMIN' ? <Section id="asistentes" title="Asistentes de IA">
      <p className="settings-note">El modelo con el que responden los asistentes (Asistentes, en el menú). Haiku es el recomendado por rápido y económico; los de OpenAI necesitan su propia llave.</p>
      <fieldset className="model-list"><legend className="sr-only">Modelo de los asistentes</legend>
        {assistantModels.map(model => <label key={model.id} className="model-option">
          <input type="radio" name={modelName} value={model.id} checked={preferences.assistantModel === model.id} onChange={() => update({ assistantModel: model.id })}/>
          <span><strong>{model.label} <em className="model-provider">{providerLabels[model.provider]}</em></strong><small>{model.summary}</small></span>
        </label>)}
      </fieldset>
    </Section> : null}
    <Section id="ayuda" title="Ayuda">
      <SwitchRow label="Recorridos automáticos" hint="La primera vez que abras cada módulo te mostraremos un recorrido corto." checked={preferences.tours.enabled} onChange={next => update({ tours: { enabled: next } })}/>
    </Section>
    <Section id="vistas" title="Vistas recordadas">
      <p className="settings-note">{views.length ? views.join(' · ') : 'Todavía no has elegido vistas; cada módulo abre con su vista habitual.'}</p>
      {views.length ? <button type="button" className="text-button" onClick={() => update({ resetViews: true })}>Restablecer vistas</button> : null}
    </Section>
  </Modal>;
}
