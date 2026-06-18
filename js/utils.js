/**
 * EAS Field Capture QCM — Utilities
 */

export const SYSTEM_NAME = 'EAS | UECS Field Capture + QCM Intake System';
export const VERSION = 'EAS Field Capture QCM v1.0';
export const PHASE = 'Phase 1 Phone Camera PWA';

export const DISCLAIMER =
  'This system supports visual and spatial documentation quality control only. QCM results evaluate image clarity, coverage, metadata, and documentation readiness. QCM does not provide engineering opinions, inspection conclusions, code compliance determinations, damage diagnosis, or repair recommendations.';

export const SERVICE_PATHWAYS = {
  XPD_STORM: 'XPD Storm Snapshot',
  XPD_BASELINE: 'XPD Exterior Baseline Snapshot',
  XPD_PROPERTY: 'XPD Exterior Property Record',
  XPD_AERIAL: 'XPD Exterior + Aerial Baseline',
  EAS_LEVEL_I: 'EAS Level I Baseline Documentation',
  EAS_LEVEL_II: 'EAS Level II Inspection Documentation',
  EAS_LEVEL_III: 'EAS Level III Spatial Documentation',
};

export const DOC_CONTROL_OPTIONS = ['UECS-Lite', 'UECS-S', 'UECS-V', 'Admin Review Required'];

export const PATHWAY_DOC_CONTROL = {
  [SERVICE_PATHWAYS.XPD_STORM]: 'UECS-Lite',
  [SERVICE_PATHWAYS.XPD_BASELINE]: 'UECS-Lite',
  [SERVICE_PATHWAYS.XPD_PROPERTY]: 'UECS-Lite',
  [SERVICE_PATHWAYS.XPD_AERIAL]: 'UECS-Lite',
  [SERVICE_PATHWAYS.EAS_LEVEL_I]: 'UECS-S',
  [SERVICE_PATHWAYS.EAS_LEVEL_II]: 'UECS-S',
  [SERVICE_PATHWAYS.EAS_LEVEL_III]: 'UECS-S',
};

export const AERIAL_PATHWAYS = [
  SERVICE_PATHWAYS.XPD_AERIAL,
];

export const AERIAL_STATUS_OPTIONS = [
  { value: 'pending', label: 'Aerial capture pending' },
  { value: 'not_required', label: 'Aerial not required' },
  { value: 'separate', label: 'Aerial captured separately' },
  { value: 'ground_only', label: 'Ground-only package' },
];

export const ANGLE_TYPES = ['Wide Context', 'Standard', 'Closeup', 'Detail', 'Overview'];
export const WIDE_CLOSEUP = ['Wide Context', 'Closeup'];

export const QCM_STATUS = {
  PASS: 'PASS',
  PASS_WITH_NOTE: 'PASS WITH NOTE',
  WARNING: 'WARNING',
  RETAKE: 'RETAKE RECOMMENDED',
  ADMIN_REVIEW: 'ADMIN REVIEW',
};

export const PACKAGE_READINESS = {
  READY: 'READY_FOR_ADMIN_REVIEW',
  COVERAGE: 'NEEDS_MORE_COVERAGE',
  RETAKES: 'RETAKES_RECOMMENDED',
  INCOMPLETE: 'FIELD_CAPTURE_INCOMPLETE',
  SITE_LIMITATION: 'SITE_LIMITATION_REVIEW',
};

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function formatDateTime(date = new Date()) {
  return date.toISOString();
}

export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

const THEME_STORAGE_KEY = 'eas-fc-theme';

export function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  setTheme(saved || (prefersLight ? 'light' : 'dark'), false);
}

export function getTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

export function setTheme(theme, persist = true) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, next);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = next === 'light' ? '#f0f2f6' : '#06080c';

  const toggle = $('#btn-theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-label', next === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    toggle.title = next === 'light' ? 'Dark mode' : 'Light mode';
  }
}

export function toggleTheme() {
  setTheme(getTheme() === 'light' ? 'dark' : 'light');
}

export function animateQcmScore(element, target, durationMs = 900) {
  if (!element) return Promise.resolve();

  return new Promise((resolve) => {
    const score = Math.max(0, Math.min(100, Math.round(target)));
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = Math.round(score * eased);
      if (t < 1) requestAnimationFrame(tick);
      else {
        element.textContent = score;
        resolve();
      }
    }

    element.textContent = '0';
    requestAnimationFrame(tick);
  });
}

export function updateQcmScoreRing(score, status) {
  const ring = $('#qcm-score-ring-progress');
  if (!ring) return;

  const clamped = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 40;
  ring.style.strokeDasharray = `${circumference}`;
  ring.style.strokeDashoffset = `${circumference - (clamped / 100) * circumference}`;

  const colorMap = {
    PASS: 'var(--pass-green)',
    'PASS WITH NOTE': 'var(--pass-green)',
    WARNING: 'var(--warning-amber)',
    'RETAKE RECOMMENDED': 'var(--fail-red)',
    FAIL: 'var(--fail-red)',
    'ADMIN REVIEW': 'var(--review-blue)',
  };
  ring.style.stroke = colorMap[status] || 'var(--accent-gold)';
}

const SCREEN_LABELS = {
  'screen-home': 'Home',
  'screen-intake': 'Project Intake',
  'screen-shots': 'Shot List',
  'screen-dashboard': 'Dashboard',
  'screen-capture': 'Capture',
  'screen-coverage': 'Coverage',
  'screen-final-qa': 'Final QA',
  'screen-final': 'Final Review',
  'screen-export': 'Export',
};

const NAV_TAB_MAP = {
  'screen-dashboard': 'screen-dashboard',
  'screen-shots': 'shots',
  'screen-capture': 'capture',
  'screen-coverage': 'coverage',
};

export function showScreen(screenId) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  const screen = $(`#${screenId}`);
  if (screen) screen.classList.add('active');

  const crumb = $('#header-breadcrumb');
  if (crumb) crumb.textContent = SCREEN_LABELS[screenId] || '';

  const navTarget = NAV_TAB_MAP[screenId];
  $$('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', navTarget != null && tab.dataset.nav === navTarget);
  });

  window.scrollTo(0, 0);
}

export function showToast(message, type = 'info', durationMs = 3000) {
  const stack = $('#toast-stack');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(() => toast.remove(), durationMs);
}

export function updateReadinessRing(percent) {
  const ring = $('#dash-ring-progress');
  const label = $('#dash-ring-label');
  if (!ring) return;

  const clamped = Math.max(0, Math.min(100, percent));
  const circumference = 2 * Math.PI * 34;
  ring.style.strokeDasharray = `${circumference}`;
  ring.style.strokeDashoffset = `${circumference - (clamped / 100) * circumference}`;

  if (label) label.textContent = `${clamped}%`;

  if (clamped >= 100) ring.style.stroke = 'var(--pass-green)';
  else if (clamped >= 60) ring.style.stroke = 'var(--accent-gold)';
  else ring.style.stroke = 'var(--review-blue)';
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function badgeClass(status) {
  const map = {
    PASS: 'badge-pass',
    'PASS WITH NOTE': 'badge-pass-note',
    WARNING: 'badge-warning',
    'RETAKE RECOMMENDED': 'badge-fail',
    FAIL: 'badge-fail',
    'ADMIN REVIEW': 'badge-review',
    NEEDS_REVIEW: 'badge-review',
  };
  return map[status] || 'badge-muted';
}

export function qcmResultClass(status) {
  const map = {
    PASS: 'pass',
    'PASS WITH NOTE': 'pass-note',
    WARNING: 'warning',
    'RETAKE RECOMMENDED': 'fail',
    FAIL: 'fail',
    'ADMIN REVIEW': 'review',
    NEEDS_REVIEW: 'review',
  };
  return map[status] || '';
}

export function readinessClass(level) {
  const map = {
    READY_FOR_ADMIN_REVIEW: 'ready',
    NEEDS_MORE_COVERAGE: 'coverage',
    NEEDS_MORE_CORE_COVERAGE: 'coverage',
    NEEDS_DETAIL_COVERAGE: 'coverage',
    RETAKES_RECOMMENDED: 'retake',
    FIELD_CAPTURE_INCOMPLETE: 'incomplete',
    SITE_LIMITATION_REVIEW: 'coverage',
  };
  return map[level] || 'incomplete';
}

export function readinessLabel(level) {
  const map = {
    READY_FOR_ADMIN_REVIEW: 'Ready for Admin Review',
    NEEDS_MORE_COVERAGE: 'Needs More Coverage',
    NEEDS_MORE_CORE_COVERAGE: 'Needs More Core Coverage',
    NEEDS_DETAIL_COVERAGE: 'Needs Detail Coverage',
    RETAKES_RECOMMENDED: 'Retakes Recommended',
    FIELD_CAPTURE_INCOMPLETE: 'Field Capture Incomplete',
    SITE_LIMITATION_REVIEW: 'Site Limitation Review',
  };
  return map[level] || level;
}

export async function getGpsPosition() {
  if (!navigator.geolocation) return null;
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      });
    });
    return {
      gps_available: true,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch {
    return { gps_available: false, latitude: null, longitude: null };
  }
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function downloadText(text, filename, mime = 'text/html') {
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}
