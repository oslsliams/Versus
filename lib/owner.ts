import {getAccountUser,digest,cloudflareAccounts} from './account-auth';
import {database} from '../db/store';
// Bootstrap only the already-existing account identified during the owner's request.
// The email fingerprint is not a credential; the authenticated account and cutoff are required.
const ownerFingerprint='3164ac747e763cbbe0a0911f1fbb89480808fac993b34bb233d1bbf5a88b2fc1';
const existingAccountCutoff=1791084322136;
export async function bindExistingOwner(account:Awaited<ReturnType<typeof getAccountUser>>){
  if(!account||!cloudflareAccounts()||!account.email)return;
  if(await digest(account.email.trim().toLowerCase())!==ownerFingerprint)return;
  await database().prepare('INSERT OR IGNORE INTO owner_binding(singleton,user) SELECT 1,id FROM auth_accounts WHERE id=? AND created<=?').bind(account.userId,existingAccountCutoff).run();
}
export async function ownerIdentity(){
  const account=await getAccountUser();if(!account)return null;
  await bindExistingOwner(account);
  return await database().prepare('SELECT user FROM owner_binding WHERE singleton=1 AND user=?').bind(account.userId).first()?account.userId:null;
}
