'use client';
// Compact site menu.
//  - Desktop: logo, two dropdown groups (Play, Explore), search, and the account menu (or Sign in / Join).
//  - Phones and small screens: logo, search and a menu button that opens a slide-out panel listing every section.
// Dropdowns open on click (not hover), close on Escape or a click outside, and return focus to their button.
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,Crown,Gamepad2,Lightbulb,LogIn,Menu,Search,Settings,Swords,Trophy,Users,UserRound,UserPlus,X,BarChart3,Compass} from 'lucide-react';
import type {AppState} from '../lib/domain';
import UserAvatar from './user-avatar';
import SignOut from './sign-out';

type Item={href:string;label:string;hint:string;Icon:typeof Trophy;match:(route:string,mode:string)=>boolean};
const PLAY:Item[]=[
  {href:'/',label:'Career',hint:'Build a fighter and climb to the belt',Icon:Trophy,match:(r,m)=>!r&&m!=='quick'},
  {href:'/?mode=quick',label:'Quick fight',hint:'Jump straight into a live fight',Icon:Swords,match:(r,m)=>!r&&m==='quick'},
];
const EXPLORE:Item[]=[
  {href:'/legends',label:'Legends',hint:'Real UFC fighters and their records',Icon:Users,match:r=>r==='legends'||r==='fighter'||r==='fighters'},
  {href:'/suggestions',label:'Suggestions',hint:'Ideas and feedback for VERSUS',Icon:Lightbulb,match:r=>r==='suggestions'},
];

export default function SiteHeader({route,signedIn,signIn,accountMode,me,requests,onSearch}:{route:string;signedIn:boolean;signIn:string;accountMode:boolean;me:AppState['me']|undefined;requests:number;onSearch:()=>void}){
  const[open,setOpen]=useState<null|'play'|'explore'|'account'>(null);
  const[drawer,setDrawer]=useState(false);
  const[mode,setMode]=useState('');
  const header=useRef<HTMLElement>(null),drawerRef=useRef<HTMLDivElement>(null),menuButton=useRef<HTMLButtonElement>(null);
  const buttons=useRef<Record<string,HTMLButtonElement|null>>({});
  const[mounted,setMounted]=useState(false);
  useEffect(()=>{setMode(new URLSearchParams(location.search).get('mode')??'');setMounted(true);},[]);
  // dropdowns: close on outside click / Escape
  useEffect(()=>{
    if(!open)return;
    const outside=(e:PointerEvent)=>{if(!header.current?.contains(e.target as Node))setOpen(null);};
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();buttons.current[open]?.focus();setOpen(null);}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',esc);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',esc);};
  },[open]);
  // slide-out panel: lock page scroll, focus the panel, keep Tab inside it, Escape closes
  useEffect(()=>{
    if(!drawer)return;
    const prev=document.body.style.overflow;document.body.style.overflow='hidden';
    const panel=drawerRef.current;panel?.querySelector<HTMLElement>('a,button')?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();setDrawer(false);menuButton.current?.focus();return;}
      if(e.key!=='Tab'||!panel)return;
      const f=[...panel.querySelectorAll<HTMLElement>('a,button')];if(!f.length)return;
      if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus();}
      else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus();}
    };
    const wide=()=>{if(window.innerWidth>900)setDrawer(false);};
    document.addEventListener('keydown',key);window.addEventListener('resize',wide);
    return()=>{document.body.style.overflow=prev;document.removeEventListener('keydown',key);window.removeEventListener('resize',wide);};
  },[drawer]);
  const active=(i:Item)=>i.match(route,mode);
  const groupActive=(items:Item[])=>items.some(active);
  const link=(i:Item,onClick?:()=>void)=><a key={i.href} href={i.href} className={active(i)?'active':''} aria-current={active(i)?'page':undefined} onClick={onClick}><i.Icon size={18} aria-hidden="true"/><span><strong>{i.label}</strong><small>{i.hint}</small></span></a>;
  const dropdown=(id:'play'|'explore',label:string,Icon:typeof Trophy,items:Item[])=><div className="nav-group">
    <button ref={el=>{buttons.current[id]=el;}} className={`nav-trigger${groupActive(items)?' active':''}`} aria-expanded={open===id} aria-controls={`nav-${id}`} onClick={()=>setOpen(open===id?null:id)}><Icon size={17} aria-hidden="true"/>{label}<ChevronDown size={14} aria-hidden="true"/></button>
    {open===id&&<div id={`nav-${id}`} className="nav-dropdown">{items.map(i=>link(i,()=>setOpen(null)))}</div>}
  </div>;
  const accountLinks=<>
    <a href="/profile"><UserRound size={18} aria-hidden="true"/><span><strong>Your profile</strong></span></a>
    <a href={requests?'/people?tab=requests':'/people'}><Users size={18} aria-hidden="true"/><span><strong>Friends &amp; accounts</strong></span>{requests>0&&<span className="account-request-count">{requests}</span>}</a>
    {accountMode&&<a href="/settings"><Settings size={18} aria-hidden="true"/><span><strong>Account settings</strong></span></a>}
    {accountMode&&!!me?.owner&&<a href="/owner"><Crown size={18} aria-hidden="true"/><span><strong>Owner controls</strong></span></a>}
    {accountMode&&!!me?.owner&&<a href="/analytics"><BarChart3 size={18} aria-hidden="true"/><span><strong>Analytics</strong></span></a>}
  </>;
  return <header ref={header} className="header polished-header compact-header">
    <a href="/" className="logo" aria-label="VERSUS home">VERSUS<span className="logo-mark">/</span></a>
    <nav className="nav-desktop" aria-label="Main navigation">
      {dropdown('play','Play',Gamepad2,PLAY)}
      {dropdown('explore','Explore',Compass,EXPLORE)}
    </nav>
    <div className="header-actions">
      <button className="icon-button quick-search-button" onClick={()=>{setOpen(null);onSearch();}} aria-label="Search fighters and pages" title="Search · Ctrl / ⌘ K"><Search size={19}/></button>
      <div className="header-account">
        {signedIn?<div className="account-navigation">
          <button ref={el=>{buttons.current.account=el;}} className="profile-chip account-toggle" aria-label="Open account menu" aria-expanded={open==='account'} aria-controls="account-navigation" onClick={()=>setOpen(open==='account'?null:'account')}>{me?<UserAvatar person={me}/>:<UserRound size={20}/>}<span className="account-name">{me?.username??'Account'}</span><ChevronDown size={14}/>{requests>0&&<span className="account-notification" aria-label="New friend requests"/>}</button>
          {open==='account'&&<div id="account-navigation" className="account-dropdown nav-dropdown"><span className="account-menu-heading">{me?.username??'Your account'}</span>{accountLinks}{accountMode&&<><div className="account-menu-divider"/><SignOut/></>}</div>}
        </div>:<div className="auth-links"><a href={signIn} target="_top" className="button ghost">Sign in</a>{accountMode&&<a href={signIn+'&mode=signup'} className="button primary">Join VERSUS</a>}</div>}
      </div>
      <button ref={menuButton} className="menu-toggle icon-button" aria-label="Open menu" aria-expanded={drawer} aria-controls="site-drawer" onClick={()=>{setOpen(null);setDrawer(true);}}><Menu/>{requests>0&&<span className="account-notification" aria-hidden="true"/>}</button>
    </div>
    {mounted&&createPortal(<>
    {drawer&&<div className="nav-scrim" onClick={()=>setDrawer(false)} aria-hidden="true"/>}
    <div id="site-drawer" ref={drawerRef} className={`nav-drawer${drawer?' open':''}`} role="dialog" aria-modal="true" aria-label="Menu" hidden={!drawer}>
      <div className="nav-drawer-head">
        <a href="/" className="logo" aria-label="VERSUS home">VERSUS<span className="logo-mark">/</span></a>
        <button className="icon-button" onClick={()=>{setDrawer(false);menuButton.current?.focus();}} aria-label="Close menu"><X/></button>
      </div>
      <nav aria-label="All sections" className="nav-drawer-body">
        <h2>Play</h2>{PLAY.map(i=>link(i,()=>setDrawer(false)))}
        <h2>Explore</h2>{EXPLORE.map(i=>link(i,()=>setDrawer(false)))}
        <button className="nav-drawer-search" onClick={()=>{setDrawer(false);onSearch();}}><Search size={18} aria-hidden="true"/><span><strong>Search</strong><small>Fighters and pages</small></span></button>
        <h2>You</h2>
        {signedIn?<>{accountLinks}{accountMode&&<SignOut/>}</>:<>
          <a href={signIn} target="_top"><LogIn size={18} aria-hidden="true"/><span><strong>Sign in</strong><small>Keep your career on every device</small></span></a>
          {accountMode&&<a href={signIn+'&mode=signup'}><UserPlus size={18} aria-hidden="true"/><span><strong>Join VERSUS</strong></span></a>}
          <a href="/profile"><UserRound size={18} aria-hidden="true"/><span><strong>Profile</strong></span></a>
        </>}
      </nav>
    </div></>,document.body)}
  </header>;
}
