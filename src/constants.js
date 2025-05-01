// This file contains global constants and the default configuration object.
// It is intended to be @require'd by the main UserScript file.

/* --- Constants --- */
// Use cash-dom for DOM manipulation. Assumed to be loaded via @require in the main script.
// Check for window.cash existence in the main script before using $.
const $ = window.cash; // Assumes cash-dom is loaded globally

const SELECTOR = 'input.pack-num-input'; // Selector for pack quantity inputs
const MAX_QTY = 99;                     // Max quantity per pack input
const CONFIG_KEY = 'packFillerProConfig_vF83_41'; // Storage key (can be updated if config structure changes significantly)

// UI Element IDs - Using constants makes HTML and JS interaction safer
const PANEL_ID = 'pack-filler-pro-panel';     // ID for the main panel
const TOGGLE_BUTTON_ID = 'pfp-toggle-button'; // ID for the separate toggle button

// Checkbox IDs (Essential for basic config)
const DARK_MODE_CHECKBOX_ID = 'pfp-dark-mode-checkbox'; // ID for Dark Mode checkbox
const FILL_EMPTY_ONLY_CHECKBOX_ID = 'pfp-empty-only'; // ID for fill empty only checkbox
const CLEAR_INPUTS_CHECKBOX_ID = 'pfp-clear'; // ID for 'Clear inputs before filling'

// Input/Select IDs (Essential for basic fill)
const MODE_SELECT_ID = 'pfp-mode'; // ID for fill mode select
const COUNT_INPUT_ID = 'pfp-count'; // ID for the number of packs input
const FIXED_INPUT_ID = 'pfp-fixed'; // ID for fixed quantity input
const MIN_INPUT_ID = 'pfp-min'; // ID for min quantity input (random range)
const MAX_INPUT_ID = 'pfp-max'; // ID for max quantity input (random range)
const MAX_TOTAL_INPUT_ID = 'pfp-max-total'; // ID for the max total amount input
const PATTERN_TYPE_SELECT_ID = 'pfp-pattern-type'; // ID for pattern type select
const PATTERN_PARAMS_DIV_ID = 'pfp-pattern-params'; // ID for div containing pattern parameters
const NOISE_SEED_INPUT_ID = 'pfp-noise-seed'; // ID for noise seed input
const PATTERN_SCALE_INPUT_ID = 'pfp-pattern-scale'; // ID for pattern scale input
const PATTERN_INTENSITY_INPUT_ID = 'pfp-pattern-intensity'; // ID for pattern intensity input

// Button IDs (Essential)
const FILL_PACKS_BTN_ID = 'pfp-run'; // ID for the main "Fill Packs" button
const CLEAR_ALL_BTN_ID = 'pfp-clear-btn'; // ID for the "Clear All" button
const FILL_RANDOM_BTN_ID = 'pfp-fill-random'; // ID for the "Fill 1 Random Pack" button


/* --- Default Configuration --- */
// This structure defines the default settings for the script.
// Increment this version number whenever the structure of the DEFAULT_CONFIG changes
// to trigger migration logic in loadConfig.
const DEFAULT_CONFIG = {
    version: 26,        // Config version control (increment for changes)
    lastMode: 'fixed', // Default fill mode ('fixed', 'max', 'unlimited')
    lastCount: 10, // Default number of packs to target
    lastFixedQty: 1, // Default quantity for fixed mode
    lastMinQty: 1, // Default minimum quantity for random range mode
    lastMaxQty: 5, // Default maximum quantity for random range mode
    lastClear: false, // Default state for 'Clear inputs before filling'
    panelVisible: true, // Default state for panel visibility
    panelPos: { top: '120px', right: '30px', left: 'auto', bottom: 'auto' }, // Default panel position
    isDarkMode: false, // Default state for Dark Mode
    maxTotalAmount: 0, // Default max total copies (0 = disabled)
    fillEmptyOnly: false, // Default state for 'Fill empty inputs only'

    // Pattern Options (Essential)
    patternType: 'random', // Default pattern type ('random', 'fixed', 'gradient', 'perlin', 'alternating')
    noiseSeed: '', // Default noise seed (empty string for random seed on each run)
    patternIntensity: 1.0, // Default pattern intensity (0.0 to 1.0) - stored 0-1, UI uses 0-100
    patternScale: 100, // Default pattern scale (integer, affects pattern frequency)

    // Page Interaction Options (Not essential for core fill, but include IDs)
    clickPageRandomCount: 1, // Default number of times to click the page's random button
    CLICK_PAGE_RANDOM_BTN_ID: 'pfp-click-page-random' // ID for the "Click Page's Random" button
};

// No need for an IIFE wrapper in this file.
// Variables are made available in the main script's scope via @require.
