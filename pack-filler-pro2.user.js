// ==UserScript==
// @name         🎴F105.25 Pack Filler Pro – Sleek Edition
// @namespace    https://ygoprodeck.com
// @version      🎴F105.25
// @description  Enhanced UI and options for YGOPRODeck Pack Simulator, automatically loads all packs on load via scrolling.
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
// // @require      https://cdn.jsdelivr.net/npm/interactjs@2/dist/interact.min.js // Uncomment if needed if using drag
// // @require      https://cdn.jsdelivr.net/npm/simplebar@6.3.8/dist/simplebar.min.js // Uncomment if needed if using simplebar

// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/constants.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/configManager.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/domUtils.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/swalHelpers.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/fillLogic.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/pageLoader.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiCss.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/uiManager.js
// @require      https://raw.githubusercontent.com/PoseidonCrit/pack-filler-pro-2/refs/heads/main/src/dragHandler.js // Uncomment if needed if using drag

// ==/UserScript==

// This is the main entry point file for the UserScript.
// It contains the header, the main IIFE wrapper, the init function,
// and the event listener to start the script.
// All other functionalities are loaded via @require directives from the src/ folder.

(function() {
    'use strict';

    // Declare global variables that will be populated by required modules
    // or used across modules. These are declared here to make it explicit
    // that they are part of the shared scope.
    // Note: In a more complex setup, you might use a namespace object
    // (e.g., window.PFP = {};) to avoid polluting the global scope directly.
    // For UserScripts and simplicity, direct declaration in the IIFE is common.
    let config; // Will be populated by loadConfig from configManager.js
    let panelElement; // Will be populated after adding panel HTML
    let toggleButtonElement; // Will be populated after adding toggle button HTML
    let panelSimpleBarInstance = null; // Will be populated if SimpleBar is used and available

    // Assumes constants like $, SELECTOR, MAX_QTY, PANEL_ID, etc.
    // are defined in src/constants.js and available here due to @require.

    // Assumes functions like loadConfig, saveConfig, debouncedSaveConfig
    // are defined in src/configManager.js and available here due to @require.

    // Assumes functions like getPackInputs, clamp, updateInput, clearAllInputs
    // are defined in src/domUtils.js and available here due to @require.

    // Assumes functions like SWAL_ALERT, SWAL_TOAST
    // are defined in src/swalHelpers.js and available here due to @require.

    // Assumes functions like calculateFillCount, chooseQuantity, distribute, fillPacks
    // are defined in src/fillLogic.js and available here due to @require.

    // Assumes functions like loadFullPageIfNeeded
    // are defined in src/pageLoader.js and available here due to @require.

    // Assumes functions like addPanelCSS, panelHTML, panelToggleHTML
    // are defined in src/uiCss.js and available here due to @require.

    // Assumes functions like bindPanelEvents, updatePanelModeDisplay, updatePanelVisibility,
    // loadConfigIntoUI, updateConfigFromUI, applyDarkMode
    // are defined in src/uiManager.js and available here due to @require.

    // Assumes function initDrag is defined in src/dragHandler.js and available here due to @require.


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


        // 2. Load Configuration
        // Calls the loadConfig function from src/configManager.js
        // Ensure config is assigned before proceeding.
        config = loadConfig();

        // Add a check to ensure config is valid after loading
        if (!config || typeof config.loadFullPage === 'undefined') {
             const errorMessage = "Failed to load configuration. Script cannot run correctly.";
             GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
             alert(`Pack Filler Pro Error: ${errorMessage}`);
             return; // Stop initialization if config is bad
        }

        GM_log(`Pack Filler Pro: Config loaded. Auto-load full page: ${config.loadFullPage}, Dark Mode: ${config.isDarkMode}, Auto-fill loaded: ${config.autoFillLoaded}, Fill Empty Only: ${config.fillEmptyOnly}`);

        // 3. Add CSS
        // Calls the addPanelCSS function from src/uiCss.js
        addPanelCSS();

        // 4. Add Panel HTML to DOM and get element references
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


        // 5. Initialize SimpleBar (Custom Scrollbar - Optional)
        // Check if SimpleBar library is available before initializing.
        const panelBodyEl = panelElement.querySelector('.pfp-body');
        if (panelBodyEl && typeof window.SimpleBar !== 'undefined') {
            panelSimpleBarInstance = new window.SimpleBar(panelBodyEl);
            GM_log("Pack Filler Pro: SimpleBar initialized.");
        } else {
            GM_log("Pack Filler Pro: SimpleBar library not available or panel body not found. Using native scrollbar.");
            panelSimpleBarInstance = null;
        }


        // 6. Apply Initial Configuration to UI and State
        // Calls functions from src/uiManager.js
        loadConfigIntoUI();
        updatePanelModeDisplay(config.lastMode);
        // Pass the initial position from config when setting initial visibility
        updatePanelVisibility(config.panelVisible, config.panelPos);
        applyDarkMode(config.isDarkMode);


        // 7. Bind Events
        // Calls the bindPanelEvents function from src/uiManager.js
        bindPanelEvents();


        // 8. Initialize Drag Functionality (Optional)
        // Check if interactjs library is available before initializing drag.
        if (typeof window.interact !== 'undefined') {
             // Calls the initDrag function from src/dragHandler.js
             initDrag(panelElement);
        } else {
            GM_log("Pack Filler Pro: interactjs library not available. Drag functionality disabled.");
        }


        // 9. Trigger Auto-load Full Page if enabled
        // Calls the loadFullPageIfNeeded function from src/pageLoader.js
        // Pass the config object explicitly to ensure it's available.
        if (config.loadFullPage) {
            // Delay slightly to allow page rendering
            setTimeout(() => loadFullPageIfNeeded(config), 300); // Pass config here
        } else {
            // If not auto-loading, ensure the max count for the count input is set based on initially visible inputs
            // Uses $ from cash-dom and getPackInputs from src/domUtils.js
            $('#pfp-count').attr('max', getPackInputs().length);
        }


        GM_log("Pack Filler Pro: Initialization complete.");
    }


    // --- Run Initialization ---
    // Use DOMContentLoaded to ensure the basic page structure is ready before initializing.
    // This is the actual trigger that starts the script's logic after the page loads.
    document.addEventListener('DOMContentLoaded', init);

})(); // End of IIFE
