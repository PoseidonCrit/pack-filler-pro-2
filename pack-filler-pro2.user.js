// ==UserScript==
// @name          🎴F105.32 Pack Filler Pro – Sleek Edition (Revised)
// @namespace     https://ygoprodeck.com
// @version       🎴F105.32-rev1
// @description   Enhanced UI/options for YGOPRODeck Pack Sim, loads all packs, advanced fill patterns, security/reliability fixes.
// @match         https://ygoprodeck.com/pack-sim/*
// @grant         GM_addStyle
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_log
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require       https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js
// @require       https://unpkg.com/sweetalert2@11.10.8/dist/sweetalert2.min.js // Redundant? Keep one Swal require.
// // @require    https://cdn.jsdelivr.net/npm/simplebar@latest/dist/simplebar.min.js // Uncomment if simplebar needed

// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/constants.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/configManager.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/domUtils.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/swalHelpers.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/patternWorker.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/fillLogic.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/pageLoader.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/uiCss.js
// @require       https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/uiManager.js
// // @require    https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/REPLACE_WITH_CORRECT_COMMIT_HASH/src/dragHandler.js // Uncomment if adding drag

// ==/UserScript==

// Note: Replace REPL...HASH above with the actual commit hash or branch name where these files reside.

(function() {
    'use strict';

    // Global variables populated during initialization are now declared in constants.js
    // (config, panelElement, toggleButtonElement, panelSimpleBarInstance, patternWorker)

    /**
     * Initialize the script.
     */
    function init() {
        GM_log(`Pack Filler Pro v${GM_info.script.version}: Initialization started.`);

        // 1. Essential Dependency Checks
        if (typeof $ === 'undefined' || typeof window.cash === 'undefined') { // Check cash-dom ($)
            alert("Pack Filler Pro Error: Cash-dom library not found. Script cannot run.");
            return;
        }
        if (typeof Swal === 'undefined') { // Check SweetAlert2 (Swal)
            alert("Pack Filler Pro Error: SweetAlert2 library not found. Script cannot run.");
            return;
        }
        GM_log("Pack Filler Pro: Essential libraries found.");

        // 2. Load Configuration
        config = loadConfig(); // Load config using function from configManager.js
        GM_log("Pack Filler Pro: Config loaded:", config);

        // 3. Initialize Web Worker (Persistent)
        if (typeof Worker !== 'undefined' && typeof workerCode !== 'undefined') {
            try {
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                patternWorker = new Worker(blobUrl); // Assign to the global variable
                GM_log("Pack Filler Pro: Persistent Web Worker created.");

                // Setup the main message/error handlers for the worker instance
                setupWorkerMessageHandler(); // Use helper from fillLogic.js

            } catch (e) {
                GM_log("Pack Filler Pro: Failed to initialize Web Worker.", e);
                patternWorker = null; // Ensure worker is null if init fails
                SWAL_ALERT("Worker Init Failed", `Could not create pattern worker: ${e.message}. Pattern features may be disabled.`, 'error', config);
            }
        } else {
            GM_log("Pack Filler Pro: Web Worker API or workerCode not available. Pattern features requiring worker are disabled.");
            patternWorker = null;
        }

        // 4. Add CSS
        addPanelCSS(); // From uiCss.js

        // 5. Add Panel HTML to DOM and get element references
        document.body.insertAdjacentHTML('beforeend', panelHTML); // From uiCss.js
        document.body.insertAdjacentHTML('beforeend', panelToggleHTML); // From uiCss.js

        panelElement = document.getElementById(PANEL_ID); // From constants.js
        toggleButtonElement = document.getElementById(TOGGLE_BUTTON_ID); // From constants.js

        if (!panelElement || !toggleButtonElement) {
             const missing = !panelElement ? `#${PANEL_ID}` : `#${TOGGLE_BUTTON_ID}`;
             alert(`Pack Filler Pro Error: UI element (${missing}) not found after insertion. Script cannot run.`);
             return;
        }
        GM_log("Pack Filler Pro: UI elements added to DOM.");

        // 6. Initialize SimpleBar (Optional Custom Scrollbar)
        const panelBodyEl = panelElement.querySelector('.pfp-body');
        // Check if SimpleBar is loaded (uncomment @require if needed)
        if (panelBodyEl && typeof SimpleBar !== 'undefined') {
             try {
                  panelSimpleBarInstance = new SimpleBar(panelBodyEl);
                  GM_log("Pack Filler Pro: SimpleBar initialized.");
             } catch (e) {
                  GM_log("Pack Filler Pro: SimpleBar initialization failed.", e);
                  panelSimpleBarInstance = null;
             }
        } else {
             GM_log("Pack Filler Pro: SimpleBar library not available or panel body not found. Using native scrollbar.");
             panelSimpleBarInstance = null;
        }

        // 7. Load Config into UI & Apply Initial State
        loadConfigIntoUI(config); // From uiManager.js (includes applying mode display, theme, visibility, position)

        // 8. Bind Events
        bindPanelEvents(config); // From uiManager.js

        // 9. Trigger Auto-load Full Page if enabled
        if (config.loadFullPage) {
            GM_log("Pack Filler Pro: Auto-load enabled, scheduling loadFullPageIfNeeded.");
            // Delay slightly to allow page rendering and observers to attach
            setTimeout(() => loadFullPageIfNeeded(config), 500); // Pass config to pageLoader.js function
        } else {
            GM_log("Pack Filler Pro: Auto-load is disabled.");
            // Ensure max count is set initially if not auto-loading
            $('#pfp-count').attr('max', getPackInputs().length);
        }

        // 10. Optional: Initialize Drag Handler (Uncomment @require if needed)
        /*
        if (typeof initDrag === 'function') {
             initDrag(panelElement); // From dragHandler.js
        }
        */

        GM_log("Pack Filler Pro: Initialization complete.");
    }


    // --- Run Initialization ---
    // Use DOMContentLoaded to ensure the basic page structure is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOMContentLoaded has already fired
        init();
    }

    // --- Cleanup ---
    // Terminate worker and disconnect observers on page unload
    window.addEventListener('beforeunload', () => {
        if (patternWorker) {
            patternWorker.terminate();
            GM_log("Pack Filler Pro: Web Worker terminated.");
            patternWorker = null;
        }
        // Disconnect MutationObservers if stored globally (currently local/scoped)
        // Example: if (window._pfpListObserver) window._pfpListObserver.disconnect();
        // Example: if (window._pfpSwalObserver) window._pfpSwalObserver.disconnect();
        GM_log("Pack Filler Pro: Page unloading.");
    });

})(); // End of IIFE
