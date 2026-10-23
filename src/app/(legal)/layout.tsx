import Link from 'next/link';
import './legal.css';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <div className="aj-legal">
    <header><Link href="/login" aria-label="Sistema AJ, inicio">Sistema AJ<span>CRM de seguros</span></Link><span>Información y privacidad</span></header>
    <main id="contenido">{children}</main>
    <footer><strong>Sistema AJ</strong><nav aria-label="Información legal"><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Condiciones del servicio</Link><Link href="/eliminacion-de-datos">Eliminar mis datos</Link></nav><p>Contacto: <a href="mailto:gilantonio656@gmail.com">gilantonio656@gmail.com</a></p></footer>
  </div>;
}
