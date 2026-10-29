'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Add,ArrowDown2,Eraser,Link2,More,TextBold,TextItalic,TextalignLeft} from '@/components/icons';
import {renderRichText,safeEmailLink} from '@/modules/email/rich-text';
import {placeholderLabels,type Placeholder} from '@/modules/email/template-text';
import './email-editor.css';

function sourceOf(node:Node):string {
 if(node.nodeType===Node.TEXT_NODE)return node.textContent??'';
 if(!(node instanceof HTMLElement))return '';
 if(node.dataset.variable)return '{'+node.dataset.variable+'}';
 const value=Array.from(node.childNodes).map(sourceOf).join('');
 switch(node.tagName){case 'BR':return '\n';case 'STRONG':case 'B':return '**'+value+'**';case 'EM':case 'I':return '_'+value+'_';case 'LI':return '- '+value.trim()+'\n';case 'UL':case 'OL':return '\n'+value;case 'DIV':case 'P':return (node.previousSibling?'\n':'')+value;case 'A':return safeEmailLink(node.getAttribute('href')??'')?'['+value+']('+node.getAttribute('href')+')':value;default:return value;}
}

type Panel='variables'|'more'|'link'|null;
export function RichEmailEditor({value,onChange,label,variables=[],disabled=false,singleLine=false}:{value:string;onChange:(value:string)=>void;label:string;variables?:readonly Placeholder[];disabled?:boolean;singleLine?:boolean}){
 const field=useRef<HTMLDivElement>(null),root=useRef<HTMLDivElement>(null),last=useRef<string|undefined>(undefined),range=useRef<Range|null>(null),trigger=useRef<HTMLButtonElement|null>(null);
 const [panel,setPanel]=useState<Panel>(null),[link,setLink]=useState(''),[error,setError]=useState(''),[format,setFormat]=useState({bold:false,italic:false,list:false});
 const popupId=useId();
 useLayoutEffect(()=>{if(root.current&&last.current!==value){root.current.innerHTML=renderRichText(value,true);last.current=value;}},[value]);
 useEffect(()=>{
  if(!panel)return;
  const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!field.current?.contains(e.target))setPanel(null);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setPanel(null);trigger.current?.focus();}};
  const popup=field.current?.querySelector<HTMLElement>('.email-editor-popover');
  popup?.querySelector<HTMLElement>('input,button')?.focus();
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
 },[panel]);
 function remember(){const s=window.getSelection();if(s?.rangeCount&&root.current?.contains(s.anchorNode)){range.current=s.getRangeAt(0).cloneRange();setFormat({bold:document.queryCommandState('bold'),italic:document.queryCommandState('italic'),list:document.queryCommandState('insertUnorderedList')});}}
 function emit(){if(!root.current)return;const s=Array.from(root.current.childNodes).map(sourceOf).join('').replace(/\n{3,}/g,'\n\n').trimEnd();const next=singleLine?s.replace(/\s+/g,' '):s;last.current=next;onChange(next);remember();}
 function command(name:string,arg?:string){
  if(disabled||!root.current)return;
  setPanel(null);root.current.focus();
  const s=window.getSelection();
  if(range.current&&root.current.contains(range.current.commonAncestorContainer)){s?.removeAllRanges();s?.addRange(range.current);}else{const r=document.createRange();r.selectNodeContents(root.current);r.collapse(false);s?.removeAllRanges();s?.addRange(r);}
  document.execCommand(name,false,arg);emit();
 }
 function open(next:Exclude<Panel,null>,button:HTMLButtonElement){remember();trigger.current=button;setError('');if(next==='link')setLink('');setPanel(p=>p===next?null:next);}
 const insert=variables.length?<button type="button" className="email-insert-data" disabled={disabled} aria-expanded={panel==='variables'} aria-controls={panel==='variables'?popupId:undefined} onMouseDown={e=>e.preventDefault()} onClick={e=>open('variables',e.currentTarget)}><Add aria-hidden="true"/><span>Insertar dato</span><ArrowDown2 aria-hidden="true"/></button>:null;
 return <div className="rich-email-field" ref={field} onBlur={e=>{if(e.relatedTarget instanceof Node&&!e.currentTarget.contains(e.relatedTarget))setPanel(null);}}>
  <span className="form-label">{label}</span>
  <div className={'email-editor-frame'+(singleLine?' is-subject':'')}>
   <div ref={root} role="textbox" aria-label={label} aria-multiline={!singleLine} aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning className="rich-email-input" data-placeholder={singleLine?'Escribe el asunto…':'Escribe tu mensaje…'} onInput={emit} onMouseDown={()=>setPanel(null)} onMouseUp={remember} onKeyUp={remember} onKeyDown={e=>{if(singleLine&&(e.key==='Enter'||((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase()))))e.preventDefault();}} onPaste={e=>{e.preventDefault();command('insertText',e.clipboardData.getData('text/plain'));}} onDrop={e=>e.preventDefault()}/>
   {singleLine?insert:<div className="email-editor-footer">
    <div role="toolbar" aria-label={'Formato de '+label} className="email-format-tools">
     <button type="button" aria-label="Negrita" title="Negrita" aria-pressed={format.bold} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('bold')}><TextBold aria-hidden="true"/></button>
     <button type="button" aria-label="Cursiva" title="Cursiva" aria-pressed={format.italic} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('italic')}><TextItalic aria-hidden="true"/></button>
     <span className="email-toolbar-divider"/>
     <button type="button" aria-label="Lista" title="Lista" aria-pressed={format.list} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertUnorderedList')}><TextalignLeft aria-hidden="true"/></button>
     <button type="button" aria-label="Enlace" title="Insertar enlace" disabled={disabled} aria-expanded={panel==='link'} onMouseDown={e=>e.preventDefault()} onClick={e=>open('link',e.currentTarget)}><Link2 aria-hidden="true"/></button>
     <button type="button" aria-label="Más formato" title="Más formato" disabled={disabled} aria-expanded={panel==='more'} onMouseDown={e=>e.preventDefault()} onClick={e=>open('more',e.currentTarget)}><More aria-hidden="true"/></button>
    </div>{insert}
   </div>}
   {panel?<div id={popupId} role="dialog" aria-label={panel==='variables'?'Insertar dato':panel==='link'?'Insertar enlace':'Más formato'} className={'email-editor-popover is-'+panel}>
    {panel==='variables'?<><p className="email-popover-heading">Datos del cliente</p><p className="email-popover-hint">Se completan al preparar el correo.</p><div className="email-variable-options">{variables.map(name=><button type="button" disabled={disabled} key={name} onMouseDown={e=>e.preventDefault()} onClick={()=>{command('insertHTML',renderRichText('{'+name+'}',true).replace(/<br>$/,''));setPanel(null);}}>{placeholderLabels[name]}</button>)}</div></>:null}
    {panel==='more'?<button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>{command('removeFormat');setPanel(null);}}><Eraser aria-hidden="true"/>Quitar formato</button>:null}
    {panel==='link'?<><label className="email-link-label">Dirección del enlace<input type="url" value={link} placeholder="https://" onChange={e=>setLink(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();field.current?.querySelector<HTMLButtonElement>('.email-link-save')?.click();}}}/></label><p className="email-popover-hint">Selecciona el texto que quieres enlazar.</p><div className="email-link-actions"><button type="button" onClick={()=>{setPanel(null);trigger.current?.focus();}}>Cancelar</button><button type="button" className="email-link-save" onClick={()=>{const url=safeEmailLink(link);if(!url){setError('Usa un enlace HTTPS sin credenciales.');return;}command('createLink',url);setPanel(null);setError('');}}>Insertar enlace</button></div>{error?<p className="field-error" role="alert">{error}</p>:null}</>:null}
   </div>:null}
  </div>
 </div>;
}
