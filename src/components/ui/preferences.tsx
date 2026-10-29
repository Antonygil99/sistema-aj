'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { mergePreferences, type Preferences, type PreferencesPatch } from '@/modules/preferences';
type PreferencesContext = { preferences: Preferences; update: (patch: PreferencesPatch) => void; applySaved:(patch:PreferencesPatch)=>void };
const Context = createContext<PreferencesContext | null>(null);
// Saves in the background: keepalive lets the request finish even when the click also navigates away.
export function savePreferencesPatch(patch: PreferencesPatch) {
  return fetch('/api/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch), keepalive: true, credentials: 'same-origin' })
    .then(response => { if (!response.ok) throw new Error(`PREFERENCES_${response.status}`); })
    .catch(() => { /* A preference that fails to save only means the default view next time. */ });
}
export function PreferencesProvider({ initial, children }: { initial: Preferences; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initial);
  const applySaved=useCallback((patch:PreferencesPatch)=>setPreferences(current=>mergePreferences(current,patch)),[]);
  const update = useCallback((patch: PreferencesPatch) => {
    setPreferences(current => mergePreferences(current, patch));
    void savePreferencesPatch(patch);
  }, []);
  const value = useMemo(() => ({ preferences, update,applySaved }), [preferences, update,applySaved]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error('usePreferences requires PreferencesProvider');
  return value;
}
