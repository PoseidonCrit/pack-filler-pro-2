// This block contains the main initialization function that kicks off the script.
// It calls functions from other modules to set up the UI, load config, bind events,
// and trigger the auto-load if enabled.
// This would be the main entry point of the UserScript.

// Assumes all other functions and global variables (config, panelElement, toggleButtonElement,
// panelSimpleBarInstance, loadConfig, addPanelCSS, loadConfigIntoUI, updatePanelModeDisplay,
// updatePanelVisibility, applyDarkMode, bindPanelEvents, initDrag, loadFullPageIfNeeded,
// GM_info, GM_log, window.Swal, window.SimpleBar, $, PANEL_ID, TOGGLE_BUTTON_ID, getPackInputs)
// are accessible in this scope, potentially via @require directives.

/* --- Initialize Script --- */
function init() {
    GM_log(`Pack Filler Pro v${GM_info.script.version}: Initialization started.`);

    // 1. Essential Dependency Checks (Libraries)
    // Check if critical external libraries loaded correctly via @require.
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
    // Assumes loadConfig function is available (potentially from configManager.js)
    config = loadConfig();
    GM_log(`Pack Filler Pro: Config loaded. Auto-load full page: ${config.loadFullPage}, Dark Mode: ${config.isDarkMode}, Auto-fill loaded: ${config.autoFillLoaded}, Fill Empty Only: ${config.fillEmptyOnly}`);

    // 3. Add CSS
    // Assumes addPanelCSS function is available (potentially from uiCss.js)
    addPanelCSS();

    // 4. Add Panel HTML to DOM and get element references
    document.body.insertAdjacentHTML('beforeend', panelHTML); // Assumes panelHTML is accessible
    document.body.insertAdjacentHTML('beforeend', panelToggleHTML); // Assumes panelToggleHTML is accessible

    panelElement = document.getElementById(PANEL_ID); // Assumes PANEL_ID is accessible
    toggleButtonElement = document.getElementById(TOGGLE_BUTTON_ID); // Assumes TOGGLE_BUTTON_ID is accessible

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
    // Check if SimpleBar library is available and initialize if the panel body exists.
    const panelBodyEl = panelElement.querySelector('.pfp-body');
    if (panelBodyEl && typeof window.SimpleBar !== 'undefined') {
        panelSimpleBarInstance = new window.SimpleBar(panelBodyEl); // Assumes panelSimpleBarInstance is accessible
        GM_log("Pack Filler Pro: SimpleBar initialized.");
    } else {
        GM_log("Pack Filler Pro: SimpleBar library not available or panel body not found. Using native scrollbar.");
        panelSimpleBarInstance = null;
    }


    // 6. Apply Initial Configuration to UI and State
    // Assumes loadConfigIntoUI, updatePanelModeDisplay, updatePanelVisibility, applyDarkMode are accessible
    loadConfigIntoUI();
    updatePanelModeDisplay(config.lastMode);
    // Pass the initial position from config when setting initial visibility
    updatePanelVisibility(config.panelVisible, config.panelPos);
    applyDarkMode(config.isDarkMode);


    // 7. Bind Events
    // Assumes bindPanelEvents function is available (potentially from uiManager.js)
    bindPanelEvents();


    // 8. Initialize Drag Functionality (Optional)
    // Check if interactjs library is available before initializing drag.
    if (typeof window.interact !== 'undefined') {
         // Assumes initDrag function is available (potentially from dragHandler.js)
         initDrag(panelElement);
    } else {
        GM_log("Pack Filler Pro: interactjs library not available. Drag functionality disabled.");
    }


    // 9. Trigger Auto-load Full Page if enabled
    // Assumes loadFullPageIfNeeded function is available (potentially from pageLoader.js)
    if (config.loadFullPage) {
        // Delay slightly to allow page rendering
        setTimeout(() => loadFullPageIfNeeded(), 300);
    } else {
        // If not auto-loading, ensure the max count for the count input is set based on initially visible inputs
        // Assumes '$' and getPackInputs are accessible
        $('#pfp-count').attr('max', getPackInputs().length);
    }


    GM_log("Pack Filler Pro: Initialization complete.");
}


// --- Run Initialization ---
// Use DOMContentLoaded to ensure the basic page structure is ready before initializing.
document.addEventListener('DOMContentLoaded', init);

})(); // End of IIFE
