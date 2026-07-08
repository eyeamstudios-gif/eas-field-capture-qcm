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
  };

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

export function getPathwayDefaults(pathway) {
  return PATHWAY_DEFAULTS[pathway] || null;
}
