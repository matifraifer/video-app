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
  const { token, deviceId, channelId = '0' } = req.body || {};

  if (!token || !deviceId) {
    return res.status(400).json({ error: 'Missing token or deviceId' });
  }

  try {
    const response = await fetch('https://openapi-or.easy4ip.com/openapi/bindDeviceLive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: makeSystem(IMOU_APP_ID, IMOU_APP_SECRET),
        id: crypto.randomUUID(),
        params: { token, deviceId, channelId, streamId: 1, liveMode: 'proxy' }
      })
    });

    const data = await response.json();

    if (data.result?.code === '0') {
      const streams = data.result.data?.streams || [];
      const hlsUrl = streams[0]?.hls || null;
      res.json({ url: hlsUrl, streams });
    } else {
      res.status(400).json({ error: data.result?.msg || 'Failed to get stream', code: data.result?.code });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
