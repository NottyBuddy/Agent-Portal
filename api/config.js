export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return res.status(503).json({ error: 'Supabase public configuration is not set on the server.' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url, anonKey });
}
