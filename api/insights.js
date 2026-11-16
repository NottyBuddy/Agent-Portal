import { methodNotAllowed, requireUser, send } from './_lib/supabase.js';

const DAY_MS = 86400000;
function isoDate(date) { return date.toISOString().slice(0, 10); }

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return methodNotAllowed(res, ['GET','POST']);
  const auth = await requireUser(req, res);
  if (!auth) return;

  if (req.method === 'POST') {
    const body = req.body || {};
    const score = Number(body.score), total = Number(body.total);
    if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || total > 50 || score < 0 || score > total) {
      return send(res, 400, { error: 'Invalid quiz score.' });
    }
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 50) : [];
    const { error } = await auth.client.from('quiz_attempts').insert({
      user_id: auth.user.id, quiz_date: isoDate(new Date()), score, total, answers
    });
    if (error) {
      console.error('Quiz save failed:', error);
      return send(res, 500, { error: 'Unable to save the quiz result.' });
    }
    return send(res, 200, { ok: true });
  }

  const leaderboard = req.query.view === 'leaderboard';
  const now = new Date();
  const since = new Date(now.getTime() - 29 * DAY_MS);
  const dateFrom = leaderboard ? isoDate(now) : isoDate(since);
  let profilesQuery = auth.client.from('agent_profiles')
    .select('user_id,email,display_name')
    .eq('role', 'agent').eq('active', true)
    .order('display_name', { ascending: true });

  if (!auth.isManager && !leaderboard) profilesQuery = profilesQuery.eq('user_id', auth.user.id);
  const { data: profiles, error: profilesError } = await profilesQuery;
  if (profilesError) {
    console.error('Insights profile read failed:', profilesError);
    return send(res, 500, { error: 'Unable to load coaching profiles.' });
  }
  const ids = (profiles || []).map(p => p.user_id);
  if (!ids.length) return send(res, 200, { role: auth.profile.role, rows: [] });

  const [kpiResult, quizResult, simResult] = await Promise.all([
    auth.client.from('daily_kpis')
      .select('agent_user_id,work_date,outbound_attempts,inbound_calls,connected_calls,qualified_leads,consultations_booked,followups_completed,crm_updated,whatsapp_shared,talk_time_minutes')
      .in('agent_user_id', ids).gte('work_date', dateFrom).lte('work_date', isoDate(now)),
    auth.client.from('quiz_attempts')
      .select('user_id,score,total,quiz_date')
      .in('user_id', ids).gte('quiz_date', isoDate(since)),
    auth.client.from('simulation_attempts')
      .select('user_id,score,created_at')
      .in('user_id', ids).gte('created_at', since.toISOString())
  ]);

  for (const result of [kpiResult, quizResult, simResult]) {
    if (result.error) {
      console.error('Insights data read failed:', result.error);
      return send(res, 500, { error: 'Unable to load performance insights.' });
    }
  }

  const byId = new Map(ids.map(id => [id, {
    attempts: 0, connected: 0, qualified: 0, consultations: 0,
    productive_actions: 0, talk_minutes: 0
  }]));
  for (const row of kpiResult.data || []) {
    const x = byId.get(row.agent_user_id);
    if (!x) continue;
    x.attempts += Number(row.outbound_attempts || 0) + Number(row.inbound_calls || 0);
    x.connected += Number(row.connected_calls || 0);
    x.qualified += Number(row.qualified_leads || 0);
    x.consultations += Number(row.consultations_booked || 0);
    x.productive_actions += Number(row.followups_completed || 0) + Number(row.crm_updated || 0) + Number(row.whatsapp_shared || 0);
    x.talk_minutes += Number(row.talk_time_minutes || 0);
  }

  const quizById = new Map();
  for (const row of quizResult.data || []) {
    const x = quizById.get(row.user_id) || { points: 0, total: 0, count: 0, last: null };
    x.points += Number(row.score || 0);
    x.total += Number(row.total || 0);
    x.count += 1;
    if (!x.last || row.quiz_date > x.last) x.last = row.quiz_date;
    quizById.set(row.user_id, x);
  }
  const simById = new Map();
  for (const row of simResult.data || []) {
    const x = simById.get(row.user_id) || { points: 0, count: 0, last: null };
    x.points += Number(row.score || 0);
    x.count += 1;
    if (!x.last || row.created_at > x.last) x.last = row.created_at;
    simById.set(row.user_id, x);
  }

  const rows = (profiles || []).map(p => {
    const k = byId.get(p.user_id), q = quizById.get(p.user_id), s = simById.get(p.user_id);
    return {
      user_id: p.user_id, display_name: p.display_name, email: p.email,
      ...k, connect_rate: k.attempts ? k.connected / k.attempts * 100 : 0,
      quiz_score: q && q.total ? q.points / q.total * 100 : null,
      quiz_count: q?.count || 0, last_quiz: q?.last || null,
      sim_score: s && s.count ? s.points / s.count : null,
      sim_count: s?.count || 0, last_sim: s?.last || null
    };
  });
  return send(res, 200, { role: auth.profile.role, rows });
}
