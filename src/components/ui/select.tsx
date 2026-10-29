'use client';

import {Children,isValidElement,useEffect,useId,useRef,useState,type ReactNode,type SelectHTMLAttributes,type ChangeEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown2,TickCircle} from '@/components/icons';
import {portalTarget} from './modal';
import './select.css';

type Option={value:string;label:string;disabled:boolean;group?:string};
type Props=Omit<SelectHTMLAttributes<HTMLSelectElement>,'multiple'|'size'>;
function textOf(node:ReactNode):string{return Children.toArray(node).map(n=>typeof n==='string'||typeof n==='number'?String(n):isValidElement<{children?:ReactNode}>(n)?textOf(n.props.children):'').join('');}
function optionsOf(children:ReactNode,group?:string,groupDisabled=false):Option[]{return Children.toArray(children).flatMap(node=>{
 if(!isValidElement<{children?:ReactNode;value?:string|number;disabled?:boolean;label?:string}>(node))return [];
 if(node.type==='option'){const label=node.props.label??textOf(node.props.children);return [{value:String(node.props.value??label),label,disabled:groupDisabled||!!node.props.disabled,group}];}
 return optionsOf(node.props.children,node.type==='optgroup'?node.props.label:group,groupDisabled||!!node.props.disabled);
});}
const folded=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();

// The hidden select retains native FormData/GET-form behavior and React change events.
// The visible control and portaled listbox replace the operating-system popup everywhere in the CRM.
export function Select({children,value,defaultValue,onChange,onInvalid,id,disabled,required,className='',style,...props}:Props){
 const options=optionsOf(children),initial=String(defaultValue??options.find(o=>!o.disabled)?.value??'');
 const [local,setLocal]=useState(initial),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[invalid,setInvalid]=useState(false);
 const [place,setPlace]=useState<{left:number;width:number;top?:number;bottom?:number;maxHeight:number}|null>(null);
 const native=useRef<HTMLSelectElement>(null),trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),field=useRef<HTMLSpanElement>(null),search=useRef({text:'',at:0});
 const uid=useId(),controlId=id??'select-'+uid,listId='select-options-'+uid,current=String(value??local);
 const selected=options.find(o=>o.value===current)??options.find(o=>!o.disabled),enabled=options.flatMap((o,i)=>o.disabled?[]:[i]);
 const attributes=Object.fromEntries(Object.entries(props).filter(([key])=>key.startsWith('aria-')||key.startsWith('data-')));
 function show(index=options.findIndex(o=>o.value===current&&!o.disabled)){
  if(disabled||native.current?.matches(':disabled'))return;
  setActive(index>=0?index:enabled[0]??-1);setOpen(true);
 }
 function choose(index:number){
  const option=options[index];if(!option||option.disabled||native.current?.matches(':disabled'))return;
  setOpen(false);setInvalid(false);
  if(native.current&&option.value!==current){native.current.value=option.value;native.current.dispatchEvent(new Event('change',{bubbles:true}));}
  trigger.current?.focus({preventScroll:true});
 }
 function changed(event:ChangeEvent<HTMLSelectElement>){setLocal(event.target.value);setInvalid(false);onChange?.(event);}
 useEffect(()=>{
  if(!open)return;
  function position(){
   const r=trigger.current?.getBoundingClientRect();if(!r)return;
   const viewport=window.visualViewport,h=viewport?.height??innerHeight,w=viewport?.width??innerWidth,offsetY=viewport?.offsetTop??0,offsetX=viewport?.offsetLeft??0;
   const below=h+offsetY-r.bottom-14,above=r.top-offsetY-14,up=below<Math.min(240,options.length*40+16)&&above>below;
   const width=Math.min(Math.max(r.width,200),w-16),maxHeight=Math.max(64,Math.min(320,up?above:below));
   setPlace({left:Math.max(offsetX+8,Math.min(r.left,w+offsetX-width-8)),width,maxHeight,...(up?{bottom:innerHeight-r.top+6}:{top:r.bottom+6})});
  }
  position();
  function outside(event:Event){const n=event.target;if(n instanceof Node&&!field.current?.contains(n)&&!popup.current?.contains(n))setOpen(false);}
  function escape(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus({preventScroll:true});}}
  function scroll(event:Event){if(event.target instanceof Node&&popup.current?.contains(event.target))return;position();}
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape,true);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape,true);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);};
 },[open,options.length]);
 useEffect(()=>{const list=popup.current,item=list?.querySelector<HTMLElement>('[data-active=true]');if(!open||!list||!item)return;const top=item.offsetTop,bottom=top+item.offsetHeight;if(top<list.scrollTop)list.scrollTop=top;else if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=bottom-list.clientHeight;},[open,active,place]);
 useEffect(()=>{const form=native.current?.form;if(!form||value!==undefined)return;const reset=()=>setLocal(initial);form.addEventListener('reset',reset);return()=>form.removeEventListener('reset',reset);},[initial,value]);
 function keyDown(event:React.KeyboardEvent<HTMLButtonElement>){
  if(event.key==='Tab'){setOpen(false);return;}
  if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(active);else show();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();if(!open){show(event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):undefined);return;}
   const at=enabled.indexOf(active),index=event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):enabled[(at+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length];setActive(index??-1);return;
  }
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   event.preventDefault();const now=Date.now(),letter=folded(event.key);search.current={text:now-search.current.at>650?letter:search.current.text+letter,at:now};
   const prefix=search.current.text.split('').every(c=>c===letter)?letter:search.current.text;
   const ordered=[...enabled.filter(i=>i>active),...enabled.filter(i=>i<=active)],match=ordered.find(i=>folded(options[i].label).startsWith(prefix));if(match!==undefined){if(!open)show(match);else setActive(match);}
  }
 }
 const target=open&&place?portalTarget():null;
 return <span ref={field} className="aj-select">
  <button {...attributes} ref={trigger} id={controlId} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined} aria-activedescendant={open&&active>=0?listId+'-'+active:undefined} aria-required={required||undefined} aria-invalid={invalid||props['aria-invalid']} disabled={disabled} className={'aj-select-trigger '+className} style={style} onClick={()=>open?setOpen(false):show()} onKeyDown={keyDown}>
   <span className="aj-select-value">{selected?.label??'Seleccionar'}</span><ArrowDown2 aria-hidden="true"/>
  </button>
  <select {...props} ref={native} hidden aria-hidden="true" tabIndex={-1} data-native-select="true" disabled={disabled} required={required} value={value===undefined?local:value} onChange={changed} onInvalid={event=>{event.preventDefault();setInvalid(true);trigger.current?.focus();onInvalid?.(event);}}>{children}</select>
  {target?createPortal(<div ref={popup} id={listId} role="listbox" aria-label={props['aria-label']??'Opciones'} className="aj-select-popup" style={place!}>
   {options.map((option,index)=><span key={index} className="aj-select-option-group">
    {option.group&&option.group!==options[index-1]?.group?<span className="aj-select-group-label">{option.group}</span>:null}
    <span id={listId+'-'+index} role="option" aria-selected={option.value===selected?.value} aria-disabled={option.disabled||undefined} data-active={active===index} className="aj-select-option" onPointerDown={event=>event.preventDefault()} onMouseMove={()=>{if(!option.disabled)setActive(index);}} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===selected?.value?<TickCircle aria-hidden="true"/>:null}</span>
   </span>)}
   {!options.length?<span className="aj-select-empty">Sin opciones disponibles</span>:null}
  </div>,target):null}
 </span>;
}
