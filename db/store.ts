import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Saved activity is temporarily unavailable. Please try again.');return env.DB;}
