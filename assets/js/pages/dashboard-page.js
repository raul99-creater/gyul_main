import { APP_CONFIG } from '../config.js';
import { renderMonthCalendar } from '../core/calendar.js';
import { buildEventBucketsForCourse, getModeLabel, getSession, loadDashboardData } from '../core/service.js';
import { renderFooter, renderHeader, setStatus, wireLogoutButtons } from '../core/ui.js';
import { escapeHtml, fmtDate } from '../core/utils.js';

renderHeader('dashboard');
renderFooter();
wireLogoutButtons();

document.getElementById('modeBadge').textContent = getModeLabel();
const session = await getSession();
if (!session?.user) {
  window.location.href = `${APP_CONFIG.siteBasePath || ''}/index.html`;
}
const dashboard = await loadDashboardData();
const state = {
  selectedCourseId: dashboard.courses[0]?.id || null,
  cursor: new Date(),
};

function getSelectedCourse() {
  return dashboard.courses.find((course) => course.id === state.selectedCourseId) || dashboard.courses[0] || null;
}

function renderSummary() {
  document.getElementById('profileName').textContent = dashboard.profile?.full_name || dashboard.session?.user?.email || '-';
  document.getElementById('profileEmail').textContent = dashboard.session?.user?.email || '-';
  const isSuper = dashboard.adminScope?.isSuperAdmin;
  const isCourseAdmin = !isSuper && (dashboard.adminScope?.roles || []).some((item) => item.role_type === 'course_admin');
  document.getElementById('profileRole').textContent = isSuper ? '슈퍼어드민' : isCourseAdmin ? '강사 어드민 겸 수강생' : '수강생';
  document.getElementById('statCourses').textContent = String(dashboard.courses.length);
  document.getElementById('statEvents').textContent = String(dashboard.events.length);
  document.getElementById('statAssignments').textContent = String(dashboard.assignments.length);
  document.getElementById('statSchedules').textContent = String(dashboard.schedule.length);
  if ((isSuper || isCourseAdmin) && APP_CONFIG.adminAppUrl) {
    const wrap = document.getElementById('adminLinkWrap');
    wrap.classList.remove('hidden');
    wrap.innerHTML = `<a class="btn btn-secondary small" href="${APP_CONFIG.adminAppUrl}" target="_blank" rel="noopener">분리된 어드민 열기</a>`;
  }
}

function renderCourseTabs() {
  const target = document.getElementById('courseTabs');
  if (!dashboard.courses.length) {
    target.innerHTML = '<div class="empty-state">배정된 강의가 없습니다. 토큰 회원가입 또는 어드민 배정을 먼저 확인하세요.</div>';
    return;
  }
  target.innerHTML = dashboard.courses.map((course) => {
    const meta = [course.instructor_name, course.cohort_label].filter(Boolean).join(' · ');
    return `<button type="button" class="course-tab ${course.id === state.selectedCourseId ? 'active' : ''}" data-course-id="${course.id}"><strong>${escapeHtml(course.title)}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</button>`;
  }).join('');
}

function renderCourseHero() {
  const course = getSelectedCourse();
  const target = document.getElementById('courseHero');
  if (!course) {
    target.innerHTML = '<div class="empty-state">표시할 강의가 없습니다.</div>';
    return;
  }
  const meta = [course.instructor_name ? `${course.instructor_name} 강사` : '', course.cohort_label || '기수 미설정'].filter(Boolean).join(' · ');
  target.innerHTML = `
    <div class="hero-course" style="border-color:${escapeHtml(course.accent_color || '#ff9d4d')}22;background:linear-gradient(180deg,#fff7ef,rgba(255,255,255,.98))">
      <span class="eyebrow">MY COURSE</span>
      <h2>${escapeHtml(course.title)}</h2>
      <p>${escapeHtml(course.subtitle || course.description || '설명이 아직 없습니다.')}</p>
      <div class="row"><span class="pill orange">${escapeHtml(meta)}</span></div>
    </div>`;
}

function renderCalendarSection() {
  const course = getSelectedCourse();
  document.getElementById('calendarTitle').textContent = `${state.cursor.getFullYear()}년 ${state.cursor.getMonth() + 1}월 일정`;
  if (!course) return renderMonthCalendar(document.getElementById('calendarGrid'), [], state.cursor);
  const items = [
    ...dashboard.schedule.filter((item) => item.course_id === course.id).map((item) => ({ ...item, title: `[일정] ${item.title}` })),
    ...dashboard.events.filter((item) => item.course_id === course.id).map((item) => ({ ...item, title: `[행사] ${item.title}` })),
  ];
  renderMonthCalendar(document.getElementById('calendarGrid'), items, state.cursor);
}

function renderEventColumns() {
  const course = getSelectedCourse();
  const target = document.getElementById('eventColumns');
  if (!course) {
    target.innerHTML = '<div class="empty-state">행사가 없습니다.</div>';
    return;
  }
  const buckets = buildEventBucketsForCourse(dashboard.events, course.id);
  const bucketConfig = [
    ['모집중인 행사', buckets.open, 'green'],
    ['마감된 행사', buckets.closed, 'red'],
    ['예정된 행사', buckets.upcoming, 'blue'],
  ];
  target.innerHTML = bucketConfig.map(([label, list, color]) => `
    <div class="card">
      <div class="card-header"><h3>${label}</h3><span class="pill ${color}">${list.length}</span></div>
      <div class="event-list">
        ${list.length ? list.map((event) => `
          <div class="assignment-week">
            <div class="row" style="justify-content:space-between;align-items:flex-start">
              <strong>${escapeHtml(event.title)}</strong>
              <span class="badge badge-outline">${escapeHtml(event.category || 'event')}</span>
            </div>
            <div class="muted" style="margin-top:6px">${escapeHtml(fmtDate(event.starts_at))}${event.ends_at ? ` ~ ${escapeHtml(fmtDate(event.ends_at))}` : ''}</div>
            <div class="muted">${escapeHtml(event.location || '')}</div>
            <div class="muted">${escapeHtml(event.description || '')}</div>
            ${(event.registration_open_at || event.registration_close_at) ? `<div class="notice-box" style="margin-top:10px">모집 기간: ${escapeHtml(fmtDate(event.registration_open_at))} ~ ${escapeHtml(fmtDate(event.registration_close_at))}</div>` : ''}
            ${event.apply_url ? `<div style="margin-top:10px"><a class="btn btn-secondary small" href="${escapeHtml(event.apply_url)}" target="_blank" rel="noopener">신청 링크 열기</a></div>` : ''}
          </div>`).join('') : '<div class="empty-state">표시할 항목이 없습니다.</div>'}
      </div>
    </div>`).join('');
}

function renderScheduleList() {
  const course = getSelectedCourse();
  const target = document.getElementById('scheduleList');
  if (!course) {
    target.innerHTML = '<div class="empty-state">일정이 없습니다.</div>';
    return;
  }
  const rows = dashboard.schedule.filter((item) => item.course_id === course.id);
  target.innerHTML = rows.length ? rows.map((item) => `
    <div class="assignment-week">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <strong>${escapeHtml(item.week_no ? `${item.week_no}주차 · ` : '')}${escapeHtml(item.title)}</strong>
          <div class="muted">${escapeHtml(fmtDate(item.starts_at))} ~ ${escapeHtml(fmtDate(item.ends_at))}</div>
          <div class="muted">${escapeHtml(item.location || '')}</div>
        </div>
        <span class="pill orange">일정</span>
      </div>
      ${item.description ? `<div class="muted" style="margin-top:8px">${escapeHtml(item.description)}</div>` : ''}
    </div>`).join('') : '<div class="empty-state">등록된 강의 일정이 없습니다.</div>';
}

function renderAssignments() {
  const course = getSelectedCourse();
  const target = document.getElementById('assignmentList');
  if (!course) {
    target.innerHTML = '<div class="empty-state">과제가 없습니다.</div>';
    return;
  }
  const list = dashboard.assignments.filter((item) => item.course_id === course.id);
  const grouped = list.reduce((acc, item) => {
    const key = item.week_no || 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const weeks = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
  target.innerHTML = weeks.length ? weeks.map((week) => `
    <div class="assignment-week">
      <div class="card-header" style="margin-bottom:8px"><h3>${week}주차 과제</h3><span class="pill orange">${grouped[week].length}개</span></div>
      ${grouped[week].map((item) => `
        <div class="assignment-item">
          <div class="row" style="justify-content:space-between;align-items:flex-start">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="badge badge-outline">${item.is_required ? '필수' : '선택'}</span>
          </div>
          <div class="muted" style="margin-top:6px">마감: ${escapeHtml(fmtDate(item.due_at))}</div>
          <div class="muted">${escapeHtml(item.description || '')}</div>
          ${item.material_url ? `<div style="margin-top:8px"><a class="btn btn-ghost small" href="${escapeHtml(item.material_url)}" target="_blank" rel="noopener">자료 열기</a></div>` : ''}
        </div>`).join('')}
    </div>`).join('') : '<div class="empty-state">주차별 과제가 아직 없습니다.</div>';
}

function wireEvents() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-course-id]');
    if (button) {
      state.selectedCourseId = button.dataset.courseId;
      renderAll();
    }
    if (event.target.closest('[data-cal="prev"]')) {
      state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
      renderCalendarSection();
    }
    if (event.target.closest('[data-cal="next"]')) {
      state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
      renderCalendarSection();
    }
  });
}

function renderAll() {
  renderSummary();
  renderCourseTabs();
  renderCourseHero();
  renderCalendarSection();
  renderEventColumns();
  renderScheduleList();
  renderAssignments();
}

wireEvents();
renderAll();
setStatus('내 강의 대시보드를 불러왔습니다.', 'ok');
