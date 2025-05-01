// ==UserScript==
// @name         🎴 Pack Filler Pro – Minimal Edition (v3)
// @namespace    https://ygoprodeck.com
// @version      🎴1.0.0.v3 // Minimal version 3
// @description  Minimal Pack Filler Pro with basic fill modes and UI, using IIFEs for better scope management.
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
// Each module is now wrapped in an IIFE and attaches its public interface to window.pfpMinimal
// The order of @requires still matters for dependencies within the window.pfpMinimal namespace.

// Constants (defines window.pfpMinimal.$ and other constants)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/constants.js?v=minimal_v3

// DOM manipulation utilities (depends on window.pfpMinimal.$, window.pfpMinimal.SELECTOR, etc.)
// Defines window.pfpMinimal.getPackInputs, window.pfpMinimal.clamp, etc.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/domUtils.js?v=minimal_v3

// SweetAlert2 helpers (depends on window.Swal, window.pfpMinimal.sanitize)
// Defines window.pfpMinimal.SWAL_ALERT, window.pfpMinimal.SWAL_TOAST
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/swalHelpers.js?v=minimal_v3

// Configuration loading/saving (depends on window.GM_*, window.pfpMinimal.DEFAULT_CONFIG, etc.)
// Defines window.pfpMinimal.loadConfig, window.pfpMinimal.saveConfig, etc.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/configManager.js?v=minimal_v3

// UI CSS styles and HTML structure strings (depends on window.GM_addStyle, window.pfpMinimal.PANEL_ID, etc.)
// Defines window.pfpMinimal.panelHTML, window.pfpMinimal.panelToggleHTML, window.pfpMinimal.addPanelCSS
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiCss.js?v=minimal_v3

// Core filling logic (depends on functions/constants from window.pfpMinimal namespace)
// Defines window.pfpMinimal.fillPacks, window.pfpMinimal.MainThreadFillStrategies, etc.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/fillLogic.js?v=minimal_v3

// UI management and basic event binding (depends on functions/constants from window.pfpMinimal namespace)
// Defines window.pfpMinimal.bindPanelEvents, window.pfpMinimal.loadConfigIntoUI, etc.
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiManager.js?v=minimal_v3


// ==/UserScript==

// This is the main entry point file.
// It sets up the basic execution environment and triggers initialization.

(function() {
    'use strict';

    // Initialize the global namespace object if it doesn't exist.
    // This should already be done in constants.js, but doing it here provides a safeguard.
    window.pfpMinimal = window.pfpMinimal || {};

    // Declare variables that will hold references to the UI elements.
    // These are needed in this scope to be passed to the uiManager's bindPanelEvents.
    let panelElement = null;
    let toggleButtonElement = null;

    // Store the config object in this scope after loading it.
    let config = null;


    /* --- Initialize Script --- */
    // This function orchestrates the startup of the script.
    async function init() {
        // Use GM_log from the window object (granted)
        if (typeof GM_log === 'function') GM_log(`Pack Filler Pro v${GM_info.script.version} (Minimal v3): Initialization started.`);

        // --- Essential Dependency Checks ---
        // Check if critical external libraries and core internal modules are available
        // by checking the functions/objects attached to window.pfpMinimal or window.
        if (typeof window.cash === 'undefined') { const msg = "Cash-dom library not found. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }
        if (typeof window.Swal === 'undefined') { const msg = "SweetAlert2 library not found. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }

         // Check for key functions/objects on the namespace object.
         // The order of these checks should generally follow the @require order.
         if (typeof window.pfpMinimal.$ === 'undefined' || typeof window.pfpMinimal.SELECTOR === 'undefined' || typeof window.pfpMinimal.MAX_QTY === 'undefined' || typeof window.pfpMinimal.DEFAULT_CONFIG === 'undefined') { const msg = "Constants module dependencies missing from namespace. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof window.pfpMinimal.getPackInputs !== 'function' || typeof window.pfpMinimal.clamp !== 'function' || typeof window.pfpMinimal.updateInput !== 'function' || typeof window.pfpMinimal.clearAllInputs !== 'function' || typeof window.pfpMinimal.sanitize !== 'function') { const msg = "domUtils module missing functions from namespace. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof window.pfpMinimal.SWAL_ALERT !== 'function' || typeof window.pfpMinimal.SWAL_TOAST !== 'function') { const msg = "swalHelpers module missing functions from namespace. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof window.pfpMinimal.loadConfig !== 'function' || typeof window.pfpMinimal.saveConfig !== 'function' || typeof window.pfpMinimal.debouncedSaveConfig !== 'function' || typeof window.pfpMinimal.validateFillConfig !== 'function') { const msg = "configManager module missing functions from namespace. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof window.pfpMinimal.panelHTML === 'undefined' || typeof window.pfpMinimal.panelToggleHTML === 'undefined' || typeof window.pfpMinimal.addPanelCSS !== 'function') { const msg = "uiCss module missing HTML/CSS or function from namespace. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof window.pfpMinimal.fillPacks !== 'function' || typeof window.pfpMinimal.calculateQuantitiesMainThread !== 'function' || typeof window.pfpMinimal.MainThreadFillStrategies === 'undefined' || typeof window.pfpMinimal.virtualUpdate !== 'function' || typeof window.pfpMinimal.calculateFillCount !== 'function' || typeof window.pfpMinimal.generateFeedback !== 'function') { const msg = "fillLogic module missing functions/strategies from namespace. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }
         if (typeof window.pfpMinimal.bindPanelEvents !== 'function' || typeof window.pfpMinimal.loadConfigIntoUI !== 'function' || typeof window.pfpMinimal.updateConfigFromUI !== 'function' || typeof window.pfpMinimal.updatePanelModeDisplay !== 'function' || typeof window.pfpMinimal.updatePanelVisibility !== 'function' || typeof window.pfpMinimal.applyDarkMode !== 'function' || typeof window.pfpMinimal.updateQuantityInputVisibility !== 'function' || typeof window.pfpMinimal.updatePatternParamsVisibility !== 'function') { const msg = "uiManager module missing functions from namespace. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return; }


        if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Essential dependencies found in namespace.");

        // 1. Load Configuration
        // GM_log("Pack Filler Pro: Loading config."); // Minimal logging
        try {
             // Call loadConfig from the namespace
             config = window.pfpMinimal.loadConfig();
             if (!config || typeof config !== 'object') {
                   const msg = "loadConfig did not return a valid object. Script aborted."; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`); alert(`Pack Filler Pro Error: ${msg}`); return;
              }
             // GM_log("Pack Filler Pro: Config loaded:", config); // Minimal logging
        } catch (e) {
             const msg = `Error loading config: ${e.message}. Script aborted.`; if (typeof GM_log === 'function') GM_log(`FATAL ERROR: ${msg}`, e); alert(`Pack Filler Pro Error: ${msg}`); return;
        }

        // 2. Add CSS
        // GM_log("Pack Filler Pro: Adding UI CSS."); // Minimal logging
        try {
             // Call addPanelCSS from the namespace
             window.pfpMinimal.addPanelCSS();
             // GM_log("Pack Filler Pro: UI CSS added."); // Minimal logging
        } catch (e) {
             // CSS failing is not critical enough to abort, but log and alert.
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - Failed to add UI CSS: ${e.message}`, e);
             // Use SWAL_ALERT from namespace, assumes sanitize is available in namespace
             if (typeof window.pfpMinimal.SWAL_ALERT === 'function' && typeof window.pfpMinimal.sanitize === 'function') {
                 window.pfpMinimal.SWAL_ALERT('UI Error', window.pfpMinimal.sanitize(`Failed to apply custom styles: ${e.message}.`), 'error', config);
             }
        }


        // 3. Inject UI HTML and get element references
        // GM_log("Pack Filler Pro: Injecting UI."); // Minimal logging
        // Use constants from the namespace
        const PANEL_ID = window.pfpMinimal.PANEL_ID;
        const TOGGLE_BUTTON_ID = window.pfpMinimal.TOGGLE_BUTTON_ID;
        const panelHTML = window.pfpMinimal.panelHTML;
        const panelToggleHTML = window.pfpMinimal.panelToggleHTML;

        if (typeof panelHTML === 'string' && typeof panelToggleHTML === 'string' && typeof PANEL_ID !== 'undefined' && typeof TOGGLE_BUTTON_ID !== 'undefined') {
             try {
                  document.body.insertAdjacentHTML('beforeend', panelHTML);
                  document.body.insertAdjacentHTML('beforeend', panelToggleHTML);

                  panelElement = document.getElementById(PANEL_ID);
                  toggleButtonElement = document.getElementById(TOGGLE_BUTTON_ID);

                  if (!panelElement || !toggleButtonElement) {
                       const msg = `UI elements (${PANEL_ID} or ${TOGGLE_BUTTON_ID}) not found after insertion. UI may not be functional.`;
                       if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${msg}`);
                       // Use SWAL_ALERT from namespace, assumes sanitize is available
                        if (typeof window.pfpMinimal.SWAL_ALERT === 'function' && typeof window.pfpMinimal.sanitize === 'function') {
                            window.pfpMinimal.SWAL_ALERT('UI Error', window.pfpMinimal.sanitize(msg), 'error', config);
                        }
                  } else {
                      // GM_log("Pack Filler Pro: UI elements added to DOM and references obtained."); // Minimal logging
                  }
             } catch (e) {
                  const msg = `Failed to insert UI HTML: ${e.message}. UI may not be created.`;
                  if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${msg}`, e);
                   // Use SWAL_ALERT from namespace, assumes sanitize is available
                   if (typeof window.pfpMinimal.SWAL_ALERT === 'function' && typeof window.pfpMinimal.sanitize === 'function') {
                       window.pfpMinimal.SWAL_ALERT('UI Error', window.pfpMinimal.sanitize(msg), 'error', config);
                   }
             }
        } else {
             const msg = "UI HTML strings or ID constants missing from namespace. UI may not be created.";
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${msg}`);
              // Use SWAL_ALERT from namespace, assumes sanitize is available
              if (typeof window.pfpMinimal.SWAL_ALERT === 'function' && typeof window.pfpMinimal.sanitize === 'function') {
                  window.pfpMinimal.SWAL_ALERT('UI Error', window.pfpMinimal.sanitize(msg), 'error', config);
              }
        }


        // 4. Apply Initial UI State & Bind Events (if elements exist)
        if (panelElement && toggleButtonElement) {
             // GM_log("Pack Filler Pro: Applying initial UI state and binding events."); // Minimal logging
             try {
                 // Call UI management functions from the namespace
                 window.pfpMinimal.loadConfigIntoUI(config);
                 window.pfpMinimal.updatePanelModeDisplay(config.lastMode);
                 window.pfpMinimal.updateQuantityInputVisibility(config.lastMode);
                 window.pfpMinimal.updatePatternParamsVisibility(config.patternType); // Will hide in minimal
                 window.pfpMinimal.applyDarkMode(config, config.isDarkMode);
                 window.pfpMinimal.updatePanelVisibility(config, config.panelVisible, config.panelPos);

                 // Bind events - pass element references
                 window.pfpMinimal.bindPanelEvents(config, panelElement, toggleButtonElement);

                 // GM_log("Pack Filler Pro: Initial UI state applied and events bound."); // Minimal logging

             } catch (e) {
                  const msg = `Error applying initial UI state or binding events: ${e.message}. UI may not be fully functional.`;
                  if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${msg}`, e);
                   // Use SWAL_ALERT from namespace, assumes sanitize is available
                   if (typeof window.pfpMinimal.SWAL_ALERT === 'function' && typeof window.pfpMinimal.sanitize === 'function') {
                       window.pfpMinimal.SWAL_ALERT('UI Error', window.pfpMinimal.sanitize(msg), 'error', config);
                   }
             }

        } else {
             // GM_log("Pack Filler Pro: Skipping UI state application and event binding because panel elements were not found."); // Minimal logging
        }


        // Set max count for the count input based on initially visible inputs
         // Use functions/constants from namespace
         const maxCount = window.pfpMinimal.getPackInputs().length;
         const COUNT_INPUT_ID = window.pfpMinimal.COUNT_INPUT_ID;
         const clamp = window.pfpMinimal.clamp;
         const $ = window.pfpMinimal.$;

         if (typeof $ === 'function' && typeof COUNT_INPUT_ID !== 'undefined' && typeof clamp === 'function') {
             $(`#${COUNT_INPUT_ID}`).attr('max', clamp(maxCount, 0, Infinity));
             // GM_log("Pack Filler Pro: Max count for input set based on initially visible inputs."); // Minimal logging
         } else {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Dependencies for setting max count missing from namespace ($, COUNT_INPUT_ID, clamp). Skipping.");
         }


        // Auto-fill on load is NOT included in this minimal version.

        if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Initialization complete (Minimal v3).");
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
         GM_registerMenuCommand("Pack Filler Pro: Manual Init (Minimal v3)", init);
         // GM_log("Pack Filler Pro: Registered manual initialization menu command."); // Minimal logging
    } else {
         // GM_log("Pack Filler Pro: GM_registerMenuCommand not available. Manual init command not registered."); // Minimal logging
    }

})(); // End of IIFE
