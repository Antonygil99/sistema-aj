import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Sistema AJ · CRM', description: 'CRM de seguros y operaciones AJ' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
