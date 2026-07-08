/**
 * XPD Field Capture QCM — Utilities
 *
 * Field Capture QCM Version 1.0 is intentionally limited to XPD and UECS Lite workflows.
 * Enterprise documentation levels (EAS/EDIS, Levels I–V, spatial, inspection, LiDAR,
 * controlled evidence, etc.) will be implemented in a future Enterprise capture module.
 */

export const SYSTEM_NAME = 'XPD Field Capture QCM | UECS Lite Intake System';
export const VERSION = 'XPD Field Capture QCM v1.0';
export const PHASE = 'Phase 1 Phone Camera PWA — XPD Only';

export const DOCUMENTATION_FAMILY = 'XPD';
export const DOC_CONTROL_CLASSIFICATION = 'UECS Lite';

/** @deprecated v1.0 — use DOC_CONTROL_CLASSIFICATION; kept for legacy import normalization */
export const DOC_CONTROL_OPTIONS = [DOC_CONTROL_CLASSIFICATION];

export const DISCLAIMER =
  'This system supports visual and spatial documentation quality control only. QCM results evaluate image clarity, coverage, metadata, and documentation readiness. QCM does not provide engineering opinions, inspection conclusions, code compliance determinations, damage diagnosis, or repair recommendations.';

export const SERVICE_PATHWAYS = {
  XPD_STORMREADY_PRE: 'XPD StormReady Residential – Pre-Storm Baseline',
  XPD_STORMREADY_POST: 'XPD StormReady Residential – Post-Storm Comparison',
  XPD_STORM: 'XPD Storm Snapshot',
  XPD_BASELINE: 'XPD Exterior Baseline Snapshot',
  XPD_PROPERTY: 'XPD Exterior Property Record',
  XPD_AERIAL: 'XPD Exterior + Aerial Baseline',
};

export const XPD_PATHWAY_VALUES = Object.values(SERVICE_PATHWAYS);

export const PATHWAY_DOC_CONTROL = Object.fromEntries(
  XPD_PATHWAY_VALUES.map((pathway) => [pathway, DOC_CONTROL_CLASSIFICATION])
);

export function normalizeDocControl(value) {
  if (value == null || value === '') return DOC_CONTROL_CLASSIFICATION;
  const normalized = String(value).trim().toLowerCase().replace(/-/g, ' ');
  if (normalized === 'uecs lite' || normalized === 'uecs s' || normalized === 'uecs v') {
    return DOC_CONTROL_CLASSIFICATION;
  }
  return DOC_CONTROL_CLASSIFICATION;
}

export function isXpdPathway(pathway) {
  return (pathway || '').startsWith('XPD');
}

export function assertXpdPathway(pathway) {
  if (!isXpdPathway(pathway)) {
    throw new Error('Only XPD documentation packages are supported in Field Capture QCM v1.0.');
  }
}

export function applyXpdProjectMetadata(project) {
  if (!project || typeof project !== 'object') return project;
  project.documentation_family = DOCUMENTATION_FAMILY;
  project.documentation_control_classification = DOC_CONTROL_CLASSIFICATION;
  return project;
}

export const AERIAL_PATHWAYS = [
  SERVICE_PATHWAYS.XPD_AERIAL,
];

export const AERIAL_STATUS_OPTIONS = [
  { value: 'not_requested', label: 'Not requested' },
  { value: 'requested', label: 'Requested' },
  { value: 'pending_airspace_review', label: 'Pending airspace review' },
  { value: 'pending_client_authorization', label: 'Pending client authorization' },
  { value: 'approved', label: 'Approved' },
  { value: 'unavailable_or_not_approved', label: 'Unavailable or not approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
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

const PROJECT_DOCK_SCREENS = new Set([
  'screen-dashboard',
  'screen-shots',
  'screen-capture',
  'screen-coverage',
  'screen-final-qa',
  'screen-final',
  'screen-export',
]);

let activeScreenId = 'screen-home';

export function isMobileDevice() {
  return (
    window.matchMedia('(max-width: 719px)').matches ||
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
}

export function getActiveScreenId() {
  return activeScreenId;
}

export function showScreen(screenId) {
  const previousScreen = activeScreenId;
  activeScreenId = screenId;

  $$('.screen').forEach((s) => s.classList.remove('active'));
  const screen = $(`#${screenId}`);
  if (screen) screen.classList.add('active');

  const crumb = $('#header-breadcrumb');
  if (crumb) crumb.textContent = SCREEN_LABELS[screenId] || '';

  const navTarget = NAV_TAB_MAP[screenId];
  $$('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', navTarget != null && tab.dataset.nav === navTarget);
  });

  const hasDock = PROJECT_DOCK_SCREENS.has(screenId);
  document.body.classList.toggle('has-project-dock', hasDock);
  document.body.classList.toggle('on-capture-screen', screenId === 'screen-capture');
  document.body.dataset.screen = screenId.replace('screen-', '');

  const mobileDock = $('#mobile-project-dock');
  if (mobileDock) {
    const showMobileDock = hasDock && isMobileDevice();
    mobileDock.classList.toggle('hidden', !showMobileDock);
  }

  window.dispatchEvent(
    new CustomEvent('eas:screen-change', {
      detail: { screenId, previousScreen },
    })
  );

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
