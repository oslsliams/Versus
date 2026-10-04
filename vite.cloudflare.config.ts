import vinext from 'vinext';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
import {localPublicFeeds} from './build/local-public-feeds';

export default defineConfig({
  plugins: [localPublicFeeds(), vinext(), cloudflare({configPath: './wrangler.cloudflare.json', viteEnvironment: {name: 'rsc', childEnvironments: ['ssr']}, inspectorPort: false})],
  server: {host: '127.0.0.1', port: 5174},
});
