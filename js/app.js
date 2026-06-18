/**
 * EAS Field Capture QCM v1.0 — Main Application
 */

import {
  DISCLAIMER,
  SERVICE_PATHWAYS,
  AERIAL_PATHWAYS,
  PATHWAY_DOC_CONTROL,
  generateId,
  formatDate,
  formatDateTime,
  $,
  $$,
  showScreen,
  showToast,
  updateReadinessRing,
  initTheme,
  toggleTheme,
  animateQcmScore,
  updateQcmScoreRing,
  debounce,
  escapeHtml,
  badgeClass,
  qcmResultClass,
  readinessClass,
  readinessLabel,
  getGpsPosition,
} from './utils.js';

import {
  generateShotList,
  updateZoneStatus,
  getPathwayOptions,
  getMissingZones,
} from './shotlists.js';

import {
  initStorage,
  saveProject,
  getProject,
  getAllProjects,
  saveImage,
  getProjectImages,
  saveQcmResult,
  saveShotListStatus,
  getShotListStatus,
  saveExportRecord,
  saveUecsLiteQueueRecord,
  getUecsLiteQueueRecords,
  setActiveProjectId,
  getActiveProjectId,
  getImageDataUrl,
} from './storage.js';

import { runQcmAnalysis, computeCoverageSummary, computeProjectQcmSummary } from './qcm.js';
import { CameraCapture, createFileInputCapture } from './camera.js';
import { buildProjectPacket, exportProject } from './export.js';
import {
  usesSimpleFieldMethod,
  initSimpleFieldMethod,
  updateSimpleFieldProgress,
  getPass1Progress,
  getPass2Progress,
  getPass3Status,
  getNextRequiredView,
  getNextRequiredDetail,
  getMissingSideWarnings,
  getWeakImages,
  getDuplicateHeavyZones,
  applySiteLimitation,
  CAPTURE_METHOD_NAME,
  CAPTURE_METHOD_DESCRIPTION,
  SFM_GUIDANCE,
  PASS_2_INSTRUCTION,
  PASS_3_INSTRUCTION,
  SITE_LIMITATION_OPTIONS,
  PASS_2_CLASSIFICATIONS,
  PASS_3_CHECKLIST,
  mapViewToZone,
  applyImageClassification,
  CONTEXT_VIEW_OPTIONS,
  GROUND_QA_REMINDER,
  COVERAGE_GROUPS,
} from './simple-field-method.js';

const state = {
  project: null,
  shotList: null,
  sfm: null,
  images: [],
  pendingCapture: null,
  pendingQcm: null,
  camera: null,
  fileCapture: null,
  selectedZone: null,
  capturePass: 1,
  selectedViewId: null,
  replacementTargetId: null,
  importedProjectSource: null,
  homeProjects: [],
};

async function init() {
  try {
    initTheme();
    await initStorage();
    registerServiceWorker();
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    bindEvents();
    populatePathwaySelect();
    await loadHomeScreen();
  } catch (err) {
    console.error('App init failed:', err);
    const home = document.getElementById('screen-home');
    if (home) {
      const alert = document.createElement('div');
      alert.className = 'alert alert-warning';
      alert.textContent = `App failed to start: ${err.message}. Try a hard refresh (clear cache).`;
      home.prepend(alert);
    }
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(console.warn);
  }
}

function updateOnlineStatus() {
  const el = $('#offline-indicator');
  if (!el) return;
  const label = el.querySelector('.status-label');
  if (navigator.onLine) {
    if (label) label.textContent = 'Online';
    else el.textContent = 'Online';
    el.classList.add('online');
  } else {
    if (label) label.textContent = 'Offline';
    else el.textContent = 'Offline';
    el.classList.remove('online');
  }
}

function bindEvents() {
  $('#btn-theme-toggle')?.addEventListener('click', toggleTheme);

  $('#btn-start-project')?.addEventListener('click', () => {
    resetIntakeForm();
    showScreen('screen-intake');
  });
  $('#btn-import-project')?.addEventListener('click', () => $('#project-import-file')?.click());
  $('#project-import-file')?.addEventListener('change', handleProjectImport);

  $('#btn-continue-project')?.addEventListener('click', async () => {
    const activeId = getActiveProjectId();
    if (activeId) {
      await loadProject(activeId);
      showScreen('screen-dashboard');
    }
  });

  $('#intake-form')?.addEventListener('submit', handleIntakeSubmit);
  $('#pathway-select')?.addEventListener('change', onPathwayChange);
  $('#btn-back-home')?.addEventListener('click', () => showScreen('screen-home'));
  $('#btn-save-pathway')?.addEventListener('click', handlePathwaySave);

  $$('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'capture') {
        if (isSfm() && state.sfm) {
          const p1 = getPass1Progress(state.sfm, state.images);
          if (p1.complete < p1.total) openNextRequiredCapture();
          else startPassCapture(2);
        } else openCaptureScreen();
      }
      else if (target === 'coverage') renderCoverageDashboard();
      else if (target === 'shots') renderShotList();
      else if (target === 'final') renderFinalReview();
      else if (target === 'export') renderExportScreen();
      else showScreen(target);
    });
  });

  $('#btn-capture-file')?.addEventListener('click', () => state.fileCapture?.trigger());
  $('#btn-capture-live')?.addEventListener('click', handleLiveCapture);
  $('#btn-retake')?.addEventListener('click', resetCaptureScreen);
  $('#btn-accept-image')?.addEventListener('click', handleAcceptImage);
  $('#btn-admin-review')?.addEventListener('click', handleAdminReview);
  $('#btn-run-qcm')?.addEventListener('click', handleRunQcm);
  $('#btn-export')?.addEventListener('click', handleExport);
  $('#btn-send-uecs-lite')?.addEventListener('click', handleSendToUecsLite);
  $('#btn-view-missing')?.addEventListener('click', () => {
    renderShotList(true);
    showScreen('screen-shots');
  });
  $('#btn-view-missing-legacy')?.addEventListener('click', () => {
    renderShotList(true);
    showScreen('screen-shots');
  });

  $('#capture-zone')?.addEventListener('change', (e) => {
    state.selectedZone = e.target.value;
  });

  $('#capture-wide-closeup')?.addEventListener('change', handleWideCloseupChange);

  $('#btn-start-pass1')?.addEventListener('click', () => startPassCapture(1));
  $('#btn-capture-next-view')?.addEventListener('click', () => openNextRequiredCapture());
  $('#btn-mark-not-accessible')?.addEventListener('click', () => showSiteLimitationPanel());
  $('#btn-capture-detail')?.addEventListener('click', () => startPassCapture(2));
  $('#btn-run-final-qa')?.addEventListener('click', () => openFinalQa());
  $('#btn-finish-capture')?.addEventListener('click', handleFinishCapture);
  $('#btn-save-site-limitation')?.addEventListener('click', handleSaveSiteLimitation);
  $('#btn-cancel-site-limitation')?.addEventListener('click', () => $('#site-limitation-panel')?.classList.add('hidden'));
  $('#btn-complete-qa')?.addEventListener('click', handleCompleteQa);
  $('#btn-add-context')?.addEventListener('click', () => {
    state.capturePass = 3;
    state.selectedViewId = CONTEXT_VIEW_OPTIONS[0]?.id;
    openCaptureScreen();
  });

  $('#project-search')?.addEventListener('input', debounce(filterProjectList, 200));
  $('#project-filter')?.addEventListener('change', filterProjectList);
}

function isSfm() {
  return state.project && usesSimpleFieldMethod(state.project.service_pathway);
}

async function syncSfm() {
  if (!isSfm()) return;
  state.sfm = updateSimpleFieldProgress(state.sfm, state.images);
  await saveShotListStatus({
    project_id: state.project.project_id,
    shotList: state.shotList,
    sfm: state.sfm,
  });
}

function getCoverage() {
  return computeCoverageSummary(state.project, state.images, state.shotList, state.sfm);
}

function populatePathwaySelect() {
  const select = $('#pathway-select');
  if (!select) return;
  select.innerHTML = getPathwayOptions()
    .map(
      (p) =>
        `<option value="${escapeHtml(p.pathway)}">${escapeHtml(p.label)} (${p.targetMin}–${p.targetMax} images)</option>`
    )
    .join('');
}

function resetIntakeForm() {
  const form = $('#intake-form');
  if (!form) return;
  form.reset();
  state.importedProjectSource = null;
  $('#intake-autofill-status').innerHTML = '';
  $('#project-date').value = formatDate();
  $('#doc-control').value = PATHWAY_DOC_CONTROL[SERVICE_PATHWAYS.XPD_BASELINE];
}

function onPathwayChange() {
  const pathway = $('#pathway-select').value;
  $('#doc-control').value = PATHWAY_DOC_CONTROL[pathway] || 'UECS-S';
  const aerialSection = $('#aerial-section');
  if (AERIAL_PATHWAYS.includes(pathway)) {
    aerialSection?.classList.remove('hidden');
  } else {
    aerialSection?.classList.add('hidden');
  }
}

async function handleProjectImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const statusEl = $('#project-import-status');
  try {
    const raw = await file.text();
    const data = JSON.parse(raw);
    const project = normalizeImportedProject(data);

    resetIntakeForm();
    populateIntakeForm(project);
    state.importedProjectSource = {
      file_name: file.name,
      imported_at: formatDateTime(),
      source_system: data.system || data.source_system || 'UECS Lite import',
      clientflow_request_id: project.clientflow_request_id || null,
      uecs_project_id: project.uecs_project_id || project.project_id || null,
    };

    statusEl.innerHTML = `<div class="alert alert-info">Loaded project info from ${escapeHtml(file.name)}. Review details, then create the field capture.</div>`;
    $('#intake-autofill-status').innerHTML = `<div class="alert alert-info">Project details auto-loaded from ${escapeHtml(file.name)}.</div>`;
    showScreen('screen-intake');
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = `<div class="alert alert-warning">Import failed: ${escapeHtml(err.message)}</div>`;
  } finally {
    e.target.value = '';
  }
}

function normalizeImportedProject(data) {
  const source = data.project || data.project_info || data;
  if (!source || typeof source !== 'object') {
    throw new Error('Project import must be a JSON object.');
  }

  const project = {
    project_id: source.project_id || data.uecs_project_id || source.uecs_project_id || '',
    client_name: source.client_name || source.client?.name || '',
    client_company: source.client_company || source.client?.company || '',
    client_email: source.client_email || source.client?.email || '',
    client_phone: source.client_phone || source.client?.phone || '',
    project_address: source.project_address || source.address || source.site_address || '',
    city: source.city || source.site_city || '',
    state: source.state || source.site_state || '',
    zip: source.zip || source.postal_code || source.site_zip || '',
    service_pathway: source.service_pathway || data.service_pathway || SERVICE_PATHWAYS.XPD_BASELINE,
    documentation_level: source.documentation_level || data.documentation_level || '',
    documentation_control_classification:
      source.documentation_control_classification ||
      data.documentation_control_classification ||
      'UECS-Lite',
    field_user: source.field_user || '',
    date: source.date || formatDate(),
    weather: source.weather || '',
    site_access_notes: source.site_access_notes || source.access_notes || '',
    purpose: source.purpose || source.documentation_purpose || '',
    client_notes: source.client_notes || '',
    internal_notes: source.internal_notes || '',
    aerial_status: source.aerial_status || null,
    clientflow_request_id: source.clientflow_request_id || data.clientflow_request_id || null,
    uecs_project_id: source.uecs_project_id || data.uecs_project_id || source.project_id || '',
  };

  if (!project.client_name || !project.project_address) {
    throw new Error('Project import needs at least client_name and project_address.');
  }

  return project;
}

function populateIntakeForm(project) {
  const setValue = (selector, value) => {
    const el = $(selector);
    if (el) el.value = value ?? '';
  };

  setValue('#project-id', project.project_id);
  setValue('#client-name', project.client_name);
  setValue('#client-company', project.client_company);
  setValue('#client-email', project.client_email);
  setValue('#client-phone', project.client_phone);
  setValue('#project-address', project.project_address);
  setValue('#city', project.city);
  setValue('#state', project.state);
  setValue('#zip', project.zip);
  const pathwaySelect = $('#pathway-select');
  if (pathwaySelect) {
    const hasPathway = Array.from(pathwaySelect.options).some((o) => o.value === project.service_pathway);
    pathwaySelect.value = hasPathway ? project.service_pathway : SERVICE_PATHWAYS.XPD_BASELINE;
  }
  setValue('#doc-level', project.documentation_level);
  setValue('#doc-control', project.documentation_control_classification || 'UECS-Lite');
  setValue('#field-user', project.field_user);
  setValue('#project-date', project.date || formatDate());
  setValue('#weather', project.weather);
  setValue('#site-access', project.site_access_notes);
  setValue('#purpose', project.purpose);
  setValue('#client-notes', project.client_notes);
  setValue('#internal-notes', project.internal_notes);

  onPathwayChange();
  setValue('#doc-level', project.documentation_level);
  setValue('#doc-control', project.documentation_control_classification || 'UECS-Lite');
  if (project.aerial_status) {
    const aerial = $$('input[name="aerial_status"]').find((el) => el.value === project.aerial_status);
    if (aerial) aerial.checked = true;
  }
}

async function handleIntakeSubmit(e) {
  e.preventDefault();
  const pathway = $('#pathway-select').value;

  const project = {
    project_id: $('#project-id').value.trim() || generateId('proj'),
    client_name: $('#client-name').value.trim(),
    client_company: $('#client-company').value.trim(),
    client_email: $('#client-email').value.trim(),
    client_phone: $('#client-phone').value.trim(),
    project_address: $('#project-address').value.trim(),
    city: $('#city').value.trim(),
    state: $('#state').value.trim(),
    zip: $('#zip').value.trim(),
    service_pathway: pathway,
    documentation_level: $('#doc-level').value.trim() || generateShotList(pathway).documentationLevel,
    documentation_control_classification: $('#doc-control').value,
    field_user: $('#field-user').value.trim(),
    date: $('#project-date').value,
    weather: $('#weather').value.trim(),
    site_access_notes: $('#site-access').value.trim(),
    purpose: $('#purpose').value.trim(),
    client_notes: $('#client-notes').value.trim(),
    internal_notes: $('#internal-notes').value.trim(),
    aerial_status: AERIAL_PATHWAYS.includes(pathway) ? $('input[name="aerial_status"]:checked')?.value : null,
    created_at: formatDateTime(),
    updated_at: formatDateTime(),
    clientflow_request_id: state.importedProjectSource?.clientflow_request_id || null,
    uecs_project_id: state.importedProjectSource?.uecs_project_id || null,
    import_source: state.importedProjectSource,
    uecs_delivery_status: 'not_queued',
  };

  project.uecs_project_id = project.uecs_project_id || project.project_id;

  state.project = project;
  state.shotList = generateShotList(pathway);
  state.images = [];
  state.sfm = usesSimpleFieldMethod(pathway) ? initSimpleFieldMethod() : null;

  await saveProject(project);
  await saveShotListStatus({ project_id: project.project_id, shotList: state.shotList, sfm: state.sfm });
  setActiveProjectId(project.project_id);

  if (isSfm()) {
    renderDashboard();
    showScreen('screen-dashboard');
  } else {
    renderShotList();
    showScreen('screen-shots');
  }
}

async function handlePathwaySave() {
  if (!state.project) return;
  const selected = $('.pathway-card.selected');
  if (!selected) {
    alert('Please select a service pathway.');
    return;
  }
  const pathway = selected.dataset.pathway;
  state.project.service_pathway = pathway;
  state.project.documentation_level = generateShotList(pathway).documentationLevel;
  state.project.documentation_control_classification = PATHWAY_DOC_CONTROL[pathway];
  state.project.updated_at = formatDateTime();
  state.shotList = generateShotList(pathway);
  await saveProject(state.project);
  await saveShotListStatus({ project_id: state.project.project_id, shotList: state.shotList });
  renderDashboard();
  showScreen('screen-dashboard');
}

async function loadHomeScreen() {
  const projects = await getAllProjects();
  state.homeProjects = projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const searchEl = $('#project-search');
  const filterEl = $('#project-filter');
  if (searchEl) searchEl.value = '';
  if (filterEl) filterEl.value = 'all';

  renderProjectList(state.homeProjects);

  const activeId = getActiveProjectId();
  if (activeId && state.homeProjects.some((p) => p.project_id === activeId)) {
    $('#btn-continue-project')?.classList.remove('hidden');
  } else {
    $('#btn-continue-project')?.classList.add('hidden');
  }
}

function filterProjectList() {
  const query = ($('#project-search')?.value || '').trim().toLowerCase();
  const filter = $('#project-filter')?.value || 'all';
  const activeId = getActiveProjectId();

  let filtered = [...state.homeProjects];

  if (filter === 'active' && activeId) {
    filtered = filtered.filter((p) => p.project_id === activeId);
  } else if (filter === 'xpd') {
    filtered = filtered.filter((p) => (p.service_pathway || '').startsWith('XPD'));
  } else if (filter === 'eas') {
    filtered = filtered.filter((p) => (p.service_pathway || '').startsWith('EAS'));
  }

  if (query) {
    filtered = filtered.filter((p) => {
      const haystack = [
        p.project_id,
        p.client_name,
        p.client_company,
        p.project_address,
        p.service_pathway,
        p.city,
        p.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  renderProjectList(filtered, query || filter !== 'all');
}

function renderProjectList(projects, isFiltered = false) {
  const listEl = $('#project-list');
  const emptyEl = $('#project-list-empty');
  const countBadge = $('#project-count-badge');
  if (!listEl) return;

  if (!state.homeProjects.length) {
    listEl.innerHTML = '';
    emptyEl?.classList.add('hidden');
    countBadge?.classList.add('hidden');
    listEl.innerHTML = '<p class="card-lead">No saved projects yet. Start a new field capture to begin.</p>';
    return;
  }

  if (countBadge) {
    countBadge.textContent = `${projects.length}`;
    countBadge.classList.toggle('hidden', !isFiltered && projects.length === state.homeProjects.length);
  }

  if (!projects.length) {
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');

  const activeId = getActiveProjectId();
  listEl.innerHTML = projects
    .map(
      (p) => `
    <div class="project-item${p.project_id === activeId ? ' project-item-active' : ''}" data-project-id="${escapeHtml(p.project_id)}">
      <div class="project-item-main">
        <h4>${escapeHtml(p.project_id)}${p.project_id === activeId ? ' <span class="badge badge-review" style="font-size:0.58rem;vertical-align:middle">Active</span>' : ''}</h4>
        <p>${escapeHtml(p.client_name)} · ${escapeHtml(p.service_pathway)}</p>
      </div>
      <span class="badge badge-muted">${escapeHtml(p.date)}</span>
      <span class="project-item-chevron" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </div>`
    )
    .join('');

  $$('.project-item').forEach((el) => {
    el.addEventListener('click', async () => {
      await loadProject(el.dataset.projectId);
      showScreen('screen-dashboard');
    });
  });
}

async function loadProject(projectId) {
  const project = await getProject(projectId);
  if (!project) return;

  state.project = project;
  const shotStatus = await getShotListStatus(projectId);
  state.shotList = shotStatus?.shotList || generateShotList(project.service_pathway);
  state.sfm = shotStatus?.sfm || (usesSimpleFieldMethod(project.service_pathway) ? initSimpleFieldMethod() : null);
  if (state.sfm && !state.sfm.groundCapture) {
    state.sfm.groundCapture = initSimpleFieldMethod().groundCapture;
  }
  state.images = (await getProjectImages(projectId)).map((img) =>
    img.coverage_area ? img : applyImageClassification(img)
  );
  state.shotList = updateZoneStatus(state.shotList, state.images);
  if (state.sfm) state.sfm = updateSimpleFieldProgress(state.sfm, state.images);
  setActiveProjectId(projectId);
  renderDashboard();
}

function renderDashboard() {
  if (!state.project || !state.shotList) return;

  $('#dash-project-id').textContent = state.project.project_id;
  $('#dash-pathway').textContent = state.project.service_pathway;
  $('#dash-client').textContent = `${state.project.client_name} — ${state.project.project_address}`;

  const coverage = getCoverage();
  $('#dash-readiness').textContent = readinessLabel(coverage.readiness);
  $('#dash-readiness').className = `readiness-banner ${readinessClass(coverage.readiness)}`;
  $('#dash-progress-fill').style.width = `${coverage.packageReadiness}%`;
  $('#dash-progress-text').textContent = `${coverage.packageReadiness}% — ${coverage.accepted} accepted / ${coverage.targetMin}–${coverage.targetMax} target`;
  updateReadinessRing(coverage.packageReadiness);

  renderMiniStats(coverage);
  renderSimpleFieldPanel(coverage);
}

function renderSimpleFieldPanel(coverage) {
  const panel = $('#sfm-dashboard');
  const legacyShots = $('#legacy-shots-nav');
  if (!panel) return;

  if (!isSfm() || !state.sfm) {
    panel.classList.add('hidden');
    legacyShots?.classList.remove('hidden');
    $('#legacy-dash-actions')?.classList.remove('hidden');
    return;
  }

  panel.classList.remove('hidden');
  legacyShots?.classList.remove('hidden');
  $('#legacy-dash-actions')?.classList.add('hidden');

  const p1 = getPass1Progress(state.sfm, state.images);
  const p2 = getPass2Progress(state.sfm, state.images);
  const p3Status = getPass3Status(state.sfm);
  const warnings = getMissingSideWarnings(state.sfm, state.images);

  $('#sfm-guidance').textContent = SFM_GUIDANCE;
  $('#sfm-method-name').textContent = CAPTURE_METHOD_NAME;
  $('#sfm-method-desc').textContent = CAPTURE_METHOD_DESCRIPTION;

  $('#sfm-pass1-status').textContent = `${p1.complete} / ${p1.total} required views complete`;
  $('#sfm-pass2-status').textContent = `${p2.complete} / ${p2.total} detail categories complete`;
  $('#sfm-pass3-status').textContent = p3Status;

  const warnEl = $('#sfm-warnings');
  if (warnings.length) {
    warnEl.innerHTML = `<div class="alert alert-warning">${warnings.slice(0, 2).map((w) => escapeHtml(w)).join('<br>')}</div>`;
    warnEl.classList.remove('hidden');
  } else {
    warnEl.classList.add('hidden');
  }

  const pass1Complete = p1.complete === p1.total;
  const pass2Complete = p2.complete === p2.total;
  const pass3Complete = state.sfm.pass3?.completed;

  $('#btn-start-pass1')?.classList.toggle('hidden', pass1Complete);
  $('#btn-capture-next-view')?.classList.toggle('hidden', pass1Complete);
  $('#btn-capture-detail')?.classList.toggle('hidden', !pass1Complete);
  $('#btn-run-final-qa')?.classList.toggle('hidden', !(pass1Complete && p2.complete >= Math.min(5, p2.total)));

  renderPassStepper(p1, p2, pass3Complete, p3Status);
  renderGroundCaptureDashboard(coverage);
}

function renderPassStepper(p1, p2, pass3Complete, pass3Status) {
  const stepper = $('#pass-stepper');
  if (!stepper) return;

  const steps = stepper.querySelectorAll('.step');
  const connectors = stepper.querySelectorAll('.step-connector');

  const pass1Done = p1.complete === p1.total;
  const pass2Done = p2.complete === p2.total;
  const pass3Started = state.sfm?.pass3?.started;

  steps[0]?.classList.toggle('complete', pass1Done);
  steps[0]?.classList.toggle('active', !pass1Done);
  steps[1]?.classList.toggle('complete', pass2Done);
  steps[1]?.classList.toggle('active', pass1Done && !pass2Done);
  steps[2]?.classList.toggle('complete', pass3Complete);
  steps[2]?.classList.toggle('active', pass2Done && !pass3Complete);

  connectors[0]?.classList.toggle('complete', pass1Done);
  connectors[1]?.classList.toggle('complete', pass2Done);

  const s1 = $('#stepper-pass1');
  const s2 = $('#stepper-pass2');
  const s3 = $('#stepper-pass3');
  if (s1) s1.textContent = `${p1.complete}/${p1.total}`;
  if (s2) s2.textContent = `${p2.complete}/${p2.total}`;
  if (s3) s3.textContent = pass3Complete ? 'Complete' : pass3Started ? 'In progress' : 'Pending';
}

function renderGroundCaptureDashboard(coverage) {
  const el = $('#ground-capture-dashboard');
  if (!el || !coverage.coreStats) return;

  const core = coverage.coreStats;
  const detail = coverage.detailStats;
  const ctx = coverage.contextStats;
  const coreMissing = coverage.missingCoreAreas?.length
    ? coverage.missingCoreAreas.join(', ')
    : 'None';
  const detailMissing = coverage.missingDetailAreas?.length
    ? coverage.missingDetailAreas.join(', ')
    : 'None';
  const ctxExplain = ctx.explainText
    ? `Used to explain: ${ctx.explainText}`
    : 'Optional — add only when needed to explain layout or access';

  let qaStatus = 'In progress';
  if (state.sfm?.pass3?.completed) qaStatus = 'Final QA completed';
  else if (state.sfm?.pass3?.started) qaStatus = 'Ready for final QA';

  el.innerHTML = `
    <div class="card-header">XPD Ground-Based Capture Structure</div>
    <div class="coverage-group-card">
      <h4>Required Core Coverage</h4>
      <p class="pass-status">Target: ${core.targetRange} images</p>
      <p>Status: ${core.captured} captured / ${core.usable} usable</p>
      <p class="missing-line">Missing: ${escapeHtml(coreMissing)}</p>
      <p class="pass-map">↳ Pass 1: Four-Side Exterior Record</p>
    </div>
    <div class="coverage-group-card">
      <h4>Condition / Detail Coverage</h4>
      <p class="pass-status">Target: ${detail.targetRange} images</p>
      <p>Status: ${detail.captured} captured / ${detail.usable} usable</p>
      <p class="missing-line">Missing: ${escapeHtml(detailMissing)}</p>
      <p class="pass-map">↳ Pass 2: Controlled Detail Capture</p>
    </div>
    <div class="coverage-group-card">
      <h4>Optional Context Coverage</h4>
      <p class="pass-status">Target: ${ctx.targetRange} images (optional)</p>
      <p>Status: ${ctx.captured} captured / ${ctx.usable} usable</p>
      <p class="missing-line">${escapeHtml(ctxExplain)}</p>
      <p class="pass-map">↳ Pass 3: Final QA / justified context only</p>
    </div>
    <div class="coverage-group-card total-card">
      <h4>Current Total</h4>
      <p>Captured: ${coverage.captured} · Usable: ${coverage.accepted}</p>
      <p>Target Package Range: ${coverage.targetMin}–${coverage.targetMax} (upper ${coverage.controlledUpperMax || 45} with context)</p>
      <p><strong>Status:</strong> ${escapeHtml(readinessLabel(coverage.readiness))}${state.sfm?.pass3?.completed ? '' : ' — ' + qaStatus}</p>
    </div>`;

  const overEl = $('#overcapture-warning');
  if (coverage.overcapture?.level !== 'ok' && overEl) {
    overEl.innerHTML = `<div class="alert alert-warning">${escapeHtml(coverage.overcapture.message)}</div>`;
    overEl.classList.remove('hidden');
  } else if (overEl) {
    overEl.classList.add('hidden');
  }
}

function renderMiniStats(coverage) {
  const el = $('#dash-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-box"><div class="value">${coverage.accepted}</div><div class="label">Accepted</div></div>
    <div class="stat-box"><div class="value">${coverage.requiredZonesComplete}/${coverage.requiredZonesTotal}</div><div class="label">Zones</div></div>
    <div class="stat-box"><div class="value">${coverage.warnings}</div><div class="label">Warnings</div></div>
    <div class="stat-box"><div class="value">${coverage.retakes}</div><div class="label">Retakes</div></div>`;
}

function renderShotList(highlightMissing = false) {
  if (!state.shotList) return;
  state.shotList = updateZoneStatus(state.shotList, state.images);
  if (state.sfm) state.sfm = updateSimpleFieldProgress(state.sfm, state.images);

  $('#shots-pathway-title').textContent = state.project?.service_pathway || '';
  $('#shots-target').textContent = isSfm()
    ? `Target: 25–40 images (controlled upper 45 with optional context)`
    : `Target: ${state.shotList.targetMin}–${state.shotList.targetMax} images`;

  const listEl = $('#shot-list');

  if (isSfm() && state.sfm) {
    const p1Html = state.sfm.pass1.views.map((v) => {
      const done = v.complete || state.images.some((i) => i.accepted && i.required_view_id === v.id);
      const cls = done ? 'complete' : highlightMissing ? 'missing' : '';
      return `
      <div class="shot-item ${cls}" data-view-id="${v.id}" data-pass="1">
        <div class="shot-item-info">
          <h4>Pass 1 — ${escapeHtml(v.name)}</h4>
          <p>${v.site_limitation ? 'Site limitation noted' : done ? 'Captured' : 'Required'}</p>
        </div>
        <div class="shot-count">${done ? '✓' : v.sequence}</div>
      </div>`;
    }).join('');

    const p2Html = state.sfm.pass2.categories.map((c) => {
      const done = c.complete;
      const cls = done ? 'complete' : highlightMissing && !c.complete ? 'warning' : '';
      return `
      <div class="shot-item ${cls}" data-view-id="${c.id}" data-pass="2">
        <div class="shot-item-info">
          <h4>Pass 2 — ${escapeHtml(c.name)}</h4>
          <p>${c.conditional ? 'If visible' : 'Required'}${c.site_limitation ? ' · Site limitation noted' : ''}</p>
        </div>
        <div class="shot-count">${done ? '✓' : '—'}</div>
      </div>`;
    }).join('');

    listEl.innerHTML = `<div class="card-header">Pass 1: Four-Side Exterior Record</div>${p1Html}<div class="card-header" style="margin-top:16px">Pass 2: Controlled Detail Capture</div><p class="pass-instruction">${escapeHtml(PASS_2_INSTRUCTION)}</p>${p2Html}`;
  } else {
    listEl.innerHTML = state.shotList.zones
      .map((z) => {
        let statusClass = z.complete ? 'complete' : z.required ? 'missing' : '';
        if (highlightMissing && z.required && !z.complete) statusClass = 'missing';
        else if (z.captured > 0 && !z.complete) statusClass = 'warning';

        return `
      <div class="shot-item ${statusClass}" data-zone="${z.id}">
        <div class="shot-item-info">
          <h4>${escapeHtml(z.name)}${z.required ? '' : ' <span class="badge badge-muted">Optional</span>'}</h4>
          <p>Wide: ${z.wideCount}/${z.minWide} | Closeup: ${z.closeupCount}/${z.minCloseup} | Total: ${z.captured}/${z.minTotal}</p>
        </div>
        <div class="shot-count">${z.complete ? '✓' : z.captured}</div>
      </div>`;
      })
      .join('');
  }

  $$('.shot-item').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.viewId) {
        state.selectedViewId = el.dataset.viewId;
        state.capturePass = parseInt(el.dataset.pass, 10);
        openCaptureScreen();
      } else {
        state.selectedZone = el.dataset.zone;
        openCaptureScreen();
      }
    });
  });

  populateCaptureZoneSelect();
}

function populateCaptureZoneSelect() {
  const select = $('#capture-zone');
  const sfmViewEl = $('#capture-sfm-view');
  if (!select || !state.shotList) return;

  if (isSfm() && state.sfm) {
    select.classList.add('hidden');
    sfmViewEl?.classList.remove('hidden');
    const viewId = state.selectedViewId;
    let label = '—';
    if (viewId) {
      const v1 = state.sfm.pass1.views.find((v) => v.id === viewId);
      const v2 = state.sfm.pass2.categories.find((c) => c.id === viewId);
      label = v1?.name || v2?.name || viewId;
    }
    if ($('#capture-pass-label')) {
      $('#capture-pass-label').textContent = `Pass ${state.capturePass}`;
    }
    if ($('#capture-view-label')) {
      $('#capture-view-label').textContent = label;
    }

    const pass2Section = $('#pass2-classification-section');
    const contextSection = $('#pass3-context-section');
    if (state.capturePass === 2) {
      pass2Section?.classList.remove('hidden');
      contextSection?.classList.add('hidden');
    } else if (state.capturePass === 3) {
      pass2Section?.classList.add('hidden');
      contextSection?.classList.remove('hidden');
      const ctxSelect = $('#capture-context-view');
      if (ctxSelect) {
        ctxSelect.innerHTML = CONTEXT_VIEW_OPTIONS.map(
          (v) => `<option value="${v.id}" ${state.selectedViewId === v.id ? 'selected' : ''}>${escapeHtml(v.name)}</option>`
        ).join('');
      }
    } else {
      pass2Section?.classList.add('hidden');
      contextSection?.classList.add('hidden');
    }
    return;
  }

  select.classList.remove('hidden');
  sfmViewEl?.classList.add('hidden');
  select.innerHTML = state.shotList.zones
    .map((z) => `<option value="${z.id}" ${state.selectedZone === z.id ? 'selected' : ''}>${escapeHtml(z.name)}</option>`)
    .join('');
  if (state.selectedZone) select.value = state.selectedZone;
}

function startPassCapture(pass) {
  state.capturePass = pass;
  if (pass === 1) {
    const next = getNextRequiredView(state.sfm, state.images);
    state.selectedViewId = next?.id || state.sfm.pass1.views[0]?.id;
  } else if (pass === 2) {
    const next = getNextRequiredDetail(state.sfm, state.images);
    state.selectedViewId = next?.id || state.sfm.pass2.categories[0]?.id;
  }
  openCaptureScreen();
}

function openNextRequiredCapture() {
  if (!state.sfm) return;
  const next = getNextRequiredView(state.sfm, state.images);
  if (next) {
    state.capturePass = 1;
    state.selectedViewId = next.id;
    openCaptureScreen();
  } else {
    alert('Pass 1 complete. Continue with Controlled Detail Capture (Pass 2).');
    startPassCapture(2);
  }
}

function showSiteLimitationPanel() {
  const panel = $('#site-limitation-panel');
  const select = $('#site-limitation-type');
  const targetSelect = $('#site-limitation-target');
  if (!panel || !select) return;

  select.innerHTML = SITE_LIMITATION_OPTIONS.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');

  if (targetSelect && state.sfm) {
    const options = [
      ...state.sfm.pass1.views.filter((v) => !v.complete).map((v) => ({ id: v.id, label: `Pass 1 — ${v.name}`, type: 'pass1_view' })),
      ...state.sfm.pass2.categories.filter((c) => !c.complete).map((c) => ({ id: c.id, label: `Pass 2 — ${c.name}`, type: 'pass2_category' })),
    ];
    targetSelect.innerHTML = options.map((o) => `<option value="${o.id}" data-type="${o.type}">${escapeHtml(o.label)}</option>`).join('');
    if (state.selectedViewId) targetSelect.value = state.selectedViewId;
  }

  panel.classList.remove('hidden');
}

async function handleSaveSiteLimitation() {
  const targetSelect = $('#site-limitation-target');
  const limitation = $('#site-limitation-type')?.value;
  const note = $('#site-limitation-note')?.value.trim();
  if (!limitation || !note) {
    alert('Site limitation requires a field note.');
    return;
  }
  const targetId = targetSelect?.value;
  const targetType = targetSelect?.selectedOptions[0]?.dataset.type;
  if (!targetId || !targetType) return;

  state.sfm = applySiteLimitation(state.sfm, targetType, targetId, limitation, note);
  await syncSfm();
  $('#site-limitation-panel')?.classList.add('hidden');
  $('#site-limitation-note').value = '';
  renderDashboard();
  showToast('Site limitation noted.', 'success');
}

function openFinalQa() {
  if (!state.sfm) return;
  state.sfm.pass3.started = true;
  renderFinalQaScreen();
  showScreen('screen-final-qa');
}

function renderFinalQaScreen() {
  const coverage = getCoverage();
  const weak = getWeakImages(state.images);
  const dupes = getDuplicateHeavyZones(state.images);
  const retakes = state.images.filter((i) => i.accepted && i.qcm_status === 'RETAKE RECOMMENDED');

  $('#qa-instruction').textContent = PASS_3_INSTRUCTION + ' ' + GROUND_QA_REMINDER;
  $('#qa-usable-count').textContent = coverage.accepted;
  $('#qa-target-range').textContent = `${coverage.targetMin}–${coverage.targetMax}`;
  $('#qa-readiness').textContent = readinessLabel(coverage.readiness);
  $('#qa-readiness').className = `readiness-banner ${readinessClass(coverage.readiness)}`;

  const missingEl = $('#qa-missing-views');
  const items = [...(coverage.missingViews || []), ...(coverage.missingDetails || [])];
  missingEl.innerHTML = items.length
    ? `<div class="alert alert-warning"><strong>Missing required views:</strong><ul>${items.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`
    : '<div class="alert alert-info">All required views and detail categories covered or site-limited.</div>';

  const weakEl = $('#qa-weak-images');
  weakEl.innerHTML = weak.length
    ? `<div class="card"><div class="card-header">Weak Images (${weak.length})</div>${weak.map((i) => `
      <div class="qa-image-row" data-id="${i.image_id}">
        <span>${escapeHtml(i.zone_name || i.required_view_id || i.zone)} — Score ${i.qcm_score} · ${escapeHtml(i.qcm_status)}</span>
        <button type="button" class="btn btn-sm btn-warning qa-replace-btn" data-id="${i.image_id}">Replace Weak Image</button>
      </div>`).join('')}</div>`
    : '<p class="screen-subtitle">No weak images flagged.</p>';

  $$('.qa-replace-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const img = state.images.find((i) => i.image_id === btn.dataset.id);
      state.replacementTargetId = btn.dataset.id;
      state.selectedViewId = img?.required_view_id || null;
      state.capturePass = img?.capture_pass === 'Pass 2' ? 2 : img?.capture_pass === 'Pass 3' ? 3 : 1;
      openCaptureScreen();
    });
  });

  const dupEl = $('#qa-duplicates');
  dupEl.innerHTML = dupes.length
    ? `<div class="alert alert-warning"><strong>Duplicate-heavy zones:</strong> ${dupes.map((d) => `${d.zone} (${d.count})`).join(', ')}</div>`
    : '';

  const checklistEl = $('#qa-checklist');
  checklistEl.innerHTML = PASS_3_CHECKLIST.map((c) => `
    <label class="aerial-option">
      <input type="checkbox" name="qa_check" value="${c.id}" ${state.sfm.pass3.checklist[c.id] ? 'checked' : ''}>
      ${escapeHtml(c.label)}
    </label>`).join('');

  const retakeEl = $('#qa-retakes');
  retakeEl.innerHTML = retakes.length
    ? `<div class="alert alert-warning">${retakes.length} image(s) marked retake recommended.</div>`
    : '';
}

async function handleCompleteQa() {
  const checks = $$('input[name="qa_check"]');
  for (const c of PASS_3_CHECKLIST) {
    state.sfm.pass3.checklist[c.id] = false;
  }
  checks.forEach((el) => {
    state.sfm.pass3.checklist[el.value] = el.checked;
  });

  const allChecked = PASS_3_CHECKLIST.every((c) => state.sfm.pass3.checklist[c.id]);
  if (!allChecked) {
    alert('Complete all Final QA checklist items before finishing.');
    return;
  }

  state.sfm.pass3.completed = true;
  await syncSfm();
  renderDashboard();
  showScreen('screen-dashboard');
}

function handleFinishCapture() {
  openFinalQa();
}

function openCaptureScreen() {
  populateCaptureZoneSelect();
  resetCaptureScreen();
  initCamera();
  $('#site-limitation-panel')?.classList.add('hidden');
  if (state.replacementTargetId) {
    $('#capture-replacement-notice')?.classList.remove('hidden');
    $('#capture-replacement-notice').textContent = 'Replacing weak image — new capture will replace the flagged image.';
  } else {
    $('#capture-replacement-notice')?.classList.add('hidden');
  }
  showScreen('screen-capture');
}

function initCamera() {
  const video = $('#camera-video');
  const canvas = $('#camera-canvas');
  const preview = $('#capture-preview');

  state.camera = new CameraCapture({ videoEl: video, canvasEl: canvas, previewEl: preview });

  if (!state.fileCapture) {
    state.fileCapture = createFileInputCapture(handleFileCapture);
  }

  state.camera.initLivePreview().then((result) => {
    const liveBtn = $('#btn-capture-live');
    const liveSection = $('#live-camera-section');
    if (result.supported) {
      liveSection?.classList.remove('hidden');
      liveBtn?.classList.remove('hidden');
    } else {
      liveSection?.classList.add('hidden');
    }
  });
}

async function handleFileCapture(file) {
  try {
    const result = await state.camera.loadFromFile(file);
    state.pendingCapture = result;
    state.camera.showPreview(result.dataUrl);
    $('#capture-meta-section')?.classList.remove('hidden');
    $('#capture-actions')?.classList.remove('hidden');
    $('#btn-run-qcm')?.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Could not load image. Please try again.');
  }
}

async function handleLiveCapture() {
  try {
    const result = await state.camera.captureFromVideo();
    state.pendingCapture = result;
    state.camera.showPreview(result.dataUrl);
    $('#capture-meta-section')?.classList.remove('hidden');
    $('#capture-actions')?.classList.remove('hidden');
    $('#btn-run-qcm')?.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Capture failed. Use file capture instead.');
  }
}

function resetCaptureScreen() {
  state.pendingCapture = null;
  state.pendingQcm = null;
  state.camera?.hidePreview();
  $('#capture-meta-section')?.classList.add('hidden');
  $('#capture-actions')?.classList.add('hidden');
  $('#qcm-result-panel')?.classList.add('hidden');
  $('#wide-context-section')?.classList.add('hidden');
  $('#btn-run-qcm')?.classList.add('hidden');
}

function handleWideCloseupChange() {
  const val = $('#capture-wide-closeup').value;
  const section = $('#wide-context-section');
  const isCloseup = val === 'Closeup' || val === 'Closeup detail';
  if (isCloseup) {
    section?.classList.remove('hidden');
  } else {
    section?.classList.add('hidden');
  }
}

function getCaptureMetaBase() {
  let zoneId, zoneName, requiredViewId, capturePassLabel;

  if (isSfm() && state.selectedViewId) {
    requiredViewId = state.selectedViewId;
    if (state.capturePass === 3) {
      requiredViewId = $('#capture-context-view')?.value || state.selectedViewId;
      capturePassLabel = 'Pass 3';
    } else {
      capturePassLabel = `Pass ${state.capturePass}`;
    }
    const v1 = state.sfm.pass1.views.find((v) => v.id === requiredViewId);
    const v2 = state.sfm.pass2.categories.find((c) => c.id === requiredViewId);
    const v3 = CONTEXT_VIEW_OPTIONS.find((v) => v.id === requiredViewId);
    zoneName = v1?.name || v2?.name || v3?.name || requiredViewId;
    zoneId = mapViewToZone(requiredViewId);
  } else {
    zoneId = $('#capture-zone').value;
    const zone = state.shotList.zones.find((z) => z.id === zoneId);
    zoneName = zone?.name || zoneId;
    requiredViewId = zoneId;
    capturePassLabel = null;
  }

  return { zoneId, zoneName, requiredViewId, capturePassLabel };
}

async function handleRunQcm() {
  if (!state.pendingCapture) {
    alert('Capture an image first.');
    return;
  }

  const { zoneId, zoneName, requiredViewId, capturePassLabel } = getCaptureMetaBase();
  const gps = await getGpsPosition();

  let wideOrCloseup = $('#capture-wide-closeup').value;
  let detailClassification = null;
  if (isSfm() && state.capturePass === 2) {
    detailClassification = $('#capture-detail-classification')?.value || 'Wide context';
    wideOrCloseup = detailClassification;
  }

  const imageMeta = {
    image_id: generateId('img'),
    project_id: state.project.project_id,
    original_filename: state.pendingCapture.original_filename || `capture_${Date.now()}.jpg`,
    capture_timestamp: formatDateTime(),
    uploaded_timestamp: formatDateTime(),
    shot_category: zoneName,
    zone: zoneId,
    zone_name: zoneName,
    required_view_id: requiredViewId,
    capture_pass: capturePassLabel,
    angle_type: $('#capture-angle').value,
    wide_or_closeup: wideOrCloseup,
    detail_classification: detailClassification,
    field_notes: $('#capture-notes').value.trim(),
    wide_context_status:
      wideOrCloseup === 'Closeup' || wideOrCloseup === 'Closeup detail'
        ? $('input[name="wide_context"]:checked')?.value
        : null,
    is_replacement_image: !!state.replacementTargetId,
    replaces_image_id: state.replacementTargetId || '',
    site_limitation: '',
    site_limitation_note: '',
    optional_context_reason: $('#optional-context-reason')?.value?.trim() || '',
    is_duplicate_candidate: false,
    is_unnecessary: false,
    admin_review_required: false,
    device_source: state.camera?.mode === 'live' ? 'browser_camera' : 'file_input',
    image_width: state.pendingCapture.width,
    image_height: state.pendingCapture.height,
    file_size: state.pendingCapture.blob?.size || 0,
    mime_type: state.pendingCapture.mime_type || 'image/jpeg',
    accepted: false,
    ...gps,
  };

  const img = new Image();
  img.src = state.pendingCapture.dataUrl;
  await new Promise((r) => (img.onload = r));

  const qcm = await runQcmAnalysis(imageMeta, img, state.images, state.shotList);
  state.pendingQcm = qcm;
  imageMeta.qcm_score = qcm.qcm_score;
  imageMeta.qcm_status = qcm.qcm_status;
  imageMeta.qcm_flags = qcm.qcm_flags;
  state.pendingCapture.imageMeta = applyImageClassification(imageMeta);

  renderQcmResult(qcm, { name: zoneName });
  $('#qcm-result-panel')?.classList.remove('hidden');
}

function renderQcmResult(qcm, zone) {
  const panel = $('#qcm-result-panel');
  if (!panel) return;

  panel.className = `qcm-result qcm-reveal ${qcmResultClass(qcm.qcm_status)}`;
  panel.innerHTML = `
    <h3>Image QCM Result</h3>
    <p>Status: <span class="badge ${badgeClass(qcm.qcm_status)}">${escapeHtml(qcm.qcm_status)}</span></p>
    <div class="qcm-score-hero">
      <div class="qcm-score-ring-wrap">
        <svg class="qcm-score-ring" viewBox="0 0 88 88">
          <circle class="ring-track" cx="44" cy="44" r="40"/>
          <circle id="qcm-score-ring-progress" class="ring-progress" cx="44" cy="44" r="40"/>
        </svg>
        <span id="qcm-score-value" class="qcm-score-value">0</span>
      </div>
      <div class="qcm-score-meta">
        <div class="qcm-score-label">Quality Score</div>
        <div class="qcm-score-max">out of 100</div>
        <p style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary)">Zone: ${escapeHtml(zone?.name || '—')}</p>
        <p style="font-size:0.85rem;color:var(--text-secondary)">Shot: ${escapeHtml(state.pendingCapture?.imageMeta?.wide_or_closeup || '—')}</p>
      </div>
    </div>
    <h4 style="margin-top:12px;font-size:0.85rem;">Checks</h4>
    <ul class="qcm-checks">
      ${qcm.checks.map((c) => `<li><span class="check-icon ${c.status}">${c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '!'}</span> ${escapeHtml(c.name)}: ${escapeHtml(c.message)}</li>`).join('')}
    </ul>
    <div class="qcm-recommendation"><strong>Recommendation:</strong> ${escapeHtml(qcm.recommendation)}</div>`;

  requestAnimationFrame(() => {
    updateQcmScoreRing(0, qcm.qcm_status);
    requestAnimationFrame(() => {
      updateQcmScoreRing(qcm.qcm_score, qcm.qcm_status);
      animateQcmScore($('#qcm-score-value'), qcm.qcm_score);
    });
  });
}

async function handleAcceptImage() {
  if (!state.pendingCapture?.imageMeta) {
    await handleRunQcm();
    if (!state.pendingCapture?.imageMeta) return;
  }

  const meta = applyImageClassification({ ...state.pendingCapture.imageMeta, accepted: true });

  if (meta.coverage_group === COVERAGE_GROUPS.CONTEXT && !meta.optional_context_reason?.trim()) {
    alert('Optional context images require a justification reason.');
    return;
  }

  if (state.replacementTargetId) {
    const oldIdx = state.images.findIndex((i) => i.image_id === state.replacementTargetId);
    if (oldIdx >= 0) {
      state.images[oldIdx].marked_unnecessary = true;
      state.images[oldIdx].accepted = false;
      await saveImage(state.images[oldIdx], null);
      if (state.sfm) {
        state.sfm.pass3.weak_images_replaced += 1;
      }
    }
    state.replacementTargetId = null;
  }

  await saveImage(meta, state.pendingCapture.blob);
  await saveQcmResult({ ...state.pendingQcm, project_id: state.project.project_id });

  state.images.push(meta);
  state.shotList = updateZoneStatus(state.shotList, state.images);
  if (state.sfm) {
    state.sfm = updateSimpleFieldProgress(state.sfm, state.images);
  }
  await saveShotListStatus({ project_id: state.project.project_id, shotList: state.shotList, sfm: state.sfm });

  state.project.updated_at = formatDateTime();
  await saveProject(state.project);

  resetCaptureScreen();
  renderDashboard();
  showScreen('screen-dashboard');
  showToast('Image accepted and saved.', 'success');
}

async function handleAdminReview() {
  if (!state.pendingCapture?.imageMeta) {
    await handleRunQcm();
  }
  if (state.pendingCapture?.imageMeta) {
    state.pendingCapture.imageMeta.admin_review = true;
    state.pendingCapture.imageMeta.wide_context_status = 'admin_review';
    if (state.pendingQcm) {
      state.pendingQcm.qcm_status = 'ADMIN REVIEW';
      state.pendingCapture.imageMeta.qcm_status = 'ADMIN REVIEW';
    }
  }
  await handleAcceptImage();
}

function renderCoverageDashboard() {
  if (!state.project || !state.shotList) return;
  state.shotList = updateZoneStatus(state.shotList, state.images);
  if (state.sfm) state.sfm = updateSimpleFieldProgress(state.sfm, state.images);
  const coverage = getCoverage();

  $('#coverage-title').textContent = state.project.service_pathway;
  $('#coverage-readiness').textContent = readinessLabel(coverage.readiness);
  $('#coverage-readiness').className = `readiness-banner ${readinessClass(coverage.readiness)}`;
  $('#coverage-message').textContent = coverage.statusMessage;
  $('#coverage-progress-fill').style.width = `${coverage.packageReadiness}%`;

  $('#coverage-stats').innerHTML = `
    <div class="stat-box"><div class="value">${coverage.accepted}</div><div class="label">Accepted</div></div>
    <div class="stat-box"><div class="value">${coverage.captured}</div><div class="label">Captured</div></div>
    <div class="stat-box"><div class="value">${coverage.requiredZonesComplete}/${coverage.requiredZonesTotal}</div><div class="label">Req. Zones</div></div>
    <div class="stat-box"><div class="value">${coverage.avgQcmScore}</div><div class="label">Avg QCM</div></div>
    <div class="stat-box"><div class="value">${coverage.warnings}</div><div class="label">Warnings</div></div>
    <div class="stat-box"><div class="value">${coverage.retakes}</div><div class="label">Retakes</div></div>
    <div class="stat-box"><div class="value">${coverage.targetMin}–${coverage.targetMax}</div><div class="label">Target</div></div>
    <div class="stat-box"><div class="value">${coverage.packageReadiness}%</div><div class="label">Readiness</div></div>`;

  const missing = getMissingZones(state.shotList);
  const missingEl = $('#coverage-missing');
  if (isSfm() && coverage.missingCoreAreas?.length) {
    missingEl.innerHTML = `<div class="alert alert-warning"><strong>Missing Core Coverage:</strong><ul>${coverage.missingCoreAreas.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`;
  } else if (isSfm() && coverage.missingDetailAreas?.length) {
    missingEl.innerHTML = `<div class="alert alert-warning"><strong>Missing Detail Coverage:</strong><ul>${coverage.missingDetailAreas.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`;
  } else if (isSfm() && coverage.missingViews?.length) {
    missingEl.innerHTML = `<div class="alert alert-warning"><strong>Missing Required Views:</strong><ul>${coverage.missingViews.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}${coverage.missingDetails?.map((n) => `<li>${escapeHtml(n)} (detail)</li>`).join('') || ''}</ul></div>`;
  } else if (missing.length) {
    missingEl.innerHTML = `<div class="alert alert-warning"><strong>Missing Required Zones:</strong><ul>${missing.map((z) => `<li>${escapeHtml(z.name)}</li>`).join('')}</ul></div>`;
  } else {
    missingEl.innerHTML = '<div class="alert alert-info">All required zones have coverage.</div>';
  }

  renderImageGrid();
  showScreen('screen-coverage');
}

async function renderImageGrid() {
  const grid = $('#image-grid');
  if (!grid) return;
  const accepted = state.images.filter((i) => i.accepted);

  grid.innerHTML = await Promise.all(
    accepted.map(async (img) => {
      const url = await getImageDataUrl(img.image_id);
      return `
      <div class="image-thumb" data-id="${img.image_id}">
        ${url ? `<img src="${url}" alt="">` : ''}
        <span class="thumb-badge badge ${badgeClass(img.qcm_status)}">${img.qcm_score ?? '—'}</span>
      </div>`;
    })
  ).then((html) => html.join(''));
}

function renderFinalReview() {
  if (!state.project || !state.shotList) return;
  state.shotList = updateZoneStatus(state.shotList, state.images);
  if (state.sfm) state.sfm = updateSimpleFieldProgress(state.sfm, state.images);
  const coverage = getCoverage();
  const qcm = computeProjectQcmSummary(state.images);

  $('#final-readiness').textContent = readinessLabel(coverage.readiness);
  $('#final-readiness').className = `readiness-banner ${readinessClass(coverage.readiness)}`;

  $('#final-summary').innerHTML = `
    <div class="card">
      <div class="card-header">Project Summary</div>
      <p><strong>Project:</strong> ${escapeHtml(state.project.project_id)}</p>
      <p><strong>Pathway:</strong> ${escapeHtml(state.project.service_pathway)}</p>
      <p><strong>Documentation Control:</strong> ${escapeHtml(state.project.documentation_control_classification)}</p>
      <p><strong>Accepted Images:</strong> ${coverage.accepted} (target ${coverage.targetMin}–${coverage.targetMax})</p>
      <p><strong>Required Zones:</strong> ${coverage.requiredZonesComplete} / ${coverage.requiredZonesTotal}</p>
      <p><strong>Average QCM Score:</strong> ${qcm.average_score} / 100</p>
      <p><strong>Warnings:</strong> ${coverage.warnings} | <strong>Retakes:</strong> ${coverage.retakes}</p>
      <p><strong>Package Readiness:</strong> ${coverage.packageReadiness}%</p>
      <p>${escapeHtml(coverage.statusMessage)}</p>
    </div>`;

  if (coverage.readiness !== 'READY_FOR_ADMIN_REVIEW') {
    $('#final-warning').innerHTML = `<div class="alert alert-warning">${escapeHtml(coverage.statusMessage)}</div>`;
  } else {
    $('#final-warning').innerHTML = `<div class="alert alert-info">Package meets minimum requirements for admin review.</div>`;
  }

  showScreen('screen-final');
}

function renderExportScreen() {
  $('#export-project-id').textContent = state.project?.project_id || '—';
  renderUecsQueueStatus();
  showScreen('screen-export');
}

async function renderUecsQueueStatus() {
  const el = $('#uecs-queue-status');
  if (!el || !state.project) return;

  const records = await getUecsLiteQueueRecords(state.project.project_id);
  if (!records.length) {
    el.innerHTML = '<div class="alert alert-info">Not queued yet. Send when the packet is ready for UECS Lite intake.</div>';
    return;
  }

  records.sort((a, b) => new Date(b.queued_at) - new Date(a.queued_at));
  const latest = records[0];
  el.innerHTML = `
    <div class="alert alert-info">
      UECS Lite packet queued: ${escapeHtml(latest.queued_at)}<br>
      Status: ${escapeHtml(latest.status)} · Queue ID: ${escapeHtml(latest.queue_id)}
    </div>`;
}

async function handleExport() {
  if (!state.project) return;
  state.shotList = updateZoneStatus(state.shotList, state.images);
  if (state.sfm) state.sfm = updateSimpleFieldProgress(state.sfm, state.images);

  try {
    const result = await exportProject(state.project, state.images, state.shotList, state.sfm);
    const coverage = result.coverage;
    if (coverage.overcapture?.adminReviewRequired) {
      state.project.admin_review_required = true;
      await saveProject(state.project);
    }
    await saveExportRecord({
      export_id: result.export_id,
      project_id: state.project.project_id,
      export_timestamp: result.export_timestamp,
      files: result.files,
      readiness: result.coverage.readiness,
    });

    $('#export-status').innerHTML = `<div class="alert alert-info">Export complete. ${result.files.length} files downloaded.<br>Status: ${readinessLabel(result.coverage.readiness)}</div>`;
    showToast(`Export complete — ${result.files.length} files`, 'success');
  } catch (err) {
    console.error(err);
    $('#export-status').innerHTML = `<div class="alert alert-warning">Export failed: ${escapeHtml(err.message)}</div>`;
  }
}

async function handleSendToUecsLite() {
  if (!state.project) return;
  state.shotList = updateZoneStatus(state.shotList, state.images);
  if (state.sfm) state.sfm = updateSimpleFieldProgress(state.sfm, state.images);

  try {
    const coverage = getCoverage();
    const packet = buildProjectPacket(state.project, state.images, state.shotList, coverage, state.sfm);
    const record = {
      queue_id: generateId('uecsq'),
      project_id: state.project.project_id,
      uecs_project_id: state.project.uecs_project_id || state.project.project_id,
      status: 'queued',
      queued_at: formatDateTime(),
      sync_attempts: 0,
      sync_endpoint: null,
      next_action: 'connect_uecs_lite_sync_endpoint',
      readiness: coverage.readiness,
      accepted_images: coverage.accepted,
      payload_type: 'field_capture_project_packet',
      payload_version: 1,
      packet,
    };

    await saveUecsLiteQueueRecord(record);
    state.project.uecs_delivery_status = 'queued';
    state.project.uecs_queued_at = record.queued_at;
    state.project.updated_at = formatDateTime();
    await saveProject(state.project);

    $('#export-status').innerHTML = `<div class="alert alert-info">UECS Lite packet queued locally. It will remain on this device until the UECS Lite sync endpoint is connected.</div>`;
    await renderUecsQueueStatus();
  } catch (err) {
    console.error(err);
    $('#export-status').innerHTML = `<div class="alert alert-warning">UECS Lite queue failed: ${escapeHtml(err.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
