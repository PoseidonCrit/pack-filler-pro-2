// ==UserScript==
// @name         🎴F105.35 Pack Filler Pro – Sleek Edition
// @namespace    https://ygoprodeck.com
// @version      🎴F105.35
// @description  Enhanced UI and options for YGOPRODeck Pack Simulator, automatically loads all packs on load via scrolling, with advanced fill patterns.
// @match        https://ygoprodeck.com/pack-sim/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_log

// --- External Libraries ---
// Load core libraries first
// cash-dom for DOM manipulation
// SweetAlert2 for custom alerts/toasts (requiring multiple versions for compatibility)
// simplebar (uncomment if you are actively using the SimpleBar custom scrollbar)
// IMPORTANT: Ensure these URLs are correct and accessible.
// @require      https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/sweetalert2/11.10.8/sweetalert2.min.js
// @require      https://unpkg.com/sweetalert2@11.10.8/dist/sweetalert2.min.js
// // @require      https://cdn.jsdelivr.net/npm/simplebar@6.3.8/dist/simplebar.min.js

// --- Internal Modules ---
// Load constants first as they are used everywhere
// Load helpers and managers that have fewer dependencies next
// Load core logic (fillLogic) and features (pageLoader) that depend on helpers
// Load UI components last as they wire everything together
// IMPORTANT: The order of these @require directives is CRITICAL for avoiding ReferenceErrors
// in some userscript managers. Ensure dependencies are loaded BEFORE the files that use them.

// Constants used across the script
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/constants.js

// SweetAlert2 helpers (depends on SweetAlert2, constants)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/swalHelpers.js

// DOM manipulation utilities (depends on cash-dom, constants, swalHelpers)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/domUtils.js

// Configuration loading/saving (depends on constants, GM functions)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/configManager.js

// Web Worker code string (used by fillLogic)
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/patternWorker.js

// Core filling logic (depends on domUtils, swalHelpers, patternWorker, constants, configManager, GM functions)
// This file needs to be loaded before pageLoader and uiManager which call its functions.
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
    let patternWorker = null; // Web Worker instance for pattern calculations


    /* --- Initialize Script --- */
    // This function orchestrates the startup of the script.
    function init() {
        GM_log(`Pack Filler Pro v${GM_info.script.version}: Initialization started.`);

        // 1. Essential Dependency Checks (Libraries)
        // Check if critical external libraries loaded correctly via @require.
        if (typeof window.cash === 'undefined') {
            const errorMessage = "Cash-dom library not found. Please check @require directives or network connectivity. Script cannot run.";
            GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
            alert(`Pack Filler Pro Error: ${errorMessage}`); // Use native alert as Swal might not be loaded
            return; // Abort initialization
        }
         if (typeof window.Swal === 'undefined') {
             const errorMessage = "SweetAlert2 library not found. Please check @require directives or network connectivity. Script cannot run.";
             GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
             alert(`Pack Filler Pro Error: ${errorMessage}`); // Use native alert
             return; // Abort initialization
         }
        GM_log("Pack Filler Pro: Essential libraries (cash-dom, SweetAlert2) found.");

        // 2. Initialize Web Worker
        // Check if the Worker class is available and if the worker code string ('workerCode' from patternWorker.js) is available.
        // The workerCode variable is exposed by Tampermonkey/Violentmonkey from the @require'd file.
        if (typeof Worker !== 'undefined' && typeof workerCode !== 'undefined' && workerCode) {
            try {
                // Create a Blob from the worker code string and get a URL for it.
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                patternWorker = new Worker(blobUrl);
                GM_log("Pack Filler Pro: Web Worker initialized successfully.");

                // Set up the message handler for the worker.
                // This handler is responsible for processing messages from the worker,
                // including results ('result'), errors ('error'), and logs ('log').
                // It interacts with the _pendingWorkerRequests map managed in fillLogic.js.
                // Assumes handleWorkerMessage is available from fillLogic.js.
                if (typeof handleWorkerMessage === 'function') {
                     patternWorker.onmessage = handleWorkerMessage;
                     GM_log("Pack Filler Pro: Web Worker message handler (handleWorkerMessage) attached.");
                } else {
                     GM_log("Pack Filler Pro: handleWorkerMessage function not found. Worker messages will not be fully processed.");
                     // Basic logging fallback if the handler is missing
                     patternWorker.onmessage = (e) => { GM_log("Pack Filler Pro Worker Message (handler missing):", e.data); };
                }


                // Handle critical worker errors that prevent it from starting or running.
                patternWorker.onerror = (error) => {
                     GM_log("Pack Filler Pro: Web Worker failed or encountered a critical error:", error);
                     // Inform the user via a toast if Swal is available and config is loaded
                     // Use a small delay to ensure config and Swal are likely ready.
                     setTimeout(() => {
                         if(typeof SWAL_TOAST !== 'undefined' && config) {
                              SWAL_TOAST('Pattern Worker Error: Pattern features may be disabled.', 'error', config);
                         } else {
                              GM_log('Pack Filler Pro: Pattern Worker Error - Pattern features may be disabled.');
                         }
                     }, 100); // 100ms delay

                     // Terminate the worker on critical error to prevent further issues
                     if (patternWorker) {
                          patternWorker.terminate();
                          patternWorker = null; // Ensure the reference is null
                          GM_log("Pack Filler Pro: Web Worker terminated due to error.");
                     }
                };

            } catch (e) {
                GM_log("Pack Filler Pro: Failed to initialize Web Worker.", e);
                patternWorker = null; // Ensure worker is null if initialization fails
                 // Inform the user via a toast if Swal is available and config is loaded
                 setTimeout(() => {
                     if(typeof SWAL_TOAST !== 'undefined' && config) {
                          SWAL_TOAST('Pattern Worker Init Failed: Pattern features may be disabled.', 'error', config);
                     } else {
                          GM_log('Pack Filler Pro: Pattern Worker Init Failed - Pattern features may be disabled.');
                     }
                 }, 100); // 100ms delay
            }
        } else {
            GM_log("Pack Filler Pro: Web Worker API or workerCode not available. Pattern features will run on main thread or fallback.");
            patternWorker = null; // Ensure worker is null if not supported/loaded
        }


        // 3. Load Configuration
        // Calls the loadConfig function from src/configManager.js
        // Assumes loadConfig is available via @require.
        GM_log("Pack Filler Pro: Attempting to load config.");
        if (typeof loadConfig === 'function') {
             // Assign the returned config object to the 'config' variable in this scope.
             config = loadConfig();
             // Add a check to ensure loadConfig returned a valid object
              if (!config || typeof config !== 'object') {
                   const errorMessage = "Failed to load configuration. loadConfig did not return a valid object. Script cannot run correctly.";
                   GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
                   alert(`Pack Filler Pro Error: ${errorMessage}`); // Use native alert
                   return; // Stop initialization if config is bad
              }
             GM_log("Pack Filler Pro: Config loaded and assigned.", config);
        } else {
             const errorMessage = "loadConfig function not found. Cannot load configuration. Script cannot run.";
             GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
             alert(`Pack Filler Pro Error: ${errorMessage}`); // Use native alert
             return; // Abort initialization
        }


        // 4. Add CSS
        // Calls the addPanelCSS function from src/uiCss.js
        // Assumes addPanelCSS is available via @require and GM_addStyle is granted.
        if (typeof addPanelCSS === 'function') {
             addPanelCSS();
             GM_log("Pack Filler Pro: UI CSS added.");
        } else {
             GM_log("Pack Filler Pro: addPanelCSS function not found. UI CSS may not be applied.");
             // Script can continue, but UI will be unstyled.
        }


        // 5. Add Panel HTML to DOM and get element references
        // Assumes panelHTML and panelToggleHTML strings are available from uiCss.js
        // and PANEL_ID, TOGGLE_BUTTON_ID from constants.js
        if (typeof panelHTML === 'string' && typeof panelToggleHTML === 'string' && typeof PANEL_ID !== 'undefined' && typeof TOGGLE_BUTTON_ID !== 'undefined') {
             document.body.insertAdjacentHTML('beforeend', panelHTML);
             document.body.insertAdjacentHTML('beforeend', panelToggleHTML);

             // Get references to the main panel and toggle button elements
             panelElement = document.getElementById(PANEL_ID);
             toggleButtonElement = document.getElementById(TOGGLE_BUTTON_ID);

             // Check if UI elements were successfully added and log their presence
             if (!panelElement) {
                  const errorMessage = `Main panel element (#${PANEL_ID}) not found after insertion. UI may not be functional.`;
                  GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
                   if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', errorMessage, 'error', config);
                  // Script can potentially continue, but UI interaction will fail.
             } else {
                   GM_log(`Pack Filler Pro: Panel element (#${PANEL_ID}) found in DOM.`);
             }

             if (!toggleButtonElement) {
                  const errorMessage = `Toggle button element (#${TOGGLE_BUTTON_ID}) not found after insertion. UI may not be functional.`;
                  GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
                   if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', errorMessage, 'error', config);
                  // Script can potentially continue, but UI interaction will fail.
             } else {
                  GM_log(`Pack Filler Pro: Toggle button element (#${TOGGLE_BUTTON_ID}) found in DOM.`);
             }
             if (panelElement && toggleButtonElement) {
                 GM_log("Pack Filler Pro: UI elements added to DOM and references obtained.");
             } else {
                 GM_log("Pack Filler Pro: Failed to obtain references for one or more UI elements.");
             }

        } else {
             const errorMessage = "UI HTML strings (panelHTML, panelToggleHTML) or ID constants not found. UI may not be created.";
             GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
              if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', errorMessage, 'error', config);
             // Script can continue, but UI will be missing.
        }


        // 6. Initialize SimpleBar (Custom Scrollbar - Optional)
        // Check if SimpleBar library is available before initializing.
        // Assumes window.SimpleBar is available if SimpleBar is @require'd.
        // Assumes panelElement exists.
        const panelBodyEl = panelElement ? panelElement.querySelector('.pfp-body') : null;
        if (panelBodyEl && typeof window.SimpleBar !== 'undefined') {
            try {
                panelSimpleBarInstance = new window.SimpleBar(panelBodyEl);
                GM_log("Pack Filler Pro: SimpleBar initialized.");
            } catch (e) {
                 GM_log("Pack Filler Pro: Failed to initialize SimpleBar.", e);
                 panelSimpleBarInstance = null;
                 // Script can continue, using native scrollbar.
            }
        } else {
            GM_log("Pack Filler Pro: SimpleBar library not available or panel body not found. Using native scrollbar.");
            panelSimpleBarInstance = null;
        }


        // 7. Apply Initial Configuration to UI and State
        // Calls functions from src/uiManager.js, passing the config object
        // Assumes loadConfigIntoUI, updatePanelModeDisplay, updatePanelVisibility, applyDarkMode are available from uiManager.js
        // Assumes config, panelElement, toggleButtonElement are available in scope.
        if (typeof loadConfigIntoUI === 'function' && typeof updatePanelModeDisplay === 'function' && typeof updatePanelVisibility === 'function' && typeof applyDarkMode === 'function') {
             loadConfigIntoUI(config); // Pass config here
             updatePanelModeDisplay(config.lastMode); // Pass mode from config
             // Pass the initial position from config when setting initial visibility
             // Ensure updatePanelVisibility is called AFTER panelElement and toggleButtonElement are confirmed to exist
             if (panelElement && toggleButtonElement) {
                  updatePanelVisibility(config, config.panelVisible, config.panelPos); // Pass config here
             } else {
                  GM_log("Pack Filler Pro: Skipping initial updatePanelVisibility because panel elements were not found.");
             }
             applyDarkMode(config, config.isDarkMode); // Apply dark mode based on loaded config
             GM_log("Pack Filler Pro: Initial config applied to UI.");
        } else {
             const errorMessage = "UI state management functions not found (loadConfigIntoUI, etc.). UI may not be correctly initialized.";
             GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
              if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', errorMessage, 'error', config);
             // Script can continue, but UI state might be incorrect.
        }


        // 8. Bind Events
        // Calls the bindPanelEvents function from src/uiManager.js, passing the config object
        // Assumes bindPanelEvents is available from uiManager.js and config is available.
        if (typeof bindPanelEvents === 'function') {
             bindPanelEvents(config); // Pass config here
             GM_log("Pack Filler Pro: UI events bound.");
        } else {
             const errorMessage = "bindPanelEvents function not found. UI events will not be bound.";
             GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
              if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('UI Error', errorMessage, 'error', config);
             // Script can continue, but UI will not be interactive.
        }


        // 9. Trigger Auto-load Full Page if enabled
        // Calls the loadFullPageIfNeeded function from src/pageLoader.js
        // Pass the config object explicitly to ensure it's available.
        // Assumes loadFullPageIfNeeded and getPackInputs are available.
        if (config.loadFullPage) {
            GM_log("Pack Filler Pro: Auto-load is enabled, scheduling loadFullPageIfNeeded.");
            if (typeof loadFullPageIfNeeded === 'function') {
                // Delay slightly to allow page rendering
                // Ensure config is passed correctly in the setTimeout callback
                setTimeout(() => loadFullPageIfNeeded(config), 300); // Pass config here
            } else {
                 const errorMessage = "loadFullPageIfNeeded function not found. Auto-loading will not run.";
                 GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
                  if(typeof SWAL_ALERT !== 'undefined') SWAL_ALERT('Auto-Load Error', errorMessage, 'error', config);
            }

        } else {
            GM_log("Pack Filler Pro: Auto-load is disabled.");
            // If not auto-loading, ensure the max count for the count input is set based on initially visible inputs
            // Uses $ from cash-dom and getPackInputs from src/domUtils.js
             if (typeof getPackInputs === 'function' && typeof $ === 'function') {
                $('#pfp-count').attr('max', getPackInputs().length);
                GM_log("Pack Filler Pro: Max count for input set based on initially visible inputs.");
             } else {
                 GM_log("Pack Filler Pro: getPackInputs or $ function not found. Could not set max count for input.");
             }
        }

        GM_log("Pack Filler Pro: Initialization complete.");
    }


    // --- Run Initialization ---
    // Use DOMContentLoaded to ensure the basic page structure is ready before initializing.
    // This is the actual trigger that starts the script's logic after the page loads.
    // Using a small delay (0ms) with setTimeout ensures this runs after the current
    // execution context finishes, which can sometimes help with environment quirks.
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(init, 0);
    });

    // Clean up the worker when the script is unloaded (e.g., page navigation)
    // Also disconnect MutationObservers stored globally.
    window.addEventListener('beforeunload', () => {
        if (patternWorker) {
            patternWorker.terminate();
            GM_log("Pack Filler Pro: Web Worker terminated on unload.");
        }
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
         GM_registerMenuCommand("Pack Filler Pro: Manual Init", init);
         GM_log("Pack Filler Pro: Registered manual initialization menu command.");
    } else {
         GM_log("Pack Filler Pro: GM_registerMenuCommand not available. Manual init command not registered.");
    }


})(); // End of IIFE
