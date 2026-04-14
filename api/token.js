import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { IMOU_APP_ID, IMOU_APP_SECRET } = process.env;

  if (!IMOU_APP_ID || !IMOU_APP_SECRET) {
    return res.status(500).json({ error: 'Missing IMOU_APP_ID or IMOU_APP_SECRET environment variables' });
  }

  const time = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(4).toString('hex');
  const sign = crypto
    .createHash('md5')
    .update(`time:${time},nonce:${nonce},appSecret:${IMOU_APP_SECRET}`)
    .digest('hex');

  try {
    const response = await fetch('https://openapi-or.easy4ip.com/openapi/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: { ver: '1.0', sign, appId: IMOU_APP_ID, time, nonce },
        params: {}
      })
    });

    const data = await response.json();

    if (data.result?.code === '0') {
      res.json({ token: data.result.data.accessToken });
    } else {
      res.status(400).json({ error: data.result?.msg || 'Auth failed', code: data.result?.code });
    }
  } catch (err) {
    res.status(500).json({ error: err.message, cause: err.cause?.message || err.cause || null });
  }
}
