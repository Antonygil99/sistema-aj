import { requireUser } from '@/lib/session';
import { WorkspaceShell } from '@/components/workspace-shell';
import './workspace.css';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  return <WorkspaceShell user={{ name: user.name, role: user.role }}>{children}</WorkspaceShell>;
}
