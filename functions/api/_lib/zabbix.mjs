/* ============================================================================
 * zabbix.mjs — runtime-agnostic Zabbix stats core (Phase 1 back-end)
 * ----------------------------------------------------------------------------
 * Pure ES module with no platform dependencies: it takes credentials and a
 * `fetch` implementation and returns the stats object. This is the SINGLE
 * source of truth for the Zabbix logic, shared by:
 *   - functions/api/stats.js  (Cloudflare Pages Function — production endpoint)
 *   - scripts/dev-api.mjs      (local Node dev server — `node scripts/dev-api.mjs`)
 *   - scripts/fetch_zabbix_stats.py's successor, if the pipeline is retired
 *
 * It mirrors the existing Python pipeline (scripts/fetch_zabbix_stats.py):
 * Zabbix 7.x JSON-RPC, Bearer-token auth, counts enabled hosts + active
 * problems. Because both Node 18+ and the Workers runtime expose a global
 * `fetch`, the same code runs unchanged in either place.
 * ==========================================================================*/

/**
 * @typedef {Object} ZabbixStats
 * @property {number} devices     Count of enabled monitored hosts.
 * @property {number} problems    Count of recent active problems.
 * @property {string} updated_at  ISO-8601 UTC timestamp.
 * @property {string} source      "zabbix" (live) — set by callers to "fallback"/"cache" as needed.
 */

let _reqId = 0;

async function rpc(apiUrl, method, params, token, fetchImpl) {
  _reqId += 1;
  const headers = { 'Content-Type': 'application/json-rpc' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetchImpl(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: _reqId }),
  });
  if (!resp.ok) throw new Error(`Zabbix HTTP ${resp.status}`);

  const data = await resp.json();
  if (data.error) {
    throw new Error(`Zabbix API error [${data.error.code}]: ${data.error.data}`);
  }
  return data.result;
}

/**
 * Fetch live stats from a Zabbix 7.x server.
 * @param {{url:string, user:string, pass:string}} creds
 * @param {typeof fetch} [fetchImpl] defaults to the global fetch.
 * @returns {Promise<ZabbixStats>}
 */
export async function fetchZabbixStats(creds, fetchImpl = globalThis.fetch) {
  if (!creds || !creds.url || !creds.user || !creds.pass) {
    throw new Error('Missing Zabbix credentials (url/user/pass)');
  }
  const apiUrl = `${creds.url.replace(/\/+$/, '')}/api_jsonrpc.php`;

  // Login (Zabbix 7.x uses "username")
  const token = await rpc(apiUrl, 'user.login', { username: creds.user, password: creds.pass }, null, fetchImpl);

  try {
    const devices = parseInt(
      await rpc(apiUrl, 'host.get', { countOutput: true, filter: { status: 0 } }, token, fetchImpl),
      10
    );

    let problems = 0;
    try {
      problems = parseInt(
        await rpc(apiUrl, 'problem.get', { countOutput: true, recent: true }, token, fetchImpl),
        10
      );
    } catch (_) { /* problems are best-effort */ }

    return {
      devices: Number.isNaN(devices) ? 0 : devices,
      problems: Number.isNaN(problems) ? 0 : problems,
      updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      source: 'zabbix',
    };
  } finally {
    try { await rpc(apiUrl, 'user.logout', {}, token, fetchImpl); } catch (_) { /* ignore */ }
  }
}
