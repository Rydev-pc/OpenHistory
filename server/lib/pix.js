const QRCode = require('qrcode');

// CRC-16/CCITT-FALSE para payload EMV do Pix (BR Code)
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function buildPixPayload({ key, name = 'Open History', city = 'BRASIL', amount = '', txid = '***' }) {
  if (!key) return null;
  const gui = tlv('00', 'BR.GOV.BCB.PIX');
  const chave = tlv('01', key);
  const merchant = tlv('26', gui + chave);
  const payload =
    tlv('00', '01') +
    merchant +
    tlv('52', '0000') +
    tlv('53', '986') +
    (amount ? tlv('54', String(Number(amount).toFixed(2))) : '') +
    tlv('58', 'BR') +
    tlv('59', String(name).slice(0, 25)) +
    tlv('60', String(city).slice(0, 15)) +
    tlv('62', tlv('05', String(txid).slice(0, 25)));
  return payload + '6304' + crc16(payload);
}

async function pixQrDataUrl({ key, name, city, amount }) {
  const payload = buildPixPayload({ key, name, city, amount });
  if (!payload) return null;
  return QRCode.toDataURL(payload, { margin: 1, width: 320 });
}

module.exports = { buildPixPayload, pixQrDataUrl };
