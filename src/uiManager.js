// This file handles updating the UI based on config, updating config from UI,
// and binding event listeners to UI elements.
// It relies heavily on the cash-dom library ($).
// Note: This module now accepts the 'config' object as a parameter where needed.
// It also includes the MutationObserver for dynamic updates.

// It assumes '$' from cash-dom, 'panelElement', 'toggleButtonElement',
// 'panelSimpleBarInstance' from the main script's scope or src/constants.js,
// 'fillPacks' from src/fillLogic.js,
// 'fillRandomPackInput' from src/fillLogic.js, // Added
// 'clearAllInputs' from src/domUtils.js,
// 'debouncedSaveConfig' from src/configManager.js,
// 'getPackInputs' from src/domUtils.js,
// 'SELECTOR', 'FULL_PAGE_CHECKBOX_ID',
// 'AUTO_FILL_LOADED_CHECKBOX_ID', 'FILL_EMPTY_ONLY_CHECKBOX_ID',
// 'MAX_TOTAL_INPUT_ID', 'SCROLL_TO_BOTTOM_CHECKBOX_ID', DARK_MODE_CHECKBOX_ID,
// PATTERN_TYPE_SELECT_ID, PATTERN_PARAMS_DIV_ID, NOISE_SEED_INPUT_ID,
// PATTERN_SCALE_INPUT_ID, PATTERN_INTENSITY_INPUT_ID,
// FILL_RANDOM_BTN_ID, CLICK_PAGE_RANDOM_BTN_ID, CLICK_PAGE_RANDOM_COUNT_ID // Added
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
    $('#pfp-run').on('click', async () => { // Make async to await fillPacks
        GM_log("Pack Filler Pro: 'Fill Packs' button clicked."); // Debugging log
        // Ensure config is updated from UI before filling
        updateConfigFromUI(config); // Pass config
        debouncedSaveConfig(config); // Save config immediately on manual trigger

        // --- Add Debugging Log Here ---
        GM_log("Pack Filler Pro: About to call fillPacks with config:", config); // Debugging log

        await fillPacks(config); // Pass config and await the async fillPacks
    });

    // Clear All Button
    $('#pfp-clear-btn').on('click', () => {
        GM_log("Pack Filler Pro: 'Clear All' button clicked."); // Debugging log
        clearAllInputs(); // Uses clearAllInputs from src/domUtils.js
    });

    // *** NEW: Fill 1 Random Pack Button ***
    $(`#${FILL_RANDOM_BTN_ID}`).on('click', async () => {
        GM_log("Pack Filler Pro: 'Fill 1 Random' button clicked.");
        updateConfigFromUI(config); // Ensure config has latest quantity settings
        // No need to save config just for this action as it's a one-off action
        await fillRandomPackInput(config); // Call the new function from fillLogic.js
    });

    // *** NEW: Click Page's Random Button ***
    $(`#${CLICK_PAGE_RANDOM_BTN_ID}`).on('click', () => {
        GM_log("Pack Filler Pro: 'Click Page Random' button clicked.");
        updateConfigFromUI(config); // Get latest count value
        debouncedSaveConfig(config); // Save count value if changed
        triggerPageRandomButton(config.clickPageRandomCount, config); // Call helper, pass config for SWAL
    });


    // Mode Selection Change
    $('#pfp-mode').on('change', function() {
        GM_log(`Pack Filler Pro: Mode changed to ${this.value}.`); // Debugging log
        updatePanelModeDisplay(this.value); // Uses updatePanelModeDisplay from this file
        updateConfigFromUI(config); // Pass config
        debouncedSaveConfig(config); // Pass config
    });

    // Pattern Type Selection Change
    $(`#${PATTERN_TYPE_SELECT_ID}`).on('change', function() {
        GM_log(`Pack Filler Pro: Pattern type changed to ${this.value}.`);
        updatePatternParamsDisplay(this.value); // New function to show/hide params
        updateConfigFromUI(config); // Update config with new pattern type
        debouncedSaveConfig(config); // Save config
    });

    // Update range value display for Pattern Scale
    $(`#${PATTERN_SCALE_INPUT_ID}`).on('input', function() {
        $('#pfp-pattern-scale-value').text($(this).val());
        // Config update and save handled by the general input/change listener below
    });

     // Update range value display for Pattern Intensity
    $(`#${PATTERN_INTENSITY_INPUT_ID}`).on('input', function() {
        // Convert range value (0-100) to a float (0.0-1.0)
        const intensityValue = (parseInt($(this).val(), 10) / 100).toFixed(2);
        $('#pfp-pattern-intensity-value').text(intensityValue);
        // Config update and save handled by the general input/change listener below
    });


    // General Input/Checkbox/Select Changes (Debounced Save)
    // Added new input IDs including the click count input
    $(panelElement).on('input change', `.pfp-input, .pfp-select, .pfp-checkbox, #${NOISE_SEED_INPUT_ID}, #${PATTERN_SCALE_INPUT_ID}, #${PATTERN_INTENSITY_INPUT_ID}, #${CLICK_PAGE_RANDOM_COUNT_ID}`, function(e) {
        GM_log(`Pack Filler Pro: Input/Change event on element ID: ${e.target.id}, Value: ${e.target.value ?? e.target.checked}`); // Debugging log
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

     // Add MutationObserver to disconnect SweetAlert2 observers on modal close
     // This helps prevent memory leaks from Swal's internal observers
     const swalCloseObserver = new MutationObserver((mutationsList) => {
         mutationsList.forEach(mutation => {
             mutation.removedNodes.forEach(removedNode => {
                 if (removedNode.nodeType === 1 && removedNode.classList.contains('swal2-container')) {
                     GM_log("Pack Filler Pro: Detected SweetAlert2 modal removed. Disconnecting Swal observers.");
                     // SweetAlert2 manages its own internal observers, but ensuring the main
                     // Swal instance is cleaned up or checking for specific Swal observer
                     // instances might be necessary in complex scenarios.
                     // For now, we log the removal. If memory issues persist, a more
                     // aggressive approach might be needed, potentially involving
                     // accessing Swal's internal state (if possible and safe).
                     // The swalObserver in applyDarkMode is handled there.
                 }
             });
         });
     });
     swalCloseObserver.observe(document.body, { childList: true });
     GM_log("Pack Filler Pro: Observing body for SweetAlert2 modal removal.");


     GM_log("Pack Filler Pro: bindPanelEvents finished."); // Debugging log
}

/**
 * Helper function to click the page's random button.
 * @param {number} count - How many times to click.
 * @param {object} config - The script's configuration object (for SWAL).
 */
function triggerPageRandomButton(count = 1, config) {
    const btn = document.getElementById('random_pack');
    const clickCount = Math.max(1, parseInt(count, 10) || 1); // Ensure count is a number and at least 1

    if (btn) {
        GM_log(`Pack Filler Pro: Clicking page random button ${clickCount} time(s).`);
        for (let i = 0; i < clickCount; i++) {
            // No delay needed unless page interaction requires it
            btn.click();
        }
        SWAL_TOAST(`Clicked page random button ${clickCount} time(s).`, 'info', config); // Pass config to SWAL
    } else {
        GM_log("Pack Filler Pro: Page random button (#random_pack) not found.");
        SWAL_ALERT('Not Found', 'The page\'s "Open Random Pack" button was not found.', 'warning', config); // Pass config to SWAL
    }
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

     // Pattern options are always visible now, but their parameters might change
     // updatePatternParamsDisplay is called separately on pattern type change
}

/**
 * Updates the visibility of pattern parameter inputs based on the selected pattern type.
 * @param {string} patternType - The selected pattern type ('random', 'perlin', 'gradient', 'alternating').
 */
function updatePatternParamsDisplay(patternType) {
     const isPerlin = patternType === 'perlin';
     const isGradient = patternType === 'gradient';
     // const isAlternating = patternType === 'alternating'; // Alternating has no specific params

     // Hide all pattern specific params initially
     $(`#${PATTERN_PARAMS_DIV_ID} .pfp-form-group`).hide();

     // Show parameters relevant to the selected pattern type
     if (isPerlin) {
          $(`#${PATTERN_PARAMS_DIV_ID} #${NOISE_SEED_INPUT_ID}`).closest('.pfp-form-group').show();
          $(`#${PATTERN_PARAMS_DIV_ID} #${PATTERN_SCALE_INPUT_ID}`).closest('.pfp-form-group').show();
          $(`#${PATTERN_PARAMS_DIV_ID} #${PATTERN_INTENSITY_INPUT_ID}`).closest('.pfp-form-group').show();
     } else if (isGradient) {
          $(`#${PATTERN_PARAMS_DIV_ID} #${PATTERN_INTENSITY_INPUT_ID}`).closest('.pfp-form-group').show();
          $(`#${PATTERN_PARAMS_DIV_ID} #${PATTERN_SCALE_INPUT_ID}`).closest('.pfp-form-group').show(); // Scale can affect gradient smoothness
     }
     // Random and Alternating have no specific parameters to show
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
// SCROLL_TO_BOTTOM_CHECKBOX_ID, DARK_MODE_CHECKBOX_ID, PATTERN_TYPE_SELECT_ID,
// NOISE_SEED_INPUT_ID, PATTERN_SCALE_INPUT_ID, PATTERN_INTENSITY_INPUT_ID,
// CLICK_PAGE_RANDOM_COUNT_ID are available.
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
    $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode); // Dark Mode
    $(`#${MAX_TOTAL_INPUT_ID}`).val(config.maxTotalAmount);
    $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).prop('checked', config.autoFillLoaded);
    $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).prop('checked', config.fillEmptyOnly);
    // Load state for the scroll to bottom checkbox
    $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).prop('checked', config.scrollToBottomAfterLoad);

    // Load new pattern options into UI
    $(`#${PATTERN_TYPE_SELECT_ID}`).val(config.patternType);
    $(`#${NOISE_SEED_INPUT_ID}`).val(config.noiseSeed);
    $(`#${PATTERN_SCALE_INPUT_ID}`).val(config.patternScale);
    $(`#${PATTERN_INTENSITY_INPUT_ID}`).val(config.patternIntensity * 100); // Convert float 0-1 to int 0-100

    // *** NEW: Load click count for page random button ***
    $(`#${CLICK_PAGE_RANDOM_COUNT_ID}`).val(config.clickPageRandomCount || 1); // Use default 1 if undefined


    // Update range value displays
    $('#pfp-pattern-scale-value').text(config.patternScale);
    $('#pfp-pattern-intensity-value').text(config.patternIntensity.toFixed(2));

    // Update display based on loaded mode and pattern type
    updatePanelModeDisplay(config.lastMode);
    updatePatternParamsDisplay(config.patternType);


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
// MAX_TOTAL_INPUT_ID, SCROLL_TO_BOTTOM_CHECKBOX_ID, DARK_MODE_CHECKBOX_ID,
// PATTERN_TYPE_SELECT_ID, NOISE_SEED_INPUT_ID, PATTERN_SCALE_INPUT_ID,
// PATTERN_INTENSITY_INPUT_ID, CLICK_PAGE_RANDOM_COUNT_ID are available.
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
    config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).is(':checked'); // Dark Mode
    config.maxTotalAmount = parseInt($(`#${MAX_TOTAL_INPUT_ID}`).val(), 10) || 0;
    config.autoFillLoaded = $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).is(':checked');
    config.fillEmptyOnly = $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).is(':checked');
    // Update state for the scroll to bottom checkbox
    config.scrollToBottomAfterLoad = $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).is(':checked');

    // Update new pattern options from UI
    config.patternType = $(`#${PATTERN_TYPE_SELECT_ID}`).val() || DEFAULT_CONFIG.patternType;
    config.noiseSeed = $(`#${NOISE_SEED_INPUT_ID}`).val(); // Keep as string
    config.patternScale = parseInt($(`#${PATTERN_SCALE_INPUT_ID}`).val(), 10) || DEFAULT_CONFIG.patternScale;
    config.patternIntensity = parseFloat((parseInt($(`#${PATTERN_INTENSITY_INPUT_ID}`).val(), 10) / 100).toFixed(2)) || DEFAULT_CONFIG.patternIntensity; // Convert int 0-100 to float 0-1

    // *** NEW: Read click count for page random button ***
    config.clickPageRandomCount = Math.max(1, parseInt($(`#${CLICK_PAGE_RANDOM_COUNT_ID}`).val(), 10) || 1);


    // Ensure quantities are within valid bounds after reading
    // Assumes clamp is available globally from domUtils.js
    config.lastFixedQty = clamp(config.lastFixedQty, 0, MAX_QTY);
    config.lastMinQty = clamp(config.lastMinQty, 0, MAX_QTY);
    config.lastMaxQty = clamp(config.lastMaxQty, 0, MAX_QTY);
    // Ensure min <= max for random range
    if (config.lastMinQty > config.lastMaxQty) {
         [config.lastMinQty, config.lastMaxQty] = [config.lastMaxQty, config.lastMinQty];
    }
    config.maxTotalAmount = Math.max(0, config.maxTotalAmount);

    // Ensure pattern scale and intensity are within bounds
    config.patternScale = clamp(config.patternScale, 10, 1000);
    config.patternIntensity = clamp(config.patternIntensity, 0.0, 1.0);


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
    // Ensure this observer is only created once and properly disconnected.
    if (!window._pfpSwalObserver) {
         window._pfpSwalObserver = new MutationObserver((mutationsList) => {
             for (const mutation of mutationsList) {
                 if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                     mutation.addedNodes.forEach(node => {
                         if (node.nodeType === 1 && (node.classList.contains('swal2-popup') || node.classList.contains('swal2-toast-popup'))) {
                             $(node).toggleClass('dark-mode', config.isDarkMode); // Use current config state
                         }
                     });
                 }
             }
         });
         // Start observing the body for added SweetAlert2 popups
         window._pfpSwalObserver.observe(document.body, { childList: true });
         GM_log("Pack Filler Pro: SweetAlert2 popup observer started.");
    }

    // Update the dark mode state on any currently open SweetAlert2 popups
    $('.swal2-popup, .swal2-toast-popup').toggleClass('dark-mode', enable);

    config.isDarkMode = enable; // Update config state
    // No need to save config here, as the input/change listener already calls debouncedSaveConfig
}


// The functions updatePanelModeDisplay, updatePanelVisibility, loadConfigIntoUI,
// updateConfigFromUI, updatePatternParamsDisplay, and applyDarkMode are made available
// to the main script's scope via @require.
