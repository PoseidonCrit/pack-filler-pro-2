// This file contains global constants and the default configuration object.
// It is intended to be @require'd by the main UserScript file.

/* --- Constants --- */
// Use cash-dom for DOM manipulation. Assumed to be loaded via @require in the main script.
const $ = window.cash;
const SELECTOR = 'input.pack-num-input'; // Selector for pack quantity inputs
const MAX_QTY = 99;                     // Max quantity per pack input
const CONFIG_KEY = 'packFillerProConfig_vF83_41'; // Updated Storage key for F83.41
const PANEL_ID = 'pack-filler-pro-panel';     // ID for the main panel
const FULL_PAGE_CHECKBOX_ID = 'pfp-full-page-checkbox'; // ID for the full page load checkbox
const DARK_MODE_CHECKBOX_ID = 'pfp-dark-mode-checkbox'; // ID for Dark Mode checkbox
const MAX_TOTAL_INPUT_ID = 'pfp-max-total'; // ID for the max total amount input
const TOGGLE_BUTTON_ID = 'pfp-toggle-button'; // ID for the separate toggle button
const AUTO_FILL_LOADED_CHECKBOX_ID = 'pfp-autofill-loaded'; // ID for auto-fill loaded checkbox
const FILL_EMPTY_ONLY_CHECKBOX_ID = 'pfp-empty-only'; // ID for fill empty only checkbox
const SCROLL_TO_BOTTOM_CHECKBOX_ID = 'pfp-scroll-to-bottom'; // ID for scroll to bottom checkbox

// New Pattern UI Constants
const PATTERN_TYPE_SELECT_ID = 'pfp-pattern-type'; // ID for pattern type select
const PATTERN_PARAMS_DIV_ID = 'pfp-pattern-params'; // ID for pattern parameters div
const NOISE_SEED_INPUT_ID = 'pfp-noise-seed'; // ID for noise seed input
const PATTERN_SCALE_INPUT_ID = 'pfp-pattern-scale'; // ID for pattern scale input
const PATTERN_INTENSITY_INPUT_ID = 'pfp-pattern-intensity'; // ID for pattern intensity input


/* --- Default Configuration --- */
// Default settings for the script.
// This object defines the initial state and structure of the configuration.
const DEFAULT_CONFIG = {
    version: 16,        // Incremented config version for worker fix
    lastMode: 'fixed',
    lastCount: 10,
    lastFixedQty: 1,
    lastMinQty: 1,
    lastMaxQty: 5,
    lastClear: false,
    loadFullPage: true, // Setting this to TRUE as requested
    panelVisible: true,
    panelPos: { top: '120px', right: '30px', left: 'auto', bottom: 'auto' }, // Default panel position (top right)
    isDarkMode: false, // Dark Mode default
    maxTotalAmount: 0,
    autoFillLoaded: false,
    fillEmptyOnly: false, // Fill empty only option
    scrollToBottomAfterLoad: false, // Scroll to bottom after load option

    // New Pattern Options
    patternType: 'random', // Default to random (existing behavior)
    noiseSeed: '', // Empty string for random seed on each run
    patternIntensity: 1.0, // How much the pattern influences the quantity (0 to 1)
    patternScale: 100 // Scale for noise/gradient patterns
};

// Declare variables that will be populated during initialization in the main script.
// 'config' is now managed explicitly in the main script and passed to functions.
// Let config; // Removed global config declaration here

let config; // Declare config here to hold the loaded configuration object
let panelElement; // Will be populated after adding panel HTML
let toggleButtonElement; // Will be populated after adding toggle button HTML
let panelSimpleBarInstance = null; // Will be populated if SimpleBar is used and available

// Note: No IIFE wrapper needed in this file if the main script uses one,
// as the variables and constants defined here will be added to the main script's scope.

