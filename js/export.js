/**
 * EAS Field Capture QCM — Export Module
 */

import {
  SYSTEM_NAME,
  PHASE,
  VERSION,
  DISCLAIMER,
  formatDateTime,
  downloadJson,
  downloadText,
} from './utils.js';
import { computeCoverageSummary, computeProjectQcmSummary } from './qcm.js';
import { getMissingZones } from './shotlists.js';
import { usesSimpleFieldMethod, buildCapturePassesExport } from './simple-field-method.js';
import { DEFAULT_CAPTURE_METHOD, TEST_WATERMARK } from './governance.js';

export function buildProjectPacket(project, images, shotList, coverage, sfm = null) {
  const qcmSummary = computeProjectQcmSummary(images);
  const missing = getMissingZones(shotList).map((z) => ({
    zone_id: z.id,
    zone_name: z.name,
    min_wide: z.minWide,
    min_closeup: z.minCloseup,
    captured: z.captured,
  }));

  const adminReviewFlags = images
    .filter((i) => i.qcm_status === 'ADMIN REVIEW' || i.admin_review)
    .map((i) => ({
      image_id: i.image_id,
      zone: i.zone,
      reason: i.field_notes || 'Admin review flagged',
    }));

  return {
    system: SYSTEM_NAME,
    phase: PHASE,
    version: VERSION,
    project: { ...project },
    service_pathway: project.service_pathway,
    documentation_level: project.documentation_level,
    documentation_control_classification: project.documentation_control_classification,
    clientflow_request_id: project.clientflow_request_id || null,
    uecs_project_id: project.uecs_project_id || project.project_id,
    xpd_package_type: project.service_pathway,
    review_status: 'qcm_pending',
    qcm_status: 'field_qcm_completed',
    sow_status: 'not_started',
    delivery_status: project.field_export_completed ? 'export_ready' : 'not_ready',
    default_capture_method: project.default_capture_method || DEFAULT_CAPTURE_METHOD,
    field_capture_qcm: project.field_capture_qcm ?? true,
    field_export_required: project.field_export_required ?? true,
    field_export_completed: project.field_export_completed ?? false,
    ready_for_admin_review: project.ready_for_admin_review ?? false,
    linked_to_clientflow: project.linked_to_clientflow ?? false,
    import_method: project.import_method || null,
    override_reason: project.override_reason || null,
    is_test_project: project.is_test_project || false,
    not_for_client_delivery: project.not_for_client_delivery || false,
    fallback_capture_method: project.fallback_capture_method || null,
    client_scope_notice_required: project.client_scope_notice_required || false,
    enhanced_camera_capture: project.enhanced_camera_capture || false,
    aerial_documentation: project.aerial_documentation || false,
    reference_360_capture: project.reference_360_capture || false,
    verified_location_capture: project.verified_location_capture || false,
    spatial_record_capture: project.spatial_record_capture || false,
    field_capture_complete:
      coverage.readiness === 'READY_FOR_ADMIN_REVIEW' ||
      coverage.readiness === 'SITE_LIMITATION_REVIEW',
    admin_review_required: true,
    aerial_status: project.aerial_status || null,
    capture_summary: {
      total_captured: images.length,
      total_accepted: coverage.accepted,
      warnings: coverage.warnings,
      retakes_recommended: coverage.retakes,
      target_range: `${coverage.targetMin}–${coverage.targetMax}`,
    },
    coverage_summary: coverage,
    qcm_summary: qcmSummary,
    images: images.map((img) => sanitizeImageForExport(img)),
    missing_required_shots: missing,
    admin_review_flags: adminReviewFlags,
    export_timestamp: formatDateTime(),
    ...(usesSimpleFieldMethod(project.service_pathway) && sfm
      ? buildCapturePassesExport(sfm, images)
      : {}),
  };
}

function sanitizeImageForExport(img) {
  const { blob, dataUrl, ...rest } = img;
  return {
    ...rest,
    capture_pass: rest.capture_pass || null,
    required_view_id: rest.required_view_id || '',
    is_replacement_image: rest.is_replacement_image || false,
    replaces_image_id: rest.replaces_image_id || '',
    site_limitation: rest.site_limitation || '',
    site_limitation_note: rest.site_limitation_note || '',
    coverage_group: rest.coverage_group || '',
    coverage_area: rest.coverage_area || '',
    target_range_group: rest.target_range_group || '',
    supports_baseline_record: rest.supports_baseline_record ?? true,
    optional_context_reason: rest.optional_context_reason || '',
    is_duplicate_candidate: rest.is_duplicate_candidate || false,
    is_unnecessary: rest.is_unnecessary || false,
    admin_review_required: rest.admin_review_required || false,
    detail_classification: rest.detail_classification || null,
  };
}

export function buildImageManifest(project, images) {
  return {
    system: SYSTEM_NAME,
    project_id: project.project_id,
    project_address: project.project_address,
    service_pathway: project.service_pathway,
    export_timestamp: formatDateTime(),
    image_count: images.length,
    images: images.map((img) => ({
      image_id: img.image_id,
      project_id: img.project_id,
      original_filename: img.original_filename,
      capture_timestamp: img.capture_timestamp,
      uploaded_timestamp: img.uploaded_timestamp,
      shot_category: img.shot_category,
      zone: img.zone,
      zone_name: img.zone_name,
      angle_type: img.angle_type,
      wide_or_closeup: img.wide_or_closeup,
      field_notes: img.field_notes,
      qcm_score: img.qcm_score,
      qcm_status: img.qcm_status,
      qcm_flags: img.qcm_flags,
      gps_available: img.gps_available,
      latitude: img.latitude,
      longitude: img.longitude,
      device_source: img.device_source,
      image_width: img.image_width,
      image_height: img.image_height,
      file_size: img.file_size,
      mime_type: img.mime_type,
      accepted: img.accepted,
      wide_context_status: img.wide_context_status,
      capture_pass: img.capture_pass || null,
      required_view_id: img.required_view_id || '',
      is_replacement_image: img.is_replacement_image || false,
      replaces_image_id: img.replaces_image_id || '',
      site_limitation: img.site_limitation || '',
      site_limitation_note: img.site_limitation_note || '',
      detail_classification: img.detail_classification || null,
    })),
  };
}

export function buildQcmSummaryExport(project, images, coverage) {
  const qcm = computeProjectQcmSummary(images);
  return {
    system: SYSTEM_NAME,
    project_id: project.project_id,
    service_pathway: project.service_pathway,
    export_timestamp: formatDateTime(),
    package_readiness: coverage.readiness,
    package_readiness_pct: coverage.packageReadiness,
    qcm_summary: qcm,
    coverage_summary: coverage,
    per_image: images
      .filter((i) => i.accepted)
      .map((i) => ({
        image_id: i.image_id,
        zone: i.zone_name || i.zone,
        qcm_score: i.qcm_score,
        qcm_status: i.qcm_status,
        wide_or_closeup: i.wide_or_closeup,
      })),
    missing_required_shots: coverage.missingZones.map((z) => z.name),
  };
}

export function buildFieldCaptureReportHtml(project, images, shotList, coverage) {
  const qcm = computeProjectQcmSummary(images);
  const missing = getMissingZones(shotList);

  const rows = images
    .filter((i) => i.accepted)
    .map(
      (img) => `
    <tr>
      <td>${escapeHtml(img.zone_name || img.zone)}</td>
      <td>${escapeHtml(img.wide_or_closeup || '—')}</td>
      <td>${img.qcm_score ?? '—'}</td>
      <td><span class="status-${statusClass(img.qcm_status)}">${escapeHtml(img.qcm_status || '—')}</span></td>
    </tr>`
    )
    .join('');

  const missingList = missing
    .map((z) => `<li>${escapeHtml(z.name)}</li>`)
    .join('');

  const testWatermark = project.is_test_project
    ? `<div class="test-watermark">${escapeHtml(TEST_WATERMARK)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Field Capture Report — ${escapeHtml(project.project_id)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
    h1 { color: #b8923f; font-size: 1.4rem; }
    h2 { font-size: 1.1rem; margin-top: 24px; border-bottom: 2px solid #b8923f; padding-bottom: 4px; }
    .meta { background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .meta p { margin: 4px 0; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.85rem; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #2d2d2d; color: #fff; }
    .status-pass { color: #2ea043; font-weight: 600; }
    .status-warning { color: #bf8700; font-weight: 600; }
    .status-fail { color: #cf222e; font-weight: 600; }
    .readiness { padding: 12px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .ready { background: #dafbe1; color: #1a7f37; }
    .coverage { background: #fff8c5; color: #9a6700; }
    .retake { background: #ffebe9; color: #cf222e; }
    .incomplete { background: #ddf4ff; color: #0969da; }
    .disclaimer { font-size: 0.75rem; color: #666; margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; }
    ul { padding-left: 20px; }
    .test-watermark { background: repeating-linear-gradient(-45deg, #fff3cd, #fff3cd 10px, #ffe69c 10px, #ffe69c 20px); border: 2px dashed #bf8700; color: #9a6700; font-weight: 700; text-align: center; padding: 12px; margin-bottom: 16px; font-size: 0.9rem; }
  </style>
</head>
<body>
  ${testWatermark}
  <h1>${escapeHtml(SYSTEM_NAME)}</h1>
  <p><strong>${escapeHtml(VERSION)}</strong> — Field Capture Report</p>

  <div class="meta">
    <p><strong>Project ID:</strong> ${escapeHtml(project.project_id)}</p>
    <p><strong>Client:</strong> ${escapeHtml(project.client_name)} ${project.client_company ? `(${escapeHtml(project.client_company)})` : ''}</p>
    <p><strong>Address:</strong> ${escapeHtml(project.project_address)}, ${escapeHtml(project.city)} ${escapeHtml(project.state)} ${escapeHtml(project.zip)}</p>
    <p><strong>Service Pathway:</strong> ${escapeHtml(project.service_pathway)}</p>
    <p><strong>Default Capture Method:</strong> Field Capture QCM</p>
    <p><strong>Documentation Control:</strong> ${escapeHtml(project.documentation_control_classification)}</p>
    <p><strong>Admin Review Required:</strong> ${project.admin_review_required !== false ? 'YES' : 'NO'}</p>
    <p><strong>Field User:</strong> ${escapeHtml(project.field_user)}</p>
    <p><strong>Date:</strong> ${escapeHtml(project.date)}</p>
    <p><strong>Export:</strong> ${escapeHtml(formatDateTime())}</p>
  </div>

  <div class="readiness ${readinessCss(coverage.readiness)}">
    Documentation Readiness: ${escapeHtml(formatReadiness(coverage.readiness))} (${coverage.packageReadiness}%)
  </div>
  <p>${escapeHtml(coverage.statusMessage)}</p>

  <h2>Capture Summary</h2>
  <div class="meta">
    <p>Target Range: ${coverage.targetMin}–${coverage.targetMax} images</p>
    <p>Accepted Images: ${coverage.accepted}</p>
    <p>Required Zones Complete: ${coverage.requiredZonesComplete} / ${coverage.requiredZonesTotal}</p>
    <p>Average QCM Score: ${qcm.average_score} / 100</p>
    <p>Warnings: ${coverage.warnings} | Retake Recommended: ${coverage.retakes}</p>
  </div>

  ${missing.length ? `<h2>Missing Required Zones</h2><ul>${missingList}</ul>` : ''}

  <h2>Accepted Images</h2>
  <table>
    <thead><tr><th>Zone</th><th>Shot Type</th><th>QCM Score</th><th>Status</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No accepted images yet.</td></tr>'}</tbody>
  </table>

  <div class="disclaimer">${escapeHtml(DISCLAIMER)}</div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusClass(status) {
  if (!status) return 'warning';
  if (status.includes('PASS')) return 'pass';
  if (status.includes('WARNING')) return 'warning';
  if (status.includes('RETAKE') || status === 'FAIL') return 'fail';
  return 'warning';
}

function readinessCss(level) {
  const map = {
    READY_FOR_ADMIN_REVIEW: 'ready',
    NEEDS_MORE_COVERAGE: 'coverage',
    RETAKES_RECOMMENDED: 'retake',
    FIELD_CAPTURE_INCOMPLETE: 'incomplete',
  };
  return map[level] || 'incomplete';
}

function formatReadiness(level) {
  const map = {
    READY_FOR_ADMIN_REVIEW: 'Ready for Admin Review',
    NEEDS_MORE_COVERAGE: 'Needs More Coverage',
    RETAKES_RECOMMENDED: 'Retakes Recommended',
    FIELD_CAPTURE_INCOMPLETE: 'Field Capture Incomplete',
  };
  return map[level] || level;
}

export async function exportProject(project, images, shotList, sfm = null) {
  const coverage = computeCoverageSummary(project, images, shotList, sfm);
  const packet = buildProjectPacket(project, images, shotList, coverage, sfm);
  const manifest = buildImageManifest(project, images);
  const qcmExport = buildQcmSummaryExport(project, images, coverage);
  const reportHtml = buildFieldCaptureReportHtml(project, images, shotList, coverage);

  const exportId = `export_${Date.now()}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prefix = project.project_id.replace(/[^a-zA-Z0-9_-]/g, '_');

  downloadJson(packet, `${prefix}_project_packet_${timestamp}.json`);
  downloadJson(manifest, `${prefix}_image_manifest_${timestamp}.json`);
  downloadJson(qcmExport, `${prefix}_qcm_summary_${timestamp}.json`);
  downloadText(reportHtml, `${prefix}_field_capture_report_${timestamp}.html`);

  return {
    export_id: exportId,
    export_timestamp: formatDateTime(),
    files: [
      `${prefix}_project_packet_${timestamp}.json`,
      `${prefix}_image_manifest_${timestamp}.json`,
      `${prefix}_qcm_summary_${timestamp}.json`,
      `${prefix}_field_capture_report_${timestamp}.html`,
    ],
    coverage,
    packet,
  };
}
