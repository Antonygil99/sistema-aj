import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'iconsax-reactjs';
import { modules } from '@/modules/catalog';
import { DocumentsPage } from '@/components/documents-page';
import { ContactsPage } from '@/components/contacts-page';
export function generateStaticParams() { return modules.map(m => ({ module: m.slug })); }
export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const slug = (await params).module;
  const selected = modules.find(m => m.slug === slug);
  if (!selected) notFound();
  if (slug === 'prospectos' || slug === 'clientes') return <><Link href="/" className="back"><ArrowLeft size={16} aria-hidden="true"/> Volver al resumen</Link><div className="eyebrow">CRM / {selected.label.toUpperCase()}</div><h1>{selected.label}</h1><p className="lead">{selected.description}</p><ContactsPage slug={slug}/></>;
  if (slug === 'documentos') return <><Link href="/" className="back"><ArrowLeft size={16} aria-hidden="true"/> Volver al resumen</Link><div className="eyebrow">CRM / DOCUMENTOS</div><h1>Documentos</h1><p className="lead">Archivos y multimedia de tus expedientes.</p><DocumentsPage/></>;
  return <><Link href="/" className="back"><ArrowLeft size={16} aria-hidden="true"/> Volver al resumen</Link><div className="eyebrow">CRM / {selected.label.toUpperCase()}</div><h1>{selected.label}</h1><p className="lead">{selected.description}</p><section className="empty"><span className="index">AJ / {selected.label}</span><h2>El espacio está preparado.</h2><p>Este módulo dispone de un modelo de datos, validación y rutas para listar y crear registros. La interfaz de captura y edición se implementará en la siguiente etapa.</p><code>/api/crm/{selected.slug}</code><p>Configura PostgreSQL y usa la API con un token de servidor. Esta pantalla no muestra datos reales.</p></section></>;
}
