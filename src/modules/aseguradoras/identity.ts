// Keep aligned with the migration: collapse whitespace and case, without fuzzy merging company names.
export const insurerKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLowerCase();
