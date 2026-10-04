'use client';
import {useArena} from './arena-context';
import OwnerPanel from './owner-panel';
export default function OwnerPage(){const{state,loading}=useArena();if(loading)return <p>Loading owner controls…</p>;if(!state?.me.owner)return <section className="panel"><h1>Owner access required.</h1><p>This area is available only to the verified arena owner.</p><a className="button outline" href="/">Back to the arena</a></section>;return <><div className="page-head"><div><span className="eyebrow">VERSUS / OWNER</span><h1>Your control room.</h1><p>Coins, community moderation, approved accounts, and announcements in one place.</p></div><a className="button outline" href="/profile">Your profile →</a></div><OwnerPanel/></>;}
