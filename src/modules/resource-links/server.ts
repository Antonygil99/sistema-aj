import 'server-only';
import {getDb} from '@/lib/db';
// The anonymous page must use this projection: no internal records, owners or audit metadata.
export function publicResourceLinks(){return getDb().crmResourceLink.findMany({where:{audience:'PUBLIC',active:true},orderBy:[{category:'asc'},{title:'asc'}],take:200,select:{id:true,title:true,description:true,category:true,insurer:true,url:true}});}
