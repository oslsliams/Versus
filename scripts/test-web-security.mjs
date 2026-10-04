import assert from 'node:assert/strict';
import {transportGuard,boundedApiRequest,securityHeaders} from '../lib/web-security.ts';
import {photoCrop} from '../lib/photo-crop.ts';
const http=new Request('http://versusarena.org/moments?q=a');assert.equal(transportGuard(http).status,308);assert.equal(transportGuard(http).headers.get('location'),'https://versusarena.org/moments?q=a');
assert.equal(transportGuard(new Request('http://versusarena.org/api/account',{method:'POST',body:'{}'})).status,403);assert.equal(transportGuard(new Request('http://127.0.0.1:5173/')),null);assert.equal(transportGuard(new Request('https://versusarena.org/')),null);
const hardened=securityHeaders(new Request('https://versusarena.org/'),new Response('ok'));assert.equal(hardened.headers.get('strict-transport-security'),'max-age=31536000');assert(hardened.headers.get('content-security-policy').includes("object-src 'none'"));assert(hardened.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert(hardened.headers.get('permissions-policy').includes('camera=()'));assert.equal(hardened.headers.get('x-content-type-options'),'nosniff');
assert.equal(securityHeaders(new Request('http://127.0.0.1/'),new Response('ok')).headers.get('content-security-policy'),null);
assert.equal(securityHeaders(new Request('https://versusarena.org/api/owner'),new Response('{}')).headers.get('cache-control'),'private, no-store');
assert.equal(securityHeaders(new Request('https://versusarena.org/auth'),new Response('login')).headers.get('cache-control'),'private, no-store');
const valid=await boundedApiRequest(new Request('https://versusarena.org/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"logout"}'}));assert(valid instanceof Request);assert.equal(await valid.text(),'{"action":"logout"}');
assert.equal((await boundedApiRequest(new Request('https://versusarena.org/api/account',{method:'POST',headers:{'sec-fetch-site':'cross-site'},body:'{}'}))).status,403);
assert.equal((await boundedApiRequest(new Request('https://versusarena.org/api/account',{method:'POST',body:'x'.repeat(8193)}))).status,413);
assert.equal((await boundedApiRequest(new Request('https://versusarena.org/api/profile-photo',{method:'POST',headers:{'content-length':'200001'},body:'x'}))).status,413);
const photo=await boundedApiRequest(new Request('https://versusarena.org/api/profile-photo',{method:'POST',body:new Uint8Array(199999)}));assert.equal((await photo.arrayBuffer()).byteLength,199999);
for(const [w,h] of [[1000,500],[500,1000],[512,512]])for(const zoom of [1,2,4])for(const x of [-100,0,100])for(const y of [-100,0,100]){const crop=photoCrop(w,h,zoom,x,y);assert(crop.x>=0&&crop.y>=0);assert(crop.x+crop.side<=w&&crop.y+crop.side<=h);assert.equal(crop.side,Math.min(w,h)/zoom);}
assert.deepEqual(photoCrop(1000,500,1,0,0),{side:500,x:250,y:0});assert.deepEqual(photoCrop(1000,500,2,100,-100),{side:250,x:750,y:0});
console.log('PASS: trusted-host HTTPS enforcement, HTTP mutation rejection, local preview exception, HSTS/CSP/browser permissions, private page/API caching, bounded streaming bodies, cross-site rejection, unchanged legitimate payloads, and crop positioning/zoom at all bounds.');
