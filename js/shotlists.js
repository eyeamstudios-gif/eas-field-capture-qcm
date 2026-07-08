/**

 * EAS Field Capture QCM — Shot List Generator (XPD packages only — v1.0)

 */



import { SERVICE_PATHWAYS, isXpdPathway } from './utils.js';



const zone = (id, name, opts = {}) => ({

  id,

  name,

  required: opts.required !== false,

  minWide: opts.minWide ?? 1,

  minCloseup: opts.minCloseup ?? 0,

  minTotal: opts.minTotal ?? 1,

  angleTypes: opts.angleTypes ?? ['Wide Context', 'Standard'],

  description: opts.description ?? '',

});



export const PATHWAY_CONFIG = {

  [SERVICE_PATHWAYS.XPD_STORMREADY_PRE]: {

    targetMin: 25,

    targetMax: 45,

    documentationLevel: 'XPD StormReady Residential – Pre-Storm Baseline',

    stormReady: true,

    zones: [

      zone('front_elev', 'Front Elevation'),

      zone('rear_elev', 'Rear Elevation'),

      zone('left_elev', 'Left Elevation'),

      zone('right_elev', 'Right Elevation'),

      zone('corners', 'All Four Corners', { minTotal: 4 }),

      zone('entry', 'Entry Areas'),

      zone('garage', 'Garage/Driveway'),

      zone('roofline', 'Roofline from Ground'),

      zone('windows_doors', 'Windows/Doors', { minCloseup: 1 }),

      zone('ext_utilities', 'Exterior Utilities'),

      zone('storm_exposure', 'Storm-Exposed Areas', { minWide: 1, minCloseup: 1 }),

      zone('drainage', 'Drainage / Grading Features'),

      zone('wide_context', 'Wide Context Reference Views', { minWide: 2 }),

      zone('pre_storm_condition', 'Pre-Storm Condition Reference', { minCloseup: 2, angleTypes: ['Closeup'] }),

    ],

  },

  [SERVICE_PATHWAYS.XPD_STORMREADY_POST]: {

    targetMin: 20,

    targetMax: 40,

    documentationLevel: 'XPD StormReady Residential – Post-Storm Comparison',

    stormReady: true,

    zones: [

      zone('front_elev', 'Front Elevation'),

      zone('rear_elev', 'Rear Elevation'),

      zone('left_elev', 'Left Elevation'),

      zone('right_elev', 'Right Elevation'),

      zone('roofline', 'Roofline Visible from Ground'),

      zone('windows_doors', 'Windows/Doors', { minCloseup: 1 }),

      zone('storm_impact', 'Visible Storm Impact Areas', { minWide: 1, minCloseup: 2 }),

      zone('water_intrusion', 'Water / Debris Indicators', { required: false, minCloseup: 1 }),

      zone('fence_gates', 'Fence/Gates if Present', { required: false }),

      zone('wide_context', 'Wide Context Comparison Views', { minWide: 2 }),

      zone('notable_closeup', 'Closeups of Notable Post-Storm Conditions', { minCloseup: 2, angleTypes: ['Closeup'] }),

    ],

  },

  [SERVICE_PATHWAYS.XPD_STORM]: {

    targetMin: 15,

    targetMax: 30,

    documentationLevel: 'XPD Storm Snapshot',

    zones: [

      zone('front_elev', 'Front Elevation', { minWide: 1, minCloseup: 0 }),

      zone('rear_elev', 'Rear Elevation', { minWide: 1 }),

      zone('left_elev', 'Left Elevation', { minWide: 1 }),

      zone('right_elev', 'Right Elevation', { minWide: 1 }),

      zone('roofline', 'Roofline Visible from Ground', { minWide: 1 }),

      zone('fence_gates', 'Fence/Gates if Present', { required: false, minWide: 0 }),

      zone('driveway', 'Driveway/Walkway', { minWide: 1 }),

      zone('windows_doors', 'Windows/Doors', { minWide: 1, minCloseup: 1 }),

      zone('utilities', 'Utilities/HVAC/Electrical', { minWide: 1 }),

      zone('storm_areas', 'Visible Storm-Sensitive Areas', { minWide: 1, minCloseup: 1 }),

      zone('wide_context', 'Wide Context Photos', { minWide: 2 }),

      zone('notable_closeup', 'Closeups of Notable Visual Conditions', { minCloseup: 1, angleTypes: ['Closeup'] }),

    ],

  },

  [SERVICE_PATHWAYS.XPD_BASELINE]: {

    targetMin: 25,

    targetMax: 45,

    controlledMax: 45,

    documentationLevel: 'XPD Exterior Baseline Snapshot',

    captureMethod: 'simple_field_method',

    groundBased: true,

    zones: [

      zone('front_elev', 'Front Elevation'),

      zone('rear_elev', 'Rear Elevation'),

      zone('left_elev', 'Left Elevation'),

      zone('right_elev', 'Right Elevation'),

      zone('corners', 'All Four Corners', { minTotal: 4 }),

      zone('entry', 'Entry Areas'),

      zone('garage', 'Garage/Driveway'),

      zone('walkways', 'Walkways'),

      zone('fence_gates', 'Fence/Gates', { required: false }),

      zone('windows_doors', 'Windows/Doors', { minCloseup: 1 }),

      zone('roofline', 'Roofline from Ground'),

      zone('soffit', 'Soffit/Fascia Visible from Ground'),

      zone('ext_utilities', 'Exterior Utilities'),

      zone('hvac_plumb', 'HVAC/Electrical/Plumbing Visible Exterior'),

      zone('drainage', 'Drainage Areas'),

      zone('site_context', 'Site Context'),

      zone('notable_conditions', 'Notable Exterior Conditions', { minCloseup: 1 }),

    ],

  },

  [SERVICE_PATHWAYS.XPD_PROPERTY]: {

    targetMin: 45,

    targetMax: 75,

    documentationLevel: 'XPD Exterior Property Record',

    zones: [

      zone('front_elev', 'Front Elevation'),

      zone('rear_elev', 'Rear Elevation'),

      zone('left_elev', 'Left Elevation'),

      zone('right_elev', 'Right Elevation'),

      zone('corners', 'All Four Corners', { minTotal: 4 }),

      zone('entry', 'Entry Areas'),

      zone('garage', 'Garage/Driveway'),

      zone('walkways', 'Walkways'),

      zone('fence_gates', 'Fence/Gates'),

      zone('windows_doors', 'Windows/Doors', { minCloseup: 2 }),

      zone('roofline', 'Roofline from Ground'),

      zone('soffit', 'Soffit/Fascia'),

      zone('ext_utilities', 'Exterior Utilities'),

      zone('perimeter', 'Perimeter Sequence', { minTotal: 4 }),

      zone('elevation_coverage', 'Elevation-by-Elevation Coverage', { minTotal: 4 }),

      zone('material_trans', 'Material Transitions', { minCloseup: 1 }),

      zone('penetrations', 'Exterior Penetrations', { minCloseup: 1 }),

      zone('downspouts', 'Downspouts/Gutters if Visible', { required: false }),

      zone('site_improvements', 'Site Improvements'),

      zone('adjacent_context', 'Adjacent Context'),

      zone('fence_line', 'Fence Line'),

      zone('hardscape', 'Hardscape'),

      zone('landscape', 'Landscape Interface'),

      zone('condition_ref', 'Condition Reference Views', { minCloseup: 2 }),

    ],

  },

  [SERVICE_PATHWAYS.XPD_AERIAL]: {

    targetMin: 25,

    targetMax: 45,

    documentationLevel: 'XPD Exterior + Aerial Baseline',

    aerialPlaceholder: true,

    zones: [

      zone('front_elev', 'Front Elevation'),

      zone('rear_elev', 'Rear Elevation'),

      zone('left_elev', 'Left Elevation'),

      zone('right_elev', 'Right Elevation'),

      zone('corners', 'All Four Corners', { minTotal: 4 }),

      zone('entry', 'Entry Areas'),

      zone('garage', 'Garage/Driveway'),

      zone('site_context', 'Site Context'),

      zone('aerial_ground', 'Ground Baseline (Aerial Pending)', { description: 'Aerial capture placeholder — mark aerial status separately' }),

    ],

  },

};



export function getPathwayConfig(pathway) {

  return PATHWAY_CONFIG[pathway] || PATHWAY_CONFIG[SERVICE_PATHWAYS.XPD_BASELINE];

}



export function generateShotList(pathway) {

  const config = getPathwayConfig(pathway);

  return {

    pathway,

    targetMin: config.targetMin,

    targetMax: config.targetMax,

    documentationLevel: config.documentationLevel,

    aerialPlaceholder: config.aerialPlaceholder || false,

    zones: config.zones.map((z) => ({

      ...z,

      captured: 0,

      wideCount: 0,

      closeupCount: 0,

      complete: false,

      imageIds: [],

    })),

  };

}



export function updateZoneStatus(shotList, images) {

  const updated = { ...shotList, zones: shotList.zones.map((z) => ({ ...z })) };



  for (const zoneItem of updated.zones) {

    const zoneImages = images.filter((img) => img.zone === zoneItem.id && img.accepted);

    zoneItem.captured = zoneImages.length;

    zoneItem.wideCount = zoneImages.filter((img) => img.wide_or_closeup === 'Wide Context').length;

    zoneItem.closeupCount = zoneImages.filter((img) => img.wide_or_closeup === 'Closeup').length;

    zoneItem.imageIds = zoneImages.map((img) => img.image_id);



    const wideOk = zoneItem.wideCount >= zoneItem.minWide;

    const closeupOk = zoneItem.closeupCount >= zoneItem.minCloseup;

    const totalOk = zoneItem.captured >= zoneItem.minTotal;



    if (zoneItem.required) {

      zoneItem.complete = wideOk && closeupOk && totalOk;

    } else {

      zoneItem.complete = zoneItem.captured === 0 || (wideOk && closeupOk && totalOk);

    }

  }



  return updated;

}



export function getMissingZones(shotList) {

  return shotList.zones.filter((z) => z.required && !z.complete);

}



export function getPathwayOptions() {

  return Object.entries(PATHWAY_CONFIG)

    .filter(([pathway]) => isXpdPathway(pathway))

    .map(([pathway, config]) => ({

      pathway,

      label: pathway,

      targetMin: config.targetMin,

      targetMax: config.targetMax,

      documentationLevel: config.documentationLevel,

      aerialPlaceholder: config.aerialPlaceholder || false,

      stormReady: config.stormReady || false,

    }));

}


