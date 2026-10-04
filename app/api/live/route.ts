import {database} from '../../../db/store';
import {cachedFeed,parseNews,parseScoreboard} from '../../../lib/live-feed';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const db=database();const [events,news]=await Promise.all([cachedFeed(db,'espn-scoreboard','https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',60000,parseScoreboard,true,new URL(req.url).origin),cachedFeed(db,'espn-news','https://www.espn.com/espn/rss/mma/news',900000,parseNews,false,new URL(req.url).origin)]);return Response.json({events,news},{headers:{'Cache-Control':'public, max-age=15'}});}catch{return Response.json({error:'The live hub could not load. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
