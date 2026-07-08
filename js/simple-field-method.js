/**
 * EAS Field Capture QCM — Simple Field Method (XPD Exterior Baseline)
 */

import { SERVICE_PATHWAYS, QCM_STATUS } from './utils.js';
import {
  COVERAGE_GROUPS,
  GROUND_GUIDANCE,
  GROUND_QA_REMINDER,
  DETAIL_FIELD_NOTE,
  RECOMMENDED_TOTAL,
  initGroundCaptureStructure,
  updateGroundCaptureStructure,
  getCoreGroupStats,
  getDetailGroupStats,
  getContextGroupStats,
  checkOvercapture,
  getMissingCoreAreas,
  getMissingDetailAreas,
  buildGroundCaptureExport,
  applyImageClassification,
  classifyImageFromView,
  CONTEXT_VIEW_OPTIONS,
  usableImages as groundUsableImages,
} from './xpd-ground-capture.js';

export const CAPTURE_METHOD_NAME = 'Field Capture QCM';

export const CAPTURE_METHOD_DESCRIPTION =
  'Default XPD capture method with guided shot lists, QCM scoring, and coverage readiness. Includes Simple Field Method workflow for exterior baseline pathways.';

export const SFM_GUIDANCE = GROUND_GUIDANCE;

export const PASS_2_INSTRUCTION = DETAIL_FIELD_NOTE;

export const PASS_3_INSTRUCTION =
  'Final QA Fill should replace weak images, complete missing required coverage, or add justified context views only when needed. ' +
  GROUND_QA_REMINDER;

export const SITE_LIMITATION_OPTIONS = [
  { value: 'not_accessible', label: 'Not accessible' },
  { value: 'blocked', label: 'Blocked by obstruction' },
  { value: 'unsafe', label: 'Unsafe to capture' },
  { value: 'weather', label: 'Weather limitation' },
  { value: 'client_restriction', label: 'Client restriction' },
  { value: 'not_present', label: 'Not present / not applicable' },
];

export const PASS_2_CLASSIFICATIONS = [
  'Wide context',
  'Closeup detail',
  'Detail support image',
  'Admin review',
];

export const PASS_1_VIEWS = [
  { id: 'p1_front_overview', name: 'Front overview', sideCheck: 'Front', sequence: 1 },
  { id: 'p1_front_left', name: 'Front-left angle', sideCheck: 'Front-left corner', sequence: 2 },
  { id: 'p1_front_right', name: 'Front-right angle', sideCheck: 'Front-right corner', sequence: 3 },
  { id: 'p1_front_detail', name: 'Front detail zones', sideCheck: 'Front', sequence: 4 },
  { id: 'p1_right_overview', name: 'Right side overview', sideCheck: 'Right', sequence: 5 },
  { id: 'p1_right_detail', name: 'Right side details', sideCheck: 'Right', sequence: 6 },
  { id: 'p1_rear_overview', name: 'Rear overview', sideCheck: 'Rear', sequence: 7 },
  { id: 'p1_rear_left', name: 'Rear-left angle', sideCheck: 'Rear-left corner', sequence: 8 },
  { id: 'p1_rear_right', name: 'Rear-right angle', sideCheck: 'Rear-right corner', sequence: 9 },
  { id: 'p1_rear_detail', name: 'Rear details', sideCheck: 'Rear', sequence: 10 },
  { id: 'p1_left_overview', name: 'Left side overview', sideCheck: 'Left', sequence: 11 },
  { id: 'p1_left_detail', name: 'Left side details', sideCheck: 'Left', sequence: 12 },
];

export const PASS_1_SIDE_CHECKS = [
  { id: 'side_front', name: 'Front', viewIds: ['p1_front_overview', 'p1_front_detail'] },
  { id: 'side_right', name: 'Right', viewIds: ['p1_right_overview', 'p1_right_detail'] },
  { id: 'side_rear', name: 'Rear', viewIds: ['p1_rear_overview', 'p1_rear_detail'] },
  { id: 'side_left', name: 'Left', viewIds: ['p1_left_overview', 'p1_left_detail'] },
  { id: 'corner_fl', name: 'Front-left corner', viewIds: ['p1_front_left'] },
  { id: 'corner_fr', name: 'Front-right corner', viewIds: ['p1_front_right'] },
  { id: 'corner_rl', name: 'Rear-left corner', viewIds: ['p1_rear_left'] },
  { id: 'corner_rr', name: 'Rear-right corner', viewIds: ['p1_rear_right'] },
];

export const PASS_2_CATEGORIES = [
  { id: 'p2_entry_doors', name: 'Entry doors', conditional: true, coreArea: 'entry_points_garage_gates' },
  { id: 'p2_garage_doors', name: 'Garage doors', conditional: true, coreArea: 'entry_points_garage_gates' },
  { id: 'p2_roofline', name: 'Roofline / fascia / soffit from ground', conditional: false },
  { id: 'p2_windows', name: 'Windows / doors / trim', conditional: true },
  { id: 'p2_wall_surfaces', name: 'Exterior wall materials', conditional: true },
  { id: 'p2_driveways', name: 'Driveway / walkways / hardscape', conditional: true },
  { id: 'p2_fence_gates', name: 'Fence / gate / exterior utilities', conditional: true },
  { id: 'p2_utilities', name: 'Visible exterior utilities', conditional: true },
  { id: 'p2_drainage', name: 'Drainage or grading features', conditional: true },
  { id: 'p2_exterior_condition', name: 'Visible exterior condition worth documenting', conditional: true },
];

export const PASS_3_CHECKLIST = [
  { id: 'every_side', label: 'Do I have every side of the property?' },
  { id: 'every_elevation', label: 'Do I have every major elevation?' },
  { id: 'all_corners', label: 'Do I have the front, rear, left, and right corners?' },
  { id: 'enough_detail', label: 'Do I have enough detail to explain the exterior condition?' },
  { id: 'weak_reviewed', label: 'Are blurry, blocked, duplicated, or unnecessary images addressed?' },
];

export function usesSimpleFieldMethod(pathway) {
  return pathway === SERVICE_PATHWAYS.XPD_BASELINE;
}

export function initSimpleFieldMethod() {
  return {
    capture_method: CAPTURE_METHOD_NAME,
    current_pass: 1,
    groundCapture: initGroundCaptureStructure(),
    pass1: {
      targetMin: 18,
      targetMax: 28,
      coverageGroup: COVERAGE_GROUPS.CORE,
      views: PASS_1_VIEWS.map((v) => ({
        ...v,
        complete: false,
        site_limitation: null,
        site_limitation_note: null,
      })),
    },
    pass2: {
      targetMin: 5,
      targetMax: 12,
      coverageGroup: COVERAGE_GROUPS.DETAIL,
      categories: PASS_2_CATEGORIES.map((c) => ({
        ...c,
        complete: false,
        site_limitation: null,
        site_limitation_note: null,
      })),
    },
    pass3: {
      targetMin: 3,
      targetMax: 5,
      coverageGroup: COVERAGE_GROUPS.CONTEXT,
      started: false,
      completed: false,
      checklist: Object.fromEntries(PASS_3_CHECKLIST.map((c) => [c.id, false])),
      weak_images_replaced: 0,
      site_limitations: [],
      contextViews: CONTEXT_VIEW_OPTIONS.map((v) => ({ ...v, used: false })),
    },
  };
}

function usableImages(images) {
  return groundUsableImages(images);
}

function viewHasCoverage(viewId, images, viewState) {
  if (viewState?.site_limitation && viewState.site_limitation_note) return true;
  return usableImages(images).some((i) => i.required_view_id === viewId);
}

function categoryHasCoverage(catId, images, catState) {
  if (catState?.site_limitation === 'not_present') return true;
  if (catState?.site_limitation && catState.site_limitation_note) return true;
  return usableImages(images).some((i) => i.required_view_id === catId);
}

export function updateSimpleFieldProgress(sfm, images) {
  if (!sfm) return sfm;
  const updated = JSON.parse(JSON.stringify(sfm));

  for (const view of updated.pass1.views) {
    view.complete = viewHasCoverage(view.id, images, view);
  }

  for (const cat of updated.pass2.categories) {
    cat.complete = categoryHasCoverage(cat.id, images, cat);
  }

  updated.groundCapture = updateGroundCaptureStructure(updated.groundCapture, images, updated);

  const pass1Complete = updated.pass1.views.every((v) => v.complete);
  const pass2Complete = updated.pass2.categories.every((c) => c.complete);
  const coreComplete = getMissingCoreAreas(updated.groundCapture).length === 0;

  if (updated.current_pass === 1 && pass1Complete && coreComplete) {
    updated.current_pass = 2;
  }
  if (updated.current_pass === 2 && pass1Complete && pass2Complete) {
    updated.pass3.started = true;
  }

  return updated;
}

export function getPass1Progress(sfm, images) {
  const complete = sfm.pass1.views.filter((v) => viewHasCoverage(v.id, images, v)).length;
  return { complete, total: sfm.pass1.views.length };
}

export function getPass2Progress(sfm, images) {
  const complete = sfm.pass2.categories.filter((c) => categoryHasCoverage(c.id, images, c)).length;
  return { complete, total: sfm.pass2.categories.length };
}

export function getPass3Status(sfm) {
  if (!sfm.pass3.started) return 'Not started';
  if (sfm.pass3.completed) return 'Completed';
  const checked = Object.values(sfm.pass3.checklist).filter(Boolean).length;
  return `In progress (${checked}/${PASS_3_CHECKLIST.length} checklist items)`;
}

export function getNextRequiredView(sfm, images) {
  const next = sfm.pass1.views.find((v) => !viewHasCoverage(v.id, images, v));
  return next || null;
}

export function getNextRequiredDetail(sfm, images) {
  return sfm.pass2.categories.find((c) => !categoryHasCoverage(c.id, images, c)) || null;
}

export function getMissingSideWarnings(sfm, images) {
  const warnings = [];
  for (const side of PASS_1_SIDE_CHECKS) {
    const covered = side.viewIds.some((vid) => {
      const viewState = sfm.pass1.views.find((v) => v.id === vid);
      return viewHasCoverage(vid, images, viewState);
    });
    if (!covered) {
      const viewName = side.viewIds.map((id) => PASS_1_VIEWS.find((v) => v.id === id)?.name).filter(Boolean)[0];
      warnings.push(`${side.name} has not been captured. Complete this view before leaving the site.`);
      if (viewName && side.viewIds.length === 1) {
        warnings[warnings.length - 1] = `${viewName} has not been captured. Complete this view before leaving the site.`;
      }
    }
  }
  return warnings;
}

export function getMissingRequiredViews(sfm, images) {
  return sfm.pass1.views
    .filter((v) => !viewHasCoverage(v.id, images, v))
    .map((v) => v.name);
}

export function getMissingDetailCategories(sfm, images) {
  return sfm.pass2.categories
    .filter((c) => !categoryHasCoverage(c.id, images, c))
    .map((c) => c.name);
}

export function getWeakImages(images) {
  return usableImages(images).filter(
    (i) =>
      i.qcm_status === QCM_STATUS.RETAKE ||
      i.qcm_status === 'FAIL' ||
      (i.qcm_score != null && i.qcm_score < 60)
  );
}

export function getDuplicateHeavyZones(images) {
  const counts = {};
  for (const img of usableImages(images)) {
    const key = img.required_view_id || img.zone || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, n]) => n >= 4)
    .map(([key, n]) => ({ zone: key, count: n }));
}

export function applySiteLimitation(sfm, targetType, targetId, limitation, note) {
  const updated = JSON.parse(JSON.stringify(sfm));
  if (targetType === 'pass1_view') {
    const view = updated.pass1.views.find((v) => v.id === targetId);
    if (view) {
      view.site_limitation = limitation;
      view.site_limitation_note = note;
      view.complete = !!note;
      updated.pass3.site_limitations.push({ pass: 1, view_id: targetId, limitation, note });
    }
  } else if (targetType === 'pass2_category') {
    const cat = updated.pass2.categories.find((c) => c.id === targetId);
    if (cat) {
      cat.site_limitation = limitation;
      cat.site_limitation_note = note;
      cat.complete = limitation === 'not_present' || !!note;
      updated.pass3.site_limitations.push({ pass: 2, category_id: targetId, limitation, note });
    }
  }
  return updated;
}

export function computeSimpleFieldReadiness(project, images, sfm) {
  const accepted = usableImages(images);
  const retakes = images.filter(
    (i) => i.accepted && !i.marked_unnecessary && (i.qcm_status === QCM_STATUS.RETAKE || i.qcm_status === 'FAIL')
  );
  const structure = sfm.groundCapture || updateGroundCaptureStructure(initGroundCaptureStructure(), images, sfm);
  const missingCore = getMissingCoreAreas(structure);
  const missingDetail = getMissingDetailAreas(structure);
  const hasSiteLimitations =
    sfm.pass3.site_limitations.length > 0 ||
    sfm.pass1.views.some((v) => v.site_limitation) ||
    sfm.pass2.categories.some((c) => c.site_limitation) ||
    structure.required_core_coverage.areas.some((a) => a.site_limitation);

  const coreStats = getCoreGroupStats(structure, images);
  const detailStats = getDetailGroupStats(structure, images);
  const contextStats = getContextGroupStats(structure, images);
  const overcapture = checkOvercapture(images);
  const weakImages = getWeakImages(images);

  const checks = {
    core_complete: missingCore.length === 0,
    detail_complete: missingDetail.length === 0,
    min_count: accepted.length >= RECOMMENDED_TOTAL.min,
    elevations: structure.required_core_coverage.areas
      .filter((a) => ['front_elevation', 'rear_elevation', 'left_side_elevation', 'right_side_elevation'].includes(a.id))
      .every((a) => !a.missing),
    corners: !structure.required_core_coverage.areas.find((a) => a.id === 'corners_transitions')?.missing,
    entry: !structure.required_core_coverage.areas.find((a) => a.id === 'entry_points_garage_gates')?.missing,
    weak_reviewed: weakImages.length === 0 || sfm.pass3.started,
    no_retakes: retakes.length === 0,
    qa_complete: sfm.pass3.completed,
  };

  const pass1Progress = getPass1Progress(sfm, images);
  const pass2Progress = getPass2Progress(sfm, images);
  const missingViews = getMissingRequiredViews(sfm, images);
  const missingDetails = getMissingDetailCategories(sfm, images);
  const sideWarnings = getMissingSideWarnings(sfm, images);

  let readiness = 'FIELD_CAPTURE_INCOMPLETE';

  const readyBase =
    checks.core_complete &&
    checks.detail_complete &&
    checks.min_count &&
    checks.elevations &&
    checks.corners &&
    checks.entry &&
    checks.no_retakes &&
    checks.qa_complete;

  if (readyBase && (hasSiteLimitations || overcapture.adminReviewRequired)) {
    readiness = 'SITE_LIMITATION_REVIEW';
  } else if (readyBase) {
    readiness = 'READY_FOR_ADMIN_REVIEW';
  } else if (retakes.length > 0) {
    readiness = 'RETAKES_RECOMMENDED';
  } else if (missingCore.length > 0) {
    readiness = 'NEEDS_MORE_CORE_COVERAGE';
  } else if (missingDetail.length > 0) {
    readiness = 'NEEDS_DETAIL_COVERAGE';
  } else if (accepted.length < RECOMMENDED_TOTAL.min) {
    readiness = 'NEEDS_MORE_CORE_COVERAGE';
  }

  const corePct = coreStats.usable > 0 ? Math.min(100, (coreStats.usable / 18) * 100) : 0;
  const detailPct = detailStats.usable > 0 ? Math.min(100, (detailStats.usable / 5) * 100) : 0;
  const countPct = Math.min(100, (accepted.length / RECOMMENDED_TOTAL.min) * 100);
  const qaPct = sfm.pass3.completed ? 100 : (Object.values(sfm.pass3.checklist).filter(Boolean).length / PASS_3_CHECKLIST.length) * 100;
  const packageReadiness = Math.round(corePct * 0.35 + detailPct * 0.25 + countPct * 0.25 + qaPct * 0.15);

  let statusMessage = 'Field capture in progress. Continue required shots.';
  if (readiness === 'READY_FOR_ADMIN_REVIEW') {
    statusMessage = 'Package meets XPD ground-based capture requirements. Ready for admin review.';
  } else if (readiness === 'SITE_LIMITATION_REVIEW') {
    statusMessage = 'Package complete with site limitation or overcapture review notes. Admin review needed.';
  } else if (readiness === 'NEEDS_MORE_CORE_COVERAGE') {
    if (missingCore.length) statusMessage = `Missing core coverage: ${missingCore.map((a) => a.name).join(', ')}.`;
    else if (sideWarnings.length) statusMessage = sideWarnings[0];
    else if (accepted.length < RECOMMENDED_TOTAL.min) {
      statusMessage = `Need ${RECOMMENDED_TOTAL.min - accepted.length} more usable images (target ${RECOMMENDED_TOTAL.min}–${RECOMMENDED_TOTAL.max}).`;
    } else statusMessage = 'Required core coverage incomplete.';
  } else if (readiness === 'NEEDS_DETAIL_COVERAGE') {
    statusMessage = `Missing detail coverage: ${missingDetail.map((a) => a.name).join(', ')}.`;
  } else if (readiness === 'RETAKES_RECOMMENDED') {
    statusMessage = 'Some images may be weak. Retake recommended before leaving site.';
  } else if (!sfm.pass3.completed && pass1Progress.complete === pass1Progress.total) {
    statusMessage = 'Run Final QA and complete checklist before marking field capture complete.';
  }

  if (overcapture.level !== 'ok') {
    statusMessage = overcapture.message;
  }

  return {
    capture_method: CAPTURE_METHOD_NAME,
    targetMin: RECOMMENDED_TOTAL.min,
    targetMax: RECOMMENDED_TOTAL.max,
    controlledUpperMax: 45,
    captured: images.filter((i) => i.accepted).length,
    accepted: accepted.length,
    warnings: accepted.filter((i) => i.qcm_status === QCM_STATUS.WARNING).length,
    retakes: retakes.length,
    review: images.filter((i) => i.qcm_status === QCM_STATUS.ADMIN_REVIEW).length,
    pass1Progress,
    pass2Progress,
    pass3Status: getPass3Status(sfm),
    groundCapture: structure,
    coreStats,
    detailStats,
    contextStats,
    overcapture,
    missingCoreAreas: missingCore.map((a) => a.name),
    missingDetailAreas: missingDetail.map((a) => a.name),
    missingViews,
    missingDetails,
    sideWarnings,
    weakImages,
    duplicateHeavyZones: getDuplicateHeavyZones(images),
    packageReadiness,
    readiness,
    statusMessage,
    readinessChecks: checks,
    requiredZonesTotal: pass1Progress.total + pass2Progress.total,
    requiredZonesComplete: pass1Progress.complete + pass2Progress.complete,
    avgQcmScore: accepted.length
      ? Math.round(accepted.reduce((s, i) => s + (i.qcm_score || 0), 0) / accepted.length)
      : 0,
    missingZones: [...missingCore, ...missingDetail].map((a) => ({ name: a.name || a })),
  };
}

export { applyImageClassification, classifyImageFromView, CONTEXT_VIEW_OPTIONS, COVERAGE_GROUPS, buildGroundCaptureExport, GROUND_QA_REMINDER };

export function buildCapturePassesExport(sfm, images) {
  const pass1Complete = getPass1Progress(sfm, images);
  const pass2Complete = getPass2Progress(sfm, images);
  const groundExport = buildGroundCaptureExport(sfm.groundCapture, images, sfm);

  return {
    capture_method: CAPTURE_METHOD_NAME,
    capture_passes: {
      pass_1_four_side_exterior_record: {
        coverage_group: COVERAGE_GROUPS.CORE,
        target_images: '18-28',
        required_views_complete: pass1Complete.complete,
        required_views_total: pass1Complete.total,
        missing_views: getMissingRequiredViews(sfm, images),
        side_warnings: getMissingSideWarnings(sfm, images),
      },
      pass_2_controlled_detail_capture: {
        coverage_group: COVERAGE_GROUPS.DETAIL,
        target_images: '5-12',
        detail_categories_complete: pass2Complete.complete,
        detail_categories_total: pass2Complete.total,
        missing_detail_categories: getMissingDetailCategories(sfm, images),
      },
      pass_3_final_qa_fill: {
        coverage_group: COVERAGE_GROUPS.CONTEXT,
        target_images: '3-5 optional context',
        completed: sfm.pass3.completed,
        started: sfm.pass3.started,
        checklist: sfm.pass3.checklist,
        weak_images_replaced: sfm.pass3.weak_images_replaced,
        site_limitations: sfm.pass3.site_limitations,
        note: 'QA and replacement pass — not a random image-count increase',
      },
    },
    ...groundExport,
  };
}

export function mapViewToZone(viewId) {
  const map = {
    p1_front_overview: 'front_elev',
    p1_rear_overview: 'rear_elev',
    p1_left_overview: 'left_elev',
    p1_right_overview: 'right_elev',
    p2_entry_doors: 'entry',
    p2_garage_doors: 'garage',
    p2_windows: 'windows_doors',
    p2_utilities: 'ext_utilities',
    p2_roofline: 'roofline',
    p2_fence_gates: 'fence_gates',
    p2_driveways: 'walkways',
    p2_drainage: 'drainage',
  };
  return map[viewId] || viewId;
}
