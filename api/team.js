import { methodNotAllowed, requireUser, send } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return methodNotAllowed(res, ['GET','POST']);
  const auth = await requireUser(req, res, { manager: true });
  if (!auth) return;

  if (req.method === 'GET') {
    const { data, error } = await auth.client.from('agent_profiles')
      .select('user_id,email,display_name,role,active,created_at').order('display_name', { ascending: true });
    if (error) {
      console.error('Team read failed:', error);
      return send(res, 500, { error: 'Unable to load the team directory.' });
    }
    return send(res, 200, { team: data || [] });
  }

  const userId = String(req.body?.user_id || '');
  const name = String(req.body?.display_name || '').trim().slice(0, 80);
  if (!userId) return send(res, 400, { error: 'Select a registered user.' });
  const { error } = await auth.client.rpc('manager_update_agent_profile', {
    target_user_id: userId, new_display_name: name, new_active: !!req.body?.active
  });
  if (error) {
    console.error('Team profile update failed:', error);
    return send(res, 400, { error: error.message || 'Unable to update the agent profile.' });
  }
  return send(res, 200, { ok: true });
}
