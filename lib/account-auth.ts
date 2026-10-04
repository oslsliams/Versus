import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {getChatGPTUser, chatGPTSignInPath} from '../app/chatgpt-auth';
import {database} from '../db/store';

export const cloudflareAccounts = () => (env as unknown as {AUTH_MODE?: string}).AUTH_MODE === 'cloudflare';
export const sessionCookie = 'versus_session';
export const sessionLifetime = 30 * 24 * 60 * 60;
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
export async function digest(value: string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256'}, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2,'0')).join('');
}
export function equalHash(a: string, b: string) {let difference = a.length ^ b.length; for(let i=0;i<Math.max(a.length,b.length);i++) difference |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0);return difference===0;}
export function safeReturn(value: string | null) {if(!value || !value.startsWith('/') || value.startsWith('//'))return '/';const url=new URL(value,'https://versus.local');return url.origin==='https://versus.local' && !url.pathname.startsWith('/auth') && !url.pathname.startsWith('/recover') && !url.pathname.startsWith('/api/') ? url.pathname+url.search : '/';}
export function signInPath(returnTo: string) {return cloudflareAccounts() ? '/auth?return_to='+encodeURIComponent(safeReturn(returnTo)) : chatGPTSignInPath(returnTo);}
export async function getAccountUser() {
  if(!cloudflareAccounts()) return getChatGPTUser();
  const h=await headers();const token=(h.get('cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
  if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
  const account=await database().prepare('SELECT a.id, a.email FROM auth_sessions s JOIN auth_accounts a ON a.id=s.user WHERE s.token_hash=? AND s.expires>? AND s.version=a.password_version').bind(await digest(token), Date.now()).first<{id:string;email:string}>();
  return account ? {userId:account.id,email:account.email,displayName:account.email,fullName:null} : null;
}
