// The HTTP layer. Node standard library only — no framework, no payment SDK.
// Everything that can be tested without a socket lives in webhook.mjs.
//
//   LICENSE_PRIVATE_KEY_PEM="$(cat keys/license-private.pem)" \
//   LICENSE_WEBHOOK_SECRET=... LICENSE_STORE_API_KEY=... \
//   node server/index.mjs
//
// Routes:
//   POST /webhooks/license    order_created  → issue + deliver   (provider calls this)
//   POST /licenses/validate   { envelope }   → ok / reason       (support)
//   POST /licenses/deactivate { email, device } → release a seat (support)
//   POST /licenses/resend     { email }     → re-deliver the key (support)
//   GET  /health
//
// Every non-webhook route needs LICENSE_STORE_API_KEY, compared in constant
// time. If it is not configured those routes refuse rather than run open.
import { createServer } from 'node:http';
import { fileStore } from './store.mjs';
import { handleOrderCreated, safeEqual, verifyWebhookSignature } from './webhook.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.LICENSE_WEBHOOK_SECRET ?? '';
const API_KEY = process.env.LICENSE_STORE_API_KEY ?? '';
const DEFAULT_DEVICES = Number(process.env.LICENSE_DEFAULT_DEVICES ?? 1);
const store = fileStore();

const json = (res, code, body) => {
  const text = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
};

function requireApiKey(req, res) {
  if (!API_KEY) { json(res, 503, { error: 'service-misconfigured' }); return false; }
  if (!safeEqual(req.headers['x-api-key'] ?? '', API_KEY)) { json(res, 401, { error: 'unauthorized' }); return false; }
  return true;
}

/** Best-effort delivery. Swap for a real transactional email provider. */
function deliver(record, reason) {
  if (!process.env.LICENSE_EMAIL_TRANSPORT) {
    console.warn(`[license] no mail transport configured; key for ${record.email} NOT sent (${reason})`);
    return false;
  }
  console.log(`[license] deliver ${record.email} (${reason})`);
  return false;
}

const readBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > 1_000_000) { reject(new Error('body too large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, {
        ok: true,
        signing: Boolean(process.env.LICENSE_PRIVATE_KEY_PEM),
        webhook: Boolean(SECRET),
        support: Boolean(API_KEY),
      });
    }

    if (req.method === 'POST' && req.url === '/webhooks/license') {
      const raw = await readBody(req);            // raw bytes — this is what was signed
      const verdict = verifyWebhookSignature(raw, req.headers['x-signature'], SECRET);
      if (!verdict.ok) return json(res, 401, { error: verdict.reason });

      let payload;
      try { payload = JSON.parse(raw.toString('utf8')); } catch { return json(res, 400, { error: 'bad-json' }); }

      const event = payload.meta?.event_name ?? '';
      if (event !== 'order_created') return json(res, 200, { status: 'ignored', event });
      // Always 200 on a handled event: a non-2xx makes the provider retry.
      return json(res, 200, handleOrderCreated(payload, { store, deliver, devices: DEFAULT_DEVICES }));
    }

    const supportRoutes = {
      '/licenses/validate': body => {
        const record = store.getLicense(body?.envelope?.claims?.customerEmail ?? '');
        if (!record) return { ok: false, reason: 'unknown-license' };
        return {
          ok: true,
          revoked: record.envelope.claims.revoked === true,
          devices: record.devices,
          activated: record.activatedBy.length,
        };
      },
      '/licenses/deactivate': body => {
        const record = store.getLicense(body?.email ?? '');
        if (!record) return null;
        record.activatedBy = record.activatedBy.filter(d => d !== body?.device);
        store.putLicense(record);
        return { ok: true, activated: record.activatedBy.length };
      },
      '/licenses/resend': body => {
        const record = store.getLicense(body?.email ?? '');
        if (!record) return null;
        return { ok: deliver(record, 'resend') };
      },
    };

    if (req.method === 'POST' && supportRoutes[req.url]) {
      if (!requireApiKey(req, res)) return;
      let body;
      try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}'); }
      catch { return json(res, 400, { error: 'bad-json' }); }
      const result = supportRoutes[req.url](body);
      return result === null ? json(res, 404, { error: 'unknown-license' }) : json(res, 200, result);
    }

    return json(res, 404, { error: 'not-found' });
  } catch (err) {
    console.error('[license]', err?.message ?? err);
    return json(res, 500, { error: 'internal' });
  }
}).listen(PORT, () => {
  console.log(`license service on :${PORT}`);
  console.log(`  signing key : ${process.env.LICENSE_PRIVATE_KEY_PEM ? 'present' : 'MISSING — issuance will fail'}`);
  console.log(`  webhook secret: ${SECRET ? 'present' : 'MISSING — webhooks will be rejected'}`);
  console.log(`  store API key: ${API_KEY ? 'present' : 'MISSING — support routes will refuse'}`);
});

export { store };