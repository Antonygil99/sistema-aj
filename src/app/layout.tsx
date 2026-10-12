import type { Metadata } from 'next';
import Link from 'next/link';
import { modules } from '@/modules/catalog';
import './globals.css';
export const metadata: Metadata = { title: 'Sistema AJ · CRM', description: 'CRM de seguros y operaciones AJ' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><div className="shell"><aside><Link href="/" className="brand">AJ<span>SISTEMA</span></Link><p className="nav-label">ESPACIO DE TRABAJO</p><nav aria-label="Navegación principal"><Link href="/">◈ &nbsp; Resumen</Link>{modules.map(m => <Link key={m.slug} href={'/crm/' + m.slug}>{m.label}</Link>)}</nav><div className="sidebar-note"><span className="dot"/> Base de desarrollo<br/><small>Operación conectada, paso a paso.</small></div></aside><div className="main"><header><span>CRM / Sistema AJ</span><span className="badge">Vista de demostración</span></header><main>{children}</main><footer>Sistema AJ · Seguros, relaciones y seguimiento.</footer></div></div></body></html>;
}
