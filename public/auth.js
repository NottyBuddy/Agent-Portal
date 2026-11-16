/* Supabase browser auth. The anon key is public; service-role and AI keys stay server-side. */
(function () {
  let client = null;
  const ready = (async () => {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || 'Authentication configuration is unavailable.');
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase authentication library could not be loaded.');
    }
    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  })();

  window.agentAuthReady = ready;
  window.agentAuth = {
    async getSession() {
      await ready;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async startLogin({ email }) {
      await ready;
      const { error } = await client.auth.signInWithOtp({
        email: String(email || '').trim().toLowerCase(),
        options: { shouldCreateUser: true }
      });
      if (error) throw error;
      return { has_passkey: false };
    },
    async verifyCode({ email, code }) {
      await ready;
      const { data, error } = await client.auth.verifyOtp({
        email: String(email || '').trim().toLowerCase(),
        token: String(code || '').trim(),
        type: 'email'
      });
      if (error) throw error;
      return data;
    },
    async accessToken() {
      const session = await this.getSession();
      return session?.access_token || '';
    },
    async signOut() {
      await ready;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    supportsPasskeys() { return false; },
    async registerPasskey() { throw new Error('Passkeys are not enabled in this sign-in flow.'); }
  };
})();
