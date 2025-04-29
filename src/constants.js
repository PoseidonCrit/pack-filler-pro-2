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
const DARK_MODE_CHECKBOX_ID = 'pfp-dark-mode-checkbox'; // ID for the dark mode checkbox
const MAX_TOTAL_INPUT_ID = 'pfp-max-total'; // ID for the max total amount input
const TOGGLE_BUTTON_ID = 'pfp-toggle-button'; // ID for the separate toggle button
const AUTO_FILL_LOADED_CHECKBOX_ID = 'pfp-autofill-loaded'; // ID for auto-fill loaded checkbox
const FILL_EMPTY_ONLY_CHECKBOX_ID = 'pfp-empty-only'; // ID for fill empty only checkbox
const SCROLL_TO_BOTTOM_CHECKBOX_ID = 'pfp-scroll-to-bottom'; // New ID for scroll to bottom checkbox


/* --- Default Configuration --- */
// Default settings for the script.
// This object defines the initial state and structure of the configuration.
const DEFAULT_CONFIG = {
    version: 13,        // Incremented config version for new option
    lastMode: 'fixed',
    lastCount: 10,
    lastFixedQty: 1,
    lastMinQty: 1,
    lastMaxQty: 5,
    lastClear: false,
    loadFullPage: true, // Setting this to TRUE as requested
    panelVisible: true,
    panelPos: { top: '120px', right: '30px', left: 'auto', bottom: 'auto' }, // Default panel position (top right)
    isDarkMode: true,
    maxTotalAmount: 0,
    autoFillLoaded: false,
    fillEmptyOnly: false, // Fill empty only option
    scrollToBottomAfterLoad: true // New option: Defaulting to FALSE
};

// Declare global variables that will be used and modified by other modules.
// Declaring them here ensures they are part of the shared scope after @require.
// These will be initialized or assigned values in the main script's init function
// or other required modules.
let config;
let panelElement;
let toggleButtonElement;
let panelSimpleBarInstance = null;

// Note: No IIFE wrapper needed in this file if the main script uses one,
// as the variables and constants defined here will be added to the main script's scope.
