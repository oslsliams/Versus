import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const configPath=path.join(root,'wrangler.cloudflare.json');
process.env.WRANGLER_SEND_METRICS='false';
process.env.WRANGLER_LOG_PATH=path.join(root,'.wrangler/logs');
process.env.WRANGLER_REGISTRY_PATH=path.join(root,'.wrangler/dev-registry');
process.env.MINIFLARE_REGISTRY_PATH=path.join(root,'.wrangler/registry');
process.env.CLOUDFLARE_CF_FETCH_ENABLED='false';
function run(args,{capture=false}={}){const result=spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:'utf8',stdio:capture?['inherit','pipe','inherit']:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error('A setup step failed. Fix the message above, then rerun this script.');return result.stdout;}
const cf=(args,options)=>run([wrangler,...args],options);
try{
  if(process.argv.includes('--check')){
    run(['node_modules/typescript/bin/tsc','--noEmit']);
    run(['node_modules/vite/bin/vite.js','build','--config','vite.cloudflare.config.ts']);
    console.log('Cloudflare build ready. No remote resources were created.');
    process.exit(0);
  }
  console.log('Publishing VERSUS to your Cloudflare account. Your browser will open for sign-in.');
  cf(['login']);
  const config=JSON.parse(readFileSync(configPath,'utf8'));
  const binding=config.d1_databases[0];
  if(binding.database_id==='00000000-0000-4000-8000-000000000000'){
    const databases=JSON.parse(cf(['d1','list','--json'],{capture:true}));
    let existing=databases.find(db=>db.name===binding.database_name);
    if(!existing){
      cf(['d1','create',binding.database_name]);
      existing=JSON.parse(cf(['d1','list','--json'],{capture:true})).find(db=>db.name===binding.database_name);
    }
    if(!existing?.uuid)throw Error('Could not find versus-db. Check your Cloudflare account selection.');
    binding.database_id=existing.uuid;
    writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
  }
  run(['node_modules/typescript/bin/tsc','--noEmit']);
  run(['node_modules/vite/bin/vite.js','build','--config','vite.cloudflare.config.ts']);
  cf(['d1','migrations','apply','DB','--remote','--config','wrangler.cloudflare.json']);
  cf(['deploy','--config','dist/server/wrangler.json']);
  console.log('Published! Copy the https:// link shown above and share it with your friend.');
}catch(error){console.error(error.message);process.exitCode=1;}
