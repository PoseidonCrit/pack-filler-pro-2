// This file contains global constants and the default configuration object.
// It is intended to be @require'd by the main UserScript file.
// Wrapped in an IIFE to avoid polluting the global scope directly.
// Attaches constants to window.pfpMinimal.

(function() {
    'use strict';

    // Ensure the global namespace object exists
    window.pfpMinimal = window.pfpMinimal || {};

    /* --- Constants --- */
    // Use cash-dom for DOM manipulation. Assumed to be loaded via @require in the main script.
    // Check for window.cash existence in the main script before using $.
    // Access via window.pfpMinimal.$
    window.pfpMinimal.$ = window.cash; // Assumes cash-dom is loaded globally

    // Access via window.pfpMinimal.SELECTOR, etc.
    window.pfpMinimal.SELECTOR = 'input.pack-num-input'; // Selector for pack quantity inputs
    window.pfpMinimal.MAX_QTY = 99;                     // Max quantity per pack input
    window.pfpMinimal.CONFIG_KEY = 'packFillerProConfig_minimal_v3'; // Unique Storage key for this minimal version

    // UI Element IDs - Access via window.pfpMinimal.PANEL_ID, etc.
    window.pfpMinimal.PANEL_ID = 'pack-filler-pro-panel';     // ID for the main panel
    window.pfpMinimal.TOGGLE_BUTTON_ID = 'pfp-toggle-button'; // ID for the separate toggle button

    // Checkbox IDs (Minimal) - Access via window.pfpMinimal.DARK_MODE_CHECKBOX_ID, etc.
    window.pfpMinimal.DARK_MODE_CHECKBOX_ID = 'pfp-dark-mode-checkbox'; // ID for Dark Mode checkbox
    window.pfpMinimal.CLEAR_INPUTS_CHECKBOX_ID = 'pfp-clear'; // ID for 'Clear inputs before filling'

    // Input/Select IDs (Minimal fill options) - Access via window.pfpMinimal.MODE_SELECT_ID, etc.
    window.pfpMinimal.MODE_SELECT_ID = 'pfp-mode'; // ID for fill mode select ('fixed', 'random', 'unlimited')
    window.pfpMinimal.COUNT_INPUT_ID = 'pfp-count'; // ID for the number of packs input (used by fixed/random modes)
    window.pfpMinimal.FIXED_INPUT_ID = 'pfp-fixed'; // ID for fixed quantity input
    window.pfpMinimal.MIN_INPUT_ID = 'pfp-min'; // ID for min quantity input (random range)
    window.pfpMinimal.MAX_INPUT_ID = 'pfp-max'; // ID for max quantity input (random range)

    // Button IDs (Minimal) - Access via window.pfpMinimal.FILL_PACKS_BTN_ID, etc.
    window.pfpMinimal.FILL_PACKS_BTN_ID = 'pfp-run'; // ID for the main "Fill Packs" button
    window.pfpMinimal.CLEAR_ALL_BTN_ID = 'pfp-clear-btn'; // ID for the "Clear All" button


    /* --- Default Configuration --- */
    // This structure defines the default settings for the script.
    // Keep this minimal for the bare-bones version.
    // Access via window.pfpMinimal.DEFAULT_CONFIG
    window.pfpMinimal.DEFAULT_CONFIG = {
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

        // Minimal pattern options - just the type (used internally by fillLogic)
        patternType: 'random', // Default pattern type ('random', 'fixed')
    };

})(); // End of IIFE
