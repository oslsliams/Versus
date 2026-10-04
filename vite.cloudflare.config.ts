import vinext from 'vinext';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [vinext(), cloudflare({configPath: './wrangler.cloudflare.json', viteEnvironment: {name: 'rsc', childEnvironments: ['ssr']}, inspectorPort: false})],
  server: {host: '127.0.0.1', port: 5174},
});
