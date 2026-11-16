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

  const body = req.body || {};
  const userId = String(body.user_id || '');
  const name = String(body.display_name || '').trim().slice(0, 80);
  if (!userId) return send(res, 400, { error: 'Select a registered agent.' });
  if (typeof body.active !== 'boolean') return send(res, 400, { error: 'Select a valid account status.' });

  const { data: target, error: targetError } = await auth.client.from('agent_profiles')
    .select('user_id,role').eq('user_id', userId).maybeSingle();
  if (targetError) {
    console.error('Team target verification failed:', targetError);
    return send(res, 500, { error: 'Unable to verify the selected agent.' });
  }
  if (!target || target.role !== 'agent') return send(res, 400, { error: 'Only registered Agent accounts can be updated.' });

  const { data, error } = await auth.client.from('agent_profiles')
    .update({ display_name: name, active: body.active })
    .eq('user_id', userId).eq('role', 'agent')
    .select('user_id,email,display_name,role,active').single();
  if (error || !data) {
    console.error('Team profile update failed:', error);
    return send(res, 500, { error: 'Unable to update the agent profile.' });
  }
  return send(res, 200, { ok: true, agent: data });
}
