// ==UserScript==
// @name         🎴 Pack Filler Pro – Minimal Edition
// @namespace    https://ygoprodeck.com
// @version      🎴1.0.0 // Minimal version
// @description  Minimal Pack Filler Pro with basic fill modes and UI.
// @match        https://ygoprodeck.com/pack-sim/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_log

// --- External Libraries ---
// cash-dom for DOM manipulation
// SweetAlert2 for custom alerts/toasts
// IMPORTANT: Ensure these URLs are correct and accessible.
// @require      https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/sweetalert2/11.10.8/sweetalert2.min.js
// @require      https://unpkg.com/sweetalert2@11.10.8/dist/sweetalert2.min.js

// --- Internal Modules (Minimal) ---
// Load constants first
// Load helpers (DOM Utils, SWAL)
// Load config management
// Load UI structure (CSS/HTML)
// Load core logic (fillLogic)
// Load UI management (depends on everything above)

// Constants used across the script
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/constants.js?v=minimal

// DOM manipulation utilities (depends on cash-dom, constants)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/domUtils.js?v=minimal

// SweetAlert2 helpers (depends on SweetAlert2, domUtils.sanitize)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/swalHelpers.js?v=minimal

// Configuration loading/saving (depends on constants, GM functions, domUtils.clamp)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/configManager.js?v=minimal

// UI CSS styles and HTML structure strings (depends on constants)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiCss.js?v=minimal

// Core filling logic (depends on domUtils, swalHelpers, constants, configManager)
// Minimal version with only main thread strategies.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/fillLogic.js?v=minimal

// UI management and basic event binding (depends on cash-dom, domUtils, configManager, fillLogic, constants, swalHelpers)
// This should be loaded after its dependencies.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiManager.js?v=minimal


// ==/UserScript==

// This is the main entry point file.
// It sets up the basic execution environment and triggers initialization.

(function() {
    'use strict';

    // Declare variables that will be populated during initialization and shared across modules.
    // These are made available in this IIFE's scope.
    let config; // Holds the loaded configuration object
    let panelElement; // Reference to the main UI panel element
    let toggleButtonElement; // Reference to the panel toggle button element
    // SimpleBar and Worker are not included in minimal version

    /* --- Initialize Script --- */
    // This function orchestrates the startup of the script.
    async function init() { // Made async for potential future async tasks
        // GM_log(`Pack Filler Pro v${GM_info.script.version} (Minimal): Initialization started.`); // Minimal logging

        // --- Essential Dependency Checks ---
        // Check if critical external libraries and core internal modules are available.
        // Use typeof checks for functions/objects expected from @require.
        // Check for window.cash and window.Swal first as they are base requirements.
        if (typeof window.cash === 'undefined') { const msg = "Cash-dom library not found. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }
        if (typeof window.Swal === 'undefined') { const msg = "SweetAlert2 library not found. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }

         // Check for key functions/objects from required modules.
         // Order matters based on @require dependencies.
         if (typeof $ === 'undefined' || typeof SELECTOR === 'undefined' || typeof MAX_QTY === 'undefined') { const msg = "Constants module missing dependencies or constants. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof getPackInputs !== 'function' || typeof updateInput !== 'function' || typeof clearAllInputs !== 'function' || typeof clamp !== 'function' || typeof sanitize !== 'function') { const msg = "domUtils module missing functions. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof SWAL_ALERT !== 'function' || typeof SWAL_TOAST !== 'function') { const msg = "swalHelpers module missing functions. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof loadConfig !== 'function' || typeof saveConfig !== 'function' || typeof debouncedSaveConfig !== 'function') { const msg = "configManager module missing functions. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof panelHTML === 'undefined' || typeof panelToggleHTML === 'undefined' || typeof addPanelCSS !== 'function') { const msg = "uiCss module missing HTML/CSS or function. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof fillPacks !== 'function' || typeof calculateQuantitiesMainThread !== 'function' || typeof MainThreadFillStrategies === 'undefined' || typeof virtualUpdate !== 'function' || typeof calculateFillCount !== 'function' || typeof generateFeedback !== 'function') { const msg = "fillLogic module missing functions/strategies. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof bindPanelEvents !== 'function' || typeof loadConfigIntoUI !== 'function' || typeof updateConfigFromUI !== 'function' || typeof updatePanelModeDisplay !== 'function' || typeof updatePanelVisibility !== 'function' || typeof applyDarkMode !== 'function' || typeof updateQuantityInputVisibility !== 'function' || typeof updatePatternParamsVisibility !== 'function') { const msg = "uiManager module missing functions. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return; }


        // GM_log("Pack Filler Pro: Essential dependencies found."); // Minimal logging

        // 1. Load Configuration
        // GM_log("Pack Filler Pro: Loading config."); // Minimal logging
        try {
             config = loadConfig(); // loadConfig from configManager.js
             if (!config || typeof config !== 'object') { // Double check return value
                   const msg = "loadConfig did not return a valid object. Script aborted."; /* GM_log(`FATAL ERROR: ${msg}`); */ alert(`Pack Filler Pro Error: ${msg}`); return;
              }
             // GM_log("Pack Filler Pro: Config loaded:", config); // Minimal logging
        } catch (e) {
             const msg = `Error loading config: ${e.message}. Script aborted.`; /* GM_log(`FATAL ERROR: ${msg}`, e); */ alert(`Pack Filler Pro Error: ${msg}`); return;
        }

        // 2. Add CSS
        // GM_log("Pack Filler Pro: Adding UI CSS."); // Minimal logging
        try {
             addPanelCSS(); // addPanelCSS from uiCss.js
             // GM_log("Pack Filler Pro: UI CSS added."); // Minimal logging
        } catch (e) {
             // CSS failing is not critical enough to abort the script, but log it and alert.
             // GM_log(`Pack Filler Pro: ERROR - Failed to add UI CSS: ${e.message}`, e); // Minimal logging
             SWAL_ALERT('UI Error', sanitize(`Failed to apply custom styles: ${e.message}.`), 'error', config);
        }


        // 3. Inject UI HTML and get element references
        // GM_log("Pack Filler Pro: Injecting UI."); // Minimal logging
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
                       // GM_log(`Pack Filler Pro: ERROR - ${msg}`); // Minimal logging
                       SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
                       // Script can continue, but UI interaction will fail.
                  } else {
                      // GM_log("Pack Filler Pro: UI elements added to DOM and references obtained."); // Minimal logging
                  }
             } catch (e) {
                  const msg = `Failed to insert UI HTML: ${e.message}. UI may not be created.`;
                  // GM_log(`Pack Filler Pro: ERROR - ${msg}`, e); // Minimal logging
                   SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
                  // Script can continue, but UI will be missing.
             }
        } else {
             const msg = "UI HTML strings or ID constants missing. UI may not be created.";
             // GM_log(`Pack Filler Pro: ERROR - ${msg}`); // Minimal logging
              SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
             // Script can continue, but UI will be missing.
        }


        // 4. Apply Initial UI State & Bind Events (if elements exist)
        if (panelElement && toggleButtonElement) {
             // GM_log("Pack Filler Pro: Applying initial UI state and binding events."); // Minimal logging
             try {
                 // Apply loaded config to UI controls and state
                 loadConfigIntoUI(config); // from uiManager.js
                 updatePanelModeDisplay(config.lastMode); // from uiManager.js
                 updateQuantityInputVisibility(config.lastMode); // from uiManager.js
                 updatePatternParamsVisibility(config.patternType); // from uiManager.js (will hide in minimal)
                 applyDarkMode(config, config.isDarkMode); // from uiManager.js
                 updatePanelVisibility(config, config.panelVisible, config.panelPos); // from uiManager.js

                 // Bind events
                 bindPanelEvents(config); // from uiManager.js

                 // GM_log("Pack Filler Pro: Initial UI state applied and events bound."); // Minimal logging

             } catch (e) {
                  const msg = `Error applying initial UI state or binding events: ${e.message}. UI may not be fully functional.`;
                  // GM_log(`Pack Filler Pro: ERROR - ${msg}`, e); // Minimal logging
                  SWAL_ALERT('UI Error', sanitize(msg), 'error', config);
             }

        } else {
             // GM_log("Pack Filler Pro: Skipping UI state application and event binding because panel elements were not found."); // Minimal logging
        }


        // Set max count for the count input based on initially visible inputs
         // Assumes getPackInputs, $, and clamp are available (checked above)
         const maxCount = getPackInputs().length;
         $(`#${COUNT_INPUT_ID}`).attr('max', clamp(maxCount, 0, Infinity));
         // GM_log("Pack Filler Pro: Max count for input set based on initially visible inputs."); // Minimal logging


        // Auto-fill on load is NOT included in this minimal version.

        // GM_log("Pack Filler Pro: Initialization complete (Minimal)."); // Minimal logging
    }


    // --- Run Initialization ---
    // Use DOMContentLoaded to ensure the basic page structure is ready before initializing.
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 0); // Use setTimeout with 0 delay to ensure it runs after current execution context
    });

    // Clean up resources when the script is unloaded (e.g., page navigation)
    window.addEventListener('beforeunload', () => {
         // Disconnect MutationObservers if they are stored globally on window
         // (The swal observer is stored on window._pfpSwalObserver in uiManager.js)
         if (window._pfpSwalObserver) {
              window._pfpSwalObserver.disconnect();
              delete window._pfpSwalObserver;
              // GM_log("Pack Filler Pro: SweetAlert2 popup observer disconnected on unload."); // Minimal logging
         }
         // Add disconnection for other observers if they were stored globally
    });

    // Optional: Add a menu command for manual initialization
    if (typeof GM_registerMenuCommand !== 'undefined') {
         GM_registerMenuCommand("Pack Filler Pro: Manual Init (Minimal)", init);
         // GM_log("Pack Filler Pro: Registered manual initialization menu command."); // Minimal logging
    } else {
         // GM_log("Pack Filler Pro: GM_registerMenuCommand not available. Manual init command not registered."); // Minimal logging
    }

})(); // End of IIFE
