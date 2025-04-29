// This block handles updating the UI based on config, updating config from UI,
// applying dark mode, and binding event listeners to UI elements.
// It relies heavily on the cash-dom library ($) and the 'config' object.
// It also includes the MutationObserver for dynamic updates.
// In a modular setup, this could be a 'uiManager.js' or 'eventHandlers.js' module.

// Assumes '$', 'config', 'panelElement', 'toggleButtonElement', 'panelSimpleBarInstance',
// 'fillPacks', 'clearAllInputs', 'updateConfigFromUI', 'debouncedSaveConfig',
// 'updatePanelVisibility', 'applyDarkMode', 'getPackInputs', 'SELECTOR',
// 'DARK_MODE_CHECKBOX_ID', 'FULL_PAGE_CHECKBOX_ID', 'AUTO_FILL_LOADED_CHECKBOX_ID',
// 'FILL_EMPTY_ONLY_CHECKBOX_ID', 'MAX_TOTAL_INPUT_ID', and GM_log are accessible.

/* --- UI Event Binding --- */
function bindPanelEvents() {
    // Fill Packs Button
    $('#pfp-run').on('click', () => fillPacks()); // Assumes fillPacks is accessible

    // Clear All Button
    $('#pfp-clear-btn').on('click', () => clearAllInputs()); // Assumes clearAllInputs is accessible

    // Mode Selection Change
    $('#pfp-mode').on('change', function() {
        updatePanelModeDisplay(this.value); // Assumes updatePanelModeDisplay is accessible
        updateConfigFromUI(); // Assumes updateConfigFromUI is accessible
        debouncedSaveConfig(); // Assumes debouncedSaveConfig is accessible
    });

    // Input/Checkbox/Select Changes (Debounced Save)
    $(panelElement).on('input change', '.pfp-input, .pfp-select, .pfp-checkbox', function(e) {
        updateConfigFromUI(); // Assumes updateConfigFromUI is accessible
        debouncedSaveConfig(); // Assumes debouncedSaveConfig is accessible

        if (e.target.id === DARK_MODE_CHECKBOX_ID) {
            applyDarkMode(e.target.checked); // Assumes applyDarkMode is accessible
        }
    });


    // Panel Close Button
    $(panelElement).find('.pfp-close').on('click', () => {
        updatePanelVisibility(false); // Assumes updatePanelVisibility is accessible
    });

    // Toggle Button
    $(toggleButtonElement).on('click', () => {
        updatePanelVisibility(true); // Assumes updatePanelVisibility is accessible
    });

    // MutationObserver to update max count and simplebar when inputs are added
     const observer = new MutationObserver((mutationsList, observer) => {
         let inputsAdded = false;
         for(const mutation of mutationsList) {
             if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                 // Check if any of the added nodes contain our input selector
                 inputsAdded = Array.from(mutation.addedNodes).some(node =>
                      node.nodeType === 1 && (node.matches(SELECTOR) || node.querySelector(SELECTOR)) // Assumes SELECTOR is accessible
                 );
                 if (inputsAdded) break;
             }
         }

         if (inputsAdded) {
             const currentInputCount = getPackInputs().length; // Assumes getPackInputs is accessible
             $('#pfp-count').attr('max', currentInputCount); // Assumes '$' is accessible
             GM_log(`Pack Filler Pro: Detected new inputs. Updated count max to ${currentInputCount}.`);
             if (panelSimpleBarInstance) { // Assumes panelSimpleBarInstance is accessible
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

// Uses $ (cash-dom) for brevity, updated to handle top positioning
// Updates the visibility of the panel and saves the visibility state.
// Can also apply a specific position and save it.
function updatePanelVisibility(isVisible, position = null) {
    if (!panelElement || !toggleButtonElement) return; // Assumes panelElement and toggleButtonElement are accessible

    $(panelElement).toggleClass('hidden', !isVisible);
    $(toggleButtonElement).toggleClass('hidden', isVisible);
    config.panelVisible = isVisible; // Assumes 'config' is accessible

    if (isVisible && panelSimpleBarInstance) { // Assumes panelSimpleBarInstance is accessible
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
    debouncedSaveConfig(); // Assumes debouncedSaveConfig is accessible
}

// Uses $ (cash-dom) for brevity
// Loads the saved configuration values into the UI elements.
function loadConfigIntoUI() {
    if (!panelElement) return; // Assumes panelElement is accessible

    $('#pfp-mode').val(config.lastMode); // Assumes 'config' is accessible
    $('#pfp-count').val(config.lastCount);
    $('#pfp-fixed').val(config.lastFixedQty);
    $('#pfp-min').val(config.lastMinQty);
    $('#pfp-max').val(config.lastMaxQty);
    $('#pfp-clear').prop('checked', config.lastClear);
    $(`#${FULL_PAGE_CHECKBOX_ID}`).prop('checked', config.loadFullPage); // Assumes FULL_PAGE_CHECKBOX_ID is accessible
    $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode); // Assumes DARK_MODE_CHECKBOX_ID is accessible
    $(`#${MAX_TOTAL_INPUT_ID}`).val(config.maxTotalAmount); // Assumes MAX_TOTAL_INPUT_ID is accessible
    $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).prop('checked', config.autoFillLoaded); // Assumes AUTO_FILL_LOADED_CHECKBOX_ID is accessible
    $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).prop('checked', config.fillEmptyOnly); // Assumes FILL_EMPTY_ONLY_CHECKBOX_ID is accessible

    // Apply initial panel position from config
    // Clear previous positioning properties before applying new ones
    $(panelElement).css({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
    $(panelElement).css(config.panelPos); // Apply position using $().css

    GM_log("Pack Filler Pro: UI loaded from config.");
}

// Uses $ (cash-dom) for brevity
// Updates the 'config' object based on the current values in the UI elements.
function updateConfigFromUI() {
    if (!panelElement) return; // Assumes panelElement is accessible

    config.lastMode = $('#pfp-mode').val() || DEFAULT_CONFIG.lastMode; // Assumes 'config' and 'DEFAULT_CONFIG' are accessible
    config.lastCount = parseInt($('#pfp-count').val(), 10) || 0;
    config.lastFixedQty = parseInt($('#pfp-fixed').val(), 10) || 0;
    config.lastMinQty = parseInt($('#pfp-min').val(), 10) || 0;
    config.lastMaxQty = parseInt($('#pfp-max').val(), 10) || 0;
    config.lastClear = $('#pfp-clear').is(':checked');
    config.loadFullPage = $(`#${FULL_PAGE_CHECKBOX_ID}`).is(':checked'); // Assumes FULL_PAGE_CHECKBOX_ID is accessible
    config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).is(':checked'); // Assumes DARK_MODE_CHECKBOX_ID is accessible
    config.maxTotalAmount = parseInt($(`#${MAX_TOTAL_INPUT_ID}`).val(), 10) || 0; // Assumes MAX_TOTAL_INPUT_ID is accessible
    config.autoFillLoaded = $(`#${AUTO_FILL_LOADED_CHECKBOX_ID}`).is(':checked'); // Assumes AUTO_FILL_LOADED_CHECKBOX_ID is accessible
    config.fillEmptyOnly = $(`#${FILL_EMPTY_ONLY_CHECKBOX_ID}`).is(':checked'); // Assumes FILL_EMPTY_ONLY_CHECKBOX_ID is accessible


    // Ensure quantities are within valid bounds after reading
    config.lastFixedQty = clamp(config.lastFixedQty, 0, MAX_QTY); // Assumes 'clamp' and 'MAX_QTY' are accessible
    config.lastMinQty = clamp(config.lastMinQty, 0, MAX_QTY);
    config.lastMaxQty = clamp(config.lastMaxQty, 0, MAX_QTY);
    // Ensure min <= max for random range
    if (config.lastMinQty > config.lastMaxQty) {
         [config.lastMinQty, config.lastMaxQty] = [config.lastMaxQty, config.lastMinQty];
    }
    config.maxTotalAmount = Math.max(0, config.maxTotalAmount);

    GM_log("Pack Filler Pro: Config updated from UI.");
}

// Uses $ (cash-dom) for brevity
// Applies or removes the 'dark-mode' class to the panel and recalculates SimpleBar.
function applyDarkMode(isDark) {
    if (!panelElement) return; // Assumes panelElement is accessible
    $(panelElement).toggleClass('dark-mode', isDark);
    if (panelSimpleBarInstance) { // Assumes panelSimpleBarInstance is accessible
        panelSimpleBarInstance.recalculate();
    }
    GM_log(`Pack Filler Pro: Dark Mode ${isDark ? 'enabled' : 'disabled'}.`);
}

// Assumes bindPanelEvents will be called during initialization.
// Assumes loadConfigIntoUI and updateConfigFromUI are called as part of UI management.
