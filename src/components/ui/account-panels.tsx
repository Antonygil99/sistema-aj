'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { tourForPath } from '@/modules/help/tours';
import { HelpCenter } from '../help-center';
import { SettingsDialog, type SettingsSection } from '../settings-dialog';
import { usePreferences } from './preferences';
import { useTours } from './tours';
type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
type AccountPanels = { openHelp: () => void; openSettings: (section?: SettingsSection) => void; darkActive: () => boolean; toggleDark: () => void };
const Context = createContext<AccountPanels | null>(null);
// The account panels (Help Center, Preferences) open from the sidebar account menu, the phone "Más" sheet and the
// notification panel, so they live once here instead of in each trigger.
export function AccountPanelsProvider({ role, children }: { role: Role; children: ReactNode }) {
  const pathname = usePathname();
  const { start } = useTours();
  const { preferences, update } = usePreferences();
  const [panel, setPanel] = useState<{ kind: 'help' } | { kind: 'settings'; section: SettingsSection } | null>(null);
  // The gradient theme is dark-based, so the quick switch shows as on and turning it off goes back to light.
  const darkActive = useCallback(() => preferences.theme === 'dark' || preferences.theme === 'gradient' || (preferences.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches), [preferences.theme]);
  const value = useMemo<AccountPanels>(() => ({
    openHelp: () => setPanel({ kind: 'help' }),
    openSettings: (section = 'apariencia') => setPanel({ kind: 'settings', section }),
    darkActive,
    toggleDark: () => update({ theme: darkActive() ? 'light' : 'dark' }),
  }), [darkActive, update]);
  return <Context.Provider value={value}>{children}
    <HelpCenter open={panel?.kind === 'help'} onClose={() => setPanel(null)} role={role} current={tourForPath(pathname)} onStart={id => { setPanel(null); start(id); }}/>
    <SettingsDialog open={panel?.kind === 'settings'} section={panel?.kind === 'settings' ? panel.section : 'apariencia'} onClose={() => setPanel(null)}/>
  </Context.Provider>;
}
export function useAccountPanels() {
  const value = useContext(Context);
  if (!value) throw new Error('useAccountPanels requires AccountPanelsProvider');
  return value;
}
