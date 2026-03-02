const crypto = require('crypto');

function decryptLark(encryptKey, encrypt) {
  const key = crypto.createHash('sha256').update(encryptKey).digest();
  const iv = key.slice(0, 16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);

  let decrypted = Buffer.concat([
    decipher.update(encrypt, 'base64'),
    decipher.final()
  ]);

  const pad = decrypted[decrypted.length - 1];
  if (pad < 1 || pad > 16) throw new Error(`Invalid padding length: ${pad}`);
  decrypted = decrypted.slice(0, decrypted.length - pad);

  const text = decrypted.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Decrypted payload is not valid JSON');
  }
}

module.exports = { decryptLark };
