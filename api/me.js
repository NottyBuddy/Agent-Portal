import { methodNotAllowed, requireUser, send } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST']);
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (req.method === 'GET') return send(res, 200, { profile: auth.profile });

  const name = String(req.body?.display_name || '').trim().slice(0, 80);
  if (!name) return send(res, 400, { error: 'Enter a display name.' });

  const { data, error } = await auth.client.from('agent_profiles')
    .update({ display_name: name }).eq('user_id', auth.user.id).eq('active', true)
    .select('user_id,email,display_name,role,active').single();
  if (error) {
    console.error('Profile update failed:', error);
    return send(res, 500, { error: 'Unable to update your profile.' });
  }
  return send(res, 200, { profile: data });
}
