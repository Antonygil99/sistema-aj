import type { Metadata } from 'next';
import { PublicIntake } from '@/components/public-intake';
import '@/components/intake.css';
export const metadata:Metadata={title:'Completa tu ficha · AJ',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <PublicIntake/>;}
