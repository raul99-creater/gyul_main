import { APP_CONFIG } from './config.js';

let supabaseClient;

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  supabaseClient = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' }
  });
  return supabaseClient;
}

async function rpc(name, params = {}) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export const api = {
  getTokenInfo(token) { return rpc('app_get_signup_token_info', { p_token: token }); },
  signUp(token, fullName, phone) { return rpc('app_member_sign_up', { p_token: token, p_full_name: fullName, p_phone: phone }); },
  signIn(fullName, phone) { return rpc('app_member_sign_in', { p_full_name: fullName, p_phone: phone }); },
  getDashboard(sessionToken) { return rpc('app_member_get_dashboard', { p_session_token: sessionToken }); },
  submitEvent(sessionToken, eventId, answers) { return rpc('app_member_submit_event', { p_session_token: sessionToken, p_event_id: eventId, p_answers: answers }); },
  signOut(sessionToken) { return rpc('app_sign_out', { p_session_token: sessionToken }); }
};
