import {fantasyCards} from '../lib/fantasy-store';
import {cachedFeed,parseNews,parseScoreboard} from '../lib/live-feed';
import handler from 'vinext/server/fetch-handler';
import {transportGuard,boundedApiRequest,securityHeaders} from '../lib/web-security';
export default {scheduled(_controller:ScheduledController,env:Cloudflare.Env,ctx:ExecutionContext){if(env.DB)ctx.waitUntil(Promise.allSettled([fantasyCards(env.DB),cachedFeed(env.DB,'espn-scoreboard','https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',60000,parseScoreboard),cachedFeed(env.DB,'espn-news','https://www.espn.com/espn/rss/mma/news',900000,parseNews,false)]));},async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
  const redirect=transportGuard(request);if(redirect)return securityHeaders(request,redirect);
  const checked=await boundedApiRequest(request);if(checked instanceof Response)return securityHeaders(request,checked);
  return securityHeaders(request,await handler.fetch(checked, env, ctx));
}};
