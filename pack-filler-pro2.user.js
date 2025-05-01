// ==UserScript==
// @name         🎴F105.35 Pack Filler Pro – Sleek Edition (Main Thread Only, Improved)
// @namespace    https://ygoprodeck.com
// @version      🎴F105.35.1 // Incremented version for improved code
// @description  Enhanced UI and options for YGOPRODeck Pack Simulator, automatically loads all packs on load via scrolling, with advanced fill patterns (all calculations on main thread). Includes improved robustness.
// @match        https://ygoprodeck.com/pack-sim/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_log

// --- External Libraries ---
// Load core libraries first. Order is important.
// cash-dom for DOM manipulation (required by many modules)
// SweetAlert2 for custom alerts/toasts (required by swalHelpers, domUtils, fillLogic, pageLoader, uiManager)
// simplebar (optional, uncomment if you are actively using the SimpleBar custom scrollbar, required by uiManager)
// IMPORTANT: Ensure these URLs are correct and accessible.
// @require      https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/sweetalert2/11.10.8/sweetalert2.min.js // Include multiple CDNs for robustness
// @require      https://unpkg.com/sweetalert2@11.10.8/dist/sweetalert2.min.js // Include multiple CDNs for robustness
// // @require      https://cdn.jsdelivr.net/npm/simplebar@6.3.8/dist/simplebar.min.js

// --- Internal Modules ---
// Load constants first as they are used everywhere.
// Load helpers and managers that have fewer dependencies next.
// Load core logic (fillLogic) and features (pageLoader) that depend on helpers.
// Load UI components last as they wire everything together.
// IMPORTANT: The order of these @require directives is CRITICAL for avoiding ReferenceErrors.
// Ensure dependencies are loaded BEFORE the files that use them.

// Constants used across the script
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/constants.js

// SweetAlert2 helpers (depends on SweetAlert2, constants)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/swalHelpers.js

// DOM manipulation utilities (depends on cash-dom, constants, swalHelpers)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/domUtils.js

// Configuration loading/saving (depends on constants, GM functions)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/configManager.js

// NOTE: patternWorker.js is NOT required in this version as worker is not used.

// Core filling logic (depends on domUtils, swalHelpers, constants, configManager, GM functions)
// This file needs to be loaded before pageLoader and uiManager which call its functions.
// THIS VERSION RUNS ALL PATTERN CALCULATIONS ON THE MAIN THREAD.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/fillLogic.js

// Page loading/scrolling logic (depends on domUtils, fillLogic, swalHelpers, constants, cash-dom, GM functions)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/pageLoader.js

// UI CSS styles (depends on constants, GM_addStyle)
// Can be placed here or earlier after constants.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiCss.js

// UI management and event binding (depends on cash-dom, domUtils, configManager, fillLogic, constants, GM functions)
// This file depends on almost everything else, so it should be loaded last.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiManager.js

// ==/UserScript==


// This is the main entry point file for the UserScript.
// It contains the header, the main IIFE wrapper, the init function,
// and the event listener to start the script.
// All other functionalities are loaded via @require directives from the src/ folder.

(function() {
    'use strict';

    // Declare variables that will be populated during initialization.
    // These variables are intended to be accessible across functions defined
    // in different @require'd files, within this main IIFE scope.
    // They are declared here to ensure they exist before any @require'd code might try to use them.
    let config; // Holds the loaded configuration object
    let panelElement; // Reference to the main UI panel element
    let toggleButtonElement; // Reference to the panel toggle button element
    let panelSimpleBarInstance = null; // SimpleBar instance for the panel body (if used)
    // let patternWorker = null; // Web Worker instance - NOT USED IN THIS VERSION


    /* --- Initialize Script --- */
    // This function orchestrates the startup of the script.
    async function init() { // Made async to potentially await future async init tasks
        GM_log(`Pack Filler Pro v${GM_info.script.version} (Main Thread Only, Improved): Initialization started.`);

        // --- Essential Dependency Checks (Libraries and Core Modules) ---
        // Check if critical external libraries and core modules loaded correctly via @require.
        // Abort early if fundamental dependencies are missing.
        if (typeof window.cash === 'undefined') {
            const msg = "Cash-dom library not found. Check @require or network. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
        }
        if (typeof window.Swal === 'undefined') {
             const msg = "SweetAlert2 library not found. Check @require or network. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
        }
         // Check core internal modules based on the order of @require
         if (typeof loadConfig !== 'function') {
             const msg = "configManager module not found. Check @require order/URLs. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
         }
         if (typeof addPanelCSS !== 'function') {
             const msg = "uiCss module not found. Check @require order/URLs. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
         }
         if (typeof getPackInputs !== 'function' || typeof updateInput !== 'function' || typeof clearAllInputs !== 'function' || typeof sanitize !== 'function') { // Added sanitize check
             const msg = "domUtils module (or some functions) not found. Check @require order/URLs. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
         }
         if (typeof fillPacks !== 'function' || typeof fillRandomPackInput !== 'function' || typeof virtualUpdate !== 'function' || typeof calculateQuantitiesMainThread !== 'function') { // Added calculateQuantitiesMainThread check
             const msg = "fillLogic module (or some functions) not found. Check @require order/URLs. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
         }
         if (typeof loadFullPageIfNeeded !== 'function') {
              const msg = "pageLoader module not found. Check @require order/URLs. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
         }
         if (typeof bindPanelEvents !== 'function' || typeof loadConfigIntoUI !== 'function' || typeof updateConfigFromUI !== 'function' || typeof updatePanelModeDisplay !== 'function' || typeof updatePanelVisibility !== 'function' || typeof applyDarkMode !== 'function' || typeof updateQuantityInputVisibility !== 'function' || typeof updatePatternParamsVisibility !== 'function') {
             const msg = "uiManager module (or some functions) not found. Check @require order/URLs. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
         }


        GM_log("Pack Filler Pro: Essential libraries and core modules found.");

        // 2. Initialize Web Worker - SKIPPED IN THIS VERSION
        // The patternWorker is not used.

        // 3. Load Configuration
        GM_log("Pack Filler Pro: Attempting to load config.");
        try {
             config = loadConfig(); // loadConfig from configManager.js
             if (!config || typeof config !== 'object') { // Double check return value
                   const msg = "loadConfig did not return a valid object. Script aborted."; GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
              }
             GM_log("Pack Filler Pro: Config loaded and assigned.", config);
        } catch (e) {
             const msg = `Error loading config: ${e.message}. Script aborted.`; GM_log(`FATAL ERROR: ${msg}`, e); alert(`Pack Filler Pro Error: ${msg}`); return;
        }


        // 4. Add CSS
        GM_log("Pack Filler Pro: Adding UI CSS.");
        try {
             addPanelCSS(); // addPanelCSS from uiCss.js
             GM_log("Pack Filler Pro: UI CSS added.");
        } catch (e) {
             // CSS failing is not critical enough to abort the script, but log it.
             GM_log(`Pack Filler Pro: ERROR - Failed to add UI CSS: ${e.message}`, e);
             if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', `Failed to apply custom styles: ${sanitize(e.message)}.`, 'error', config);
        }


        // 5. Add Panel HTML to DOM and get element references
        GM_log("Pack Filler Pro: Adding UI HTML elements.");
        // Assumes panelHTML, panelToggleHTML from uiCss.js and PANEL_ID, TOGGLE_BUTTON_ID from constants.js are available
        if (typeof panelHTML === 'string' && typeof panelToggleHTML === 'string' && typeof PANEL_ID !== 'undefined' && typeof TOGGLE_BUTTON_ID !== 'undefined') {
             try {
                  document.body.insertAdjacentHTML('beforeend', panelHTML);
                  document.body.insertAdjacentHTML('beforeend', panelToggleHTML);

                  // Get references to the main panel and toggle button elements
                  panelElement = document.getElementById(PANEL_ID);
                  toggleButtonElement = document.getElementById(TOGGLE_BUTTON_ID);

                  if (!panelElement || !toggleButtonElement) {
                       const msg = `UI elements (${PANEL_ID} or ${TOGGLE_BUTTON_ID}) not found after insertion. UI may not be functional.`;
                       GM_log(`Pack Filler Pro: ERROR - ${msg}`);
                        if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
                       // Script can continue, but UI interaction will fail.
                  } else {
                      GM_log("Pack Filler Pro: UI elements added to DOM and references obtained.");
                  }
             } catch (e) {
                  const msg = `Failed to insert UI HTML: ${e.message}. UI may not be created.`;
                  GM_log(`Pack Filler Pro: ERROR - ${msg}`, e);
                   if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
                  // Script can continue, but UI will be missing.
             }
        } else {
             const msg = "UI HTML strings or ID constants missing. UI may not be created.";
             GM_log(`Pack Filler Pro: ERROR - ${msg}`);
              if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
             // Script can continue, but UI will be missing.
        }


        // 6. Initialize SimpleBar (Custom Scrollbar - Optional)
        // Check if SimpleBar library is available before initializing.
        // Assumes window.SimpleBar is available if SimpleBar is @require'd.
        // Assumes panelElement exists.
         if (panelElement && typeof window.SimpleBar !== 'undefined') {
            const panelBodyEl = panelElement.querySelector('.pfp-body');
            if (panelBodyEl) {
                try {
                    panelSimpleBarInstance = new window.SimpleBar(panelBodyEl);
                    GM_log("Pack Filler Pro: SimpleBar initialized.");
                } catch (e) {
                     GM_log("Pack Filler Pro: Failed to initialize SimpleBar.", e);
                     panelSimpleBarInstance = null;
                     // Script can continue, using native scrollbar.
                }
            } else {
                 GM_log("Pack Filler Pro: Panel body element not found for SimpleBar.");
            }
        } else {
            GM_log("Pack Filler Pro: SimpleBar library not available or panel element not found. Using native scrollbar.");
            panelSimpleBarInstance = null;
        }


        // 7. Apply Initial Configuration to UI and State
        // Assumes functions from uiManager.js are available and config, panelElement, toggleButtonElement are available.
        if (typeof loadConfigIntoUI === 'function' && typeof updatePanelModeDisplay === 'function' && typeof updatePanelVisibility === 'function' && typeof applyDarkMode === 'function' && typeof updateQuantityInputVisibility === 'function' && typeof updatePatternParamsVisibility === 'function') {
             // Apply loaded config to UI controls
             loadConfigIntoUI(config); // Pass config
             // Update panel state based on loaded config
             updatePanelModeDisplay(config.lastMode); // Pass mode from config
             updateQuantityInputVisibility(config.lastMode); // Set initial quantity input visibility
             updatePatternParamsVisibility(config.patternType); // Set initial pattern params visibility

             // Apply dark mode based on loaded config
             applyDarkMode(config, config.isDarkMode); // Pass config

             // Set initial panel visibility and position - only if elements exist
             if (panelElement && toggleButtonElement) {
                  updatePanelVisibility(config, config.panelVisible, config.panelPos); // Pass config
             } else {
                  GM_log("Pack Filler Pro: Skipping initial updatePanelVisibility because panel elements were not found.");
             }

             GM_log("Pack Filler Pro: Initial config applied to UI.");

        } else {
             const msg = "UI state management functions not found. UI may not be correctly initialized.";
             GM_log(`Pack Filler Pro: ERROR - ${msg}`);
              if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
             // Script can continue, but UI state might be incorrect.
        }


        // 8. Bind Events
        // Assumes bindPanelEvents from uiManager.js is available and config is available.
         if (panelElement && toggleButtonElement && typeof bindPanelEvents === 'function') {
             bindPanelEvents(config); // Pass config here
             GM_log("Pack Filler Pro: UI events bound.");
         } else {
              const msg = "UI elements or bindPanelEvents function not found. UI events will not be bound.";
              GM_log(`Pack Filler Pro: ERROR - ${msg}`);
               if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
              // Script can continue, but UI will not be interactive.
         }


        // 9. Trigger Auto-load Full Page if enabled
        // Assumes loadFullPageIfNeeded from pageLoader.js is available.
        if (config.loadFullPage) {
            GM_log("Pack Filler Pro: Auto-load is enabled, scheduling loadFullPageIfNeeded.");
            if (typeof loadFullPageIfNeeded === 'function') {
                // Delay slightly to allow page rendering
                setTimeout(() => loadFullPageIfNeeded(config), 300); // Pass config here
            } else {
                 const msg = "loadFullPageIfNeeded function not found. Auto-loading will not run.";
                 GM_log(`Pack Filler Pro: ERROR - ${msg}`);
                  if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('Auto-Load Error', sanitize(msg), 'error', config);
            }

        } else {
            GM_log("Pack Filler Pro: Auto-load is disabled.");
            // If not auto-loading, ensure the max count for the count input is set based on initially visible inputs
            // Uses $ from cash-dom and getPackInputs from src/domUtils.js
            // Assumes getPackInputs, $, and clamp are available
             if (typeof getPackInputs === 'function' && typeof $ === 'function' && typeof clamp === 'function') {
                 const maxCount = getPackInputs().length;
                 // Ensure the max attribute is set but not less than 0
                  $('#pfp-count').attr('max', clamp(maxCount, 0, Infinity));
                 GM_log("Pack Filler Pro: Max count for input set based on initially visible inputs.");
             } else {
                 GM_log("Pack Filler Pro: getPackInputs, $, or clamp function not found. Could not set max count for input.");
             }
        }

        GM_log("Pack Filler Pro: Initialization complete (Main Thread Only, Improved).");
    }


    // --- Run Initialization ---
    // Use DOMContentLoaded to ensure the basic page structure is ready before initializing.
    // This is the actual trigger that starts the script's logic after the page loads.
    // Using a small delay (0ms) with setTimeout ensures this runs after the current
    // execution context finishes, which can sometimes help with environment quirks.
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 0);
    });

    // Clean up resources when the script is unloaded (e.g., page navigation)
    // Disconnect MutationObservers stored globally.
    window.addEventListener('beforeunload', () => {
         // Disconnect MutationObservers if they are stored globally on window
         // (The swal observer is stored on window._pfpSwalObserver in uiManager.js)
         if (window._pfpSwalObserver) {
              window._pfpSwalObserver.disconnect();
              delete window._pfpSwalObserver;
              GM_log("Pack Filler Pro: SweetAlert2 popup observer disconnected on unload.");
         }
         // Add disconnection for the main input observer if it were stored globally
         // (Currently, the main input observer is local to bindPanelEvents in uiManager.js, so it will be garbage collected)
    });

    // Optional: Add a menu command for manual initialization if DOMContentLoaded fails for some reason
    // This provides a fallback way to start the script.
    if (typeof GM_registerMenuCommand !== 'undefined') {
         GM_registerMenuCommand("Pack Filler Pro: Manual Init (Main Thread Only)", init);
         GM_log("Pack Filler Pro: Registered manual initialization menu command.");
    } else {
         GM_log("Pack Filler Pro: GM_registerMenuCommand not available. Manual init command not registered.");
    }


})(); // End of IIFE
