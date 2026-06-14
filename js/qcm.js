/**
 * EAS Field Capture QCM — Quality Control Module
 */

import { QCM_STATUS } from './utils.js';
import { getPathwayConfig } from './shotlists.js';
import { usesSimpleFieldMethod, computeSimpleFieldReadiness } from './simple-field-method.js';

const MIN_RES_LONG = 1920;
const STRONG_RES_LONG = 3000;
const MIN_FILE_SIZE = 50000;
const MAX_FILE_SIZE = 25000000;

export function analyzeSharpness(canvas, ctx, width, height) {
  const sampleW = Math.min(400, width);
  const sampleH = Math.min(400, height);
  const offCanvas = document.createElement('canvas');
  offCanvas.width = sampleW;
  offCanvas.height = sampleH;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(canvas, 0, 0, width, height, 0, 0, sampleW, sampleH);
  const imageData = offCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imageData.data;

  const gray = new Float32Array(sampleW * sampleH);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let lapSum = 0;
  let lapCount = 0;
  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = y * sampleW + x;
      const lap =
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - sampleW] +
        gray[idx + sampleW];
      lapSum += lap * lap;
      lapCount++;
    }
  }
  const variance = lapCount > 0 ? lapSum / lapCount : 0;

  let sharpness_score;
  let sharpness_status;
  let sharpness_message;

  if (variance >= 500) {
    sharpness_score = 25;
    sharpness_status = 'pass';
    sharpness_message = 'Image appears sharp enough for documentation use.';
  } else if (variance >= 150) {
    sharpness_score = 15;
    sharpness_status = 'warning';
    sharpness_message = 'Image may be slightly soft. Retake recommended if this is a primary record.';
  } else {
    sharpness_score = 5;
    sharpness_status = 'fail';
    sharpness_message = 'Image appears blurry. Retake recommended.';
  }

  return { sharpness_score, sharpness_status, sharpness_message, variance };
}

export function analyzeExposure(canvas, ctx, width, height) {
  const sampleW = Math.min(200, width);
  const sampleH = Math.min(200, height);
  const offCanvas = document.createElement('canvas');
  offCanvas.width = sampleW;
  offCanvas.height = sampleH;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(canvas, 0, 0, width, height, 0, 0, sampleW, sampleH);
  const imageData = offCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imageData.data;

  let totalBrightness = 0;
  let darkCount = 0;
  let brightCount = 0;
  const pixelCount = sampleW * sampleH;

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalBrightness += brightness;
    if (brightness < 30) darkCount++;
    if (brightness > 225) brightCount++;
  }

  const avgBrightness = totalBrightness / pixelCount;
  const darkPct = (darkCount / pixelCount) * 100;
  const brightPct = (brightCount / pixelCount) * 100;

  let exposure_score;
  let exposure_status;
  let exposure_message;

  if (avgBrightness >= 60 && avgBrightness <= 200 && darkPct < 25 && brightPct < 20) {
    exposure_score = 20;
    exposure_status = 'pass';
    exposure_message = 'Exposure is acceptable.';
  } else if (darkPct >= 35 || avgBrightness < 45) {
    exposure_score = 8;
    exposure_status = 'warning';
    exposure_message = 'Image may be too dark for documentation clarity.';
  } else if (brightPct >= 30 || avgBrightness > 215) {
    exposure_score = 8;
    exposure_status = 'warning';
    exposure_message = 'Image may be overexposed in important areas.';
  } else {
    exposure_score = 14;
    exposure_status = 'pass';
    exposure_message = 'Exposure is acceptable.';
  }

  return { exposure_score, exposure_status, exposure_message, avgBrightness, darkPct, brightPct };
}

export function analyzeResolution(width, height) {
  const longEdge = Math.max(width, height);

  let resolution_score;
  let resolution_status;
  let resolution_message;

  if (longEdge >= STRONG_RES_LONG) {
    resolution_score = 15;
    resolution_status = 'pass';
    resolution_message = 'Resolution is acceptable for field documentation.';
  } else if (longEdge >= MIN_RES_LONG) {
    resolution_score = 10;
    resolution_status = 'pass';
    resolution_message = 'Resolution is acceptable for field documentation.';
  } else if (longEdge >= 1280) {
    resolution_score = 6;
    resolution_status = 'warning';
    resolution_message = 'Resolution is lower than preferred. Use only if subject is clear.';
  } else {
    resolution_score = 2;
    resolution_status = 'fail';
    resolution_message = 'Resolution is too low. Retake recommended.';
  }

  return { resolution_score, resolution_status, resolution_message, longEdge };
}

export function analyzeFileSize(fileSize) {
  if (fileSize >= MIN_FILE_SIZE && fileSize <= MAX_FILE_SIZE) {
    return { status: 'pass', message: 'File size acceptable.' };
  }
  if (fileSize < MIN_FILE_SIZE) {
    return { status: 'warning', message: 'File size unusually small — verify image quality.' };
  }
  return { status: 'warning', message: 'File size very large — may affect transfer.' };
}

export function checkMetadata(imageMeta) {
  let score = 0;
  const checks = [];

  if (imageMeta.capture_timestamp) {
    score += 4;
    checks.push({ name: 'Timestamp', status: 'pass', message: 'Timestamp Available' });
  } else {
    checks.push({ name: 'Timestamp', status: 'fail', message: 'Timestamp missing' });
  }

  if (imageMeta.zone) {
    score += 3;
    checks.push({ name: 'Zone', status: 'pass', message: 'Zone assigned' });
  } else {
    checks.push({ name: 'Zone', status: 'warning', message: 'Zone not assigned' });
  }

  if (imageMeta.wide_or_closeup) {
    score += 3;
    checks.push({ name: 'Shot Type', status: 'pass', message: imageMeta.wide_or_closeup });
  } else {
    checks.push({ name: 'Shot Type', status: 'warning', message: 'Shot type not set' });
  }

  return { metadata_score: Math.min(10, score), checks };
}

export function checkDuplicateWarning(imageMeta, existingImages) {
  const sameZone = existingImages.filter(
    (img) =>
      img.zone === imageMeta.zone &&
      img.angle_type === imageMeta.angle_type &&
      img.wide_or_closeup === imageMeta.wide_or_closeup &&
      img.image_id !== imageMeta.image_id
  );
  if (sameZone.length >= 3) {
    return {
      flag: true,
      message: `You already have ${sameZone.length} ${imageMeta.zone.replace(/_/g, ' ')} ${imageMeta.wide_or_closeup.toLowerCase()} images. Consider capturing another required zone.`,
    };
  }
  return { flag: false, message: null };
}

export function checkWideCloseupPairing(imageMeta, existingImages) {
  const isCloseup =
    imageMeta.wide_or_closeup === 'Closeup' ||
    imageMeta.wide_or_closeup === 'Closeup detail' ||
    imageMeta.detail_classification === 'Closeup detail';

  if (!isCloseup) {
    return { flag: false, message: null, needsContext: false };
  }

  if (imageMeta.wide_context_status === 'yes') {
    return { flag: false, message: null, needsContext: false };
  }
  if (imageMeta.wide_context_status === 'not_applicable') {
    return { flag: false, message: null, needsContext: false };
  }
  if (imageMeta.wide_context_status === 'admin_review') {
    return {
      flag: true,
      message: 'Closeup flagged for admin review — wide context pending.',
      needsContext: true,
    };
  }

  const wideInZone = existingImages.some(
    (img) =>
      (img.zone === imageMeta.zone || img.required_view_id === imageMeta.required_view_id) &&
      (img.wide_or_closeup === 'Wide Context' || img.wide_or_closeup === 'Wide context' || img.detail_classification === 'Wide context') &&
      img.accepted &&
      !img.marked_unnecessary
  );

  if (!wideInZone && imageMeta.wide_context_status !== 'yes') {
    const isCloseupDetail =
      imageMeta.wide_or_closeup === 'Closeup' ||
      imageMeta.wide_or_closeup === 'Closeup detail' ||
      imageMeta.detail_classification === 'Closeup detail';
    const message = isCloseupDetail
      ? 'WARNING: Closeup detail image does not appear to have a linked wide context image.'
      : 'WARNING: Closeup lacks wide context image.';
    return {
      flag: true,
      message,
      needsContext: true,
    };
  }
  return { flag: false, message: null, needsContext: false };
}

export function scoreShotRelevance(imageMeta, shotList) {
  const zone = shotList?.zones?.find((z) => z.id === imageMeta.zone);
  if (!zone) return { score: 5, message: 'Zone not in shot list.' };
  if (zone.required) return { score: 20, message: 'Required zone coverage.' };
  return { score: 12, message: 'Optional zone coverage.' };
}

export function scoreCoverageContribution(imageMeta, shotList) {
  const zone = shotList?.zones?.find((z) => z.id === imageMeta.zone);
  if (!zone) return { score: 3, message: 'Zone not tracked.' };
  if (zone.required && !zone.complete) return { score: 10, message: 'Required Zone Completed' };
  if (zone.required) return { score: 7, message: 'Zone already has coverage.' };
  return { score: 5, message: 'Optional coverage.' };
}

export function computeOverallStatus(totalScore, flags) {
  if (flags.adminReview) return QCM_STATUS.ADMIN_REVIEW;
  if (totalScore >= 90) return QCM_STATUS.PASS;
  if (totalScore >= 75) return QCM_STATUS.PASS_WITH_NOTE;
  if (totalScore >= 60) return QCM_STATUS.WARNING;
  return QCM_STATUS.RETAKE;
}

export async function runQcmAnalysis(imageMeta, imageSource, existingImages, shotList) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let width, height;
  if (imageSource instanceof HTMLImageElement) {
    width = imageSource.naturalWidth;
    height = imageSource.naturalHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imageSource, 0, 0);
  } else if (imageSource instanceof HTMLCanvasElement) {
    width = imageSource.width;
    height = imageSource.height;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imageSource, 0, 0);
  } else {
    throw new Error('Invalid image source for QCM');
  }

  const sharpness = analyzeSharpness(canvas, ctx, width, height);
  const exposure = analyzeExposure(canvas, ctx, width, height);
  const resolution = analyzeResolution(width, height);
  const fileSizeCheck = analyzeFileSize(imageMeta.file_size || 0);
  const metadata = checkMetadata(imageMeta);
  const duplicate = checkDuplicateWarning(imageMeta, existingImages);
  const pairing = checkWideCloseupPairing(imageMeta, existingImages);
  const relevance = scoreShotRelevance(imageMeta, shotList);
  const coverage = scoreCoverageContribution(imageMeta, shotList);

  const flags = [];
  if (duplicate.flag) flags.push({ type: 'duplicate_warning', message: duplicate.message });
  if (pairing.flag) flags.push({ type: 'pairing_warning', message: pairing.message });

  const totalScore =
    sharpness.sharpness_score +
    exposure.exposure_score +
    resolution.resolution_score +
    relevance.score +
    metadata.metadata_score +
    coverage.score;

  const qcm_status = computeOverallStatus(totalScore, {
    adminReview: imageMeta.wide_context_status === 'admin_review',
  });

  const checks = [
    { name: 'Sharpness', status: sharpness.sharpness_status, message: sharpness.sharpness_message },
    { name: 'Exposure', status: exposure.exposure_status, message: exposure.exposure_message },
    { name: 'Resolution', status: resolution.resolution_status, message: resolution.resolution_message },
    ...metadata.checks.map((c) => ({ name: c.name, status: c.status, message: c.message })),
    { name: 'Coverage', status: coverage.score >= 7 ? 'pass' : 'warning', message: coverage.message },
  ];

  if (duplicate.flag) {
    checks.push({ name: 'Duplicate', status: 'warning', message: duplicate.message });
  }
  if (pairing.flag) {
    checks.push({ name: 'Context Pair', status: 'warning', message: pairing.message });
  }
  if (fileSizeCheck.status === 'warning') {
    checks.push({ name: 'File Size', status: 'warning', message: fileSizeCheck.message });
  }

  let recommendation = 'Use as documentation record.';
  if (qcm_status === QCM_STATUS.RETAKE) {
    recommendation = 'Retake recommended before leaving this area.';
  } else if (qcm_status === QCM_STATUS.WARNING) {
    recommendation = pairing.needsContext
      ? 'Capture one wider reference image before leaving this area.'
      : 'Review image quality before accepting as primary record.';
  } else if (qcm_status === QCM_STATUS.PASS_WITH_NOTE) {
    recommendation = 'Acceptable with minor documentation notes.';
  } else if (qcm_status === QCM_STATUS.ADMIN_REVIEW) {
    recommendation = 'Flagged for admin review.';
  } else {
    recommendation = `Use as primary ${imageMeta.zone?.replace(/_/g, ' ') || 'documentation'} record.`;
  }

  return {
    image_id: imageMeta.image_id,
    project_id: imageMeta.project_id,
    qcm_score: Math.min(100, totalScore),
    qcm_status,
    qcm_flags: flags,
    checks,
    recommendation,
    details: { sharpness, exposure, resolution, fileSizeCheck, duplicate, pairing },
    analyzed_at: new Date().toISOString(),
  };
}

export function computeCoverageSummary(project, images, shotList, sfm = null) {
  if (usesSimpleFieldMethod(project.service_pathway) && sfm) {
    return computeSimpleFieldReadiness(project, images, sfm);
  }

  const config = getPathwayConfig(project.service_pathway);
  const accepted = images.filter((i) => i.accepted);
  const warnings = images.filter((i) => i.qcm_status === QCM_STATUS.WARNING || i.qcm_status === QCM_STATUS.PASS_WITH_NOTE);
  const retakes = images.filter((i) => i.qcm_status === QCM_STATUS.RETAKE || i.qcm_status === 'FAIL');
  const review = images.filter((i) => i.qcm_status === QCM_STATUS.ADMIN_REVIEW || i.qcm_status === 'NEEDS_REVIEW');

  const requiredZones = shotList.zones.filter((z) => z.required);
  const completedRequired = requiredZones.filter((z) => z.complete).length;
  const missingZones = shotList.zones.filter((z) => z.required && !z.complete);

  const avgScore =
    accepted.length > 0
      ? accepted.reduce((sum, i) => sum + (i.qcm_score || 0), 0) / accepted.length
      : 0;

  let readiness = 'FIELD_CAPTURE_INCOMPLETE';
  const imageCount = accepted.length;
  const minTarget = config.targetMin;

  if (
    imageCount >= minTarget &&
    completedRequired === requiredZones.length &&
    retakes.length === 0 &&
    avgScore >= 75
  ) {
    readiness = 'READY_FOR_ADMIN_REVIEW';
  } else if (missingZones.length > 0 || imageCount < minTarget) {
    readiness = 'NEEDS_MORE_COVERAGE';
  } else if (retakes.length > 0) {
    readiness = 'RETAKES_RECOMMENDED';
  } else if (imageCount < minTarget * 0.5) {
    readiness = 'FIELD_CAPTURE_INCOMPLETE';
  }

  const zonePct = requiredZones.length > 0 ? (completedRequired / requiredZones.length) * 100 : 0;
  const countPct = Math.min(100, (imageCount / minTarget) * 100);
  const qualityPct = Math.min(100, avgScore);
  const packageReadiness = Math.round(zonePct * 0.4 + countPct * 0.35 + qualityPct * 0.25);

  return {
    targetMin: config.targetMin,
    targetMax: config.targetMax,
    captured: images.length,
    accepted: accepted.length,
    warnings: warnings.length,
    retakes: retakes.length,
    review: review.length,
    requiredZonesTotal: requiredZones.length,
    requiredZonesComplete: completedRequired,
    missingZones,
    avgQcmScore: Math.round(avgScore),
    packageReadiness,
    readiness,
    statusMessage: getReadinessMessage(readiness, missingZones, minTarget, imageCount),
  };
}

function getReadinessMessage(readiness, missingZones, minTarget, imageCount) {
  switch (readiness) {
    case 'READY_FOR_ADMIN_REVIEW':
      return 'Package meets minimum requirements. Ready for admin review.';
    case 'NEEDS_MORE_COVERAGE':
      if (missingZones.length > 0) {
        return `Needs ${missingZones.length} more required zone${missingZones.length > 1 ? 's' : ''} before leaving site.`;
      }
      return `Need ${Math.max(0, minTarget - imageCount)} more acceptable images to reach minimum target.`;
    case 'RETAKES_RECOMMENDED':
      return 'Some images need retake before package is ready.';
    default:
      return 'Field capture in progress. Continue required shots.';
  }
}

export function computeProjectQcmSummary(images) {
  const accepted = images.filter((i) => i.accepted);
  const scores = accepted.map((i) => i.qcm_score || 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    total_images: images.length,
    accepted_images: accepted.length,
    average_score: Math.round(avg),
    pass_count: accepted.filter((i) => i.qcm_status === QCM_STATUS.PASS || i.qcm_status === QCM_STATUS.PASS_WITH_NOTE).length,
    warning_count: accepted.filter((i) => i.qcm_status === QCM_STATUS.WARNING).length,
    retake_count: images.filter((i) => i.qcm_status === QCM_STATUS.RETAKE).length,
    admin_review_count: images.filter((i) => i.qcm_status === QCM_STATUS.ADMIN_REVIEW).length,
  };
}
