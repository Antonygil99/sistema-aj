'use client';
import { useState } from 'react';
import { attentionAreas, assistMessage, assistanceExamples, type MessageAssistance } from '@/modules/whatsapp/assistance';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { ClipboardText, MessageQuestion } from '@/components/icons';

export function WhatsAppAssistance({ value, onUse, disabled = false }: { value: MessageAssistance; onUse?: (text: string) => void; disabled?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const line = value.line ? { AUTO: 'Autos', MEDICAL: 'Gastos médicos', LIFE: 'Vida', MIXED: 'Ramo por confirmar' }[value.line] : 'Ramo por confirmar';
  return <section className={`wa-assistance${value.priority === 'URGENT' ? ' is-urgent' : ''}`} aria-label="Orientación para atender">
    <div className="wa-assistance-heading"><div><span>{value.priority === 'URGENT' ? 'Prioridad humana' : 'Motivo sugerido'}</span><h3>{attentionAreas[value.area]}</h3></div><span>{line}</span></div>
    <p>{value.reason} {value.nextStep}</p>
    <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>Ver revisión y borrador</summary><ul>{value.reviewNotes.map(note => <li key={note}>{note}</li>)}</ul>
      {value.areas.length > 1 ? <p>También revisar: {value.areas.slice(1).map(area => attentionAreas[area]).join(' · ')}.</p> : null}
      {value.draft ? <><blockquote>{value.draft}</blockquote>{onUse ? <button className="button button-soft" type="button" disabled={disabled} onClick={() => onUse(value.draft!)}><ClipboardText aria-hidden="true"/>Llevar al redactor</button> : null}</> : <p>Primero revisa el archivo o solicita que la persona explique su necesidad en texto.</p>}
      <p className="wa-assistance-limit">La atención permanece en el broker de esta bandeja. No se consulta un expediente por coincidencia de teléfono ni se envía nada automáticamente.</p>
    </details>
  </section>;
}
export function WhatsAppAssistanceDemo() {
  const [open, setOpen] = useState(false), [example, setExample] = useState<string>(assistanceExamples[0].id);
  const selected = assistanceExamples.find(item => item.id === example) ?? assistanceExamples[0];
  return <><button className="button button-soft" type="button" onClick={() => setOpen(true)}><MessageQuestion aria-hidden="true"/>Probar clasificación</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Probar la atención de WhatsApp">
      <p className="wa-demo-description">Casos ficticios para revisar la derivación antes de conectar los números reales. No usa Meta, un proveedor de IA ni guarda datos.</p>
      <label htmlFor="wa-example">Caso de prueba</label><Select id="wa-example" value={example} onChange={event => setExample(event.target.value)}>{assistanceExamples.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
      <div className="wa-demo-message"><small>Mensaje de ejemplo · {selected.kind === 'text' ? 'Texto' : selected.kind === 'audio' ? 'Audio' : 'Imagen'}</small><p>{selected.body || 'Audio recibido. Contenido aún no transcrito.'}</p></div>
      <WhatsAppAssistance key={selected.id} value={assistMessage(selected)}/>
    </Modal></>;
}
