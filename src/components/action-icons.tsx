import type {IconProps} from './icons';
// Iconsax has no unordered-list glyph. Extend its 24px / 1.5px linear style with actual bullets.
export function BulletListIcon({size=24,color,style,...props}:Omit<IconProps,'variant'>){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={color?{color,...style}:style} {...props}>
  <circle cx="4" cy="6" r="1.25" fill="currentColor"/><circle cx="4" cy="12" r="1.25" fill="currentColor"/><circle cx="4" cy="18" r="1.25" fill="currentColor"/>
  <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
 </svg>;
}
