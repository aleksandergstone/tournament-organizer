// Where issued licenses live. The interface is deliberately tiny so it can be
// swapped for a hosted database without touching the webhook code.
//
// A filesystem adapter is included because it runs anywhere with no dependency
// and no account. It is NOT suitable for a multi-instance deploy — two replicas
// would each keep their own file. For that, implement the same four methods
// against a real database; everything else in server/ stays as it is.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** @typedef {{ email: string, envelope: object, orderId: string, issuedAt: string,
 *              devices: number|null, activatedBy: string[] }} LicenseRecord */

export function fileStore(file = process.env.LICENSE_DB_PATH ?? path.join(process.cwd(), 'data', 'licenses.json')) {
  const read = () => {
    if (!existsSync(file)) return { licenses: {}, orders: {} };
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return { licenses: {}, orders: {} }; }   // a corrupt file must not take the webhook down
  };
  const write = data => {
    mkdirSync(path.dirname(file), { recursive: true });
    // Write-then-rename: a crash mid-write cannot leave a half-written database.
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmp, file);
  };
  const update = fn => { const d = read(); const r = fn(d); write(d); return r; };

  return {
    /** Idempotency: has this order already produced a license? */
    orderSeen: orderId => Boolean(read().orders[orderId]),
    /** Record an order → license mapping. Returns false if already present. */
    claimOrder: (orderId, email) => update(d => {
      if (d.orders[orderId]) return false;
      d.orders[orderId] = email;
      return true;
    }),
    putLicense: record => update(d => { d.licenses[record.email.toLowerCase()] = record; return record; }),
    getLicense: email => read().licenses[String(email).toLowerCase()] ?? null,
    /** Used by the support flow when a customer says they never got the key. */
    listLicenses: () => Object.values(read().licenses),
  };
}