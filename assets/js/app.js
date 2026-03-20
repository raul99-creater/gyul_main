import { APP_CONFIG } from './config.js';
import { api } from './api.js';
import { qs, qsa, escapeHtml, formatDateTime, eventBucket, setMessage, saveSession, loadSession, clearSession, groupBy, buildCalendar } from './utils.js';

const sessionKey = APP_CONFIG.sessionStorageKey;
const uiState = { calendarYear: null, calendarMonth: null, dashboardData: null, selectedCourseId: '' };

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
  const tokenField = qs('#token-field');
  const privacyToggle = qs('#privacy-toggle');
  const privacyBody = qs('#privacy-detail');
  const queryToken = new URLSearchParams(window.location.search).get('token') || '';
  if (queryToken) {
    tokenInput.value = queryToken;
    if (tokenField) tokenField.hidden = true;
  }
  privacyToggle?.addEventListener('click', () => {
    const expanded = privacyToggle.getAttribute('aria-expanded') === 'true';
    privacyToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (privacyBody) privacyBody.hidden = expanded;
  });

  async function renderTokenInfo() {
    const token = tokenInput.value.trim();
    if (!token) {
      tokenInfo.innerHTML = '<div class="status-bar err">유효한 회원가입 링크로 접속해주세요.</div>';
      return;
    }
    try {
      const res = await api.getTokenInfo(token);
      if (res?.ok) {
        tokenInfo.innerHTML = `<div class="notice-box"><div class="kv-list"><div class="kv-row"><strong>강의</strong><span>${escapeHtml(res.course_title)}</span></div><div class="kv-row"><strong>강사</strong><span>${escapeHtml(res.instructor_name)} · ${escapeHtml(res.cohort_label)}</span></div></div></div>`;
      } else {
        tokenInfo.innerHTML = `<div class="status-bar err">${escapeHtml(res?.message || '가입 링크를 확인해주세요.')}</div>`;
      }
    } catch (err) {
      tokenInfo.innerHTML = `<div class="status-bar err">${escapeHtml(err.message || '가입 링크 확인에 실패했습니다.')}</div>`;
    }
  }
  tokenInput?.addEventListener('blur', renderTokenInfo);
  renderTokenInfo();

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(message, '');
    const token = tokenInput.value.trim();
    const fullName = qs('[name="full_name"]', form).value.trim();
    const phone = qs('[name="phone"]', form).value.trim();
    const agreed = qs('[name="privacy_agree"]', form)?.checked;
    if (!agreed) {
      setMessage(message, '개인정보 수집 및 이용에 동의해야 회원가입할 수 있습니다.', 'error');
      return;
    }
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

function renderCalendar(schedule, selectedCourseId, data = {}) {
  const shell = qs('#calendar-shell');
  if (!shell) return;
  const baseDate = uiState.calendarYear && uiState.calendarMonth ? new Date(uiState.calendarYear, uiState.calendarMonth - 1, 1) : new Date();
  uiState.calendarYear = baseDate.getFullYear();
  uiState.calendarMonth = baseDate.getMonth() + 1;
  const scheduleItems = (schedule || []).filter((item) => !selectedCourseId || item.course_id === selectedCourseId).map((item) => ({
    starts_at: item.starts_at,
    title: item.title,
    chipClass: 'regular'
  }));
  const applicationMap = new Set((data.applications || []).map((item) => item.event_id));
  const appliedEvents = (data.events || []).filter((item) => (!selectedCourseId || item.course_id === selectedCourseId) && applicationMap.has(item.id)).map((item) => ({
    starts_at: item.starts_at,
    title: item.title,
    chipClass: 'applied'
  }));
  const openRecruit = (data.events || []).filter((item) => (!selectedCourseId || item.course_id === selectedCourseId) && eventBucket(item) === 'open').map((item) => ({
    starts_at: item.registration_open_at || item.starts_at,
    title: item.title,
    chipClass: 'recruit-open'
  }));
  const upcomingRecruit = (data.events || []).filter((item) => (!selectedCourseId || item.course_id === selectedCourseId) && eventBucket(item) === 'upcoming').map((item) => ({
    starts_at: item.registration_open_at || item.starts_at,
    title: item.title,
    chipClass: 'upcoming'
  }));
  const assignmentItems = (data.assignments || []).filter((item) => !selectedCourseId || item.course_id === selectedCourseId).map((item) => ({
    starts_at: item.due_at,
    title: item.title,
    chipClass: 'assignment'
  }));
  const cal = buildCalendar([...scheduleItems, ...appliedEvents, ...openRecruit, ...upcomingRecruit, ...assignmentItems], uiState.calendarYear, uiState.calendarMonth);
  const names = ['일','월','화','수','목','금','토'];
  shell.innerHTML = `
    <div class="calendar-head"><div><h3 class="section-title">${cal.year}.${String(cal.month).padStart(2,'0')}</h3><div class="legend-row"><span class="legend-chip"><span class="legend-dot regular"></span>정규 일정</span><span class="legend-chip"><span class="legend-dot applied"></span>신청 완료</span><span class="legend-chip"><span class="legend-dot recruit-open"></span>모집중 행사</span><span class="legend-chip"><span class="legend-dot upcoming"></span>모집 예정</span><span class="legend-chip"><span class="legend-dot assignment"></span>과제 마감</span></div></div><div class="calendar-nav"><button class="btn btn-secondary small" type="button" id="calendar-prev">이전달</button><button class="btn btn-secondary small" type="button" id="calendar-next">다음달</button></div></div>
    <div class="calendar-grid">${names.map((n) => `<div class="day-name">${n}</div>`).join('')}${cal.days.map((day) => day ? `
      <div class="day-cell">
        <div class="day-num">${day.date.getDate()}</div>
        ${day.items.map((item) => `<span class="event-chip ${item.chipClass || ''}">${escapeHtml(item.title)}</span>`).join('')}
      </div>
    ` : `<div class="day-cell calendar-blank"></div>`).join('')}</div>
  `;
  qs('#calendar-prev')?.addEventListener('click', () => {
    const prev = new Date(uiState.calendarYear, uiState.calendarMonth - 2, 1);
    uiState.calendarYear = prev.getFullYear();
    uiState.calendarMonth = prev.getMonth() + 1;
    renderCalendar(schedule, selectedCourseId, data);
  });
  qs('#calendar-next')?.addEventListener('click', () => {
    const next = new Date(uiState.calendarYear, uiState.calendarMonth, 1);
    uiState.calendarYear = next.getFullYear();
    uiState.calendarMonth = next.getMonth() + 1;
    renderCalendar(schedule, selectedCourseId, data);
  });
}

function canCancelEvent(event) {
  if (!event) return false;
  if (!event.starts_at) return true;
  return new Date(event.starts_at).getTime() > Date.now();
}

async function openSupportModal(sessionToken, course) {
  const modal = qs('#support-modal');
  const title = qs('#support-modal-title');
  const subtitle = qs('#support-modal-subtitle');
  const body = qs('#support-modal-body');
  if (!modal || !course) return;
  title.textContent = '문의하기';
  subtitle.textContent = `${course.instructor_name} · ${course.cohort_label}`;
  body.innerHTML = '<div class="empty-state">고객센터 목록을 불러오는 중입니다.</div>';
  modal.hidden = false;
  try {
    const res = await api.listSupportLinks(sessionToken, course.id);
    const items = res?.items || [];
    body.innerHTML = items.length ? items.map((item) => `<a class="support-link-button" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(item.label || '문의하기')}</span><span class="support-link-meta">오픈카톡으로 이동</span></a>`).join('') : '<div class="empty-state">등록된 고객센터가 없습니다.</div>';
  } catch (err) {
    body.innerHTML = `<div class="status-bar err">${escapeHtml(err.message || '고객센터를 불러오지 못했습니다.')}</div>`;
  }
}

function closeSupportModal() { const modal = qs('#support-modal'); if (modal) modal.hidden = true; }

function renderEvents(data, selectedCourseId, sessionToken) {
  const openWrap = qs('#events-open');
  const closedWrap = qs('#events-closed');
  const upcomingWrap = qs('#events-upcoming');
  if (!openWrap) return;
  const appsByEvent = Object.fromEntries((data.applications || []).map((a) => [a.event_id, a]));
  const events = (data.events || []).filter((item) => !selectedCourseId || item.course_id === selectedCourseId);
  const buckets = { open: [], closed: [], upcoming: [] };
  events.forEach((event) => buckets[eventBucket(event)].push(event));
  const card = (event) => {
    const applied = !!appsByEvent[event.id];
    const canCancel = applied && canCancelEvent(event);
    return `
    <article class="card">
      <div class="card-header"><div><h4>${escapeHtml(event.title)}</h4><p>${escapeHtml(event.description || '')}</p></div><span class="pill ${eventBucket(event) === 'open' ? 'green' : eventBucket(event) === 'upcoming' ? 'blue' : 'red'}">${eventBucket(event) === 'open' ? '모집중' : eventBucket(event) === 'upcoming' ? '예정' : '마감'}</span></div>
      <div class="kv-list">
        <div class="kv-row"><strong>행사일</strong><span>${formatDateTime(event.starts_at)}</span></div>
        <div class="kv-row"><strong>마감</strong><span>${formatDateTime(event.registration_close_at)}</span></div>
      </div>
      <div class="row" style="margin-top:10px">
        ${applied ? `<button class="btn btn-secondary small" disabled>신청완료</button>${canCancel ? `<button class="btn btn-ghost small" data-cancel-event="${event.id}">취소하기</button>` : ''}` : eventBucket(event) === 'open' ? `<button class="btn btn-primary small" data-apply-event="${event.id}">신청하기</button>` : ''}
      </div>
    </article>`;
  };
  openWrap.innerHTML = buckets.open.length ? buckets.open.map(card).join('') : '<div class="empty-state">모집중인 행사가 없습니다.</div>';
  upcomingWrap.innerHTML = buckets.upcoming.length ? buckets.upcoming.map(card).join('') : '<div class="empty-state">예정된 행사가 없습니다.</div>';
  closedWrap.innerHTML = buckets.closed.length ? buckets.closed.map(card).join('') : '<div class="empty-state">마감된 행사가 없습니다.</div>';
  qsa('[data-cancel-event]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('행사 신청을 취소하시겠습니까?')) return;
    try {
      const res = await api.cancelEvent(sessionToken, button.dataset.cancelEvent);
      if (!res?.ok) throw new Error(res?.message || '신청 취소에 실패했습니다.');
      window.location.reload();
    } catch (err) {
      setMessage(qs('#dashboard-message'), err.message || '신청 취소에 실패했습니다.', 'error');
    }
  }));
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
    uiState.dashboardData = data;
    if (!data?.ok) throw new Error(data?.message || '데이터를 불러오지 못했습니다.');
    qs('#member-name').textContent = data.profile?.full_name || '';
    const tabs = qs('#course-tabs');
    const courses = data.courses || [];
    let selectedCourseId = courses[0]?.id || '';
    function paint() {
      tabs.innerHTML = courses.map((course) => `<button class="course-tab ${course.id === selectedCourseId ? 'active' : ''}" data-course-tab="${course.id}">${escapeHtml(course.instructor_name)} ${escapeHtml(course.cohort_label)}</button>`).join('');
      const selected = courses.find((c) => c.id === selectedCourseId);
      qs('#course-head').innerHTML = selected ? `<div class="card"><div class="card-header"><div><h3>${escapeHtml(selected.title)}</h3><p>${escapeHtml(selected.instructor_name)} · ${escapeHtml(selected.cohort_label)}</p></div><span class="pill orange">배정됨</span></div><p>${escapeHtml(selected.description || '')}</p><div class="course-head-actions"><button class="btn btn-secondary small" type="button" id="support-open-btn">문의하기</button></div></div>` : '<div class="empty-state">배정된 강의가 없습니다.</div>';
      renderCalendar(data.schedule || [], selectedCourseId, data);
      renderEvents(data, selectedCourseId, sessionToken);
      renderAssignments(data.assignments || [], selectedCourseId);
      attachEventApply(data, selectedCourseId, sessionToken);
      qs('#support-open-btn')?.addEventListener('click', () => openSupportModal(sessionToken, selected));
      qsa('[data-course-tab]').forEach((button) => button.addEventListener('click', () => { selectedCourseId = button.dataset.courseTab; uiState.selectedCourseId = selectedCourseId; uiState.calendarYear = null; uiState.calendarMonth = null; paint(); }));
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
  qs('#support-modal-close')?.addEventListener('click', closeSupportModal);
  qs('#event-modal')?.addEventListener('click', (e) => { if (e.target.id === 'event-modal') closeModal(); });
  qs('#support-modal')?.addEventListener('click', (e) => { if (e.target.id === 'support-modal') closeSupportModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeSupportModal(); } });
}

ensureTitle();
if (currentPage() === 'index.html' || currentPage() === '') initLoginPage();
if (currentPage() === 'signup.html') initSignupPage();
if (currentPage() === 'dashboard.html') initDashboardPage();
