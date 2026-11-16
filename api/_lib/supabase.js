import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseAdmin() {
  if (!url || !serviceKey) {
    const error = new Error('Supabase server environment is not configured.');
    error.status = 503;
    throw error;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function send(res, status, payload) {
  return res.status(status).json(payload);
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return send(res, 405, { error: 'Method not allowed.' });
}

export function readBearer(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export async function requireUser(req, res, options = {}) {
  const token = readBearer(req);
  if (!token) {
    send(res, 401, { error: 'Sign in is required.' });
    return null;
  }

  let client;
  try {
    client = supabaseAdmin();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      send(res, 401, { error: 'Your session is invalid or expired. Please sign in again.' });
      return null;
    }

    const user = data.user;
    const email = String(user.email || '').trim().toLowerCase();
    const { data: profile, error: profileError } = await client
      .from('agent_profiles')
      .select('user_id,email,display_name,role,active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || !profile.active) {
      send(res, 403, { error: 'Your account is inactive or not initialised. Contact the Manager.' });
      return null;
    }

    // Enforce the allowlist on the server. A stale or tampered Manager role is denied.
    const isAllowlistedManager = email === 'mahesh.s@hrhnext.com';
    if ((profile.role === 'manager') !== isAllowlistedManager) {
      send(res, 403, { error: 'Account role verification failed. Contact the Manager.' });
      return null;
    }

    const context = {
      client,
      user,
      profile,
      isManager: isAllowlistedManager
    };
    if (options.manager && !context.isManager) {
      send(res, 403, { error: 'Authorised Manager access required.' });
      return null;
    }
    return context;
  } catch (error) {
    console.error('API authentication error:', error);
    send(res, error.status || 500, { error: error.status ? error.message : 'Unable to verify your account.' });
    return null;
  }
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function numericFields(body, keys) {
  const values = [];
  for (const key of keys) {
    const raw = body[key] === undefined || body[key] === null || body[key] === '' ? 0 : Number(body[key]);
    if (!Number.isFinite(raw) || raw < 0 || raw > 100000000) {
      throw new Error('KPI values must be valid non-negative numbers.');
    }
    values.push(raw);
  }
  return values;
}
