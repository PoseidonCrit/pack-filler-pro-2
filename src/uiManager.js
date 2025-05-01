// This file handles updating the UI based on config, updating config from UI,
// and binding event listeners to UI elements.
// It relies heavily on the cash-dom library ($).

// It assumes the following are available in the main script's scope via @require:
// - $ from cash-dom
// - panelElement, toggleButtonElement, panelSimpleBarInstance (variables populated in main script)
// - functions from fillLogic.js (fillPacks, fillRandomPackInput)
// - functions from domUtils.js (clearAllInputs, getPackInputs, clamp)
// - functions from configManager.js (debouncedSaveConfig)
// - functions from swalHelpers.js (SWAL_ALERT, SWAL_TOAST)
// - constants from constants.js (SELECTOR, FULL_PAGE_CHECKBOX_ID, etc.)
// - GM_log function
// - MutationObserver API
// - window.Swal (SweetAlert2 instance)

/* --- UI Event Binding --- */
/**
 * Binds event listeners to the UI panel elements.
 * Assumes necessary DOM elements and functions from other modules are available in scope.
 * Includes robustness checks for dependencies.
 * @param {object} config - The script's configuration object.
 */
function bindPanelEvents(config) { // Accept config here
    GM_log("Pack Filler Pro: bindPanelEvents started.");

    // Check if critical DOM elements and core functions are available before binding events
    if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement ||
        typeof fillPacks !== 'function' || typeof clearAllInputs !== 'function' ||
        typeof updateConfigFromUI !== 'function' || typeof debouncedSaveConfig !== 'function' ||
        typeof updatePanelModeDisplay !== 'function' || typeof updatePanelVisibility !== 'function' ||
        typeof applyDarkMode !== 'function' || typeof getPackInputs !== 'function' ||
        typeof SELECTOR === 'undefined') {

        const errorMessage = "Critical UI binding dependencies missing. UI events will not be bound.";
        GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
        // Use fallback alert if SWAL_ALERT is not available
        if (typeof SWAL_ALERT === 'function') SWAL_ALERT('UI Binding Error', errorMessage, 'error', config);
        else alert(`Pack Filler Pro Error: ${errorMessage}`);
        return; // Abort binding if critical dependencies are missing
    }


    // Fill Packs Button
    // Assumes fillPacks, updateConfigFromUI, debouncedSaveConfig are available
    $('#pfp-run').on('click', async () => { // Make async to await fillPacks
        GM_log("Pack Filler Pro: 'Fill Packs' button clicked.");
        try {
            // Ensure config is updated from UI before filling
            updateConfigFromUI(config); // Pass config
            debouncedSaveConfig(config); // Save config immediately on manual trig
