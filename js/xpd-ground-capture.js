/**
 * EAS Field Capture QCM — XPD Ground-Based Capture Structure
 */

import { QCM_STATUS } from './utils.js';

export const COVERAGE_GROUPS = {
  CORE: 'Required Core Coverage',
  DETAIL: 'Condition / Detail Coverage',
  CONTEXT: 'Optional Context Coverage',
};

export const GROUND_GUIDANCE =
  'Start with the required core exterior record. Then add detail images only where visible features or conditions need closer documentation. Use optional context images to explain layout, access, or viewing angles — not to pad the package.';

export const GROUND_QA_REMINDER =
  'Before export, replace weak images, remove unnecessary duplicates, and confirm that the final image set explains the property clearly.';

export const DETAIL_FIELD_NOTE =
  'Capture detail images only when they help explain the exterior record. Avoid unnecessary duplicates.';

export const RECOMMENDED_TOTAL = { min: 25, max: 40 };
export const CONTROLLED_UPPER = { min: 40, max: 45 };

export const CORE_AREAS = [
  { id: 'front_elevation', name: 'Front elevation', targetMin: 4, targetMax: 6 },
  { id: 'rear_elevation', name: 'Rear elevation', targetMin: 4, targetMax: 6 },
  { id: 'left_side_elevation', name: 'Left side elevation', targetMin: 3, targetMax: 5 },
  { id: 'right_side_elevation', name: 'Right side elevation', targetMin: 3, targetMax: 5 },
  { id: 'corners_transitions', name: 'Corners / transitions', targetMin: 4, targetMax: 6 },
  { id: 'entry_points_garage_gates', name: 'Entry points / garage / gates', targetMin: 2, targetMax: 4 },
];

export const DETAIL_AREAS = [
  { id: 'roofline_fascia_soffit_ground', name: 'Roofline / fascia / soffit from ground', targetMin: 2, targetMax: 4 },
  { id: 'windows_doors_trim', name: 'Windows / doors / trim', targetMin: 2, targetMax: 4 },
  { id: 'exterior_wall_materials', name: 'Exterior wall materials / siding / stucco / brick', targetMin: 2, targetMax: 4 },
  { id: 'driveway_walkways_hardscape', name: 'Driveway / walkways / visible hardscape', targetMin: 1, targetMax: 3 },
  { id: 'fence_gate_exterior_utilities', name: 'Fence / gate / exterior utilities', targetMin: 1, targetMax: 3 },
];

export const CONTEXT_AREAS = [
  { id: 'street_facing_overview', name: 'Street-facing overview', targetMin: 0, targetMax: 1 },
  { id: 'front_left_angle', name: 'Front-left angle', targetMin: 0, targetMax: 1 },
  { id: 'front_right_angle', name: 'Front-right angle', targetMin: 0, targetMax: 1 },
  { id: 'rear_left_angle', name: 'Rear-left angle', targetMin: 0, targetMax: 1 },
  { id: 'rear_right_angle', name: 'Rear-right angle', targetMin: 0, targetMax: 1 },
];

/** Maps Simple Field Method view/category IDs to ground coverage areas */
export const VIEW_TO_COVERAGE = {
  p1_front_overview: { group: COVERAGE_GROUPS.CORE, area: 'front_elevation', pass: 1 },
  p1_front_detail: { group: COVERAGE_GROUPS.CORE, area: 'front_elevation', pass: 1 },
  p1_front_left: { group: COVERAGE_GROUPS.CORE, area: 'corners_transitions', pass: 1 },
  p1_front_right: { group: COVERAGE_GROUPS.CORE, area: 'corners_transitions', pass: 1 },
  p1_right_overview: { group: COVERAGE_GROUPS.CORE, area: 'right_side_elevation', pass: 1 },
  p1_right_detail: { group: COVERAGE_GROUPS.CORE, area: 'right_side_elevation', pass: 1 },
  p1_rear_overview: { group: COVERAGE_GROUPS.CORE, area: 'rear_elevation', pass: 1 },
  p1_rear_detail: { group: COVERAGE_GROUPS.CORE, area: 'rear_elevation', pass: 1 },
  p1_rear_left: { group: COVERAGE_GROUPS.CORE, area: 'corners_transitions', pass: 1 },
  p1_rear_right: { group: COVERAGE_GROUPS.CORE, area: 'corners_transitions', pass: 1 },
  p1_left_overview: { group: COVERAGE_GROUPS.CORE, area: 'left_side_elevation', pass: 1 },
  p1_left_detail: { group: COVERAGE_GROUPS.CORE, area: 'left_side_elevation', pass: 1 },
  p2_entry_doors: { group: COVERAGE_GROUPS.CORE, area: 'entry_points_garage_gates', pass: 2 },
  p2_garage_doors: { group: COVERAGE_GROUPS.CORE, area: 'entry_points_garage_gates', pass: 2 },
  p2_roofline: { group: COVERAGE_GROUPS.DETAIL, area: 'roofline_fascia_soffit_ground', pass: 2 },
  p2_windows: { group: COVERAGE_GROUPS.DETAIL, area: 'windows_doors_trim', pass: 2 },
  p2_wall_surfaces: { group: COVERAGE_GROUPS.DETAIL, area: 'exterior_wall_materials', pass: 2 },
  p2_driveways: { group: COVERAGE_GROUPS.DETAIL, area: 'driveway_walkways_hardscape', pass: 2 },
  p2_fence_gates: { group: COVERAGE_GROUPS.DETAIL, area: 'fence_gate_exterior_utilities', pass: 2 },
  p2_utilities: { group: COVERAGE_GROUPS.DETAIL, area: 'fence_gate_exterior_utilities', pass: 2 },
  p2_drainage: { group: COVERAGE_GROUPS.DETAIL, area: 'driveway_walkways_hardscape', pass: 2 },
  p2_exterior_condition: { group: COVERAGE_GROUPS.DETAIL, area: 'exterior_wall_materials', pass: 2 },
  ctx_street_facing: { group: COVERAGE_GROUPS.CONTEXT, area: 'street_facing_overview', pass: 3 },
  ctx_front_left: { group: COVERAGE_GROUPS.CONTEXT, area: 'front_left_angle', pass: 3 },
  ctx_front_right: { group: COVERAGE_GROUPS.CONTEXT, area: 'front_right_angle', pass: 3 },
  ctx_rear_left: { group: COVERAGE_GROUPS.CONTEXT, area: 'rear_left_angle', pass: 3 },
  ctx_rear_right: { group: COVERAGE_GROUPS.CONTEXT, area: 'rear_right_angle', pass: 3 },
};

export const CONTEXT_VIEW_OPTIONS = [
  { id: 'ctx_street_facing', name: 'Street-facing overview' },
  { id: 'ctx_front_left', name: 'Front-left angle (context)' },
  { id: 'ctx_front_right', name: 'Front-right angle (context)' },
  { id: 'ctx_rear_left', name: 'Rear-left angle (context)' },
  { id: 'ctx_rear_right', name: 'Rear-right angle (context)' },
];

export function initGroundCaptureStructure() {
  return {
    required_core_coverage: {
      targetMin: 18,
      targetMax: 28,
      areas: CORE_AREAS.map((a) => ({
        ...a,
        captured_count: 0,
        usable_count: 0,
        missing: true,
        site_limitation: null,
        site_limitation_note: null,
      })),
    },
    condition_detail_coverage: {
      targetMin: 5,
      targetMax: 12,
      areas: DETAIL_AREAS.map((a) => ({
        ...a,
        captured_count: 0,
        usable_count: 0,
        applicable: true,
        not_applicable_reason: null,
        missing: true,
      })),
    },
    optional_context_coverage: {
      targetMin: 3,
      targetMax: 5,
      areas: CONTEXT_AREAS.map((a) => ({
        ...a,
        captured_count: 0,
        usable_count: 0,
        used: false,
        optional_context_reason: null,
      })),
    },
    recommended_total_range: '25-40',
    controlled_upper_range: '40-45',
  };
}

export function usableImages(images) {
  return images.filter((i) => i.accepted && !i.marked_unnecessary && !i.is_unnecessary);
}

export function classifyImageFromView(requiredViewId) {
  const mapping = VIEW_TO_COVERAGE[requiredViewId];
  if (!mapping) return null;
  return {
    coverage_group: mapping.group,
    coverage_area: mapping.area,
    target_range_group: mapping.group,
    supports_baseline_record: mapping.group !== COVERAGE_GROUPS.CONTEXT,
  };
}

export function applyImageClassification(imageMeta) {
  const base = classifyImageFromView(imageMeta.required_view_id);
  if (!base) return imageMeta;
  return {
    ...imageMeta,
    coverage_group: base.coverage_group,
    coverage_area: base.coverage_area,
    target_range_group: base.target_range_group,
    supports_baseline_record: base.supports_baseline_record,
    optional_context_reason: imageMeta.optional_context_reason || '',
    is_duplicate_candidate: imageMeta.is_duplicate_candidate || false,
    is_unnecessary: imageMeta.is_unnecessary || false,
    admin_review_required: imageMeta.admin_review_required || false,
  };
}

function countImagesForArea(images, areaId) {
  const all = images.filter((i) => i.accepted && i.coverage_area === areaId);
  const usable = usableImages(images).filter((i) => i.coverage_area === areaId);
  return { captured: all.length, usable: usable.length };
}

export function updateGroundCaptureStructure(structure, images, sfm) {
  if (!structure) return initGroundCaptureStructure();
  const updated = JSON.parse(JSON.stringify(structure));

  for (const area of updated.required_core_coverage.areas) {
    const counts = countImagesForArea(images, area.id);
    area.captured_count = counts.captured;
    area.usable_count = counts.usable;

    const limitation = sfm?.pass1?.views?.find((v) => VIEW_TO_COVERAGE[v.id]?.area === area.id && v.site_limitation);
    if (limitation) {
      area.site_limitation = limitation.site_limitation;
      area.site_limitation_note = limitation.site_limitation_note;
    }
    area.missing = area.usable_count < area.targetMin && !(area.site_limitation && area.site_limitation_note);
  }

  for (const area of updated.condition_detail_coverage.areas) {
    const counts = countImagesForArea(images, area.id);
    area.captured_count = counts.captured;
    area.usable_count = counts.usable;

    const cat = sfm?.pass2?.categories?.find((c) => VIEW_TO_COVERAGE[c.id]?.area === area.id);
    if (cat?.site_limitation === 'not_present') {
      area.applicable = false;
      area.not_applicable_reason = cat.site_limitation_note || 'Not present / not applicable';
      area.missing = false;
    } else if (cat?.site_limitation && cat.site_limitation_note) {
      area.not_applicable_reason = cat.site_limitation_note;
      area.missing = false;
    } else {
      area.missing = area.usable_count < area.targetMin;
    }
  }

  for (const area of updated.optional_context_coverage.areas) {
    const counts = countImagesForArea(images, area.id);
    area.captured_count = counts.captured;
    area.usable_count = counts.usable;
    const ctxImages = usableImages(images).filter((i) => i.coverage_area === area.id);
    area.used = ctxImages.length > 0;
    area.optional_context_reason = ctxImages.map((i) => i.optional_context_reason).filter(Boolean).join('; ') || null;
  }

  return updated;
}

export function getCoreGroupStats(structure, images) {
  const usable = usableImages(images).filter((i) => i.coverage_group === COVERAGE_GROUPS.CORE);
  const captured = images.filter((i) => i.accepted && i.coverage_group === COVERAGE_GROUPS.CORE);
  const missing = structure.required_core_coverage.areas.filter((a) => a.missing).map((a) => a.name);
  return {
    targetRange: '18–28',
    captured: captured.length,
    usable: usable.length,
    missing,
  };
}

export function getDetailGroupStats(structure, images) {
  const usable = usableImages(images).filter((i) => i.coverage_group === COVERAGE_GROUPS.DETAIL);
  const captured = images.filter((i) => i.accepted && i.coverage_group === COVERAGE_GROUPS.DETAIL);
  const missing = structure.condition_detail_coverage.areas.filter((a) => a.missing).map((a) => a.name);
  return {
    targetRange: '5–12',
    captured: captured.length,
    usable: usable.length,
    missing,
  };
}

export function getContextGroupStats(structure, images) {
  const usable = usableImages(images).filter((i) => i.coverage_group === COVERAGE_GROUPS.CONTEXT);
  const captured = images.filter((i) => i.accepted && i.coverage_group === COVERAGE_GROUPS.CONTEXT);
  const usedAreas = structure.optional_context_coverage.areas
    .filter((a) => a.used)
    .map((a) => ({ name: a.name, reason: a.optional_context_reason }));
  const explainText = usedAreas.length
    ? usedAreas.map((a) => a.reason || a.name).filter(Boolean).join(', ')
    : null;
  return {
    targetRange: '3–5',
    captured: captured.length,
    usable: usable.length,
    usedAreas,
    explainText,
  };
}

export function checkOvercapture(images) {
  const usable = usableImages(images);
  const count = usable.length;
  const hasContextJustification = usable.some(
    (i) => i.coverage_group === COVERAGE_GROUPS.CONTEXT && i.optional_context_reason
  );

  if (count > CONTROLLED_UPPER.max) {
    return {
      level: 'exceeds_upper',
      message:
        'This package exceeds the controlled upper range for XPD ground-based capture. Review duplicate images and mark unnecessary images before export.',
      adminReviewRequired: true,
    };
  }
  if (count > RECOMMENDED_TOTAL.max && !hasContextJustification) {
    return {
      level: 'above_normal',
      message:
        'This package is above the normal ground-based range. Confirm that the additional images provide useful context or replace unnecessary duplicates before export.',
      adminReviewRequired: true,
    };
  }
  return { level: 'ok', message: null, adminReviewRequired: false };
}

export function getMissingCoreAreas(structure) {
  return structure.required_core_coverage.areas.filter((a) => a.missing);
}

export function getMissingDetailAreas(structure) {
  return structure.condition_detail_coverage.areas.filter((a) => a.missing);
}

export function buildGroundCaptureExport(structure, images, sfm) {
  const usable = usableImages(images);
  const overcapture = checkOvercapture(images);
  const retakes = images.filter((i) => i.accepted && i.qcm_status === QCM_STATUS.RETAKE);
  const adminReview = images.filter((i) => i.admin_review || i.admin_review_required || i.qcm_status === QCM_STATUS.ADMIN_REVIEW);

  return {
    xpd_ground_based_capture_structure: {
      required_core_coverage: {
        target_range: '18-28',
        areas: structure.required_core_coverage.areas,
      },
      condition_detail_coverage: {
        target_range: '5-12',
        areas: structure.condition_detail_coverage.areas,
      },
      optional_context_coverage: {
        target_range: '3-5',
        areas: structure.optional_context_coverage.areas,
      },
      recommended_total_range: '25-40',
      controlled_upper_range: '40-45',
      overcapture_review_required: overcapture.adminReviewRequired,
      final_qa_completed: sfm?.pass3?.completed || false,
    },
    total_captured_images: images.filter((i) => i.accepted).length,
    total_usable_images: usable.length,
    total_retake_recommended: retakes.length,
    total_admin_review: adminReview.length,
    missing_required_core_areas: getMissingCoreAreas(structure).map((a) => a.name),
    missing_detail_areas: getMissingDetailAreas(structure).map((a) => a.name),
    optional_context_used: structure.optional_context_coverage.areas
      .filter((a) => a.used)
      .map((a) => ({ area: a.name, reason: a.optional_context_reason })),
    site_limitations: sfm?.pass3?.site_limitations || [],
  };
}

export function applyCoreAreaLimitation(structure, areaId, limitation, note) {
  const updated = JSON.parse(JSON.stringify(structure));
  const area = updated.required_core_coverage.areas.find((a) => a.id === areaId);
  if (area && note) {
    area.site_limitation = limitation;
    area.site_limitation_note = note;
    area.missing = false;
  }
  return updated;
}

export function markDetailNotApplicable(structure, areaId, reason) {
  const updated = JSON.parse(JSON.stringify(structure));
  const area = updated.condition_detail_coverage.areas.find((a) => a.id === areaId);
  if (area) {
    area.applicable = false;
    area.not_applicable_reason = reason;
    area.missing = false;
  }
  return updated;
}
