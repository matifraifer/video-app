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

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const deviceId = '9E085D6PBV3E06B';
  const channelId = '0';

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

    if (data.result?.code === '0' || data.result?.code === 'LV1001') {
      // Always call getLiveStreamInfo to get all stream types (HTTP + HTTPS)
      const infoRes = await fetch('https://openapi-or.easy4ip.com/openapi/getLiveStreamInfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: makeSystem(IMOU_APP_ID, IMOU_APP_SECRET),
          id: crypto.randomUUID(),
          params: { token, deviceId, channelId }
        })
      });
      const info = await infoRes.json();
      if (info.result?.code === '0') {
        const streams = info.result.data?.streams || [];
        // Look for sub-stream (streamId=1, H.264) with HTTPS first
        const pick = (sid, proto) => streams.find(s => s.streamId === sid && s.hls?.startsWith(proto));
        let chosen = pick(1, 'https://') || pick(1, 'http://') || pick(0, 'https://') || streams[0];
        let hlsUrl = chosen?.hls || null;
        if (hlsUrl?.startsWith('http://')) {
          hlsUrl = hlsUrl.replace('http://', 'https://').replace(/:8888\b/, '');
        }
        return res.json({ url: hlsUrl });
      }
      return res.status(400).json({ error: info.result?.msg || 'Failed to get stream info', code: info.result?.code });
    }

    res.status(400).json({ error: data.result?.msg || 'Failed to get stream', code: data.result?.code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
