// This file contains global constants and the default configuration object.
// It is intended to be @require'd by the main UserScript file.

/* --- Constants --- */
// Use cash-dom for DOM manipulation. Assumed to be loaded via @require in the main script.
// Check for window.cash existence in the main script before using $.
const $ = window.cash;

const SELECTOR = 'input.pack-num-input'; // Selector for pack quantity inputs
const MAX_QTY = 99;                     // Max quantity per pack input
const CONFIG_KEY = 'packFillerProConfig_vF83_41'; // Updated Storage key for F83.41

// UI Element IDs - Using constants makes HTML and JS interaction safer
const PANEL_ID = 'pack-filler-pro-panel';     // ID for the main panel
const TOGGLE_BUTTON_ID = 'pfp-toggle-button'; // ID for the separate toggle button

// Checkbox IDs
const FULL_PAGE_CHECKBOX_ID = 'pfp-full-page-checkbox'; // ID for the full page load checkbox
const DARK_MODE_CHECKBOX_ID = 'pfp-dark-mode-checkbox'; // ID for Dark Mode checkbox
const AUTO_FILL_LOADED_CHECKBOX_ID = 'pfp-autofill-loaded'; // ID for auto-fill loaded checkbox
const FILL_EMPTY_ONLY_CHECKBOX_ID = 'pfp-empty-only'; // ID for fill empty only checkbox
const SCROLL_TO_BOTTOM_CHECKBOX_ID = 'pfp-scroll-to-bottom'; // ID for scroll to bottom checkbox

// Input/Select IDs
const MAX_TOTAL_INPUT_ID = 'pfp-max-total'; // ID for the max total amount input
const PATTERN_TYPE_SELECT_ID = 'pfp-pattern-type'; // ID for pattern type select
const PATTERN_PARAMS_DIV_ID = 'pfp-pattern-params'; // ID for div containing pattern parameters
const NOISE_SEED_INPUT_ID = 'pfp-noise-seed'; // ID for noise seed input
const PATTERN_SCALE_INPUT_ID = 'pfp-pattern-scale'; // ID for pattern scale input
const PATTERN_INTENSITY_INPUT_ID = 'pfp-pattern-intensity'; // ID for pattern intensity input
const CLICK_PAGE_RANDOM_COUNT_ID = 'pfp-click-page-random-count'; // ID for the input next to "Click Page's Random" button

// Button IDs
const FILL_RANDOM_BTN_ID = 'pfp-fill-random'; // ID for the "Fill 1 Random Pack" button
const CLICK_PAGE_RANDOM_BTN_ID = 'pfp-click-page-random'; // ID for the "Click Page's Random" button


/* --- Default Configuration --- */
// This structure defines the default settings for the script.
// Increment this version number whenever the structure of the DEFAULT_CONFIG changes
// to trigger migration logic in loadConfig.
const DEFAULT_CONFIG = {
    version: 25,        // Config version control (increment if config structure changes)
    lastMode: 'fixed', // Default fill mode
    lastCount: 10, // Default number of packs to target
    lastFixedQty: 1, // Default quantity for fixed mode
    lastMinQty: 1, // Default minimum quantity for random range mode
    lastMaxQty: 5, // Default maximum quantity for random range mode
    lastClear: false, // Default state for 'Clear inputs before filling'
    loadFullPage: true, // Defaulting this to TRUE as requested (Auto-load all packs)
    panelVisible: true, // Default state for panel visibility
    panelPos: { top: '120px', right: '30px', left: 'auto', bottom: 'auto' }, // Default panel position (top right)
    isDarkMode: false, // Default state for Dark Mode
    maxTotalAmount: 0, // Default max total copies (0 = disabled)
    autoFillLoaded: false, // Default state for 'Auto-fill loaded packs'
    fillEmptyOnly: false, // Default state for 'Fill empty inputs only'
    scrollToBottomAfterLoad: false, // Default state for 'Smooth scroll auto-load'

    // Pattern Options
    patternType: 'random', // Default pattern type ('random', 'fixed', 'gradient', 'perlin', 'alternating')
    noiseSeed: '', // Default noise seed (empty string for random seed on each run)
    patternIntensity: 1.0, // Default pattern intensity (0.0 to 1.0)
    patternScale: 100, // Default pattern scale (integer, affects pattern frequency)

    // Page Random Clicker Option
    clickPageRandomCount: 1 // Default number of times to click the page's random button
};

// No need for an IIFE wrapper in this file.
// Variables like 'config', 'panelElement', etc., are declared and managed
// in the main script's IIFE scope to ensure they are shared correctly.
