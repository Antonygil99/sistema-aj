import { requireUser } from '@/lib/session';
import { normalizeEmail } from '@/lib/access-policy';
import { calendarOverview } from '@/modules/calendar/server';
import { CalendarManager } from '@/components/calendar-manager';
export default async function Agenda({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const user = await requireUser();
  const initial = await calendarOverview(user.id, normalizeEmail(user.email));
  const result = (await searchParams).calendar;
  return <><div className="eyebrow">ORGANIZACIÓN</div><h1>Mi agenda</h1><p>Reuniones y recordatorios de Sistema AJ en tu Google Calendar. Tu agenda es privada para tu cuenta.</p><CalendarManager initial={initial} connectionResult={result}/></>;
}
