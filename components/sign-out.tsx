'use client';
import {LogOut} from 'lucide-react';
import {useState} from 'react';
export default function SignOut(){const[busy,setBusy]=useState(false);const[error,setError]=useState('');return <><button aria-label="Sign out" className="button ghost sign-out" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!response.ok)throw Error();window.location.assign('/');}catch{setError('Could not sign out. Try again.');setBusy(false);}}}><LogOut size={15}/><span>{busy?'Signing out…':'Sign out'}</span></button>{error&&<span role="alert">{error}</span>}</>;}
