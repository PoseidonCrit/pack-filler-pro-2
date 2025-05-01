// This file handles updating the UI based on config, updating config from UI...

// Assumes ..., fillRandomPackInput, etc. are available

/* --- UI Event Binding --- */
function bindPanelEvents(config) {
    GM_log("Pack Filler Pro: bindPanelEvents started.");

    // Fill Packs Button
    $('#pfp-run').on('click', async () => {
        GM_log("Pack Filler Pro: 'Fill Packs' button clicked.");
        updateConfigFromUI(config);
        debouncedSaveConfig(config);
        await fillPacks(config);
    });

    // Clear All Button
    $('#pfp-clear-btn').on('click', clearAllInputs);

    // *** NEW: Fill 1 Random Pack Button ***
    $(`#${FILL_RANDOM_BTN_ID}`).on('click', async () => {
        GM_log("Pack Filler Pro: 'Fill 1 Random' button clicked.");
        updateConfigFromUI(config); // Ensure config has latest quantity settings
        // No need to save config just for this action
        await fillRandomPackInput(config); // Call the new function
    });

    // *** NEW: Click Page's Random Button ***
     $(`#${CLICK_PAGE_RANDOM_BTN_ID}`).on('click', () => {
        GM_log("Pack Filler Pro: 'Click Page Random' button clicked.");
        updateConfigFromUI(config); // Get latest count value
        debouncedSaveConfig(config); // Save count value if changed
        triggerPageRandomButton(config.clickPageRandomCount); // Call helper
    });

    // Legacy Mode Selection Change (keep as is)
    // ...

    // Pattern Type / Fill Type Selection Change (keep as is)
    // ...

    // Range Value Display Updates (keep as is)
    // ...

    // General Input/Checkbox/Select Changes (Add new input ID)
    $(panelElement).on('input change', `.pfp-input, .pfp-select, .pfp-checkbox, #${CLICK_PAGE_RANDOM_COUNT_ID}`, function(e) { // Added new count ID
        if (e.target.id === PATTERN_TYPE_SELECT_ID || e.target.id === 'pfp-legacy-mode') return;

        GM_log(`Pack Filler Pro: Input/Change on element ID: ${e.target.id}, Value: ${e.target.value ?? e.target.checked}`);
        updateConfigFromUI(config);
        debouncedSaveConfig(config);

        if (e.target.id === DARK_MODE_CHECKBOX_ID) {
            applyDarkMode(config, e.target.checked);
        }
    });

    // Panel Close Button (keep as is)
    // ...
    // Toggle Button (keep as is)
    // ...
    // Observers (keep as is)
    // ...

    GM_log("Pack Filler Pro: bindPanelEvents finished.");
}

/**
 * Helper function to click the page's random button.
 * @param {number} count - How many times to click.
 */
function triggerPageRandomButton(count = 1) {
     const btn = document.getElementById('random_pack');
     const clickCount = Math.max(1, count); // Ensure at least 1 click

     if (btn) {
          GM_log(`Clicking page random button ${clickCount} time(s).`);
          for (let i = 0; i < clickCount; i++) {
               // No delay needed unless page interaction requires it
               btn.click();
          }
          SWAL_TOAST(`Clicked page random button ${clickCount} time(s).`, 'info', config);
     } else {
          GM_log("Page random button (#random_pack) not found.");
          SWAL_ALERT('Not Found', 'The page\'s "Open Random Pack" button was not found.', 'warning', config);
     }
}


/* --- UI State Management --- */

// updateLegacyModeDisplay (keep as is)
// ...
// updatePanelInputsBasedOnType (keep as is)
// ...
// updatePanelVisibility (keep as is)
// ...

/**
 * Loads the saved configuration values into the UI elements.
 * @param {object} config - The script's configuration object.
 */
function loadConfigIntoUI(config) {
    // ... (Load previous elements) ...
    $('#pfp-legacy-mode').val(config.lastMode);
    $('#pfp-count').val(config.lastCount);
    $(`#${PATTERN_TYPE_SELECT_ID}`).val(config.patternType);
    $('#pfp-fixed').val(config.lastFixedQty);
    $('#pfp-min').val(config.lastMinQty);
    $('#pfp-max').val(config.lastMaxQty);
    $(`#${MAX_TOTAL_INPUT_ID}`).val(config.maxTotalAmount);
    $(`#${NOISE_SEED_INPUT_ID}`).val(config.noiseSeed);
    $(`#${PATTERN_SCALE_INPUT_ID}`).val(config.patternScale);
    $('#pfp-pattern-scale-value').text(config.patternScale);
    const intensityPercent = Math.round(config.patternIntensity * 100);
    $(`#${PATTERN_INTENSITY_INPUT_ID}`).val(intensityPercent);
    $('#pfp-pattern-intensity-value').text(config.patternIntensity.toFixed(2));
    $('#pfp-clear').prop('checked', config.lastClear);
    $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).prop('checked', config.fillEmptyOnly);
    $(`#${FULL_PAGE_CHECKBOX_ID}`).prop('checked', config.loadFullPage);
    $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).prop('checked', config.autoFillLoaded);
    $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).prop('checked', config.scrollToBottomAfterLoad);
    $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode);

    // *** NEW: Load click count for page random button ***
    $(`#${CLICK_PAGE_RANDOM_COUNT_ID}`).val(config.clickPageRandomCount || 1); // Use default 1 if undefined

    // Apply initial UI state
    updateLegacyModeDisplay(config.lastMode);
    updatePanelInputsBasedOnType(config.patternType);
    applyDarkMode(config, config.isDarkMode);
    updatePanelVisibility(config, config.panelVisible, config.panelPos);

    GM_log("Pack Filler Pro: UI loaded from config.");
}


/**
 * Updates the config object based on the current UI state. Ensures values are valid.
 * @param {object} config - The script's configuration object to update.
 */
function updateConfigFromUI(config) {
    // ... (Read previous elements and validate/clamp) ...
     config.patternType = $(`#${PATTERN_TYPE_SELECT_ID}`).val() || DEFAULT_CONFIG.patternType;
     config.lastMode = $('#pfp-legacy-mode').val() || DEFAULT_CONFIG.lastMode;
     config.lastCount = parseInt($('#pfp-count').val(), 10) || 0;
     config.lastFixedQty = clamp(parseInt($('#pfp-fixed').val(), 10) || 0, 0, MAX_QTY);
     config.lastMinQty = clamp(parseInt($('#pfp-min').val(), 10) || 0, 0, MAX_QTY);
     config.lastMaxQty = clamp(parseInt($('#pfp-max').val(), 10) || 0, 0, MAX_QTY);
     if (config.lastMinQty > config.lastMaxQty) { /* ... swap ... */ }
     config.maxTotalAmount = Math.max(0, parseInt($(`#${MAX_TOTAL_INPUT_ID}`).val(), 10) || 0);
     config.noiseSeed = $(`#${NOISE_SEED_INPUT_ID}`).val();
     config.patternScale = clamp(parseInt($(`#${PATTERN_SCALE_INPUT_ID}`).val(), 10) || DEFAULT_CONFIG.patternScale, 10, 1000);
     config.patternIntensity = clamp(parseFloat((parseInt($(`#${PATTERN_INTENSITY_INPUT_ID}`).val(), 10) / 100).toFixed(2)) || DEFAULT_CONFIG.patternIntensity, 0.0, 1.0);
     config.lastClear = $('#pfp-clear').is(':checked');
     config.fillEmptyOnly = $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).is(':checked');
     config.loadFullPage = $(`#${FULL_PAGE_CHECKBOX_ID}`).is(':checked');
     config.autoFillLoaded = $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).is(':checked');
     config.scrollToBottomAfterLoad = $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).is(':checked');
     config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).is(':checked');

    // *** NEW: Read click count for page random button ***
    config.clickPageRandomCount = Math.max(1, parseInt($(`#${CLICK_PAGE_RANDOM_COUNT_ID}`).val(), 10) || 1);

    GM_log("Pack Filler Pro: Config updated from UI.");
}


// applyDarkMode (keep as is)
// ...
