/**
 * EAS Field Capture QCM — XPD Governance & Policy Enforcement
 */

import {
  SERVICE_PATHWAYS,
  DOC_CONTROL_CLASSIFICATION,
  normalizeDocControl,
  applyXpdProjectMetadata,
  isXpdPathway,
  escapeHtml,
} from './utils.js';

export const DEFAULT_CAPTURE_METHOD = 'field_capture_qcm';
export const DEFAULT_CAPTURE_METHOD_LABEL = 'Field Capture QCM';

export const COMPLETED_PACKET_VERSION = '1.0.0';
export const SUPPORTED_IMPORT_PACKET_VERSIONS = ['1.0', '1.0.0', 1, '1'];

export const QUEUE_STATUSES = {
  QUEUED: 'queued',
  ACTIVE_CAPTURE: 'active_capture',
  COMPLETED_CAPTURE: 'completed_capture',
  READY_FOR_EXPORT: 'ready_for_export',
  EXPORTED: 'exported',
  FAILED_VALIDATION: 'failed_validation',
  ADMIN_REVIEW_REQUIRED: 'admin_review_required',
  RESOLVED: 'resolved',
};

export const FIELD_PACKET_STATUSES = {
  QUEUED_FOR_FIELD_CAPTURE: 'queued_for_field_capture',
  FIELD_CAPTURE_IN_PROGRESS: 'field_capture_in_progress',
  FIELD_CAPTURE_COMPLETE: 'field_capture_complete',
  READY_FOR_UECS_LITE: 'ready_for_uecs_lite',
  EXPORTED: 'exported',
};

export const FORBIDDEN_EXPORT_TERMS = [
  'inspection conclusion',
  'engineering conclusion',
  'insurance coverage',
  'damage cause',
  'ipcs',
  'uecs full',
  'edis',
  'level ii',
  'level iii',
  'level iv',
  'level v',
  'code compliance',
  'repair recommendation',
  'structural failure',
];

export const CAPTURE_POLICY_ENHANCEMENT_MAP = {
  aerial: 'aerial_documentation',
  aerial_documentation: 'aerial_documentation',
  '360': 'reference_360_capture',
  reference_360: 'reference_360_capture',
  rtk: 'verified_location_capture',
  verified_location: 'verified_location_capture',
  lidar: 'spatial_record_capture',
  spatial: 'spatial_record_capture',
  spatial_record: 'spatial_record_capture',
  enhanced_camera: 'enhanced_camera_capture',
  standard_camera: 'enhanced_camera_capture',
};

export const IMPORT_INCOMPLETE_MESSAGE =
  'Project packet incomplete. Return to ClientFlow / UECS Lite and regenerate the project packet.';

export const MANUAL_OVERRIDE_WARNING =
  'This project is not linked to a ClientFlow request or UECS Lite packet. Use manual override only for test, sample, or emergency documentation.';

export const DEFAULT_CAPTURE_WARNING =
  'Default capture method was not provided. Field Capture QCM has been applied as the XPD default.';

export const AERIAL_NOT_APPROVED_MESSAGE =
  'Aerial documentation is not currently approved. Continue with Field Capture QCM ground-based baseline unless admin requires reschedule or client scope revision.';

export const EXPORT_REQUIRED_MESSAGE =
  'Export Required. Phase 1 does not upload automatically. Send to UECS Lite is local queue only. Manual export and file transfer are required.';

export const UECS_LITE_QUEUE_MESSAGE =
  'Queued locally for UECS Lite sync. This does not upload in Phase 1. Export files must still be transferred to admin.';

export const TEST_WATERMARK = 'TEST / INTERNAL REVIEW — NOT FOR CLIENT DELIVERY';

export const OVERRIDE_REASONS = [
  { value: 'test_project', label: 'Test project' },
  { value: 'sample_capture', label: 'Sample capture' },
  { value: 'emergency_documentation', label: 'Emergency documentation' },
  { value: 'ueclite_packet_unavailable', label: 'UECS Lite packet unavailable' },
  { value: 'admin_authorized_manual_entry', label: 'Admin authorized manual entry' },
];

export const AERIAL_STATUSES = [
  { value: 'not_requested', label: 'Not requested' },
  { value: 'requested', label: 'Requested' },
  { value: 'pending_airspace_review', label: 'Pending airspace review' },
  { value: 'pending_client_authorization', label: 'Pending client authorization' },
  { value: 'approved', label: 'Approved' },
  { value: 'unavailable_or_not_approved', label: 'Unavailable or not approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ENHANCEMENT_KEYS = {
  enhanced_camera: { key: 'enhanced_camera_capture', label: 'Enhanced Documentation Add-On' },
  aerial: { key: 'aerial_documentation', label: 'Aerial Context Add-On' },
  reference_360: { key: 'reference_360_capture', label: '360 Reference Add-On' },
  verified_location: { key: 'verified_location_capture', label: 'Verified Location Add-On' },
  spatial: { key: 'spatial_record_capture', label: 'Spatial Record Add-On' },
};

export const PATHWAY_DEFAULTS = {
  [SERVICE_PATHWAYS.XPD_STORMREADY_PRE]: {
    targetMin: 25,
    targetMax: 45,
    defaultCapture: DEFAULT_CAPTURE_METHOD_LABEL,
    optionalEnhancements: ['Aerial Context Add-On', 'Enhanced Documentation Add-On'],
  },
  [SERVICE_PATHWAYS.XPD_STORMREADY_POST]: {
    targetMin: 20,
    targetMax: 40,
    defaultCapture: DEFAULT_CAPTURE_METHOD_LABEL,
    optionalEnhancements: ['Aerial Context Add-On', 'Enhanced Documentation Add-On'],
  },
  [SERVICE_PATHWAYS.XPD_STORM]: {
    targetMin: 15,
    targetMax: 30,
    defaultCapture: DEFAULT_CAPTURE_METHOD_LABEL,
    optionalEnhancements: ['Aerial Context Add-On', 'Enhanced Documentation Add-On'],
  },
  [SERVICE_PATHWAYS.XPD_BASELINE]: {
    targetMin: 25,
    targetMax: 45,
    defaultCapture: DEFAULT_CAPTURE_METHOD_LABEL,
    subMethod: 'Simple Field Method',
    optionalEnhancements: [
      'Enhanced Documentation Add-On',
      'Aerial Context Add-On',
      '360 Reference Add-On',
    ],
  },
  [SERVICE_PATHWAYS.XPD_PROPERTY]: {
    targetMin: 45,
    targetMax: 75,
    defaultCapture: `${DEFAULT_CAPTURE_METHOD_LABEL} with expanded coverage`,
    optionalEnhancements: [
      'Enhanced Documentation Add-On',
      'Aerial Context Add-On',
      '360 Reference Add-On',
      'Verified Location Add-On',
    ],
  },
  [SERVICE_PATHWAYS.XPD_AERIAL]: {
    defaultCapture: DEFAULT_CAPTURE_METHOD_LABEL,
    aerialDefault: 'Aerial Documentation if approved',
    fallback: 'Ground-based baseline if aerial is not approved or unavailable',
    optionalEnhancements: ['Aerial Context Add-On'],
  },
};

export { isXpdPathway } from './utils.js';

export function isLinkedToClientFlow(project) {
  return !!(project?.clientflow_request_id || project?.linked_to_clientflow);
}

function getImportSource(data) {
  return data.project || data.project_info || data;
}

function getImportField(data, ...keys) {
  const source = getImportSource(data);
  for (const key of keys) {
    if (source[key] != null && source[key] !== '') return source[key];
    if (data[key] != null && data[key] !== '') return data[key];
  }
  return null;
}

function normalizePacketVersion(value) {
  if (value == null || value === '') return null;
  return String(value).trim();
}

export function isSupportedImportPacketVersion(version) {
  if (version == null || version === '') return false;
  return SUPPORTED_IMPORT_PACKET_VERSIONS.some(
    (supported) => String(supported) === String(version)
  );
}

export function applyCapturePolicyProfile(project, profile, warnings = []) {
  if (!profile || typeof profile !== 'object') {
    project.capture_policy_profile = profile || null;
    project.capture_policy_notes = '';
    project.enhanced_camera_capture = false;
    project.aerial_documentation = false;
    project.reference_360_capture = false;
    project.verified_location_capture = false;
    project.spatial_record_capture = false;
    return project;
  }

  project.capture_policy_profile = profile;
  project.capture_policy_notes =
    profile.notes || profile.capture_notes || profile.policy_notes || '';

  const requestedFlags = Object.values(ENHANCEMENT_KEYS).reduce((acc, entry) => {
    acc[entry.key] = !!project[entry.key];
    return acc;
  }, {});

  const allowed = new Set(
    (profile.allowed_enhancements || profile.authorized_enhancements || []).map((item) =>
      String(item).toLowerCase().replace(/\s+/g, '_')
    )
  );

  const enhancementKeys = Object.values(ENHANCEMENT_KEYS).map((entry) => entry.key);
  for (const key of enhancementKeys) {
    project[key] = false;
  }

  for (const [alias, projectKey] of Object.entries(CAPTURE_POLICY_ENHANCEMENT_MAP)) {
    if (allowed.has(alias) || profile[projectKey] === true) {
      project[projectKey] = true;
    }
  }

  const unauthorized = enhancementKeys.filter((key) => requestedFlags[key] && !project[key]);

  if (unauthorized.length) {
    warnings.push(
      'Some requested capture enhancements are not authorized by capture_policy_profile and were disabled.'
    );
  }

  return project;
}

export function validateUecsLiteImport(data) {
  const warnings = [];
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Project import must be a JSON object.'], warnings, project: null };
  }

  const clientName = getImportField(data, 'client_name');
  const projectAddress = getImportField(data, 'project_address', 'address', 'site_address');
  const clientflowRequestId = getImportField(data, 'clientflow_request_id');
  const uecsProjectId = getImportField(data, 'uecs_project_id', 'project_id');
  const servicePathway = getImportField(data, 'service_pathway');
  const docControl = getImportField(data, 'documentation_control_classification');
  const defaultCaptureMethod = getImportField(data, 'default_capture_method');
  const adminReviewRequired = getImportField(data, 'admin_review_required');
  const packetVersion = normalizePacketVersion(getImportField(data, 'packet_version', 'version'));
  const capturePolicyProfile = getImportField(data, 'capture_policy_profile') || data.capture_policy_profile;
  const xpdOnly = getImportField(data, 'xpd_only');
  const stormreadyEligible = getImportField(
    data,
    'stormready_eligible',
    'stormready_eligibility',
    'storm_ready_eligible'
  );

  if (!clientflowRequestId) errors.push('clientflow_request_id');
  if (!uecsProjectId) errors.push('uecs_project_id');
  if (!clientName) errors.push('client_name');
  if (!projectAddress) errors.push('project_address');
  if (!servicePathway) errors.push('service_pathway');
  if (servicePathway && !isXpdPathway(servicePathway)) errors.push('service_pathway (XPD packages only)');
  if (!docControl) errors.push('documentation_control_classification');
  if (!defaultCaptureMethod) errors.push('default_capture_method');
  if (adminReviewRequired == null) errors.push('admin_review_required');
  if (!packetVersion || !isSupportedImportPacketVersion(packetVersion)) {
    errors.push('packet_version (unsupported schema/version)');
  }
  if (xpdOnly !== true) errors.push('xpd_only (must be true for Phase 1 Field Capture)');
  if (!capturePolicyProfile) errors.push('capture_policy_profile');

  if (errors.length) {
    return { valid: false, errors, warnings, project: null };
  }

  const source = getImportSource(data);
  const project = {
    project_id: uecsProjectId,
    client_name: clientName,
    client_company: source.client_company || source.client?.company || '',
    client_email: source.client_email || source.client?.email || '',
    client_phone: source.client_phone || source.client?.phone || '',
    project_address: projectAddress,
    city: source.city || source.site_city || '',
    state: source.state || source.site_state || '',
    zip: source.zip || source.postal_code || source.site_zip || '',
    service_pathway: servicePathway,
    documentation_level: source.documentation_level || data.documentation_level || servicePathway,
    documentation_control_classification: normalizeDocControl(docControl),
    field_user: source.field_user || '',
    date: source.date || new Date().toISOString().split('T')[0],
    weather: source.weather || '',
    site_access_notes: source.site_access_notes || source.access_notes || '',
    purpose: source.purpose || source.documentation_purpose || data.documentation_purpose || '',
    documentation_purpose: source.documentation_purpose || data.documentation_purpose || source.purpose || '',
    stormready_eligible: stormreadyEligible,
    client_notes: source.client_notes || '',
    internal_notes: source.internal_notes || '',
    clientflow_request_id: clientflowRequestId,
    uecs_project_id: uecsProjectId,
    linked_to_clientflow: true,
    import_method: 'uecs_lite',
    admin_review_required: adminReviewRequired !== false,
    default_capture_method: defaultCaptureMethod || null,
    field_capture_qcm: source.field_capture_qcm ?? data.field_capture_qcm ?? null,
    aerial_status: source.aerial_status || data.aerial_status || null,
    aerial_documentation: source.aerial_documentation ?? data.aerial_documentation ?? false,
    enhanced_camera_capture: source.enhanced_camera_capture ?? data.enhanced_camera_capture ?? false,
    reference_360_capture: source.reference_360_capture ?? data.reference_360_capture ?? false,
    verified_location_capture: source.verified_location_capture ?? data.verified_location_capture ?? false,
    spatial_record_capture: source.spatial_record_capture ?? data.spatial_record_capture ?? false,
    packet_version: packetVersion,
    capture_policy_profile: capturePolicyProfile,
    xpd_only: true,
    field_packet_status: FIELD_PACKET_STATUSES.QUEUED_FOR_FIELD_CAPTURE,
    project_status: FIELD_PACKET_STATUSES.QUEUED_FOR_FIELD_CAPTURE,
  };

  applyCapturePolicyProfile(project, capturePolicyProfile, warnings);
  applyXpdCaptureDefaults(project, warnings);

  if (project.aerial_documentation) {
    applyAerialFallback(project);
  }

  applyXpdProjectMetadata(project);

  return { valid: true, errors: [], warnings, project };
}

export function applyXpdCaptureDefaults(project, warnings = []) {
  if (!isXpdPathway(project.service_pathway)) return project;

  if (!project.default_capture_method) {
    project.default_capture_method = DEFAULT_CAPTURE_METHOD;
    project.field_capture_qcm = true;
    project.admin_review_required = true;
    warnings.push(DEFAULT_CAPTURE_WARNING);
  } else if (project.default_capture_method === DEFAULT_CAPTURE_METHOD) {
    project.field_capture_qcm = true;
  }

  if (project.admin_review_required == null) {
    project.admin_review_required = true;
  }

  applyXpdProjectMetadata(project);

  return project;
}

export function applyAerialFallback(project) {
  const approvedStatuses = ['approved', 'completed'];
  const status = project.aerial_status;

  if (project.aerial_documentation && status && !approvedStatuses.includes(status)) {
    project.aerial_status = 'unavailable_or_not_approved';
    project.fallback_capture_method = 'ground_based_baseline';
    project.client_scope_notice_required = true;
    project.aerial_not_approved = true;
  }

  return project;
}

export function applyManualOverrideFlags(project, overrideReason) {
  project.override_reason = overrideReason;
  project.linked_to_clientflow = false;
  project.import_method = 'manual_override';
  project.admin_review_required = true;

  if (overrideReason === 'test_project' || overrideReason === 'sample_capture') {
    project.is_test_project = true;
    project.not_for_client_delivery = true;
  }

  if (isXpdPathway(project.service_pathway)) {
    applyXpdCaptureDefaults(project);
  }

  applyXpdProjectMetadata(project);

  return project;
}

export function validateManualOverride({ fieldUser, overrideReason, projectAddress, servicePathway }) {
  const errors = [];
  if (!fieldUser?.trim()) errors.push('Field user is required for manual override.');
  if (!overrideReason) errors.push('Override reason is required.');
  if (!projectAddress?.trim()) errors.push('Project address is required.');
  if (!servicePathway) errors.push('XPD documentation package is required.');
  if (servicePathway && !isXpdPathway(servicePathway)) {
    errors.push('Manual override supports XPD documentation packages only in v1.0.');
  }
  return errors;
}

export function getEnhancementSelections(project) {
  const selections = [];
  if (project.enhanced_camera_capture) selections.push(ENHANCEMENT_KEYS.enhanced_camera.label);
  if (project.aerial_documentation) selections.push(ENHANCEMENT_KEYS.aerial.label);
  if (project.reference_360_capture) selections.push(ENHANCEMENT_KEYS.reference_360.label);
  if (project.verified_location_capture) selections.push(ENHANCEMENT_KEYS.verified_location.label);
  if (project.spatial_record_capture) selections.push(ENHANCEMENT_KEYS.spatial.label);
  return selections;
}

export function getEnhancementDisplayLines(project) {
  const selected = getEnhancementSelections(project);
  const lines = [];

  if (project.aerial_documentation) {
    const status = project.aerial_status || 'not_requested';
    const label = AERIAL_STATUSES.find((s) => s.value === status)?.label || status;
    lines.push(`Aerial Context ${formatStatusLabel(status, label)}`);
  } else {
    lines.push('Aerial Context Not Selected');
  }

  if (project.enhanced_camera_capture) {
    lines.push('Enhanced Documentation Selected');
  } else {
    lines.push('Enhanced Camera Not Selected');
  }

  if (project.reference_360_capture) lines.push('360 Reference Selected');
  if (project.verified_location_capture) lines.push('Verified Location Selected');
  if (project.spatial_record_capture) lines.push('Spatial Record Selected');

  if (!selected.length && !project.aerial_documentation && !project.enhanced_camera_capture) {
    return lines;
  }

  return lines.length ? lines : ['None selected'];
}

function formatStatusLabel(status, label) {
  if (status === 'pending_airspace_review' || status === 'pending_client_authorization') return 'Pending';
  if (status === 'approved') return 'Approved';
  if (status === 'completed') return 'Completed';
  if (status === 'unavailable_or_not_approved') return 'Not Approved';
  if (status === 'requested') return 'Requested';
  return label;
}

export function getDefaultCaptureMethodLabel(project) {
  if (project?.default_capture_method === DEFAULT_CAPTURE_METHOD) {
    return DEFAULT_CAPTURE_METHOD_LABEL;
  }
  if (project?.default_capture_method) {
    return project.default_capture_method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (isXpdPathway(project?.service_pathway)) {
    return DEFAULT_CAPTURE_METHOD_LABEL;
  }
  return '—';
}

export function buildGovernanceBannerHtml(project) {
  if (!project) return '';

  const linked = isLinkedToClientFlow(project) ? 'YES' : 'NO';
  const enhancements = getEnhancementDisplayLines(project).join(', ');
  const aerialLine =
    project.aerial_documentation || project.aerial_status
      ? `<div class="gov-line"><span class="gov-label">Aerial Status:</span> ${escapeHtml(
          AERIAL_STATUSES.find((s) => s.value === project.aerial_status)?.label ||
            project.aerial_status ||
            '—'
        )}</div>`
      : '';

  return `
    <div class="governance-banner">
      <div class="governance-banner-header">Project Governance</div>
      <div class="governance-banner-grid">
        <div class="gov-line"><span class="gov-label">Linked to ClientFlow:</span> ${linked}</div>
        <div class="gov-line"><span class="gov-label">ClientFlow Request ID:</span> ${escapeHtml(project.clientflow_request_id || '—')}</div>
        <div class="gov-line"><span class="gov-label">UECS Lite Project ID:</span> ${escapeHtml(project.uecs_project_id || project.project_id || '—')}</div>
        <div class="gov-line"><span class="gov-label">Service Pathway:</span> ${escapeHtml(project.service_pathway || '—')}</div>
        <div class="gov-line"><span class="gov-label">Documentation Class:</span> ${escapeHtml(project.documentation_control_classification || DOC_CONTROL_CLASSIFICATION)}</div>
        <div class="gov-line"><span class="gov-label">Documentation Family:</span> ${escapeHtml(project.documentation_family || 'XPD')}</div>
        <div class="gov-line"><span class="gov-label">Default Capture Method:</span> ${escapeHtml(getDefaultCaptureMethodLabel(project))}</div>
        <div class="gov-line"><span class="gov-label">Selected Enhancements:</span> ${escapeHtml(enhancements)}</div>
        <div class="gov-line"><span class="gov-label">Admin Review Required:</span> ${project.admin_review_required !== false ? 'YES' : 'NO'}</div>
        ${aerialLine}
      </div>
    </div>`;
}

export function buildCaptureMethodDisplayHtml(project) {
  const pathway = project?.service_pathway;
  const defaults = PATHWAY_DEFAULTS[pathway];
  const defaultLabel = getDefaultCaptureMethodLabel(project);
  const subMethod = defaults?.subMethod
    ? `<p class="capture-sub-method">Includes: ${escapeHtml(defaults.subMethod)}</p>`
    : '';
  const fallback = defaults?.fallback
    ? `<p class="capture-fallback"><strong>Fallback:</strong> ${escapeHtml(defaults.fallback)}</p>`
    : '';

  const optionalList = (defaults?.optionalEnhancements || [
    'Enhanced Documentation Add-On',
    'Aerial Context Add-On',
    '360 Reference Add-On',
    'Verified Location Add-On',
    'Spatial Record Add-On',
  ])
    .map((e) => `<li>${escapeHtml(e)}</li>`)
    .join('');

  return `
    <div class="capture-method-display">
      <div class="card-header">Capture Method</div>
      <p><strong>Default Capture Method:</strong> ${escapeHtml(defaultLabel)}</p>
      ${subMethod}
      ${fallback}
      <p class="capture-method-section-label"><strong>Optional Enhancements:</strong></p>
      <ul class="capture-enhancement-list">${optionalList}</ul>
      <p class="capture-method-note">Documentation enhancements are scope-based add-ons selected upstream by ClientFlow and governed by UECS Lite.</p>
    </div>`;
}

export function applyFieldQcmStatus(project, coverageReady = false) {
  project.qcm_status = 'field_qcm_completed';
  project.review_status = 'qcm_pending';
  project.admin_review_required = true;
  project.field_export_required = true;
  project.field_qcm_note = 'Field QCM does not equal final approval. Admin QCM is required before client release.';
  if (coverageReady && !project.field_export_completed) {
    project.ready_for_admin_review = false;
  }
  return project;
}

export function applyExportCompleted(project) {
  project.field_export_completed = true;
  project.field_export_required = false;
  project.ready_for_admin_review = true;
  project.export_completed_at = new Date().toISOString();
  return project;
}

export function isProjectExportComplete(project) {
  return !!project?.field_export_completed;
}

export function sanitizeClientFacingText(text) {
  if (text == null) return '';
  let sanitized = String(text);
  for (const term of FORBIDDEN_EXPORT_TERMS) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    sanitized = sanitized.replace(pattern, '[redacted]');
  }
  return sanitized;
}

export function buildCaptureChecklistSummary(shotList, coverage, sfm = null) {
  const requiredViewsCompleted = coverage?.requiredViewsComplete ?? coverage?.requiredZonesComplete ?? 0;
  const requiredViewsTotal = coverage?.requiredViewsTotal ?? coverage?.requiredZonesTotal ?? 0;
  const sections = [];

  if (sfm?.passes) {
    for (const pass of sfm.passes) {
      sections.push({
        section_id: pass.id,
        section_name: pass.name,
        completed: pass.completed ?? false,
        required_views: pass.requiredViews?.length ?? 0,
        captured_views: pass.capturedViews?.length ?? 0,
      });
    }
  } else if (shotList?.zones) {
    for (const zone of shotList.zones.filter((z) => z.required)) {
      sections.push({
        section_id: zone.id,
        section_name: zone.name,
        completed: !!zone.captured,
        required_views: (zone.minWide || 0) + (zone.minCloseup || 0),
        captured_views: zone.captured ? 1 : 0,
      });
    }
  }

  return {
    capture_sections_completed: sections.filter((section) => section.completed).length,
    capture_sections_total: sections.length,
    required_views_completed: requiredViewsCompleted,
    required_views_total: requiredViewsTotal,
    sections,
  };
}

export function validateExportGate(project, coverage, shotList, sfm = null) {
  const errors = [];
  const checklist = buildCaptureChecklistSummary(shotList, coverage, sfm);

  if (!project?.clientflow_request_id && !project?.is_test_project) {
    errors.push('clientflow_request_id is required for export.');
  }
  if (!project?.uecs_project_id && !project?.project_id) {
    errors.push('uecs_project_id is required for export.');
  }
  if (!project?.client_name) errors.push('client_name is required for export.');
  if (!project?.project_address) errors.push('project_address is required for export.');
  if (!isXpdPathway(project?.service_pathway)) {
    errors.push('Export supports XPD documentation packages only.');
  }

  const readiness = coverage?.readiness;
  const exportReadyLevels = ['READY_FOR_ADMIN_REVIEW', 'SITE_LIMITATION_REVIEW'];
  if (!exportReadyLevels.includes(readiness)) {
    errors.push('Required capture checklist is incomplete. Complete required views before export.');
  }

  if (checklist.required_views_total > 0 && checklist.required_views_completed < checklist.required_views_total) {
    errors.push('Required views are not complete.');
  }

  return {
    valid: errors.length === 0,
    errors,
    checklist,
  };
}

export function buildQueueRecord({
  project,
  packet = null,
  status = QUEUE_STATUSES.QUEUED,
  validationStatus = 'pending',
  validationErrors = [],
  existing = null,
}) {
  const now = new Date().toISOString();
  return {
    queue_id: existing?.queue_id || `uecsq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    project_id: project.project_id,
    clientflow_request_id: project.clientflow_request_id || null,
    uecs_project_id: project.uecs_project_id || project.project_id,
    status,
    created_at: existing?.created_at || now,
    updated_at: now,
    last_exported_at: existing?.last_exported_at || null,
    export_count: existing?.export_count || 0,
    validation_status: validationStatus,
    validation_errors: validationErrors,
    queued_at: existing?.queued_at || now,
    sync_attempts: existing?.sync_attempts || 0,
    sync_endpoint: existing?.sync_endpoint || null,
    next_action: existing?.next_action || 'connect_uecs_lite_sync_endpoint',
    payload_type: 'completed_field_packet',
    payload_version: COMPLETED_PACKET_VERSION,
    packet,
  };
}

export function transitionQueueStatus(record, nextStatus, updates = {}) {
  const now = new Date().toISOString();
  return {
    ...record,
    ...updates,
    status: nextStatus,
    updated_at: now,
    last_exported_at:
      nextStatus === QUEUE_STATUSES.EXPORTED ? now : record.last_exported_at || updates.last_exported_at || null,
    export_count:
      nextStatus === QUEUE_STATUSES.EXPORTED
        ? (record.export_count || 0) + 1
        : record.export_count || 0,
  };
}

export function getPathwayDefaults(pathway) {
  return PATHWAY_DEFAULTS[pathway] || null;
}
