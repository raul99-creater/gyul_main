import { APP_CONFIG } from '../config.js';
import { renderFooter, renderHeader, setStatus, wireLogoutButtons } from '../core/ui.js';
import { getModeLabel, getSession, signIn } from '../core/service.js';
import { escapeHtml } from '../core/utils.js';

renderHeader('home');
renderFooter();
wireLogoutButtons();

document.getElementById('modeBadge').textContent = getModeLabel();
const session = await getSession();
if (session?.user) {
  document.getElementById('authHint').innerHTML = `현재 <strong>${escapeHtml(session.user.email)}</strong> 로 로그인된 상태입니다.`;
  document.getElementById('goDashboardWrap').classList.remove('hidden');
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  try {
    setStatus('로그인 중...', '');
    await signIn(email, password);
    setStatus('로그인되었습니다. 내 강의 페이지로 이동합니다.', 'ok');
    window.location.href = `${APP_CONFIG.siteBasePath || ''}/dashboard.html`;
  } catch (error) {
    setStatus(error.message || '로그인에 실패했습니다.', 'err');
  }
});
