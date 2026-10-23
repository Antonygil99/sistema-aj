import { FaWhatsapp } from 'react-icons/fa6';
import type { SVGProps } from 'react';
// Brand destinations use their actual marks; the rest of the CRM keeps Iconsax.
export function WhatsAppBrandIcon(props: SVGProps<SVGSVGElement>) {
  return <FaWhatsapp {...props} color="#25D366"/>;
}
export function GoogleCalendarBrandIcon() {
  // This tiny, local brand asset is already sized; no image optimization or client runtime is needed.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brands/google-calendar.png" alt="" aria-hidden="true" width={20} height={20} style={{ flexShrink: 0 }}/>;
}
