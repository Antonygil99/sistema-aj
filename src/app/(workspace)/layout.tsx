import { requireUser } from '@/lib/session';
import { getPreferences } from '@/modules/preferences-server';
import { WorkspaceShell } from '@/components/workspace-shell';
import './theme.css';
import './workspace.css';
import './help.css';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const preferences = await getPreferences(user.email);
  return <WorkspaceShell user={{ name: user.name, email: user.email, image: user.image, role: user.role }} preferences={preferences}>{children}</WorkspaceShell>;
}
