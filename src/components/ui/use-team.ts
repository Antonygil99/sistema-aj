'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from './client-api';
export type Teammate = { email: string; name: string | null; role: string };
let cache: Promise<Teammate[]> | null = null;
// Teammates for "responsable" pickers; fetched once per page load and shared by every form.
export function useTeam() {
  const [team, setTeam] = useState<Teammate[]>([]);
  useEffect(() => {
    let alive = true;
    cache ??= apiFetch<{ data: Teammate[] }>('/api/team').then(result => result.data).catch(() => { cache = null; return []; });
    void cache.then(data => { if (alive) setTeam(data); });
    return () => { alive = false; };
  }, []);
  return team;
}
export const teammateLabel = (team: Teammate[], email: string | null | undefined) => {
  if (!email) return 'Sin asignar';
  const member = team.find(item => item.email === email.toLowerCase());
  return member?.name || email;
};
export const initials = (text: string) => text.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?';
