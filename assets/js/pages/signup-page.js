
import { APP_CONFIG } from '../config.js';
import { fetchTokenInfo, getModeLabel, getSession, signUpWithToken } from '../core/service.js';
import { renderFooter, renderHeader, setStatus } from '../core/ui.js';
import { escapeHtml, parseQuery } from '../core/utils.js';

renderHeader('signup');
renderFooter();
document.getElementById('modeBadge').textContent = getModeLabel();

const params = parseQuery();
const token = params.get('token') || '';
if (token) document.getElementById('token').value = token;

async function loadTokenInfo(currentToken) {
  if (!currentToken) {
    document.getElementById('tokenSummary').innerHTML = '<div class="empty-state">토큰이 아직 없습니다. 이 페이지는 <code>?token=...</code> 형식으로 여는 구조입니다.</div>';
    return;
  }
  try {
    const info = await fetchTokenInfo(currentToken);
    if (!info) {
      document.getElementById('tokenSummary').innerHTML = '<div class="empty-state">유효한 토큰을 찾지 못했습니다.</div>';
      return;
    }
    const course = info.course || {};
    document.getElementById('tokenSummary').innerHTML = `
      <div class="token-preview">
        <span class="pill orange">${escapeHtml(info.token_name || '회원가입 토큰')}</span>
        <h3 style="margin:12px 0 6px">${escapeHtml(course.title || '강의')}</h3>
        <p>${escapeHtml(info.welcome_message || course.subtitle || '강의별 회원가입 페이지입니다.')}</p>
        <div class="kv-list" style="margin-top:12px">
          <div class="kv-row"><strong>강의</strong><span>${escapeHtml(course.title || '-')}</span></div>
          <div class="kv-row"><strong>만료</strong><span>${escapeHtml(info.expires_at ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(info.expires_at)) : '미설정')}</span></div>
          <div class="kv-row"><strong>토큰</strong><span>${escapeHtml(info.token)}</span></div>
        </div>
      </div>`;
  } catch (error) {
    setStatus(error.message || '토큰 정보를 불러오지 못했습니다.', 'err');
  }
}

await loadTokenInfo(token);

document.getElementById('token').addEventListener('change', (event) => loadTokenInfo(event.target.value.trim()));

document.getElementById('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    setStatus('회원가입 처리 중...', '');
    const tokenValue = document.getElementById('token').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    await signUpWithToken({ token: tokenValue, email, password, fullName, phone });
    setStatus('회원가입이 완료되었습니다. 내 강의 페이지로 이동합니다.', 'ok');
    window.location.href = `${APP_CONFIG.siteBasePath || ''}/dashboard.html`;
  } catch (error) {
    setStatus(error.message || '회원가입에 실패했습니다.', 'err');
  }
});
