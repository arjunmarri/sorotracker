// The extension's scripts are classic browser scripts that attach to globalThis.SoroTrack.
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));

export async function load(...files) {
  for (const file of files) await import(new URL(`../extension/${file}`, import.meta.url));
  return globalThis.SoroTrack;
}

// Builds a fetch stand-in that answers by URL and records requests.
export function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    const route = routes[url];
    if (!route) throw new TypeError('fetch failed');
    const { status = 200, json, text, lines } = typeof route === 'function' ? route(init) : route;
    const payload = lines ? lines.join('\n') + '\n' : text !== undefined ? text : JSON.stringify(json);
    return new Response(payload, { status });
  };
  return { fetch, calls };
}
