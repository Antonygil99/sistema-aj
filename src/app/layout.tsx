import type { Metadata } from 'next';
import { Baskervville } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
// Both families are self-hosted at build time; the browser never calls Google Fonts.
const serif = Baskervville({ subsets: ['latin', 'latin-ext'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const sans = localFont({
  src: [
    { path: '../../node_modules/@clr/city/Webfonts/WOFF2/ClarityCity-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../node_modules/@clr/city/Webfonts/WOFF2/ClarityCity-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../node_modules/@clr/city/Webfonts/WOFF2/ClarityCity-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../node_modules/@clr/city/Webfonts/WOFF2/ClarityCity-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});
export const metadata: Metadata = { title: 'Sistema AJ · CRM', description: 'CRM de seguros y operaciones AJ' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className={`${serif.variable} ${sans.variable}`}><body>{children}</body></html>;
}
