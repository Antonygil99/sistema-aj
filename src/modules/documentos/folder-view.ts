// How the document library shows its folder tree: colors, reachable folders and breadcrumbs. Pure and free of zod
// and server code, so the browser and the tests share it.
export const folderColors = [
  { id: 'lavanda', label: 'Lavanda' },
  { id: 'cielo', label: 'Cielo' },
  { id: 'arena', label: 'Arena' },
  { id: 'menta', label: 'Menta' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'gris', label: 'Gris' },
] as const;
export type FolderColor = typeof folderColors[number]['id'];
export const folderColorIds = folderColors.map(color => color.id) as [FolderColor, ...FolderColor[]];
export function isFolderColor(value: unknown): value is FolderColor {
  return typeof value === 'string' && folderColors.some(color => color.id === value);
}
// Folders without a chosen color take one of the library's first three tones, derived from the id so it never
// shifts when siblings are added, archived or filtered.
export function folderColorOf(folder: { id: string; color: string | null }): FolderColor {
  if (isFolderColor(folder.color)) return folder.color;
  let hash = 0;
  for (const char of folder.id) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return folderColors[hash % 3].id;
}
type TreeFolder = { id: string; name: string; parentId: string | null };
// The listing only carries active folders: one whose parent chain hits an archived (missing) folder is out of reach.
export function reachableFolders<T extends TreeFolder>(folders: T[]): T[] {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  return folders.filter(folder => {
    for (let parent = folder.parentId, seen = new Set([folder.id]); parent; ) {
      if (seen.has(parent)) return false;
      seen.add(parent);
      const next = byId.get(parent);
      if (!next) return false;
      parent = next.parentId;
    }
    return true;
  });
}
export function folderPath(folder: TreeFolder, folders: TreeFolder[]): string {
  const names = [folder.name];
  for (let parent = folder.parentId, seen = new Set([folder.id]); parent && !seen.has(parent);) {
    seen.add(parent);
    const next = folders.find(item => item.id === parent);
    if (!next) break;
    names.unshift(next.name);
    parent = next.parentId;
  }
  return names.join(' / ');
}
