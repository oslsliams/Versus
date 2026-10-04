'use client';
import {createContext,useContext} from 'react';
import type {Person} from '../lib/domain';
export type Relationship={low:string;high:string;requester:string;state:'pending'|'accepted';created:number;updated:number};
export type SocialState={people:Person[];hasMore:boolean;relationships:Relationship[];contacts:Person[];blocked:Person[]};
export type SocialContextValue={data:SocialState|null;busy:boolean;error:string;refresh:()=>Promise<void>;act:(action:string,target:string)=>Promise<boolean>};
export const SocialContext=createContext<SocialContextValue>(null!);
export const useSocial=()=>useContext(SocialContext);
