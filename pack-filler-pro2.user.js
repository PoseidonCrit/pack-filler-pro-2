// ==UserScript==
// @name         🎴F105.27 Pack Filler Pro – Sleek Edition
// @namespace    https://ygoprodeck.com
// @version      🎴F105.27
// @description  Enhanced UI and options for YGOPRODeck Pack Simulator, automatically loads all packs on load via scrolling, with advanced fill patterns.
// @match        https://ygoprodeck.com/pack-sim/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @require      https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/sweetalert2/11.10.8/sweetalert2.min.js
// @require      https://unpkg.com/sweetalert2@11.10.8/dist/sweetalert2.min.js
// // @require      https://cdn.jsdelivr.net/npm/simplebar@6.3.8/dist/simplebar.min.js // Uncomment if needed if using simplebar

// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/constants.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/configManager.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/domUtils.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/swalHelpers.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/fillLogic.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/pageLoader.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiCss.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiManager.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/patternWorker.js

// ==/UserScript==

// This is the main entry point file for the UserScript.
// It contains the header, the main IIFE wrapper, the init function,
// and the event listener to start the script.
// All other functionalities are loaded via @require directives from the src/ folder.

(function() {
    'use strict';

    // Declare variables that will be populated during initialization.
    // 'config' is declared here and will hold the loaded configuration object.
    // panelElement, toggleButtonElement, panelSimpleBarInstance are also declared here.
    // These are declared in constants.js now and will be available here.

    // Declare the Web Worker instance
    let patternWorker;

    /* --- Initialize Script --- */
    // This function orchestrates the startup of the script.
    function init() {
        GM_log(`Pack Filler Pro v${GM_info.script.version}: Initialization started.`);

        // 1. Essential Dependency Checks (Libraries)
        // Check if critical external libraries loaded correctly via @require.
        // These checks are important because the script relies heavily on them.
        if (typeof window.cash === 'undefined') {
            const errorMessage = "Cash-dom library not found. Please check @require directives. Script cannot run.";
            GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
            alert(`Pack Filler Pro Error: ${errorMessage}`);
            return;
        }
         if (typeof window.Swal === 'undefined') {
            const errorMessage = "SweetAlert2 library not found. Please check @require directives. Script cannot run.";
            GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
            alert(`Pack Filler Pro Error: ${errorMessage}`);
            return;
        }
        GM_log("Pack Filler Pro: Essential libraries (cash-dom, SweetAlert2) found.");

        // 2. Initialize Web Worker
        // Check if the Worker class is available and if the worker code string is available.
        // 'workerCode' is the variable name exported from patternWorker.js due to @require.
        if (typeof Worker !== 'undefined' && typeof workerCode !== 'undefined') {
            try {
                 const blob = new Blob([workerCode], { type: 'application/javascript' });
                 const blobUrl = URL.createObjectURL(blob);
                 patternWorker = new Worker(blobUrl);
                 GM_log("Pack Filler Pro: Web Worker initialized successfully.");

                 // Listen for messages from the worker
                 patternWorker.onmessage = (e) => {
                      if (e.data && e.data.type === 'log') {
                           // Handle log messages from the worker
                           GM_log("Pack Filler Pro Worker Log:", ...e.data.data);
                      }
                      // Other message types (like 'result') are handled in fillLogic.js
                 };

                 patternWorker.onerror = (error) => {
                      GM_log("Pack Filler Pro: Web Worker failed to initialize or encountered an error.", error);
                      // Handle worker errors, potentially disable pattern features or show a warning
                      SWAL_TOAST('Pattern Worker Error: Pattern features may be disabled.', 'error', config); // Use config if available
                 };

            } catch (e) {
                 GM_log("Pack Filler Pro: Failed to initialize Web Worker.", e);
                 patternWorker = null; // Ensure worker is null if initialization fails
                 SWAL_TOAST('Pattern Worker Init Failed: Pattern features may be disabled.', 'error', config); // Use config if available
            }
        } else {
            GM_log("Pack Filler Pro: Web Worker API or workerCode not available. Pattern features will run on main thread.");
            patternWorker = null; // Ensure worker is null if not supported/loaded
        }


        // 3. Load Configuration
        GM_log("Pack Filler Pro: Attempting to load config."); // Debugging log
        // Calls the loadConfig function from src/configManager.js
        // Assign the returned config object to the 'config' variable in this scope.
        config = loadConfig();
        GM_log("Pack Filler Pro: loadConfig returned and assigned to 'config':", config); // Debugging log


        // Add a check to ensure config is valid after loading
        if (!config || typeof config.loadFullPage === 'undefined') {
             const errorMessage = "Failed to load configuration or config structure is invalid. Script cannot run correctly.";
             GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
             alert(`Pack Filler Pro Error: ${errorMessage}`);
             return; // Stop initialization if config is bad
        }

        GM_log(`Pack Filler Pro: Config loaded. Auto-load full page: ${config.loadFullPage}, Panel Visible: ${config.panelVisible}, Auto-fill loaded: ${config.autoFillLoaded}, Fill Empty Only: ${config.fillEmptyOnly}, Scroll to Bottom: ${config.scrollToBottomAfterLoad}, Dark Mode: ${config.isDarkMode}, Pattern Type: ${config.patternType}, Pattern Scale: ${config.patternScale}, Pattern Intensity: ${config.patternIntensity}`);

        // 4. Add CSS
        // Calls the addPanelCSS function from src/uiCss.js
        addPanelCSS();

        // 5. Add Panel HTML to DOM and get element references
        // Uses panelHTML and panelToggleHTML from src/uiCss.js
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        document.body.insertAdjacentHTML('beforeend', panelToggleHTML);

        // Get references to the main panel and toggle button elements
        // Uses PANEL_ID and TOGGLE_BUTTON_ID from src/constants.js
        panelElement = document.getElementById(PANEL_ID);
        toggleButtonElement = document.getElementById(TOGGLE_BUTTON_ID);

        // Check if UI elements were successfully added
        if (!panelElement) {
            const errorMessage = `Main panel element (#${PANEL_ID}) not found after insertion. Script cannot run.`;
            GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
            alert(`Pack Filler Pro Error: ${errorMessage}`);
            return;
        }
         if (!toggleButtonElement) {
            const errorMessage = `Toggle button element (#${TOGGLE_BUTTON_ID}) not found after insertion. Script cannot run.`;
            GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
            alert(`Pack Filler Pro Error: ${errorMessage}`);
            return;
        }
        GM_log("Pack Filler Pro: UI elements added to DOM.");


        // 6. Initialize SimpleBar (Custom Scrollbar - Optional)
        // Check if SimpleBar library is available before initializing.
        const panelBodyEl = panelElement.querySelector('.pfp-body');
        if (panelBodyEl && typeof window.SimpleBar !== 'undefined') {
            panelSimpleBarInstance = new window.SimpleBar(panelBodyEl);
            GM_log("Pack Filler Pro: SimpleBar initialized.");
        } else {
            GM_log("Pack Filler Pro: SimpleBar library not available or panel body not found. Using native scrollbar.");
            panelSimpleBarInstance = null;
        }


        // 7. Apply Initial Configuration to UI and State
        // Calls functions from src/uiManager.js, passing the config object
        loadConfigIntoUI(config); // Pass config here
        updatePanelModeDisplay(config.lastMode); // Pass mode from config
        // Pass the initial position from config when setting initial visibility
        updatePanelVisibility(config, config.panelVisible, config.panelPos); // Pass config here
        applyDarkMode(config, config.isDarkMode); // Apply dark mode based on loaded config


        // 8. Bind Events
        // Calls the bindPanelEvents function from src/uiManager.js, passing the config object
        bindPanelEvents(config); // Pass config here


        // 9. Trigger Auto-load Full Page if enabled
        // Calls the loadFullPageIfNeeded function from src/pageLoader.js
        // Pass the config object explicitly to ensure it's available.
        if (config.loadFullPage) {
            GM_log("Pack Filler Pro: Auto-load is enabled, scheduling loadFullPageIfNeeded."); // Debugging log
            // Delay slightly to allow page rendering
            // Ensure config is passed correctly in the setTimeout callback
            setTimeout(() => loadFullPageIfNeeded(config), 300); // Pass config here
        } else {
            GM_log("Pack Filler Pro: Auto-load is disabled."); // Debugging log
            // If not auto-loading, ensure the max count for the count input is set based on initially visible inputs
            // Uses $ from cash-dom and getPackInputs from src/domUtils.js
            $('#pfp-count').attr('max', getPackInputs().length);
        }


        GM_log("Pack Filler Pro: Initialization complete."); // Debugging log
    }


    // --- Run Initialization ---
    // Use DOMContentLoaded to ensure the basic page structure is ready before initializing.
    // This is the actual trigger that starts the script's logic after the page loads.
    document.addEventListener('DOMContentLoaded', init);

    // Clean up the worker when the script is unloaded (e.g., page navigation)
    window.addEventListener('beforeunload', () => {
        if (patternWorker) {
            patternWorker.terminate();
            GM_log("Pack Filler Pro: Web Worker terminated.");
        }
         // Disconnect MutationObservers if they are stored globally
         if (window._pfpSwalObserver) {
              window._pfpSwalObserver.disconnect();
              delete window._pfpSwalObserver;
              GM_log("Pack Filler Pro: SweetAlert2 popup observer disconnected.");
         }
         // Add disconnection for the main input observer if stored globally
         // (Currently, the main input observer is local to bindPanelEvents, might need adjustment)
    });


})(); // End of IIFE

