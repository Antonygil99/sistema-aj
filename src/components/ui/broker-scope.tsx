'use client';
import {createContext,useContext,type ReactNode} from 'react';
import type {AreaActor} from '@/modules/areas/policy';
const BrokerScope=createContext<AreaActor|undefined>(undefined);
export function BrokerScopeProvider({actor,children}:{actor:AreaActor;children:ReactNode}){return <BrokerScope.Provider value={actor}>{children}</BrokerScope.Provider>;}
export const useBrokerScope=()=>useContext(BrokerScope);
