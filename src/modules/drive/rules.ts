import {z} from 'zod';
export const driveScope='https://www.googleapis.com/auth/drive.metadata.readonly';
export const driveId=z.string().regex(/^[a-zA-Z0-9_-]{5,200}$/);
export const keySchema=z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
export const folderMime='application/vnd.google-apps.folder';
export class DriveError extends Error{constructor(public code:string,public status=422){super(code);}}
export function folderFromUrl(raw:string){
 try{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.username||u.password||u.port)throw Error();const match=/^\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)\/?$/.exec(u.pathname);if(!match)throw Error();return {folderId:driveId.parse(match[1]),resourceKey:u.searchParams.has('resourcekey')?keySchema.parse(u.searchParams.get('resourcekey')):null};}catch{throw new DriveError('DRIVE_FOLDER_URL');}
}
export function driveLink(id:string,key?:string|null,folder=false){const u=new URL(folder?'https://drive.google.com/drive/folders/'+driveId.parse(id):'https://drive.google.com/file/d/'+driveId.parse(id)+'/view');if(key)u.searchParams.set('resourcekey',keySchema.parse(key));return u.toString();}
