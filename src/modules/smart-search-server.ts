import 'server-only';
import {Prisma} from '@/generated/prisma/client';
import {getDb} from '@/lib/db';
import {compactSearch,searchTerms} from './smart-search';
import {whatsAppPhoneSearch} from './whatsapp/recipient';

const clientJoin='LEFT JOIN "Client" c ON c.id=r."clientId"';
const policyJoin='LEFT JOIN "Policy" p ON p.id=r."policyId" LEFT JOIN "Client" c ON c.id=p."clientId"';
// Only these server-owned identifiers can enter raw SQL. Query text always uses bind parameters.
const sources={
 prospectos:{table:'Prospect',join:'',fields:['r.id','r.name','r.email','r.phone','r.vehicle','r."postalCode"']},
 clientes:{table:'Client',join:'LEFT JOIN "Policy" p ON p."clientId"=r.id AND p."archivedAt" IS NULL',fields:['r.id','r.name','r.email','r.phone','r."taxId"','p.number']},
 polizas:{table:'Policy',join:clientJoin,fields:['r.id','r.number','r.insurer','r.product','r.coverage','r.vehicle','r.plates','c.name','c.id','c."taxId"']},
 cotizaciones:{table:'Quote',join:clientJoin+' LEFT JOIN "Prospect" pr ON pr.id=r."prospectId"',fields:['r.id','r.reference','r.product','c.name','pr.name']},
 pagos:{table:'Payment',join:policyJoin,fields:['r.id','p.number','p.insurer','c.id','c.name']},
 renovaciones:{table:'Renewal',join:policyJoin,fields:['r.id','p.number','p.insurer','c.id','c.name']},
 siniestros:{table:'Claim',join:policyJoin,fields:['r.id','r.reference','p.number','p.insurer','c.name']},
 actividades:{table:'Activity',join:clientJoin+' LEFT JOIN "Policy" p ON p.id=r."policyId" LEFT JOIN "Prospect" pr ON pr.id=r."prospectId"',fields:['r.id','r.title','c.name','p.number','pr.name']},
 productos:{table:'Product',join:'',fields:['r.id','r.name','r.insurer','r.description','r.line::text']},
 documentos:{table:'Document',join:clientJoin+' LEFT JOIN "Policy" p ON p.id=r."policyId"',fields:['r.id','r.name','c.name','p.number']},
 carpetas:{table:'DocumentFolder',join:clientJoin,fields:['r.id','r.name','c.name']},
 aseguradoras:{table:'Insurer',join:'',fields:['r.id','r.name','r.description']},
 usuarios:{table:'AccessGrant',join:'LEFT JOIN "AuthUser" u ON lower(u.email)=lower(r.email)',fields:['r.id','r.email','u.name']},
 whatsapp:{table:'WhatsAppConversation',join:'',fields:['r.id','r."displayName"','r."contactId"']},
 agenda:{table:'CalendarMeeting',join:'',fields:['r.id','r.title','r.location']},
 tramites:{table:'InsuranceProcedure',join:policyJoin,fields:['r.id','p.number','p.insurer','c.name']},
 avisos:{table:'ClientNotice',join:clientJoin+' LEFT JOIN "Policy" p ON p.id=r."policyId"',fields:['r.id','r.kind::text','c.name','p.number']},
 recursos:{table:'CrmResourceLink',join:'',fields:['r.id','r.title','r.insurer','r.description','r.category::text']},
 plantillas:{table:'BrokerEmailTemplate',join:'',fields:['r.id','r.name','r.kind','r.subject']},
 auditoria:{table:'CrmEvent',join:'',fields:['r."actorName"','r."actorEmail"','r.label','r."recordId"']},
} as const;
export type SearchSource=keyof typeof sources;
type SearchOptions = { includePrivateNotes?: boolean };
// CRM-only text fields retain their existing search behavior. The MCP never opts in.
const privateNotes: Partial<Record<SearchSource, string>> = {
 renovaciones: 'r.notes', siniestros: 'r.description', actividades: 'r.description',
};
export function smartSearchSql(source:SearchSource,query:string,options:SearchOptions={}){
 const terms=searchTerms(query);if(!terms.length)return null;
 const {table,join}=sources[source];
 const note=options.includePrivateNotes?privateNotes[source]:undefined;
 const fields:readonly string[]=note?[...sources[source].fields,note]:sources[source].fields;
 const text=Prisma.sql`public.aj_search_fold(concat_ws(' ',${Prisma.join(fields.map(field=>Prisma.raw(field)))}))`;
 const words=Prisma.join(terms.map(term=>Prisma.sql`${text} LIKE ${'%'+term+'%'}`),' AND ');
 const compact=compactSearch(query);
 const identifiers=Prisma.join(fields.map(field=>Prisma.sql`public.aj_search_compact(${Prisma.raw(field)}::text) LIKE ${'%'+compact+'%'}`),' OR ');
 // Preserve Mexico's historical WhatsApp contact alias for lookup only, never for sending.
 const aliases=source==='whatsapp'?whatsAppPhoneSearch(query):[];
 const phones=aliases.length?Prisma.sql` OR (${Prisma.join(aliases.map(value=>Prisma.sql`r."contactId" LIKE ${'%'+value+'%'}`),' OR ')})`:Prisma.empty;
 return Prisma.sql`SELECT DISTINCT r.id FROM ${Prisma.raw('"'+table+'"')} r ${Prisma.raw(join)} WHERE ((${words}) OR (${identifiers})${phones})`;
}
// Scope/roles, archive/status filters, pagination and projections remain in the caller's ORM query.
// No names, documents or medical narratives are returned by this candidate query.
export async function smartSearchWhere(source:SearchSource,query:string,db:Pick<ReturnType<typeof getDb>,'$queryRaw'>=getDb(),options:SearchOptions={}){
 if(!query.trim())return {};
 const sql=smartSearchSql(source,query,options);
 const rows=sql?await db.$queryRaw<{id:string}[]>(sql):[];
 return {id:{in:rows.map(row=>row.id)}};
}
