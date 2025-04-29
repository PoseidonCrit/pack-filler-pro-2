// This file handles updating the UI based on config, updating config from UI,
// and binding event listeners to UI elements.
// It relies heavily on the cash-dom library ($).
// Note: This module now accepts the 'config' object as a parameter where needed.
// It also includes the MutationObserver for dynamic updates.

// It assumes '$' from cash-dom, 'panelElement', 'toggleButtonElement',
// 'panelSimpleBarInstance' from the main script's scope or src/constants.js,
// 'fillPacks' from src/fillLogic.js,
// 'clearAllInputs' from src/domUtils.js,
// 'debouncedSaveConfig' from src/configManager.js,
// 'getPackInputs' from src/domUtils.js,
// 'SELECTOR', 'FULL_PAGE_CHECKBOX_ID',
// 'AUTO_FILL_LOADED_CHECKBOX_ID', 'FILL_EMPTY_ONLY_CHECKBOX_ID',
// 'MAX_TOTAL_INPUT_ID', 'SCROLL_TO_BOTTOM_CHECKBOX_ID', DARK_MODE_CHECKBOX_ID
// from src/constants.js,
// and GM_log are available via @require.

/* --- UI Event Binding --- */
/**
 * Binds event listeners to the UI panel elements.
 * @param {object} config - The script's configuration object.
 */
function bindPanelEvents(config) { // Accept config here
    GM_log("Pack Filler Pro: bindPanelEvents started."); // Debugging log

    // Assumes $, panelElement, toggleButtonElement are available

    // Fill Packs Button
    $('#pfp-run').on('click', () => {
        GM_log("Pack Filler Pro: 'Fill Packs' button clicked."); // Debugging log
        fillPacks(config); // Pass config
    });

    // Clear All Button
    $('#pfp-clear-btn').on('click', () => {
        GM_log("Pack Filler Pro: 'Clear All' button clicked."); // Debugging log
        clearAllInputs(); // Uses clearAllInputs from src/domUtils.js
    });

    // Mode Selection Change
    $('#pfp-mode').on('change', function() {
        GM_log(`Pack Filler Pro: Mode changed to ${this.value}.`); // Debugging log
        updatePanelModeDisplay(this.value); // Uses updatePanelModeDisplay from this file
        updateConfigFromUI(config); // Pass config
        debouncedSaveConfig(config); // Pass config
    });

    // Input/Checkbox/Select Changes (Debounced Save)
    $(panelElement).on('input change', '.pfp-input, .pfp-select, .pfp-checkbox', function(e) {
        GM_log(`Pack Filler Pro: Input/Change event on element ID: ${e.target.id}, Value: ${e.target.value || e.target.checked}`); // Debugging log
        updateConfigFromUI(config); // Pass config
        debouncedSaveConfig(config); // Pass config

        // Dark Mode toggle logic
        if (e.target.id === DARK_MODE_CHECKBOX_ID) { // Uses DARK_MODE_CHECKBOX_ID from src/constants.js
            applyDarkMode(config, e.target.checked); // Pass config
        }
    });


    // Panel Close Button
    $(panelElement).find('.pfp-close').on('click', () => {
        GM_log("Pack Filler Pro: Panel close button clicked."); // Debugging log
        updatePanelVisibility(config, false); // Pass config
    });

    // Toggle Button
    $(toggleButtonElement).on('click', () => {
        GM_log("Pack Filler Pro: Toggle button clicked."); // Debugging log
        updatePanelVisibility(config, true); // Pass config
    });

    // MutationObserver to update max count and simplebar when inputs are added
     const observer = new MutationObserver((mutationsList, observer) => {
         let inputsAdded = false;
         for(const mutation of mutationsList) {
             if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                 // Check if any of the added nodes contain our input selector
                 inputsAdded = Array.from(mutation.addedNodes).some(node =>
                      node.nodeType === 1 && (node.matches(SELECTOR) || node.querySelector(SELECTOR)) // Uses SELECTOR from src/constants.js
                 );
                 if (inputsAdded) break;
             }
         }

         if (inputsAdded) {
             const currentInputCount = getPackInputs().length; // Uses getPackInputs from src/domUtils.js
             $('#pfp-count').attr('max', currentInputCount); // Uses $ from cash-dom
             GM_log(`Pack Filler Pro: Detected new inputs via MutationObserver. Updated count max to ${currentInputCount}.`); // Assumes GM_log is available
             if (panelSimpleBarInstance) { // Assumes panelSimpleBarInstance is available
                 panelSimpleBarInstance.recalculate();
             }
         }
     });

     const packsContainer = document.querySelector('.pack-list') || document.body;
     if(packsContainer) {
          observer.observe(packsContainer, { childList: true, subtree: true });
          GM_log(`Pack Filler Pro: Observing "${packsContainer.tagName}" for new inputs.`);
     } else {
          GM_log(`Pack Filler Pro: Could not find a container to observe for new inputs.`);
     }

     GM_log("Pack Filler Pro: bindPanelEvents finished."); // Debugging log
}


/* --- UI State Management --- */
// Uses $ (cash-dom) for brevity
// Updates the visibility of input groups based on the selected mode.
function updatePanelModeDisplay(mode) {
    const isFixed = mode === 'fixed';
    const isRandom = mode === 'max';
    const isUnlimited = mode === 'unlimited';

    $('#pfp-count-group').toggle(isFixed || isRandom);
    $('#pfp-fixed-group').toggle(isFixed || isUnlimited);
    $('#pfp-range-inputs').toggle(isRandom);
}

// Uses $ (cash-dom) for brevity
// Updates the visibility of the panel and saves the visibility state.
// Can also apply a specific position and save it.
// Assumes panelElement, toggleButtonElement, panelSimpleBarInstance,
// and debouncedSaveConfig are available.
/**
 * Updates the visibility of the panel and saves the visibility/position state.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isVisible - Whether the panel should be visible.
 * @param {object} [position=null] - Optional position object {top, right, bottom, left} to apply.
 */
function updatePanelVisibility(config, isVisible, position = null) { // Accept config here
    if (!panelElement || !toggleButtonElement) return;

    $(panelElement).toggleClass('hidden', !isVisible);
    $(toggleButtonElement).toggleClass('hidden', isVisible);
    config.panelVisible = isVisible; // Uses 'config'

    if (isVisible && panelSimpleBarInstance) {
        panelSimpleBarInstance.recalculate();
    }

    if (position) {
        // Clear previous positioning properties before applying new ones
        $(panelElement).css({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
        $(panelElement).css(position); // Apply position using $().css
        config.panelPos = { // Save the applied CSS values
            top: panelElement.style.top,
            bottom: panelElement.style.bottom,
            left: panelElement.style.left,
            right: panelElement.style.right
        };
    }
    debouncedSaveConfig(config); // Pass config
}

// Uses $ (cash-dom) for brevity
// Loads the saved configuration values into the UI elements.
// Assumes panelElement, DEFAULT_CONFIG, FULL_PAGE_CHECKBOX_ID,
// MAX_TOTAL_INPUT_ID, AUTO_FILL_LOADED_CHECKBOX_ID, FILL_EMPTY_ONLY_CHECKBOX_ID,
// SCROLL_TO_BOTTOM_CHECKBOX_ID, DARK_MODE_CHECKBOX_ID are available.
/**
 * Loads the saved configuration values into the UI elements.
 * @param {object} config - The script's configuration object.
 */
function loadConfigIntoUI(config) { // Accept config here
    if (!panelElement) return;

    $('#pfp-mode').val(config.lastMode);
    $('#pfp-count').val(config.lastCount);
    $('#pfp-fixed').val(config.lastFixedQty);
    $('#pfp-min').val(config.lastMinQty);
    $('#pfp-max').val(config.lastMaxQty);
    $('#pfp-clear').prop('checked', config.lastClear);
    $(`#${FULL_PAGE_CHECKBOX_ID}`).prop('checked', config.loadFullPage);
    $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode); // Re-added Dark Mode
    $(`#${MAX_TOTAL_INPUT_ID}`).val(config.maxTotalAmount);
    $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).prop('checked', config.autoFillLoaded);
    $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).prop('checked', config.fillEmptyOnly);
    // Load state for the new checkbox
    $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).prop('checked', config.scrollToBottomAfterLoad);


    // Apply initial panel position from config
    // Clear previous positioning properties before applying new ones
    $(panelElement).css({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
    $(panelElement).css(config.panelPos); // Apply position using $().css

    GM_log("Pack Filler Pro: UI loaded from config."); // Assumes GM_log is available
}

// Uses $ (cash-dom) for brevity
// Updates the 'config' object based on the current values in the UI elements.
// Assumes panelElement, DEFAULT_CONFIG, MAX_QTY, clamp,
// FULL_PAGE_CHECKBOX_ID, AUTO_FILL_LOADED_CHECKBOX_ID, FILL_EMPTY_ONLY_CHECKBOX_ID,
// MAX_TOTAL_INPUT_ID, SCROLL_TO_BOTTOM_CHECKBOX_ID, DARK_MODE_CHECKBOX_ID are available.
/**
 * Updates the config object based on the current UI state.
 * @param {object} config - The script's configuration object to update.
 */
function updateConfigFromUI(config) { // Accept config here
    if (!panelElement) return;

    config.lastMode = $('#pfp-mode').val() || DEFAULT_CONFIG.lastMode;
    config.lastCount = parseInt($('#pfp-count').val(), 10) || 0;
    config.lastFixedQty = parseInt($('#pfp-fixed').val(), 10) || 0;
    config.lastMinQty = parseInt($('#pfp-min').val(), 10) || 0;
    config.lastMaxQty = parseInt($('#pfp-max').val(), 10) || 0;
    config.lastClear = $('#pfp-clear').is(':checked');
    config.loadFullPage = $(`#${FULL_PAGE_CHECKBOX_ID}`).is(':checked');
    config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).is(':checked'); // Re-added Dark Mode
    config.maxTotalAmount = parseInt($(`#${MAX_TOTAL_INPUT_ID}`).val(), 10) || 0;
    config.autoFillLoaded = $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).is(':checked');
    config.fillEmptyOnly = $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).is(':checked');
    // Update state for the new checkbox
    config.scrollToBottomAfterLoad = $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).is(':checked');


    // Ensure quantities are within valid bounds after reading
    config.lastFixedQty = clamp(config.lastFixedQty, 0, MAX_QTY);
    config.lastMinQty = clamp(config.lastMinQty, 0, MAX_QTY);
    config.lastMaxQty = clamp(config.lastMaxQty, 0, MAX_QTY);
    // Ensure min <= max for random range
    if (config.lastMinQty > config.lastMaxQty) {
         [config.lastMinQty, config.lastMaxQty] = [config.lastMaxQty, config.lastMinQty];
    }
    config.maxTotalAmount = Math.max(0, config.maxTotalAmount);

    GM_log("Pack Filler Pro: Config updated from UI."); // Assumes GM_log is available
}

/**
 * Applies or removes the dark mode class to relevant elements.
 * @param {object} config - The script's configuration object.
 * @param {boolean} enable - Whether to enable or disable dark mode.
 */
function applyDarkMode(config, enable) { // Accept config here
    // Assumes panelElement is available
    if (!panelElement) return;

    // Apply dark mode class to the panel
    $(panelElement).toggleClass('dark-mode', enable);
    // Apply dark mode class to the toggle button (adjacent sibling)
    $(toggleButtonElement).toggleClass('dark-mode', enable);

    // Apply dark mode class to SweetAlert2 popups dynamically
    // SweetAlert2 adds popups directly to the body, so we observe the body
    const swalObserver = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && (node.classList.contains('swal2-popup') || node.classList.contains('swal2-toast-popup'))) {
                        $(node).toggleClass('dark-mode', enable);
                    }
                });
            }
        }
    });

    // Start observing the body for added SweetAlert2 popups
    // Use a global flag or check if observer is already running to avoid duplicates
    if (!window._pfpSwalObserver) {
         swalObserver.observe(document.body, { childList: true });
         window._pfpSwalObserver = swalObserver; // Store the observer instance
    } else {
         // If observer already exists, stop it, disconnect, and restart with the new mode
         window._pfpSwalObserver.disconnect();
         swalObserver.observe(document.body, { childList: true });
         window._pfpSwalObserver = swalObserver;
    }

    // Also apply to any existing SweetAlert2 popups that might be open
    $('.swal2-popup, .swal2-toast-popup').toggleClass('dark-mode', enable);

    config.isDarkMode = enable; // Update config state
    // No need to save config here, as the input/change listener already calls debouncedSaveConfig
}


// The functions updatePanelModeDisplay, updatePanelVisibility, loadConfigIntoUI,
// updateConfigFromUI, and applyDarkMode are made available to the main script's scope via @require.
