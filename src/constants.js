// This file contains global constants and the default configuration object.
// It is intended to be @require'd by the main UserScript file.

/* --- Constants --- */
// Use cash-dom for DOM manipulation. Assumed to be loaded via @require in the main script.
// Check for window.cash existence in the main script before using $.
const $ = window.cash; // Assumes cash-dom is loaded globally

const SELECTOR = 'input.pack-num-input'; // Selector for pack quantity inputs
const MAX_QTY = 99;                     // Max quantity per pack input
const CONFIG_KEY = 'packFillerProConfig_minimal'; // Unique Storage key for this minimal version

// UI Element IDs - Using constants makes HTML and JS interaction safer
const PANEL_ID = 'pack-filler-pro-panel';     // ID for the main panel
const TOGGLE_BUTTON_ID = 'pfp-toggle-button'; // ID for the separate toggle button

// Checkbox IDs (Minimal)
const DARK_MODE_CHECKBOX_ID = 'pfp-dark-mode-checkbox'; // ID for Dark Mode checkbox
const CLEAR_INPUTS_CHECKBOX_ID = 'pfp-clear'; // ID for 'Clear inputs before filling'

// Input/Select IDs (Minimal fill options)
const MODE_SELECT_ID = 'pfp-mode'; // ID for fill mode select ('fixed', 'random', 'unlimited')
const COUNT_INPUT_ID = 'pfp-count'; // ID for the number of packs input (used by fixed/random modes)
const FIXED_INPUT_ID = 'pfp-fixed'; // ID for fixed quantity input
const MIN_INPUT_ID = 'pfp-min'; // ID for min quantity input (random range)
const MAX_INPUT_ID = 'pfp-max'; // ID for max quantity input (random range)

// Button IDs (Minimal)
const FILL_PACKS_BTN_ID = 'pfp-run'; // ID for the main "Fill Packs" button
const CLEAR_ALL_BTN_ID = 'pfp-clear-btn'; // ID for the "Clear All" button


/* --- Default Configuration --- */
// This structure defines the default settings for the script.
// Keep this minimal for the bare-bones version.
const DEFAULT_CONFIG = {
    version: 1,        // Config version control for minimal version
    lastMode: 'fixed', // Default fill mode ('fixed', 'random', 'unlimited')
    lastCount: 10, // Default number of packs to target
    lastFixedQty: 1, // Default quantity for fixed mode
    lastMinQty: 1, // Default minimum quantity for random range mode
    lastMaxQty: 5, // Default maximum quantity for random range mode
    lastClear: false, // Default state for 'Clear inputs before filling'
    panelVisible: true, // Default state for panel visibility
    panelPos: { top: '120px', right: '30px', left: 'auto', bottom: 'auto' }, // Default panel position (top right)
    isDarkMode: false, // Default state for Dark Mode

    // Minimal pattern options - just the type
    patternType: 'random', // Default pattern type ('random', 'fixed')
};

// No need for an IIFE wrapper in this file.
// Variables are made available in the main script's scope via @require.
