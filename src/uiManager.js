// This file handles updating the UI based on config, updating config from UI,
// and binding event listeners to UI elements.
// It relies heavily on the cash-dom library ($).

// It assumes the following are available in the main script's scope via @require:
// - $ from cash-dom
// - panelElement, toggleButtonElement, panelSimpleBarInstance (variables populated in main script)
// - functions from fillLogic.js (fillPacks, fillRandomPackInput)
// - functions from domUtils.js (clearAllInputs, getPackInputs, clamp, sanitize)
// - functions from configManager.js (debouncedSaveConfig, saveConfig, validateFillConfig) // Added validateFillConfig, saveConfig
// - functions from swalHelpers.js (SWAL_ALERT, SWAL_TOAST)
// - constants from constants.js (SELECTOR, FULL_PAGE_CHECKBOX_ID, etc.)
// - GM_log function
// - MutationObserver API
// - window.Swal (SweetAlert2 instance)
// - DEFAULT_CONFIG constant

/* --- UI State Management --- */

/**
 * Loads configuration values into the UI elements.
 * Assumes config object and UI element IDs (from constants.js) are available.
 * Assumes $ from cash-dom is available.
 * @param {object} config - The script's configuration object.
 */
function loadConfigIntoUI(config) {
    GM_log("Pack Filler Pro: Loading config into UI.");
    // Check critical dependencies
    if (typeof $ === 'undefined' || typeof config !== 'object' || config === null) {
         GM_log("Pack Filler Pro: loadConfigIntoUI dependencies ($ or config) missing. Aborting.");
         // Cannot use Swal without config, fallback to log
         GM_log("Pack Filler Pro: Cannot load config into UI due to missing dependencies.");
         return;
    }

    try {
         // Use constants for IDs (assumed available via @require)
         // Use $ from cash-dom (assumed available via @require)
        $('#pfp-mode').val(config.lastMode || DEFAULT_CONFIG.lastMode); // Use default if undefined
        $('#pfp-count').val(config.lastCount || DEFAULT_CONFIG.lastCount);
        $('#pfp-fixed').val(config.lastFixedQty || DEFAULT_CONFIG.lastFixedQty);
        $('#pfp-min').val(config.lastMinQty || DEFAULT_CONFIG.lastMinQty);
        $('#pfp-max').val(config.lastMaxQty || DEFAULT_CONFIG.lastMaxQty);
        $('#pfp-clear').prop('checked', config.lastClear || DEFAULT_CONFIG.lastClear);
        $(`#${FULL_PAGE_CHECKBOX_ID}`).prop('checked', config.loadFullPage || DEFAULT_CONFIG.loadFullPage);
        $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode || DEFAULT_CONFIG.isDarkMode);
        $(`#${MAX_TOTAL_INPUT_ID}`).val(config.maxTotalAmount || DEFAULT_CONFIG.maxTotalAmount);
        $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).prop('checked', config.autoFillLoaded || DEFAULT_CONFIG.autoFillLoaded);
        $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).prop('checked', config.fillEmptyOnly || DEFAULT_CONFIG.fillEmptyOnly);
        $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).prop('checked', config.scrollToBottomAfterLoad || DEFAULT_CONFIG.scrollToBottomAfterLoad);
        $(`#${PATTERN_TYPE_SELECT_ID}`).val(config.patternType || DEFAULT_CONFIG.patternType);
        $(`#${NOISE_SEED_INPUT_ID}`).val(config.noiseSeed || DEFAULT_CONFIG.noiseSeed);

        // Pattern range inputs (scale and intensity)
        // Ensure values are numbers before setting
        const patternScale = typeof config.patternScale === 'number' ? config.patternScale : DEFAULT_CONFIG.patternScale;
        const patternIntensity = typeof config.patternIntensity === 'number' ? config.patternIntensity : DEFAULT_CONFIG.patternIntensity;

        $(`#${PATTERN_SCALE_INPUT_ID}`).val(patternScale);
        $(`#${PATTERN_INTENSITY_INPUT_ID}`).val(patternIntensity * 100); // Intensity is 0-1 in config, 0-100 in UI

        // Update range input value displays
        $(`#pfp-pattern-scale-value`).text(patternScale);
        $(`#pfp-pattern-intensity-value`).text(Math.round(patternIntensity * 100));


        // Page Random Clicker Count
        $(`#${CLICK_PAGE_RANDOM_COUNT_ID}`).val(config.clickPageRandomCount || DEFAULT_CONFIG.clickPageRandomCount);


        GM_log("Pack Filler Pro: Config loaded into UI successfully.");
    } catch (e) {
        GM_log(`Pack Filler Pro: ERROR - Failed to load config into UI: ${e.message}`, e);
         // Cannot use Swal without config, fallback to log
         GM_log("Pack Filler Pro: Cannot load config into UI due to error during application.");
    }
}

/**
 * Updates the configuration object from the current UI element values.
 * Assumes config object and UI element IDs (from constants.js) are available.
 * Assumes $ from cash-dom is available.
 * @param {object} config - The script's configuration object to update.
 */
function updateConfigFromUI(config) {
    // Check critical dependencies
    if (typeof $ === 'undefined' || typeof config !== 'object' || config === null) {
         GM_log("Pack Filler Pro: updateConfigFromUI dependencies ($ or config) missing. Aborting.");
         // Cannot use Swal without config, fallback to log
         GM_log("Pack Filler Pro: Cannot update config from UI due to missing dependencies.");
         return;
    }

    try {
        // Use constants for IDs (assumed available via @require)
        // Use $ from cash-dom (assumed available via @require)
        config.lastMode = $('#pfp-mode').val();
        config.lastCount = parseInt($('#pfp-count').val(), 10) || 0; // Ensure integer
        config.lastFixedQty = parseInt($('#pfp-fixed').val(), 10) || 0; // Ensure integer
        config.lastMinQty = parseInt($('#pfp-min').val(), 10) || 0; // Ensure integer
        config.lastMaxQty = parseInt($('#pfp-max').val(), 10) || 0; // Ensure integer
        config.lastClear = $('#pfp-clear').prop('checked');
        config.loadFullPage = $(`#${FULL_PAGE_CHECKBOX_ID}`).prop('checked');
        config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked');
        config.maxTotalAmount = parseInt($(`#${MAX_TOTAL_INPUT_ID}`).val(), 10) || 0; // Ensure integer
        config.autoFillLoaded = $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).prop('checked');
        config.fillEmptyOnly = $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).prop('checked');
        config.scrollToBottomAfterLoad = $(`#${SCROLL_TO_BOTTOM_CHECKBOX_ID}`).prop('checked');
        config.patternType = $(`#${PATTERN_TYPE_SELECT_ID}`).val();

        // Pattern range inputs (scale and intensity)
        // Ensure values are numbers and convert intensity back to 0-1 range
        config.patternScale = parseInt($(`#${PATTERN_SCALE_INPUT_ID}`).val(), 10) || DEFAULT_CONFIG.patternScale;
        config.patternIntensity = parseFloat($(`#${PATTERN_INTENSITY_INPUT_ID}`).val()) / 100 || DEFAULT_CONFIG.patternIntensity;
        config.noiseSeed = $(`#${NOISE_SEED_INPUT_ID}`).val();

        // Page Random Clicker Count
        config.clickPageRandomCount = parseInt($(`#${CLICK_PAGE_RANDOM_COUNT_ID}`).val(), 10) || 1; // Ensure integer, min 1


        GM_log("Pack Filler Pro: Config updated from UI.");
        // Note: Validation is typically done before saving or before a fill operation,
        // not necessarily every time config is updated from UI.
    } catch (e) {
        GM_log(`Pack Filler Pro: ERROR - Failed to update config from UI: ${e.message}`, e);
         // Cannot use Swal without config, fallback to log
         GM_log("Pack Filler Pro: Cannot update config from UI due to error during retrieval.");
    }
}


/**
 * Updates the display of the current fill mode in the panel header.
 * Assumes panelElement exists and $ from cash-dom is available.
 * @param {string} mode - The current fill mode ('fixed', 'max', 'unlimited').
 */
function updatePanelModeDisplay(mode) {
    // Check critical dependencies
    if (typeof $ === 'undefined' || !panelElement) {
         GM_log("Pack Filler Pro: updatePanelModeDisplay dependencies ($ or panelElement) missing. Aborting.");
         return;
    }

    try {
        const modeDisplay = mode === 'fixed' ? 'Fixed Count' :
                            mode === 'max' ? 'Random Count' :
                            mode === 'unlimited' ? 'All Visible' : 'Unknown Mode';
        // Find the title span within the panel header and update its text
        $(panelElement).find('.pfp-title').text(`Pack Filler Pro (${modeDisplay})`);
    } catch (e) {
        GM_log(`Pack Filler Pro: ERROR - Failed to update panel mode display: ${e.message}`, e);
    }
}

/**
 * Toggles the visibility of the panel and updates the toggle button text/position.
 * Saves the panel's state and position.
 * Assumes panelElement, toggleButtonElement exist, config object is available,
 * and $ from cash-dom, debouncedSaveConfig, saveConfig, clamp are available.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isVisible - Whether the panel should be visible.
 * @param {{top: string, right: string, bottom: string, left: string}} [pos=null] - Optional position object.
 */
function updatePanelVisibility(config, isVisible, pos = null) {
    // Check critical dependencies
     if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement || typeof config !== 'object' || config === null || typeof debouncedSaveConfig !== 'function' || typeof saveConfig !== 'function' || typeof clamp !== 'function') {
          GM_log("Pack Filler Pro: updatePanelVisibility critical dependencies missing. Aborting.");
           // Cannot use Swal without config, fallback to log
          GM_log("Pack Filler Pro: Cannot update panel visibility due to missing dependencies.");
          return;
     }

    try {
        if (isVisible) {
            $(panelElement).removeClass('hidden');
            $(toggleButtonElement).text('✕'); // Use 'X' or similar when panel is open
            $(toggleButtonElement).attr('title', 'Close Pack Filler Pro Panel');

            // Apply saved position if provided and valid
            if (pos && typeof pos === 'object') {
                 // Validate and apply position properties
                 if (typeof pos.top === 'string') $(panelElement).css('top', pos.top); else $(panelElement).css('top', '');
                 if (typeof pos.right === 'string') $(panelElement).css('right', pos.right); else $(panelElement).css('right', '');
                 if (typeof pos.bottom === 'string') $(panelElement).css('bottom', pos.bottom); else $(panelElement).css('bottom', '');
                 if (typeof pos.left === 'string') $(panelElement).css('left', pos.left); else $(panelElement).css('left', '');
            } else {
                 // If no valid position is provided, apply default or last saved valid one from config
                 if (typeof config.panelPos === 'object') {
                      if (typeof config.panelPos.top === 'string') $(panelElement).css('top', config.panelPos.top); else $(panelElement).css('top', '');
                      if (typeof config.panelPos.right === 'string') $(panelElement).css('right', config.panelPos.right); else $(panelElement).css('right', '');
                      if (typeof config.panelPos.bottom === 'string') $(panelElement).css('bottom', config.panelPos.bottom); else $(panelElement).css('bottom', '');
                      if (typeof config.panelPos.left === 'string') $(panelElement).css('left', config.panelPos.left); else $(panelElement).css('left', '');
                 } else {
                      // Fallback to default CSS position if config.panelPos is also invalid
                      GM_log("Pack Filler Pro: Config panelPos is invalid. Using default CSS position.");
                      $(panelElement).css({ top: '', right: '', bottom: '', left: '' }); // Clear inline styles
                 }
            }
             // Ensure the toggle button is NOT hidden when the panel is visible
             $(toggleButtonElement).removeClass('hidden');

        } else {
            $(panelElement).addClass('hidden');
            $(toggleButtonElement).text('🎴'); // Use icon when panel is closed
            $(toggleButtonElement).attr('title', 'Toggle Pack Filler Pro Panel');
        }

        // Update config and save
        config.panelVisible = isVisible;
        // If hiding, capture the current position before it's potentially lost
        if (!isVisible) {
             // Capture current position from computed styles if possible, fallback to config or default
             const computedStyle = window.getComputedStyle(panelElement);
             config.panelPos = {
                 top: computedStyle.top !== 'auto' ? computedStyle.top : (config.panelPos.top || DEFAULT_CONFIG.panelPos.top),
                 right: computedStyle.right !== 'auto' ? computedStyle.right : (config.panelPos.right || DEFAULT_CONFIG.panelPos.right),
                 bottom: computedStyle.bottom !== 'auto' ? computedStyle.bottom : (config.panelPos.bottom || DEFAULT_CONFIG.panelPos.bottom),
                 left: computedStyle.left !== 'auto' ? computedStyle.left : (config.panelPos.left || DEFAULT_CONFIG.panelPos.left),
             };
             // Ensure captured positions are strings (e.g., "10px")
             if (typeof config.panelPos.top !== 'string') config.panelPos.top = DEFAULT_CONFIG.panelPos.top;
             if (typeof config.panelPos.right !== 'string') config.panelPos.right = DEFAULT_CONFIG.panelPos.right;
             if (typeof config.panelPos.bottom !== 'string') config.panelPos.bottom = DEFAULT_CONFIG.panelPos.bottom;
             if (typeof config.panelPos.left !== 'string') config.panelPos.left = DEFAULT_CONFIG.panelPos.left;

             // Save immediately when panel is closed to persist position
             saveConfig(config); // Assumes saveConfig is available
             GM_log("Pack Filler Pro: Panel hidden, position saved.");
        } else {
             // For visibility changes that don't hide the panel, use debounced save
             debouncedSaveConfig(config); // Assumes debouncedSaveConfig is available
             GM_log("Pack Filler Pro: Panel shown.");
        }

    } catch (e) {
        GM_log(`Pack Filler Pro: ERROR - Failed to update panel visibility: ${e.message}`, e);
         // Cannot use Swal without config, fallback to log
         GM_log("Pack Filler Pro: Cannot update panel visibility due to error.");
    }
}


/**
 * Updates the visibility of quantity input groups based on the selected mode.
 * Assumes $ from cash-dom and UI element IDs (from constants.js) are available.
 * Assumes panelElement exists.
 * @param {string} mode - The current fill mode ('fixed', 'max', 'unlimited').
 */
function updateQuantityInputVisibility(mode) {
    // Check critical dependencies
    if (typeof $ === 'undefined' || !panelElement) {
         GM_log("Pack Filler Pro: updateQuantityInputVisibility dependencies ($ or panelElement) missing. Aborting.");
         return;
    }
    // Check for the existence of the required elements before manipulating them
    const countGroup = $('#pfp-count-group');
    const fixedGroup = $('#pfp-fixed-group');
    const rangeInputs = $('#pfp-range-inputs');

    if (countGroup.length === 0 || fixedGroup.length === 0 || rangeInputs.length === 0) {
        GM_log("Pack Filler Pro: Required quantity input elements not found. Cannot update visibility.");
        return; // Abort if elements are missing
    }


    try {
        switch (mode) {
            case 'fixed':
                countGroup.removeClass('hidden');
                fixedGroup.removeClass('hidden');
                rangeInputs.addClass('hidden');
                break;
            case 'max':
                countGroup.removeClass('hidden');
                fixedGroup.addClass('hidden');
                rangeInputs.removeClass('hidden');
                break;
            case 'unlimited':
                countGroup.addClass('hidden');
                fixedGroup.addClass('hidden');
                rangeInputs.removeClass('hidden'); // Still show range/max total for unlimited mode
                break;
            default:
                // Hide all if mode is unknown
                countGroup.addClass('hidden');
                fixedGroup.addClass('hidden');
                rangeInputs.addClass('hidden');
                GM_log(`Pack Filler Pro: Unknown mode "${mode}" in updateQuantityInputVisibility. Hiding all quantity inputs.`);
        }
    } catch (e) {
        GM_log(`Pack Filler Pro: ERROR - Failed to update quantity input visibility: ${e.message}`, e);
    }
}

/**
 * Updates the visibility of pattern parameter inputs based on the selected pattern type.
 * Assumes $ from cash-dom and UI element IDs (from constants.js) are available.
 * Assumes panelElement exists.
 * @param {string} patternType - The current pattern type ('random', 'fixed', 'gradient', 'perlin', 'alternating').
 */
function updatePatternParamsVisibility(patternType) {
     // Check critical dependencies
     if (typeof $ === 'undefined' || !panelElement) {
          GM_log("Pack Filler Pro: updatePatternParamsVisibility dependencies ($ or panelElement) missing. Aborting.");
          return;
     }
     // Check for the existence of the required elements before manipulating them
     const patternParamsDiv = $(`#${PATTERN_PARAMS_DIV_ID}`);
     const noiseSeedInput = $(`#${NOISE_SEED_INPUT_ID}`).closest('.pfp-form-group'); // Get parent group
     const patternScaleInput = $(`#${PATTERN_SCALE_INPUT_ID}`).closest('.pfp-form-group'); // Get parent group
     const patternIntensityInput = $(`#${PATTERN_INTENSITY_INPUT_ID}`).closest('.pfp-form-group'); // Get parent group


     if (patternParamsDiv.length === 0 || noiseSeedInput.length === 0 || patternScaleInput.length === 0 || patternIntensityInput.length === 0) {
          GM_log("Pack Filler Pro: Required pattern parameter elements not found. Cannot update visibility.");
          return; // Abort if elements are missing
     }


     try {
         // Hide all pattern-specific params by default
         noiseSeedInput.addClass('hidden');
         patternScaleInput.addClass('hidden');
         patternIntensityInput.addClass('hidden');

         // Show params based on pattern type
         switch (patternType) {
             case 'gradient':
                 patternScaleInput.removeClass('hidden');
                 patternIntensityInput.removeClass('hidden');
                 break;
             case 'perlin':
                 noiseSeedInput.removeClass('hidden');
                 patternScaleInput.removeClass('hidden');
                 patternIntensityInput.removeClass('hidden');
                 break;
             // 'random', 'fixed', 'alternating' have no specific parameters to show
             default:
                 // If patternType is unknown or doesn't require specific params, all remain hidden
                 if (patternType !== 'random' && patternType !== 'fixed' && patternType !== 'alternating') {
                      GM_log(`Pack Filler Pro: Unknown patternType "${patternType}" in updatePatternParamsVisibility. Hiding all pattern params.`);
                 }
                 break;
         }
     } catch (e) {
         GM_log(`Pack Filler Pro: ERROR - Failed to update pattern params visibility: ${e.message}`, e);
     }
}


/**
 * Applies or removes the 'dark-mode' class to relevant UI elements and SweetAlert2 popups.
 * Saves the dark mode state.
 * Assumes config object is available, $ from cash-dom, panelElement, toggleButtonElement,
 * debouncedSaveConfig, and MutationObserver are available.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isDarkMode - Whether dark mode should be enabled.
 */
function applyDarkMode(config, isDarkMode) {
     // Check critical dependencies
     if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement || typeof config !== 'object' || config === null || typeof debouncedSaveConfig !== 'function' || typeof MutationObserver === 'undefined' || typeof window.Swal === 'undefined') {
          GM_log("Pack Filler Pro: applyDarkMode critical dependencies missing. Aborting.");
          // Cannot use Swal without config, fallback to log
          GM_log("Pack Filler Pro: Cannot apply dark mode due to missing dependencies.");
          return;
     }


     try {
         // Apply dark mode class to the panel and toggle button
         if (isDarkMode) {
             $(panelElement).addClass('dark-mode');
             $(toggleButtonElement).addClass('dark-mode');
         } else {
             $(panelElement).removeClass('dark-mode');
             $(toggleButtonElement).removeClass('dark-mode');
         }

         // Update config and save (debounced)
         config.isDarkMode = isDarkMode;
         debouncedSaveConfig(config); // Assumes debouncedSaveConfig is available


         // --- Apply Dark Mode to SweetAlert2 Popups ---
         // SweetAlert2 popups are added to the body dynamically, so we need to observe the DOM
         // or apply styles to them after they are created.
         // Using a MutationObserver is a robust way to catch new Swal popups.

         // Disconnect any existing observer to avoid duplicates
         if (window._pfpSwalObserver) {
             window._pfpSwalObserver.disconnect();
             delete window._pfpSwalObserver;
             GM_log("Pack Filler Pro: Disconnected previous Swal MutationObserver.");
         }

         // Create a new observer
         const observer = new MutationObserver((mutations) => {
             mutations.forEach((mutation) => {
                 mutation.addedNodes.forEach((node) => {
                     // Check if the added node is a SweetAlert2 container
                     // Swal uses classes like 'swal2-container' and 'swal2-popup'
                     // We target the main popup element for our custom class
                     if (node.classList && node.classList.contains('swal2-popup')) {
                         GM_log("Pack Filler Pro: MutationObserver detected a new SweetAlert2 popup.");
                         // Apply the dark mode class if enabled
                         if (config.isDarkMode) {
                             $(node).addClass('dark-mode');
                             GM_log("Pack Filler Pro: Applied dark-mode class to new Swal popup.");
                         }
                         // We don't need to observe inside the popup, so no need to disconnect here
                     }
                 });
             });
         });

         // Start observing the document body for added nodes
         observer.observe(document.body, { childList: true, subtree: true });

         // Store the observer globally so we can disconnect it later (e.g., on script unload)
         window._pfpSwalObserver = observer;
         GM_log("Pack Filler Pro: New Swal MutationObserver started.");


         GM_log(`Pack Filler Pro: Dark mode ${isDarkMode ? 'enabled' : 'disabled'}.`);

     } catch (e) {
         GM_log(`Pack Filler Pro: ERROR - Failed to apply dark mode: ${e.message}`, e);
         // Cannot use Swal without config, fallback to log
         GM_log("Pack Filler P
