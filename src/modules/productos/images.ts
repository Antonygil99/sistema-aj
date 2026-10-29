// Presentation metadata only: bucket keys never enter the browser.
type Company={id:string;updatedAt?:string|Date;imageType?:string|null;useProductImage?:boolean;_count?:{products?:number}};
function companyOf(row:Record<string,unknown>|null|undefined){return row?.insurerProfile&&typeof row.insurerProfile==='object'?row.insurerProfile as Company:null;}
const version=(v:unknown)=>encodeURIComponent(v instanceof Date?v.toISOString():String(v??''));
export function productCompanyImage(row:Record<string,unknown>|null|undefined){const company=companyOf(row);return company&&typeof company.id==='string'&&(company.imageType||(company.useProductImage&&Number(company._count?.products)>0))?`/api/insurers/${encodeURIComponent(company.id)}/image?v=${version(company.updatedAt)}`:null;}
export function productImage(row:Record<string,unknown>){const inherited=productCompanyImage(row);return row.imageType||inherited?`/api/products/${encodeURIComponent(String(row.id))}/image?v=${version(row.updatedAt)}${!row.imageType&&inherited?'&insurer='+version(companyOf(row)?.updatedAt):''}`:null;}
