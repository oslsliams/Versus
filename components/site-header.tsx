'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Crown,Menu,Search,Settings,Trophy,Users,UserRound,X} from 'lucide-react';
import type {AppState} from '../lib/domain';
import UserAvatar from './user-avatar';
import SignOut from './sign-out';

// VERSUS is a career game now: the game is home, the real-fighter archive lives under Legends.
const primary=[['','Career',Trophy],['legends','Legends',Users]] as const;

export default function SiteHeader({route,signedIn,signIn,accountMode,me,requests,onSearch}:{route:string;signedIn:boolean;signIn:string;accountMode:boolean;me:AppState['me']|undefined;requests:number;onSearch:()=>void}){
  const[menu,setMenu]=useState(false),[account,setAccount]=useState(false);
  const header=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null),accountButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!header.current?.contains(event.target as Node)){setMenu(false);setAccount(false);}};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&(menu||account)){event.preventDefault();(account?accountButton:menuButton).current?.focus();setMenu(false);setAccount(false);}};
    const resize=()=>{setMenu(false);setAccount(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',resize);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',resize);};
  },[menu,account]);
  const isActive=(href:string)=>href===''?route==='':route===href||(href==='legends'&&(route==='fighter'||route==='fighters'));
  return <header ref={header} className="header polished-header">
    <a href="/" className="logo" aria-label="VERSUS home">VERSUS<span className="logo-mark">/</span></a>
    <nav id="site-navigation" className={`nav site-navigation${menu?' open':''}`} aria-label="Main navigation">
      {primary.map(([href,label,Icon])=><a key={href} href={`/${href}`} className={isActive(href)?'active':''} aria-current={isActive(href)?'page':undefined}><Icon size={17}/><span>{label}</span></a>)}
    </nav>
    <div className="header-actions">
      <button className="icon-button quick-search-button" onClick={()=>{setAccount(false);setMenu(false);onSearch();}} aria-label="Search fighters" title="Search · Ctrl / ⌘ K"><Search size={19}/></button>
      {signedIn?<div className="account-navigation">
        <button ref={accountButton} className="profile-chip account-toggle" aria-label="Open account menu" aria-expanded={account} aria-controls="account-navigation" onClick={()=>{setAccount(!account);setMenu(false);}}>{me?<UserAvatar person={me}/>:<UserRound size={20}/>}<span className="account-name">{me?.username??'Account'}</span><ChevronDown size={14}/>{requests>0&&<span className="account-notification" aria-label="New friend requests"/>}</button>
        {account&&<div id="account-navigation" className="account-dropdown"><span className="account-menu-heading">{me?.username??'Your account'}</span><a href="/profile"><UserRound size={17}/>Your profile</a><a href={requests?'/people?tab=requests':'/people'}><Users size={17}/>Friends & accounts{requests>0&&<span className="account-request-count">{requests}</span>}</a>{accountMode&&<><a href="/settings"><Settings size={17}/>Account settings</a>{!!me?.owner&&<a href="/owner"><Crown size={17}/>Owner controls</a>}<div className="account-menu-divider"/><SignOut/></>}</div>}
      </div>:<div className="auth-links"><a href={signIn} target="_top" className="button ghost">Sign in</a>{accountMode&&<a href={signIn+'&mode=signup'} className="button primary">Join VERSUS</a>}</div>}
      <button ref={menuButton} className="menu-toggle icon-button" aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} aria-controls="site-navigation" onClick={()=>{setMenu(!menu);setAccount(false);}}>{menu?<X/>:<Menu/>}</button>
    </div>
  </header>;
}
