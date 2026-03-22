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


async function supportTableSelect(courseId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('course_support_links')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    label: row.label || row.title || row.name || row.item || '문의',
    title: row.title || row.label || row.name || row.item || '문의하기',
    url: row.url || row.link || row.openchat_url || ''
  }));
}

export const api = {
  getTokenInfo(token) { return rpc('app_get_signup_token_info', { p_token: token }); },
  signUp(token, fullName, phone) { return rpc('app_member_sign_up', { p_token: token, p_full_name: fullName, p_phone: phone }); },
  signIn(fullName, phone) { return rpc('app_member_sign_in', { p_full_name: fullName, p_phone: phone }); },
  getDashboard(sessionToken) { return rpc('app_member_get_dashboard', { p_session_token: sessionToken }); },
  submitEvent(sessionToken, eventId, answers) { return rpc('app_member_submit_event', { p_session_token: sessionToken, p_event_id: eventId, p_answers: answers }); },
  cancelEvent(sessionToken, eventId) { return rpc('app_member_cancel_event', { p_session_token: sessionToken, p_event_id: eventId }); },
  async listSupportLinks(sessionToken, courseId) {
    const tryCalls = [
      () => rpc('app_member_list_support_links', { p_session_token: sessionToken, p_course_id: courseId }),
      () => rpc('app_member_list_support_links', { p_course_id: courseId }),
      () => rpc('app_member_list_support_links', courseId ? { course_id: courseId } : {}),
      () => supportTableSelect(courseId)
    ];
    let lastErr;
    for (const fn of tryCalls) {
      try {
        const data = await fn();
        const rows = Array.isArray(data) ? data : (data?.items || data?.data || []);
        return { items: rows.map((row) => ({
          ...row,
          label: row.label || row.title || row.name || row.item || '문의',
          title: row.title || row.label || row.name || row.item || '문의하기',
          url: row.url || row.link || row.openchat_url || ''
        })) };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  },
  signOut(sessionToken) { return rpc('app_sign_out', { p_session_token: sessionToken }); }
};
