'use client';
import {createContext,useContext} from 'react';
import type {AppState} from '../lib/domain';
export type ArenaContext={state:AppState|null;busy:boolean;loading:boolean;error:string;act:(payload:Record<string,unknown>,message?:string)=>Promise<boolean>;reload:()=>Promise<void>};
export const Context=createContext<ArenaContext>(null!);
export const useArena=()=>useContext(Context);
