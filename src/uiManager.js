// This file handles updating the UI based on config, updating config from UI,
// and binding event listeners to UI elements.

// Assumes $, config, constants, panelElement, toggleButtonElement, panelSimpleBarInstance,
// fillPacks, setupWorkerMessageHandler, clearAllInputs, debouncedSaveConfig, getPackInputs,
// applyDarkMode are available.

/* --- UI Event Binding --- */
/**
 * Binds event listeners to the UI panel elements.
 * @param {object} config - The script's configuration object.
 */
function bindPanelEvents(config) {
    GM_log("Pack Filler Pro: bindPanelEvents started.");

    // Fill Packs Button
    $('#pfp-run').on('click', async () => {
        GM_log("Pack Filler Pro: 'Fill Packs' button clicked.");
        updateConfigFromUI(config); // Ensure config has latest UI values
        debouncedSaveConfig(config);
        await fillPacks(config); // Call the revised fillPacks
    });

    // Clear All Button
    $('#pfp-clear-btn').on('click', clearAllInputs);

    // Legacy Mode Selection Change (Less important now, but keep for count visibility)
    $('#pfp-legacy-mode').on('change', function() {
        GM_log(`Pack Filler Pro: Legacy Mode changed to ${this.value}.`);
        updateLegacyModeDisplay(this.value); // Update count visibility
        // No config save needed here as patternType is primary now
    });

    // Pattern Type / Fill Type Selection Change (Primary control)
    $(`#${PATTERN_TYPE_SELECT_ID}`).on('change', function() {
        GM_log(`Pack Filler Pro: Pattern type changed to ${this.value}.`);
        updatePanelInputsBasedOnType(this.value); // NEW function to show/hide relevant inputs
        updateConfigFromUI(config); // Update config with new pattern type
        debouncedSaveConfig(config);
    });

    // Update range value display for Pattern Scale
    $(`#${PATTERN_SCALE_INPUT_ID}`).on('input', function() {
        $('#pfp-pattern-scale-value').text($(this).val());
        // Config update/save handled by general listener below
    });

     // Update range value display for Pattern Intensity
    $(`#${PATTERN_INTENSITY_INPUT_ID}`).on('input', function() {
        const intensityValue = (parseInt($(this).val(), 10) / 100).toFixed(2);
        $('#pfp-pattern-intensity-value').text(intensityValue);
        // Config update/save handled by general listener below
    });


    // General Input/Checkbox/Select Changes (Debounced Save)
    $(panelElement).on('input change', `.pfp-input, .pfp-select, .pfp-checkbox`, function(e) {
        // Don't trigger immediate config update for pattern type change, handled above
        if (e.target.id === PATTERN_TYPE_SELECT_ID || e.target.id === 'pfp-legacy-mode') return;

        GM_log(`Pack Filler Pro: Input/Change on element ID: ${e.target.id}, Value: ${e.target.value ?? e.target.checked}`);
        updateConfigFromUI(config);
        debouncedSaveConfig(config);

        // Dark Mode toggle logic
        if (e.target.id === DARK_MODE_CHECKBOX_ID) {
            applyDarkMode(config, e.target.checked);
        }
    });

    // Panel Close Button
    $(panelElement).find('.pfp-close').on('click', () => {
        GM_log("Pack Filler Pro: Panel close button clicked.");
        updatePanelVisibility(config, false);
    });

    // Toggle Button
    $(toggleButtonElement).on('click', () => {
        GM_log("Pack Filler Pro: Toggle button clicked.");
        updatePanelVisibility(config, !config.panelVisible); // Toggle visibility
    });

    // --- Observers ---
    // MutationObserver to update max count and simplebar when inputs are added/removed
     const listObserver = new MutationObserver((mutationsList) => {
         let inputsChanged = false;
         for(const mutation of mutationsList) {
             if (mutation.type === 'childList') {
                  const addedInputs = Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && (node.matches(SELECTOR) || node.querySelector(SELECTOR)));
                  const removedInputs = Array.from(mutation.removedNodes).some(node => node.nodeType === 1 && (node.matches(SELECTOR) || node.querySelector(SELECTOR)));
                 if (addedInputs || removedInputs) {
                      inputsChanged = true;
                      break;
                 }
             }
         }
         if (inputsChanged) {
             const currentInputCount = getPackInputs().length;
             $('#pfp-count').attr('max', currentInputCount);
             GM_log(`Pack Filler Pro: Detected input list change. Updated count max to ${currentInputCount}.`);
             if (panelSimpleBarInstance) {
                 panelSimpleBarInstance.recalculate();
             }
         }
     });

     // Observe the container where pack inputs are added (adjust selector if needed)
     // Common containers: .pack-list, #deck-editor-container, etc. Observe body as fallback.
     const packsContainer = document.querySelector('.pack-list') || document.body;
     listObserver.observe(packsContainer, { childList: true, subtree: true });
     GM_log(`Pack Filler Pro: Observing "${packsContainer.tagName}" for pack input changes.`);

     // SweetAlert2 Popup Observer (for dynamic dark mode) - Handled within applyDarkMode now

     GM_log("Pack Filler Pro: bindPanelEvents finished.");
}


/* --- UI State Management --- */

/**
 * Updates visibility of count input based on legacy mode (less critical now).
 */
function updateLegacyModeDisplay(legacyMode) {
    const showCount = legacyMode === 'fixed' || legacyMode === 'max';
    $('#pfp-count-group').toggle(showCount);
}


/**
 * Updates the visibility of quantity inputs (Fixed, Range) and pattern parameters
 * based on the selected patternType.
 * @param {string} patternType - The selected pattern type.
 */
function updatePanelInputsBasedOnType(patternType) {
    // Hide all conditional inputs initially
    $('#pfp-fixed-group').hide();
    $('#pfp-range-inputs').hide();
    $(`#${PATTERN_PARAMS_DIV_ID} .pfp-form-group`).hide(); // Hide all specific pattern params

    // Show relevant inputs based on the selected type
    switch(patternType) {
        case 'fixed':
        case 'unlimited': // 'unlimited' uses the 'fixed' quantity input
            $('#pfp-fixed-group').show();
            break;
        case 'random':
        case 'alternating':
            $('#pfp-range-inputs').show(); // Uses Min/Max/Total
            break;
        case 'simplex':
            $('#pfp-range-inputs').show(); // Uses Min/Max/Total
            // Show relevant pattern params
            $(`#${PATTERN_PARAMS_DIV_ID} .pfp-param-noise-seed`).show();
            $(`#${PATTERN_PARAMS_DIV_ID} .pfp-param-scale`).show();
            $(`#${PATTERN_PARAMS_DIV_ID} .pfp-param-intensity`).show();
            break;
        case 'gradient':
            $('#pfp-range-inputs').show(); // Uses Min/Max/Total
            // Show relevant pattern params
            $(`#${PATTERN_PARAMS_DIV_ID} .pfp-param-scale`).show(); // Scale can affect gradient smoothness
            $(`#${PATTERN_PARAMS_DIV_ID} .pfp-param-intensity`).show();
            break;
    }
    // Also update legacy count visibility based on primary type if needed
    // For simplicity, let's keep count tied to the legacy mode dropdown for now
    // updateLegacyModeDisplay($('#pfp-legacy-mode').val());
}


/**
 * Updates the visibility of the panel and saves the visibility/position state.
 * @param {object} config - The script's configuration object.
 * @param {boolean} makeVisible - Whether the panel should be visible.
 * @param {object} [position=null] - Optional position object {top, right, bottom, left} to apply.
 */
function updatePanelVisibility(config, makeVisible, position = null) {
    if (!panelElement || !toggleButtonElement) return;

    const isCurrentlyVisible = !$(panelElement).hasClass('hidden');

    // If requesting visibility change or applying position
    if (makeVisible !== isCurrentlyVisible || position) {
        $(panelElement).toggleClass('hidden', !makeVisible);
        $(toggleButtonElement).toggleClass('hidden', makeVisible);
        config.panelVisible = makeVisible;

        if (makeVisible && panelSimpleBarInstance) {
            panelSimpleBarInstance.recalculate();
        }

        if (position) {
            // Clear previous positioning properties before applying new ones
            $(panelElement).css({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
            $(panelElement).css(position);
            config.panelPos = {
                top: panelElement.style.top || 'auto',
                bottom: panelElement.style.bottom || 'auto',
                left: panelElement.style.left || 'auto',
                right: panelElement.style.right || 'auto'
            };
        }
         // Only save if visibility actually changed or position was applied
        debouncedSaveConfig(config);
        GM_log(`Panel visibility updated: ${makeVisible}, Position: ${JSON.stringify(config.panelPos)}`);
    }
}


/**
 * Loads the saved configuration values into the UI elements.
 * @param {object} config - The script's configuration object.
 */
function loadConfigIntoUI(config) {
    if (!panelElement) return;

    // Load legacy mode and count (for visibility mainly)
    $('#pfp-legacy-mode').val(config.lastMode); // Still load this
    $('#pfp-count').val(config.lastCount);

    // Load primary control: Pattern/Fill Type
    $(`#${PATTERN_TYPE_SELECT_ID}`).val(config.patternType);

    // Load quantity inputs
    $('#pfp-fixed').val(config.lastFixedQty);
    $('#pfp-min').val(config.lastMinQty);
    $('#pfp-max').val(config.lastMaxQty);
    $(`#${MAX_TOTAL_INPUT_ID}`).val(config.maxTotalAmount);

    // Load pattern parameters
    $(`#${NOISE_SEED_INPUT_ID}`).val(config.noiseSeed);
    $(`#${PATTERN_SCALE_INPUT_ID}`).val(config.patternScale);
    $('#pfp-pattern-scale-value').text(config.patternScale);
    const intensityPercent = Math.round(config.patternIntensity * 100);
    $(`#${PATTERN_INTENSITY_INPUT_ID}`).val(intensityPercent);
    $('#pfp-pattern-intensity-value').text(config.patternIntensity.toFixed(2));

    // Load options checkboxes
    $('#pfp-clear').prop('checked', config.lastClear);
    $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).prop('checked', config.fillEmptyOnly);
    $(`#${FULL_PAGE_CHECKBOX_ID}`).prop('checked', config.loadFullPage);
    $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).prop('checked', config.autoFillLoaded);
    $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).prop('checked', config.scrollToBottomAfterLoad);
    $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode);

    // Apply initial UI state based on loaded config
    updateLegacyModeDisplay(config.lastMode); // Update count visibility
    updatePanelInputsBasedOnType(config.patternType); // Show/hide correct inputs
    applyDarkMode(config, config.isDarkMode); // Apply theme
    updatePanelVisibility(config, config.panelVisible, config.panelPos); // Set visibility and position

    GM_log("Pack Filler Pro: UI loaded from config.");
}


/**
 * Updates the config object based on the current UI state. Ensures values are valid.
 * @param {object} config - The script's configuration object to update.
 */
function updateConfigFromUI(config) {
    if (!panelElement) return;

    // Read primary type
    config.patternType = $(`#${PATTERN_TYPE_SELECT_ID}`).val() || DEFAULT_CONFIG.patternType;

    // Read legacy mode (mainly for count visibility state)
    config.lastMode = $('#pfp-legacy-mode').val() || DEFAULT_CONFIG.lastMode;

    // Read quantities and clamp/validate
    config.lastCount = parseInt($('#pfp-count').val(), 10) || 0;
    config.lastFixedQty = clamp(parseInt($('#pfp-fixed').val(), 10) || 0, 0, MAX_QTY);
    config.lastMinQty = clamp(parseInt($('#pfp-min').val(), 10) || 0, 0, MAX_QTY);
    config.lastMaxQty = clamp(parseInt($('#pfp-max').val(), 10) || 0, 0, MAX_QTY);
    // Ensure min <= max
    if (config.lastMinQty > config.lastMaxQty) {
        [config.lastMinQty, config.lastMaxQty] = [config.lastMaxQty, config.lastMinQty];
         // Reflect the swap in the UI immediately if inputs are visible
         if ($('#pfp-range-inputs').is(':visible')) {
              $('#pfp-min').val(config.lastMinQty);
              $('#pfp-max').val(config.lastMaxQty);
         }
    }
    config.maxTotalAmount = Math.max(0, parseInt($(`#${MAX_TOTAL_INPUT_ID}`).val(), 10) || 0);

    // Read pattern parameters
    config.noiseSeed = $(`#${NOISE_SEED_INPUT_ID}`).val(); // Keep as string/number input
    config.patternScale = clamp(parseInt($(`#${PATTERN_SCALE_INPUT_ID}`).val(), 10) || DEFAULT_CONFIG.patternScale, 10, 1000);
    config.patternIntensity = clamp(parseFloat((parseInt($(`#${PATTERN_INTENSITY_INPUT_ID}`).val(), 10) / 100).toFixed(2)) || DEFAULT_CONFIG.patternIntensity, 0.0, 1.0);

    // Read options
    config.lastClear = $('#pfp-clear').is(':checked');
    config.fillEmptyOnly = $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).is(':checked');
    config.loadFullPage = $(`#${FULL_PAGE_CHECKBOX_ID}`).is(':checked');
    config.autoFillLoaded = $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).is(':checked');
    config.scrollToBottomAfterLoad = $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).is(':checked');
    config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).is(':checked');

    // Panel visibility and position are updated directly in updatePanelVisibility

    GM_log("Pack Filler Pro: Config updated from UI.");
}


/**
 * Applies or removes the dark mode class to relevant elements.
 * @param {object} config - The script's configuration object.
 * @param {boolean} enable - Whether to enable or disable dark mode.
 */
function applyDarkMode(config, enable) {
    if (!panelElement) return;

    $(panelElement).toggleClass('dark-mode', enable);
    $(toggleButtonElement).toggleClass('dark-mode', enable);

    // SweetAlert2 Dynamic Dark Mode Observer (simplified)
    // Apply to currently open popups
    $('.swal2-popup, .swal2-container, .swal2-toast-popup').toggleClass('dark-mode', enable);

    // Use Swal's hooks if possible, otherwise rely on MutationObserver (if needed)
    // Simple approach: just toggle class on existing elements. New modals will
    // get class applied via SWAL_ALERT/SWAL_TOAST helpers based on config.isDarkMode.
    // Let's remove the observer for now as it might be overkill if helpers handle it.
    /*
    if (!window._pfpSwalObserver && enable) { // Only observe if needed
         // ... observer setup ...
         window._pfpSwalObserver.observe(document.body, { childList: true });
         GM_log("Pack Filler Pro: SweetAlert2 popup observer started for dark mode.");
    } else if (window._pfpSwalObserver && !enable) {
         window._pfpSwalObserver.disconnect();
         delete window._pfpSwalObserver;
         GM_log("Pack Filler Pro: SweetAlert2 popup observer stopped.");
    }
    */

    config.isDarkMode = enable;
    // Config saving is handled by the general input listener
}
