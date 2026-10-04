import Arena from '../../components/arena';
import {getAccountUser as getChatGPTUser,signInPath as chatGPTSignInPath,cloudflareAccounts} from '../../lib/account-auth';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}){const{path=[]}=await params;const user=await getChatGPTUser();return <Arena path={path} signedIn={!!user} signIn={chatGPTSignInPath('/'+path.join('/'))} accountMode={cloudflareAccounts()}/>;}
