// api/transcript.js — server-side YouTube transcript + oEmbed metadata.
// GET /api/transcript?videoId=XXXXXXXXXXX
//   → { videoId, title, channel, transcript, transcriptAvailable }
// Replaces the flaky third-party transcript proxies the client used to hit,
// and proxies oEmbed here too so the browser never eats a CORS failure.
import { requireAuth } from './_lib.js';

async function fetchOEmbed(videoId) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (r.ok) {
      const d = await r.json();
      return { title: d.title || 'YouTube Video', channel: d.author_name || 'Unknown Channel' };
    }
  } catch {}
  return { title: 'YouTube Video', channel: 'Unknown Channel' };
}

async function fetchTranscript(videoId) {
  try {
    // youtube-transcript is a maintained ESM/CJS package; load lazily so a
    // missing/broken install degrades to "no transcript" rather than a 500.
    const mod = await import('youtube-transcript');
    const YoutubeTranscript = mod.YoutubeTranscript || mod.default?.YoutubeTranscript || mod.default;
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (Array.isArray(segments) && segments.length) {
      return segments
        .map((s) => s.text || '')
        .join(' ')
        .replace(/\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  } catch {}
  return null;
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const videoId = String(req.query.videoId || '').trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  const [meta, transcript] = await Promise.all([fetchOEmbed(videoId), fetchTranscript(videoId)]);

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({
    videoId,
    title: meta.title,
    channel: meta.channel,
    transcript: transcript || '',
    transcriptAvailable: !!transcript,
  });
}
