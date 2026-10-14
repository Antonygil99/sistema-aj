// Email templates. Pure and free of zod and server code: the composer uses clientEmail() for its live preview and
// the server renders the same HTML it sends. Every value from the CRM is escaped. Tested in tests/email.test.ts.
export const BRAND = 'AJ Consultoría de Seguros';
export type ClientEmailKind = 'DOCUMENTOS' | 'BIENVENIDA';
export type AgendaKind = 'AGENDA_1D' | 'AGENDA_DIA' | 'AGENDA_10M';
export type Rendered = { subject: string; html: string; text: string };
export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Plain text written in the composer: blank lines split paragraphs, single line breaks are kept.
function paragraphs(text: string) {
  return text.trim().split(/\n{2,}/).map(block => `<p style="margin:0 0 14px">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
}
const safeUrl = (url: string | null | undefined) => url && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null;
function layout({ preheader, body, footer }: { preheader: string; body: string; footer: string }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2a25">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e8e5">
<tr><td style="background:#3f6b54;padding:18px 28px;color:#ffffff;font-size:15px;font-weight:bold;letter-spacing:.3px">${BRAND}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #eef1ef;font-size:12px;line-height:1.5;color:#5d6a63">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}
const button = (url: string, label: string) => `<p style="margin:22px 0 4px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#3f6b54;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:bold;font-size:14px">${escapeHtml(label)}</a></p>`;
const rows = (items: [string, string][]) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;font-size:14px">${items.map(([label, value]) => `<tr><td style="padding:4px 16px 4px 0;color:#5d6a63;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0;vertical-align:top">${escapeHtml(value)}</td></tr>`).join('')}</table>`;
const rowsText = (items: [string, string][]) => items.map(([label, value]) => `${label}: ${value}`).join('\n');
// Mexico City wall time for the team's reminders ("martes 14 de octubre, 10:30").
export function formatWhen(iso: string | Date, withDate = true) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', ...(withDate ? { weekday: 'long', day: 'numeric', month: 'long' } : {}), hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

// Messages to clients: a person always reviews and edits them before sending. The defaults avoid promises about
// coverage and any Método AJ wording, which Ale defines.
export function defaultClientMessage(kind: ClientEmailKind, clientName: string): { subject: string; message: string } {
  const name = clientName.trim();
  if (kind === 'BIENVENIDA') return {
    subject: `Te damos la bienvenida a ${BRAND}`,
    message: `Hola ${name}:\n\nGracias por confiar en nosotros. Desde hoy te acompañamos con tus seguros: cuando tengas una duda, un cambio o una urgencia, escríbenos y te ayudamos.\n\nTe compartimos tus documentos para que los tengas a la mano.\n\nSaludos,`,
  };
  return {
    subject: 'Documentos de tu póliza',
    message: `Hola ${name}:\n\nTe compartimos los documentos adjuntos. Si algo no está claro, responde a este correo y lo revisamos contigo.\n\nSaludos,`,
  };
}
export function clientEmail({ subject, message, senderName, attachments, privacyUrl }: { subject: string; message: string; senderName: string; attachments: string[]; privacyUrl?: string | null }): Rendered {
  const signature = [senderName.trim(), BRAND].filter(Boolean);
  const files = attachments.length ? `<p style="margin:18px 0 6px;color:#5d6a63;font-size:13px">Adjuntos</p><ul style="margin:0 0 14px;padding-left:20px;font-size:14px">${attachments.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul>` : '';
  const privacy = safeUrl(privacyUrl);
  const html = layout({
    preheader: message.replace(/\s+/g, ' ').slice(0, 120),
    body: `${paragraphs(message)}${files}<p style="margin:18px 0 0">${signature.map(escapeHtml).join('<br>')}</p>`,
    footer: `Puedes responder a este correo para escribirle directamente a ${escapeHtml(senderName.trim() || 'tu asesor')}.${privacy ? ` Consulta nuestro <a href="${escapeHtml(privacy)}" style="color:#3f6b54">aviso de privacidad</a>.` : ''}`,
  });
  const text = [message.trim(), attachments.length ? `Adjuntos:\n${attachments.map(name => `- ${name}`).join('\n')}` : '', signature.join('\n'), privacy ? `Aviso de privacidad: ${privacy}` : ''].filter(Boolean).join('\n\n');
  return { subject: subject.trim(), html, text };
}

const teamFooter = 'Aviso automático de Sistema AJ. Puedes desactivarlo en Preferencias → Notificaciones.';
const agendaLead: Record<AgendaKind, (time: string) => string> = {
  AGENDA_1D: time => `Mañana a las ${time}`,
  AGENDA_DIA: time => `Hoy a las ${time}`,
  AGENDA_10M: () => 'En 10 minutos',
};
export function agendaReminder({ kind, title, startAt, endAt, location, meetUrl, googleUrl, appUrl }: { kind: AgendaKind; title: string; startAt: string; endAt: string; location: string; meetUrl: string | null; googleUrl: string | null; appUrl: string }): Rendered {
  const lead = agendaLead[kind](formatWhen(startAt, false));
  const items: [string, string][] = [['Cuándo', `${formatWhen(startAt)} – ${formatWhen(endAt, false)}`]];
  if (location.trim()) items.push(['Dónde', location.trim()]);
  const meet = safeUrl(meetUrl), google = safeUrl(googleUrl);
  if (meet) items.push(['Google Meet', meet]);
  const html = layout({
    preheader: `${lead}: ${title}`,
    body: `<p style="margin:0 0 6px;color:#5d6a63;font-size:13px">${escapeHtml(lead)}</p><h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>${rows(items)}${button(meet ?? google ?? `${appUrl}/agenda`, meet ? 'Entrar a la reunión' : 'Abrir en la agenda')}`,
    footer: teamFooter,
  });
  return { subject: `${lead}: ${title}`, html, text: [`${lead}: ${title}`, rowsText(items), `${appUrl}/agenda`, teamFooter].join('\n\n') };
}
// New records for the team. Claims never carry their description: it can hold health details.
export function prospectNotice({ name, phone, email, source, url }: { name: string; phone: string | null; email: string | null; source: string; url: string }): Rendered {
  const items: [string, string][] = [['Nombre', name]];
  if (phone) items.push(['Teléfono', phone]);
  if (email) items.push(['Correo', email]);
  items.push(['Origen', source === 'manual' ? 'Registro manual' : source]);
  const html = layout({ preheader: `Nuevo prospecto: ${name}`, body: `<h1 style="margin:0 0 14px;font-size:20px">Nuevo prospecto</h1>${rows(items)}${button(url, 'Abrir el prospecto')}`, footer: teamFooter });
  return { subject: `Nuevo prospecto: ${name}`, html, text: ['Nuevo prospecto', rowsText(items), url, teamFooter].join('\n\n') };
}
export function claimNotice({ reference, policyNumber, clientName, occurredAt, url }: { reference: string; policyNumber: string; clientName: string; occurredAt: string; url: string }): Rendered {
  const items: [string, string][] = [['Referencia', reference], ['Cliente', clientName], ['Póliza', policyNumber], ['Fecha del siniestro', occurredAt.slice(0, 10)]];
  const html = layout({ preheader: `Nuevo siniestro ${reference} de ${clientName}`, body: `<h1 style="margin:0 0 14px;font-size:20px">Nuevo siniestro</h1>${rows(items)}${button(url, 'Abrir el siniestro')}`, footer: teamFooter });
  return { subject: `Nuevo siniestro: ${reference} · ${clientName}`, html, text: ['Nuevo siniestro', rowsText(items), url, teamFooter].join('\n\n') };
}
