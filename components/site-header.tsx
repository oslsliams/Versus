'use client';
import {useEffect,useRef,useState} from 'react';
import {BarChart3,ChevronDown,Coins,Crown,Flame,Menu,MessagesSquare,Search,Settings,ShoppingBag,Trophy,Users,UserRound,X} from 'lucide-react';
import type {AppState} from '../lib/domain';
import {CoinChip} from './arena-coins';
import UserAvatar from './user-avatar';
import SignOut from './sign-out';

const primary=[['fighters','Fighters',Users],['compare','Compare',BarChart3],['fantasy','Fight Night',Trophy],['live','News & live',Flame],['moments','Moments',ShoppingBag]] as const;
const secondary=[['community','Community',MessagesSquare],['suggestions','Suggestions',MessagesSquare],['shop','Shop',ShoppingBag],['rankings','Rankings',Trophy],['leaderboard','Coin leaderboard',Trophy],['rewards','Earn coins',Trophy],['discover','Find everything',Search]] as const;

export default function SiteHeader({route,signedIn,signIn,accountMode,me,requests,onSearch}:{route:string;signedIn:boolean;signIn:string;accountMode:boolean;me:AppState['me']|undefined;requests:number;onSearch:()=>void}){
  const[menu,setMenu]=useState(false),[more,setMore]=useState(false),[account,setAccount]=useState(false);
  const header=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null),moreButton=useRef<HTMLButtonElement>(null),accountButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!header.current?.contains(event.target as Node)){setMenu(false);setMore(false);setAccount(false);}};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&(menu||more||account)){event.preventDefault();(account?accountButton:more?moreButton:menuButton).current?.focus();setMenu(false);setMore(false);setAccount(false);}};
    const resize=()=>{setMenu(false);setMore(false);setAccount(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',resize);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',resize);};
  },[menu,more,account]);
  const link=([href,label,Icon]:(typeof primary)[number]|(typeof secondary)[number])=><a key={href} href={`/${href}`} className={route===href?'active':''} aria-current={route===href?'page':undefined}><Icon size={17}/><span>{label}</span></a>;
  return <header ref={header} className="header polished-header">
    <a href="/" className="logo" aria-label="VERSUS home">VERSUS<span className="logo-mark">/</span></a>
    <nav id="site-navigation" className={`nav site-navigation${menu?' open':''}`} aria-label="Main navigation">
      <a href="/" className="mobile-home" aria-current={!route?'page':undefined}><span>Explore VERSUS</span></a>
      {primary.map(link)}
      <div className="nav-more">
        <button ref={moreButton} className={`nav-more-button${secondary.some(([href])=>href===route)?' active':''}`} aria-expanded={more} aria-controls="more-navigation" onClick={()=>{setMore(!more);setAccount(false);}}>More <ChevronDown size={15}/></button>
        <div id="more-navigation" className={`nav-dropdown${more?' is-open':''}`}>{secondary.map(link)}</div>
      </div>
    </nav>
    <div className="header-actions">
      <button className="icon-button quick-search-button" onClick={()=>{setAccount(false);setMore(false);setMenu(false);onSearch();}} aria-label="Search pages and fighters" title="Search · Ctrl / ⌘ K"><Search size={19}/></button>
      {signedIn&&accountMode&&<CoinChip/>}
      {signedIn?<div className="account-navigation">
        <button ref={accountButton} className="profile-chip account-toggle" aria-label="Open account menu" aria-expanded={account} aria-controls="account-navigation" onClick={()=>{setAccount(!account);setMore(false);setMenu(false);}}>{me?<UserAvatar person={me}/>:<UserRound size={20}/>}<span className="account-name">{me?.username??'Account'}</span><ChevronDown size={14}/>{requests>0&&<span className="account-notification" aria-label="New friend requests"/>}</button>
        {account&&<div id="account-navigation" className="account-dropdown"><span className="account-menu-heading">{me?.username??'Your account'}</span><a href="/profile"><UserRound size={17}/>Your profile</a><a href={requests?'/people?tab=requests':'/people'}><Users size={17}/>Friends & accounts{requests>0&&<span className="account-request-count">{requests}</span>}</a>{accountMode&&<><a href="/fantasy#arena-coins-wallet"><Coins size={17}/>Your coins</a><a href="/settings"><Settings size={17}/>Account settings</a>{!!me?.owner&&<a href="/owner"><Crown size={17}/>Owner controls</a>}<div className="account-menu-divider"/><SignOut/></>}</div>}
      </div>:<div className="auth-links"><a href={signIn} target="_top" className="button ghost">Sign in</a>{accountMode&&<a href={signIn+'&mode=signup'} className="button primary">Join VERSUS</a>}</div>}
      <button ref={menuButton} className="menu-toggle icon-button" aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} aria-controls="site-navigation" onClick={()=>{setMenu(!menu);setMore(false);setAccount(false);}}>{menu?<X/>:<Menu/>}</button>
    </div>
  </header>;
}
