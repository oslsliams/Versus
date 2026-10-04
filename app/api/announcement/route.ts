import {database} from '../../../db/store';
export const dynamic='force-dynamic';
export async function GET(){try{const row=await database().prepare("SELECT value FROM owner_settings WHERE key='announcement'").first<{value:string}>();return Response.json({announcement:row?.value??''},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({announcement:''},{headers:{'Cache-Control':'no-store'}});}}
