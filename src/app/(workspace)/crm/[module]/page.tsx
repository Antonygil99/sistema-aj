import Link from 'next/link';
import { Suspense } from 'react';
import { ModuleKpis } from '@/components/module-kpis';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'iconsax-reactjs';
import { modules } from '@/modules/catalog';
import { isResourceSlug } from '@/modules/resources/config';
import { DocumentsPage } from '@/components/documents-page';
import { DossiersPage } from '@/components/dossiers-page';
import { ResourcePage } from '@/components/resource-page';
import { DeliveryPage } from '@/components/delivery-page';
import { ViewLink } from '@/components/ui/view-link';
import { requireUser } from '@/lib/session';
import { getPreferences } from '@/modules/preferences-server';
export function generateStaticParams() { return modules.map(m => ({ module: m.slug })); }
export default async function ModulePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ q?: string; page?: string; view?: string; clientId?: string; open?: string; folder?: string; owner?: string }> }) {
  const slug = (await params).module;
  const search = await searchParams;
  const selected = modules.find(m => m.slug === slug);
  if (!selected) notFound();
  // Clients open as dossiers or as the editable list: an explicit ?view= wins, otherwise the user's last choice.
  const clientView = slug === 'clientes' ? search.view === 'list' || search.view === 'dossiers' ? search.view : (await getPreferences((await requireUser()).email)).views.clientes ?? 'dossiers' : null;
  const kpis = <Suspense fallback={<p role="status">Consultando indicadores…</p>}><ModuleKpis slug={selected.slug} clientId={slug === 'documentos' ? search.clientId || null : null}/></Suspense>;
  if (clientView === 'dossiers') return <><div className="eyebrow">RELACIONES / CLIENTES</div><h1>Expedientes</h1><p className="lead">Cada cliente, sus pólizas, sus pagos y sus documentos.</p>{kpis}<DossiersPage query={search.q} page={Number.isFinite(Number(search.page)) ? Math.floor(Number(search.page)) : 0}/></>;
  const heading = <>{slug === 'clientes' ? <ViewLink href="/crm/clientes?view=dossiers" remember={{ clientes: 'dossiers' }} className="back"><ArrowLeft size={16} aria-hidden="true"/> Ver como expedientes</ViewLink> : <Link href="/" className="back"><ArrowLeft size={16} aria-hidden="true"/> Volver al resumen</Link>}<div className="eyebrow">CRM / {selected.label.toUpperCase()}</div><h1>{slug === 'clientes' ? 'Lista de clientes' : selected.label}</h1><p className="lead">{selected.description}</p></>;
  if (slug === 'documentos') return <>{heading}{kpis}<DocumentsPage clientId={search.clientId || null} folderId={search.folder || null}/></>;
  if (slug === 'entregas') return <>{heading}{kpis}<DeliveryPage owner={search.owner} openId={search.open}/></>;
  if (!isResourceSlug(slug)) notFound();
  return <>{heading}{kpis}<ResourcePage slug={slug} query={search.q} openId={search.open}/></>;
}
