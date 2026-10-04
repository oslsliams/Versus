const liveHosts=new Set(['versusarena.org','www.versusarena.org','versus.liam60177.workers.dev']);
export function transportGuard(request:Request):Response|null{
 const url=new URL(request.url);if(!liveHosts.has(url.hostname)||url.protocol==='https:')return null;
 if(request.method!=='GET'&&request.method!=='HEAD')return Response.json({error:'Use the HTTPS website to send account information.'},{status:403,headers:{'Cache-Control':'no-store'}});
 url.protocol='https:';return new Response(null,{status:308,headers:{Location:url.href,'Cache-Control':'no-store'}});
}
export async function boundedApiRequest(request:Request):Promise<Request|Response>{
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/')||['GET','HEAD','OPTIONS'].includes(request.method))return request;
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Cross-site requests are not allowed.'},{status:403});
 const limit=url.pathname==='/api/profile-photo'?200000:8192;
 if(Number(request.headers.get('content-length'))>limit)return Response.json({error:'Request too large.'},{status:413});
 if(!request.body)return request;const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return Response.json({error:'Request too large.'},{status:413});}chunks.push(value);}}catch{return Response.json({error:'Could not read request.'},{status:400});}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}return new Request(request,{body});
}
export function securityHeaders(request:Request,response:Response){const headers=new Headers(response.headers),url=new URL(request.url);
 headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('X-Frame-Options','DENY');
 headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 if(liveHosts.has(url.hostname)&&url.protocol==='https:'){
  headers.set('Strict-Transport-Security','max-age=31536000');
  // Vinext uses inline bootstrap scripts; do not disable them or pretend this is a nonce policy.
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://ufc.com https://*.ufc.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
 }
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth')||url.pathname.startsWith('/recover')||request.headers.get('cookie')||response.headers.has('set-cookie'))headers.set('Cache-Control','private, no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
