const ALLOWED_DOMAINS = ['imoulife.com', 'lechange.com', 'easy4ip.com'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).send('Invalid url');
  }

  if (!ALLOWED_DOMAINS.some(d => parsed.hostname.endsWith(d))) {
    return res.status(403).send('Forbidden');
  }

  const upstream = await fetch(url);
  const contentType = upstream.headers.get('content-type') || '';

  if (url.includes('.m3u8') || contentType.includes('mpegurl')) {
    const text = await upstream.text();
    const base = url.substring(0, url.lastIndexOf('/') + 1);

    const rewritten = text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const segUrl = trimmed.startsWith('http') ? trimmed : base + trimmed;
      return `/api/proxy?url=${encodeURIComponent(segUrl)}`;
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    return res.send(rewritten);
  }

  // .ts video segment — pipe through
  const buffer = await upstream.arrayBuffer();
  res.setHeader('Content-Type', contentType || 'video/mp2t');
  res.send(Buffer.from(buffer));
}
