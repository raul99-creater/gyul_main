import { APP_CONFIG } from './config.js';
import { api } from './api.js';
import { qs, qsa, escapeHtml, formatDateTime, eventBucket, setMessage, saveSession, loadSession, clearSession, groupBy, buildCalendar } from './utils.js';

const sessionKey = APP_CONFIG.sessionStorageKey;

function currentPage() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  return path;
}

function ensureTitle() {
  document.title = APP_CONFIG.siteName;
  qsa('[data-site-name]').forEach((el) => { el.textContent = APP_CONFIG.siteName; });
}

async function initLoginPage() {
  const form = qs('#login-form');
  const message = qs('#login-message');
  const signupLink = qs('#go-signup');
  if (signupLink) signupLink.addEventListener('click', () => window.location.href = 'signup.html');
  const token = loadSession(sessionKey);
  if (token) {
    try {
      const dash = await api.getDashboard(token);
      if (dash?.ok) { window.location.replace('dashboard.html'); return; }
    } catch {}
  }
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(message, '');
    const fullName = qs('[name="full_name"]', form).value.trim();
    const phone = qs('[name="phone"]', form).value.trim();
    try {
      const res = await api.signIn(fullName, phone);
      if (!res?.ok) throw new Error(res?.message || '로그인에 실패했습니다.');
      saveSession(sessionKey, res.session_token);
      window.location.href = 'dashboard.html';
    } catch (err) {
      setMessage(message, err.message || '로그인에 실패했습니다.', 'error');
    }
  });
}

async function initSignupPage() {
  const form = qs('#signup-form');
  const message = qs('#signup-message');
  const tokenInput = qs('[name="token"]', form);
  const tokenInfo = qs('#token-info');
  const queryToken = new URLSearchParams(window.location.search).get('token') || '';
  if (queryToken) tokenInput.value = queryToken;

  async function renderTokenInfo() {
    const token = tokenInput.value.trim();
    if (!token) { tokenInfo.innerHTML = ''; return; }
    try {
      const res = await api.getTokenInfo(token);
      if (res?.ok) {
        tokenInfo.innerHTML = `<div class="notice-box"><div class="kv-list"><div class="kv-row"><strong>강의</strong><span>${escapeHtml(res.course_title)}</span></div><div class="kv-row"><strong>강사</strong><span>${escapeHtml(res.instructor_name)} · ${escapeHtml(res.cohort_label)}</span></div></div></div>`;
      } else {
        tokenInfo.innerHTML = `<div class="status-bar err">${escapeHtml(res?.message || '토큰을 확인해주세요.')}</div>`;
      }
    } catch (err) {
      tokenInfo.innerHTML = `<div class="status-bar err">${escapeHtml(err.message || '토큰 조회에 실패했습니다.')}</div>`;
    }
  }
  tokenInput?.addEventListener('blur', renderTokenInfo);
  if (queryToken) renderTokenInfo();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(message, '');
    const token = tokenInput.value.trim();
    const fullName = qs('[name="full_name"]', form).value.trim();
    const phone = qs('[name="phone"]', form).value.trim();
    try {
      const res = await api.signUp(token, fullName, phone);
      if (!res?.ok) throw new Error(res?.message || '회원가입에 실패했습니다.');
      saveSession(sessionKey, res.session_token);
      window.location.href = 'dashboard.html';
    } catch (err) {
      setMessage(message, err.message || '회원가입에 실패했습니다.', 'error');
    }
  });
}

function renderCalendar(schedule, selectedCourseId) {
  const shell = qs('#calendar-shell');
  if (!shell) return;
  const events = (schedule || []).filter((item) => !selectedCourseId || item.course_id === selectedCourseId);
  const cal = buildCalendar(events);
  const names = ['일','월','화','수','목','금','토'];
  shell.innerHTML = `
    <div class="calendar-head"><div><h3 class="section-title">${cal.year}.${String(cal.month).padStart(2,'0')}</h3></div></div>
    <div class="calendar-grid">${names.map((n) => `<div class="day-name">${n}</div>`).join('')}${cal.days.map((day) => day ? `
      <div class="day-cell">
        <div class="day-num">${day.date.getDate()}</div>
        ${day.items.map((item) => `<span class="event-chip">${escapeHtml(item.title)}</span>`).join('')}
      </div>
    ` : `<div class="day-cell" style="background:transparent;border:none;box-shadow:none"></div>`).join('')}</div>
  `;
}

function renderEvents(data, selectedCourseId) {
  const openWrap = qs('#events-open');
  const closedWrap = qs('#events-closed');
  const upcomingWrap = qs('#events-upcoming');
  if (!openWrap) return;
  const appsByEvent = Object.fromEntries((data.applications || []).map((a) => [a.event_id, a]));
  const events = (data.events || []).filter((item) => !selectedCourseId || item.course_id === selectedCourseId);
  const buckets = { open: [], closed: [], upcoming: [] };
  events.forEach((event) => buckets[eventBucket(event)].push(event));
  const card = (event) => `
    <article class="card">
      <div class="card-header"><div><h4>${escapeHtml(event.title)}</h4><p>${escapeHtml(event.description || '')}</p></div><span class="pill ${eventBucket(event) === 'open' ? 'green' : eventBucket(event) === 'upcoming' ? 'blue' : 'red'}">${eventBucket(event) === 'open' ? '모집중' : eventBucket(event) === 'upcoming' ? '예정' : '마감'}</span></div>
      <div class="kv-list">
        <div class="kv-row"><strong>행사일</strong><span>${formatDateTime(event.starts_at)}</span></div>
        <div class="kv-row"><strong>마감</strong><span>${formatDateTime(event.registration_close_at)}</span></div>
      </div>
      <div class="row" style="margin-top:10px">
        ${appsByEvent[event.id] ? '<button class="btn btn-secondary small" disabled>신청완료</button>' : eventBucket(event) === 'open' ? `<button class="btn btn-primary small" data-apply-event="${event.id}">신청하기</button>` : ''}
      </div>
    </article>
  `;
  openWrap.innerHTML = buckets.open.length ? buckets.open.map(card).join('') : '<div class="empty-state">모집중인 행사가 없습니다.</div>';
  upcomingWrap.innerHTML = buckets.upcoming.length ? buckets.upcoming.map(card).join('') : '<div class="empty-state">예정된 행사가 없습니다.</div>';
  closedWrap.innerHTML = buckets.closed.length ? buckets.closed.map(card).join('') : '<div class="empty-state">마감된 행사가 없습니다.</div>';
}

function renderAssignments(assignments, selectedCourseId) {
  const wrap = qs('#assignments-wrap');
  if (!wrap) return;
  const list = (assignments || []).filter((item) => !selectedCourseId || item.course_id === selectedCourseId);
  const grouped = groupBy(list, (item) => item.week_no || 0);
  const weeks = Object.keys(grouped).sort((a,b) => Number(a) - Number(b));
  wrap.innerHTML = weeks.length ? weeks.map((week) => `
    <section class="assignment-week">
      <h4>${week}주차</h4>
      ${(grouped[week] || []).map((item) => `
        <div class="assignment-item">
          <div class="row" style="justify-content:space-between"><strong>${escapeHtml(item.title)}</strong><span class="muted">${formatDateTime(item.due_at)}</span></div>
          <p>${escapeHtml(item.description || '')}</p>
          ${item.link_url ? `<div style="margin-top:8px"><a class="btn btn-secondary small" href="${escapeHtml(item.link_url)}" target="_blank" rel="noreferrer">과제 링크</a></div>` : ''}
        </div>
      `).join('')}
    </section>
  `).join('') : '<div class="empty-state">등록된 과제가 없습니다.</div>';
}

function attachEventApply(data, selectedCourseId, sessionToken) {
  qsa('[data-apply-event]').forEach((button) => {
    button.addEventListener('click', () => {
      const event = data.events.find((item) => item.id === button.dataset.applyEvent && (!selectedCourseId || item.course_id === selectedCourseId));
      if (!event) return;
      openEventModal(event, sessionToken);
    });
  });
}

function openEventModal(event, sessionToken) {
  const modal = qs('#event-modal');
  const title = qs('#event-modal-title');
  const body = qs('#event-modal-body');
  const form = qs('#event-apply-form');
  const msg = qs('#event-modal-message');
  title.textContent = event.title;
  body.innerHTML = (event.form_schema || []).map((q) => {
    if (q.type === 'choice') {
      return `
        <div class="field">
          <label>${escapeHtml(q.label)}</label>
          <select class="select" name="${escapeHtml(q.id)}" ${q.required ? 'required' : ''}>
            <option value="">선택</option>
            ${(q.options || []).map((opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label || opt.value)}</option>`).join('')}
          </select>
        </div>`;
    }
    if (q.type === 'paragraph') {
      return `<div class="field"><label>${escapeHtml(q.label)}</label><textarea class="textarea" name="${escapeHtml(q.id)}" ${q.required ? 'required' : ''}></textarea></div>`;
    }
    return `<div class="field"><label>${escapeHtml(q.label)}</label><input class="input" name="${escapeHtml(q.id)}" ${q.required ? 'required' : ''}></div>`;
  }).join('');
  form.onsubmit = async (e) => {
    e.preventDefault();
    setMessage(msg, '');
    const answers = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await api.submitEvent(sessionToken, event.id, answers);
      if (!res?.ok) throw new Error(res?.message || '신청에 실패했습니다.');
      setMessage(msg, '신청이 완료되었습니다.');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setMessage(msg, err.message || '신청에 실패했습니다.', 'error');
    }
  };
  modal.hidden = false;
}

function closeModal() { const modal = qs('#event-modal'); if (modal) modal.hidden = true; }

async function initDashboardPage() {
  const sessionToken = loadSession(sessionKey);
  if (!sessionToken) { window.location.replace('index.html'); return; }
  const status = qs('#dashboard-message');
  try {
    const data = await api.getDashboard(sessionToken);
    if (!data?.ok) throw new Error(data?.message || '데이터를 불러오지 못했습니다.');
    qs('#member-name').textContent = data.profile?.full_name || '';
    const tabs = qs('#course-tabs');
    const courses = data.courses || [];
    let selectedCourseId = courses[0]?.id || '';
    function paint() {
      tabs.innerHTML = courses.map((course) => `<button class="course-tab ${course.id === selectedCourseId ? 'active' : ''}" data-course-tab="${course.id}">${escapeHtml(course.instructor_name)} ${escapeHtml(course.cohort_label)}</button>`).join('');
      const selected = courses.find((c) => c.id === selectedCourseId);
      qs('#course-head').innerHTML = selected ? `<div class="card"><div class="card-header"><div><h3>${escapeHtml(selected.title)}</h3><p>${escapeHtml(selected.instructor_name)} · ${escapeHtml(selected.cohort_label)}</p></div><span class="pill orange">배정됨</span></div><p>${escapeHtml(selected.description || '')}</p></div>` : '<div class="empty-state">배정된 강의가 없습니다.</div>';
      renderCalendar(data.schedule || [], selectedCourseId);
      renderEvents(data, selectedCourseId);
      renderAssignments(data.assignments || [], selectedCourseId);
      attachEventApply(data, selectedCourseId, sessionToken);
      qsa('[data-course-tab]').forEach((button) => button.addEventListener('click', () => { selectedCourseId = button.dataset.courseTab; paint(); }));
    }
    paint();
  } catch (err) {
    setMessage(status, err.message || '데이터를 불러오지 못했습니다.', 'error');
  }
  qs('#signout-btn')?.addEventListener('click', async () => {
    try { await api.signOut(sessionToken); } catch {}
    clearSession(sessionKey);
    window.location.replace('index.html');
  });
  qs('#modal-close')?.addEventListener('click', closeModal);
  qs('#event-modal')?.addEventListener('click', (e) => { if (e.target.id === 'event-modal') closeModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

ensureTitle();
if (currentPage() === 'index.html' || currentPage() === '') initLoginPage();
if (currentPage() === 'signup.html') initSignupPage();
if (currentPage() === 'dashboard.html') initDashboardPage();
