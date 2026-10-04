import AccountForm from '../../components/account-form';
import {cloudflareAccounts,safeReturn} from '../../lib/account-auth';
export const dynamic='force-dynamic';
export default async function AuthPage({searchParams}:{searchParams:Promise<{return_to?:string;mode?:string}>}) {const p=await searchParams;if(!cloudflareAccounts())return <p>Use the sign-in button on the <a href="/">home page</a>.</p>;return <AccountForm returnTo={safeReturn(p.return_to??'/')} initialRegister={p.mode==='signup'}/>;}
