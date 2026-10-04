import RecoveryForm from '../../components/recovery-form';
import {cloudflareAccounts,safeReturn} from '../../lib/account-auth';
export const dynamic='force-dynamic';
export default async function Recover({searchParams}:{searchParams:Promise<{return_to?:string}>}){const p=await searchParams;return cloudflareAccounts()?<RecoveryForm returnTo={safeReturn(p.return_to??'/profile')}/>:<p>Recovery is available on the Cloudflare version.</p>;}
