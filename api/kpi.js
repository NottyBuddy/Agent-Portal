import { methodNotAllowed, numericFields, requireUser, send, validDate } from './_lib/supabase.js';

const fields = ['calls_assigned','outbound_attempts','inbound_calls','connected_calls','qualified_leads','consultations_booked','whatsapp_shared','callbacks_scheduled','followups_completed','crm_updated','talk_time_minutes'];

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return methodNotAllowed(res, ['GET','POST']);
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    const from = req.query.from || '2000-01-01';
    const to = req.query.to || '2099-12-31';
    if (!validDate(from) || !validDate(to) || from > to) return send(res, 400, { error: 'Enter a valid date range.' });
    const target = auth.isManager && req.query.agent ? String(req.query.agent) : auth.user.id;
    const { data, error } = await auth.client.from('daily_kpis')
      .select('id,agent_user_id,work_date,calls_assigned,outbound_attempts,inbound_calls,connected_calls,qualified_leads,consultations_booked,whatsapp_shared,callbacks_scheduled,followups_completed,crm_updated,talk_time_minutes,notes,updated_at')
      .eq('agent_user_id', target).gte('work_date', from).lte('work_date', to).order('work_date', { ascending: false });
    if (error) {
      console.error('KPI read failed:', error);
      return send(res, 500, { error: 'Unable to load KPI records.' });
    }
    return send(res, 200, { entries: data || [], profile: auth.profile });
  }

  if (!auth.isManager) return send(res, 403, { error: 'Only the authorised Manager can update KPI records.' });
  const body = req.body || {}, target = String(body.agent_user_id || ''), date = String(body.work_date || '');
  if (!target || !validDate(date)) return send(res, 400, { error: 'Select an agent and enter a valid work date.' });
  let values;
  try { values = numericFields(body, fields); }
  catch (error) { return send(res, 400, { error: error.message }); }

  // Operational counts must be whole numbers; only talk time may be fractional.
  const countValues = values.slice(0, -1);
  if (countValues.some(value => !Number.isSafeInteger(value))) {
    return send(res, 400, { error: 'Call and activity counts must be whole numbers.' });
  }
  if (typeof body.notes !== 'undefined' && typeof body.notes !== 'string') {
    return send(res, 400, { error: 'Manager notes must be plain text.' });
  }

  const { data: agent, error: agentError } = await auth.client.from('agent_profiles')
    .select('user_id,role,active').eq('user_id', target).maybeSingle();
  if (agentError) return send(res, 500, { error: 'Unable to verify the selected agent.' });
  if (!agent || agent.role !== 'agent' || !agent.active) return send(res, 400, { error: 'Select an active agent account.' });

  const row = {
    agent_user_id: target, work_date: date,
    ...Object.fromEntries(fields.map((key, index) => [key, values[index]])),
    notes: String(body.notes || '').slice(0, 2000), updated_by: auth.user.id,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await auth.client.from('daily_kpis').upsert(row, { onConflict: 'agent_user_id,work_date' }).select('id').single();
  if (error) {
    console.error('KPI save failed:', error);
    return send(res, 500, { error: 'Unable to save the KPI record.' });
  }
  return send(res, 200, { ok: true, id: data.id });
}
