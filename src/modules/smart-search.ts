// Shared by browser filters and PostgreSQL search. Matching is deterministic, not an AI guess.
export const foldSearch=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const compactSearch=(value:string)=>foldSearch(value).replace(/ /g,'');
export function searchTerms(value:string){return [...new Set(foldSearch(value).split(' ').filter(Boolean))];}
export function matchesSearch(value:string,query:string){const terms=searchTerms(query);if(!terms.length)return !query.trim();const text=foldSearch(value);return terms.every(term=>text.includes(term))||compactSearch(value).includes(compactSearch(query));}
