import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'iconsax-reactjs';
import { modules } from '@/modules/catalog';
import { isResourceSlug } from '@/modules/resources/config';
import { DocumentsPage } from '@/components/documents-page';
import { DossiersPage } from '@/components/dossiers-page';
import { ResourcePage } from '@/components/resource-page';
export function generateStaticParams() { return modules.map(m => ({ module: m.slug })); }
export default async function ModulePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ q?: string; page?: string; view?: string; clientId?: string; open?: string; folder?: string }> }) {
  const slug = (await params).module;
  const search = await searchParams;
  const selected = modules.find(m => m.slug === slug);
  if (!selected) notFound();
  if (slug === 'clientes' && search.view !== 'list') return <><div className="eyebrow">RELACIONES / CLIENTES</div><h1>Expedientes</h1><p className="lead">Cada cliente, sus pólizas, sus pagos y sus documentos.</p><DossiersPage query={search.q} page={Number.isFinite(Number(search.page)) ? Math.floor(Number(search.page)) : 0}/></>;
  const heading = <><Link href={slug === 'clientes' ? '/crm/clientes' : '/'} className="back"><ArrowLeft size={16} aria-hidden="true"/> {slug === 'clientes' ? 'Volver a expedientes' : 'Volver al resumen'}</Link><div className="eyebrow">CRM / {selected.label.toUpperCase()}</div><h1>{slug === 'clientes' ? 'Lista de clientes' : selected.label}</h1><p className="lead">{selected.description}</p></>;
  if (slug === 'documentos') return <>{heading}<DocumentsPage clientId={search.clientId || null} folderId={search.folder || null}/></>;
  if (!isResourceSlug(slug)) notFound();
  return <>{heading}<ResourcePage slug={slug} query={search.q} openId={search.open}/></>;
}
