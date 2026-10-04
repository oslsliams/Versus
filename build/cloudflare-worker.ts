import {fantasyCards} from '../lib/fantasy-store';
import handler from 'vinext/server/fetch-handler';
export default {scheduled(_controller:ScheduledController,env:Cloudflare.Env,ctx:ExecutionContext){if(env.DB)ctx.waitUntil(fantasyCards(env.DB));},async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
  const response = await handler.fetch(request, env, ctx);
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  if (new URL(request.url).pathname.startsWith('/api/') || request.headers.get('cookie')) headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}};
