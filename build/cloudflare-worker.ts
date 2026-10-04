import {fantasyCards} from '../lib/fantasy-store';
import handler from 'vinext/server/fetch-handler';
import {transportGuard,boundedApiRequest,securityHeaders} from '../lib/web-security';
export default {scheduled(_controller:ScheduledController,env:Cloudflare.Env,ctx:ExecutionContext){if(env.DB)ctx.waitUntil(fantasyCards(env.DB));},async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
  const redirect=transportGuard(request);if(redirect)return securityHeaders(request,redirect);
  const checked=await boundedApiRequest(request);if(checked instanceof Response)return securityHeaders(request,checked);
  return securityHeaders(request,await handler.fetch(checked, env, ctx));
}};
