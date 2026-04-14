import crypto from 'crypto';

function makeSystem(appId, appSecret) {
  const time = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(4).toString('hex');
  const sign = crypto
    .createHash('md5')
    .update(`time:${time},nonce:${nonce},appSecret:${appSecret}`)
    .digest('hex');
  return { ver: '1.0', sign, appId, time, nonce };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { IMOU_APP_ID, IMOU_APP_SECRET } = process.env;
  const { token } = req.body || {};

  if (!token) return res.status(400).json({ error: 'Missing token' });

  try {
    const response = await fetch('https://openapi-or.easy4ip.com/openapi/deviceBaseList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: makeSystem(IMOU_APP_ID, IMOU_APP_SECRET),
        id: crypto.randomUUID(),
        params: { token, page: 1, pageSize: 20 }
      })
    });

    const data = await response.json();

    if (data.result?.code === '0') {
      const devices = (data.result.data?.deviceList || []).map(d => ({
        deviceId: d.deviceId,
        name: d.name,
        status: d.deviceStatus,
        channels: d.channels || 1
      }));
      res.json({ devices });
    } else {
      res.status(400).json({ error: data.result?.msg || 'Failed to get devices', code: data.result?.code });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
