/**
 * Encrypted API key storage using AES-256-GCM.
 * Keys are stored in the SQLite api_keys table.
 * Encryption key is derived from OREAD_SECRET env var or a file-persisted secret.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import database from './database.js';

const SECRET_FILE = path.join(process.env.OREAD_ROOT || path.resolve('.'), 'data', '.secret');

function getEncryptionKey() {
  const envSecret = process.env.OREAD_SECRET;
  if (envSecret) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }

  // Load or generate a persistent secret
  if (fs.existsSync(SECRET_FILE)) {
    const raw = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    return Buffer.from(raw, 'hex');
  }

  const generated = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, generated.toString('hex'), { mode: 0o600 });
  return generated;
}

function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted_key: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    auth_tag: authTag.toString('hex'),
  };
}

function decrypt(encryptedHex, ivHex, authTagHex) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encryptedData) + decipher.final('utf-8');
}

export async function setKey(provider, apiKey) {
  const { encrypted_key, iv, auth_tag } = encrypt(apiKey);
  await database.run(
    `INSERT INTO api_keys (provider, encrypted_key, iv, auth_tag, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(provider) DO UPDATE SET
       encrypted_key = excluded.encrypted_key,
       iv = excluded.iv,
       auth_tag = excluded.auth_tag,
       updated_at = CURRENT_TIMESTAMP`,
    [provider, encrypted_key, iv, auth_tag]
  );
}

export async function getKey(provider) {
  const row = await database.get(
    `SELECT encrypted_key, iv, auth_tag FROM api_keys WHERE provider = ?`,
    [provider]
  );
  if (!row) return null;
  try {
    return decrypt(row.encrypted_key, row.iv, row.auth_tag);
  } catch (err) {
    console.warn(`[keyStore] Failed to decrypt key for provider "${provider}" — key may be corrupted or secret changed:`, err.message);
    return null;
  }
}

export async function removeKey(provider) {
  await database.run(`DELETE FROM api_keys WHERE provider = ?`, [provider]);
}

export async function listConfiguredProviders() {
  const rows = await database.all(
    `SELECT provider, updated_at FROM api_keys ORDER BY provider`
  );
  return rows.map(r => ({ provider: r.provider, updated_at: r.updated_at }));
}
