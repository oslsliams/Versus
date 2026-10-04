import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
process.env.CI='true';
process.env.WRANGLER_SEND_METRICS='false';
process.env.WRANGLER_LOG_PATH=path.join(root,'.wrangler/logs');
const wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const config=JSON.parse(readFileSync('wrangler.cloudflare.json','utf8'));
if(config.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000')throw Error('Run the first-time Cloudflare publishing setup before enabling automatic deployment.');
// Use the already checked build. Wrangler receives the build service's credentials.
for(const args of [
  ['d1','migrations','apply','DB','--remote','--config','wrangler.cloudflare.json'],
  ['deploy','--config','dist/server/wrangler.json']
]){
  const result=spawnSync(process.execPath,[wrangler,...args],{cwd:root,env:process.env,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
