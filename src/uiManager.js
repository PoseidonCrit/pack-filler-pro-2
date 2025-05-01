// This file handles updating the UI based on config, updating config from UI,
// and binding event listeners to UI elements.
// It relies heavily on the cash-dom library ($).

// It assumes the following are available in the main script's scope via @require:
// - $ from cash-dom
// - panelElement, toggleButtonElement (variables populated in main script)
// - functions from fillLogic.js (fillPacks)
// - functions from domUtils.js (clearAllInputs, getPackInputs, clamp, sanitize)
// - functions from configManager.js (debouncedSaveConfig)
// - functions from swalHelpers.js (SWAL_ALERT, SWAL_TOAST)
// - constants from constants.js (SELECTOR, etc.)
// - GM_log function
// - MutationObserver API
// - window.Swal (SweetAlert2 instance)


/* --- UI State Management --- */

/**
 * Loads configuration values into the UI controls.
 * Assumes config object and necessary UI element IDs/references are available.
 * Assumes $ from cash-dom is available.
 * @param {object} config - The script's configuration object.
 */
function loadConfigIntoUI(config) {
    // GM_log("Pack Filler Pro: Loading config into UI."); // Minimal logging
    // Check critical dependency
    if (typeof $ === 'undefined') {
         // GM_log("Pack Filler Pro: loadConfigIntoUI dependency ($) missing. Aborting."); // Minimal logging
         return;
    }
     // Ensure config object is valid
     if (typeof config !== 'object' || config === null) {
          // GM_log("Pack Filler Pro: loadConfigIntoUI called with invalid config object. Aborting.", config); // Minimal logging
          return;
     }

    try {
        // Use constants for IDs
        $(`#${MODE_SELECT_ID}`).val(config.lastMode);
        $(`#${COUNT_INPUT_ID}`).val(config.lastCount);
        $(`#${FIXED_INPUT_ID}`).val(config.lastFixedQty);
        $(`#${MIN_INPUT_ID}`).val(config.lastMinQty);
        $(`#${MAX_INPUT_ID}`).val(config.lastMaxQty);
        $(`#${CLEAR_INPUTS_CHECKBOX_ID}`).prop('checked', config.lastClear);
        $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode);

        // Panel visibility and position are handled separately in updatePanelVisibility

        // GM_log("Pack Filler Pro: Config loaded into UI."); // Minimal logging
    } catch (e) {
        // GM_log("Pack Filler Pro: Error loading config into UI.", e); // Minimal logging
        // Use SWAL_ALERT if available, assumes sanitize is available
        if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
             SWAL_ALERT('UI Error', sanitize(`Failed to load settings into UI: ${e.message}.`), 'error', config);
        }
    }
}

/**
 * Updates the configuration object based on the current values in the UI controls.
 * Assumes config object and necessary UI element IDs/references are available.
 * Assumes $ from cash-dom and clamp from domUtils.js are available.
 * @param {object} config - The script's configuration object to update.
 */
function updateConfigFromUI(config) {
    // GM_log("Pack Filler Pro: Updating config from UI."); // Minimal logging
     // Check critical dependencies
     if (typeof $ === 'undefined' || typeof clamp !== 'function') {
          // GM_log("Pack Filler Pro: updateConfigFromUI dependencies ($ or clamp) missing. Aborting."); // Minimal logging
          return;
     }
     // Ensure config object is valid
     if (typeof config !== 'object' || config === null) {
          // GM_log("Pack Filler Pro: updateConfigFromUI called with invalid config object. Aborting.", config); // Minimal logging
          return;
     }

     // Assumes MAX_QTY from constants.js is available
     if (typeof MAX_QTY === 'undefined') {
         // GM_log("Pack Filler Pro: updateConfigFromUI dependency (MAX_QTY) missing. Using fallback 99."); // Minimal logging
     }
     const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY


    try {
        // Use constants for IDs and clamp values
        config.lastMode = $(`#${MODE_SELECT_ID}`).val();
        config.lastCount = clamp($(`#${COUNT_INPUT_ID}`).val(), 0, Infinity); // Count can be up to available inputs
        config.lastFixedQty = clamp($(`#${FIXED_INPUT_ID}`).val(), 0, maxQty);
        config.lastMinQty = clamp($(`#${MIN_INPUT_ID}`).val(), 0, maxQty);
        config.lastMaxQty = clamp($(`#${MAX_INPUT_ID}`).val(), 0, maxQty);
        config.lastClear = $(`#${CLEAR_INPUTS_CHECKBOX_ID}`).prop('checked');
        config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked');

        // Pattern type is fixed to 'random' or 'fixed' in minimal UI, but config stores it
        // Read the selected pattern type from the UI
        config.patternType = $(`#${PATTERN_TYPE_SELECT_ID}`).val();


        // Panel position is updated directly in the drag event handler

        // GM_log("Pack Filler Pro: Config updated from UI:", config); // Minimal logging
    } catch (e) {
        // GM_log("Pack Filler Pro: Error updating config from UI.", e); // Minimal logging
         // Use SWAL_ALERT if available, assumes sanitize is available
        if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
             SWAL_ALERT('UI Error', sanitize(`Failed to read settings from UI: ${e.message}.`), 'error', config);
        }
    }
}

/**
 * Updates the display text in the panel header to show the current mode.
 * Assumes panelElement reference and necessary constants are available.
 * Assumes $ from cash-dom is available.
 * @param {string} mode - The current fill mode ('fixed', 'random', 'unlimited').
 */
function updatePanelModeDisplay(mode) {
    // Check critical dependency
    if (typeof $ === 'undefined' || !panelElement) {
         // GM_log("Pack Filler Pro: updatePanelModeDisplay dependencies ($ or panelElement) missing. Aborting."); // Minimal logging
         return;
    }

    const modeText = {
        fixed: 'Fixed Count',
        random: 'Random Count',
        unlimited: 'All Visible'
    }[mode] || 'Unknown Mode'; // Fallback text

    try {
        $(panelElement).find('.pfp-title').text(`Pack Filler Pro - ${modeText}`);
        // GM_log(`Pack Filler Pro: Panel mode display updated to "${modeText}".`); // Minimal logging
    } catch (e) {
        // GM_log("Pack Filler Pro: Error updating panel mode display.", e); // Minimal logging
    }
}

/**
 * Updates the visibility of quantity input groups based on the selected mode.
 * Assumes $ from cash-dom and necessary UI element IDs are available.
 * @param {string} mode - The current fill mode ('fixed', 'random', 'unlimited').
 */
function updateQuantityInputVisibility(mode) {
    // Check critical dependency
    if (typeof $ === 'undefined') {
         // GM_log("Pack Filler Pro: updateQuantityInputVisibility dependency ($) missing. Aborting."); // Minimal logging
         return;
    }

    try {
        // Use constants for IDs
        const $countGroup = $(`#pfp-count-group`);
        const $fixedGroup = $(`#pfp-fixed-group`);
        const $rangeInputs = $(`#pfp-range-inputs`);

        // Ensure elements exist before manipulating
        if (!$countGroup.length || !$fixedGroup.length || !$rangeInputs.length) {
             // GM_log("Pack Filler Pro: updateQuantityInputVisibility: Required UI elements not found. Skipping visibility update."); // Minimal logging
             return;
        }

        switch (mode) {
            case 'fixed':
                $countGroup.removeClass('hidden');
                $fixedGroup.removeClass('hidden');
                $rangeInputs.addClass('hidden');
                break;
            case 'random':
                $countGroup.removeClass('hidden');
                $fixedGroup.addClass('hidden');
                $rangeInputs.removeClass('hidden');
                break;
            case 'unlimited':
                $countGroup.addClass('hidden');
                $fixedGroup.addClass('hidden');
                $rangeInputs.addClass('hidden');
                break;
            default:
                // Hide all if mode is unknown
                $countGroup.addClass('hidden');
                $fixedGroup.addClass('hidden');
                $rangeInputs.addClass('hidden');
                // GM_log(`Pack Filler Pro: Unknown mode "${mode}" received. Hiding quantity inputs.`); // Minimal logging
        }
        // GM_log(`Pack Filler Pro: Quantity input visibility updated for mode "${mode}".`); // Minimal logging
    } catch (e) {
        // GM_log("Pack Filler Pro: Error updating quantity input visibility.", e); // Minimal logging
    }
}

/**
 * Updates the visibility of pattern parameter inputs based on the selected pattern type.
 * This is minimal and might just hide the whole section if not 'random' or 'fixed'.
 * Assumes $ from cash-dom and necessary UI element IDs are available.
 * @param {string} patternType - The current fill pattern type.
 */
function updatePatternParamsVisibility(patternType) {
     // Check critical dependency
    if (typeof $ === 'undefined') {
         // GM_log("Pack Filler Pro: updatePatternParamsVisibility dependency ($) missing. Aborting."); // Minimal logging
         return;
    }

    try {
        // Use constants for IDs
        const $patternParamsDiv = $(`#${PATTERN_PARAMS_DIV_ID}`);

        // Ensure element exists
        if (!$patternParamsDiv.length) {
             // GM_log("Pack Filler Pro: updatePatternParamsVisibility: Pattern parameters div not found. Skipping visibility update."); // Minimal logging
             return;
        }

        // In minimal version, pattern params are always hidden as only 'fixed'/'random' are supported via mode
        // The patternType select exists in the HTML but is hidden via CSS in minimal.
        // This function will ensure the params div is hidden regardless of the selected patternType value.
        $patternParamsDiv.addClass('hidden');
        // GM_log(`Pack Filler Pro: Pattern parameters hidden (minimal version).`); // Minimal logging

    } catch (e) {
        // GM_log("Pack Filler Pro: Error updating pattern parameters visibility.", e); // Minimal logging
    }
}


/**
 * Applies or removes the dark mode class to relevant elements.
 * Assumes config object, panelElement, toggleButtonElement, and MutationObserver are available.
 * Assumes $ from cash-dom and window.Swal are available.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isDarkMode - Whether dark mode should be applied.
 */
function applyDarkMode(config, isDarkMode) {
    // GM_log(`Pack Filler Pro: Applying dark mode: ${isDarkMode}`); // Minimal logging
     // Check critical dependencies
    if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement || typeof window.Swal === 'undefined' || typeof MutationObserver === 'undefined') {
         // GM_log("Pack Filler Pro: applyDarkMode dependencies ($, panelElement, toggleButtonElement, Swal, MutationObserver) missing. Aborting."); // Minimal logging
         return;
    }

    try {
        // Apply to panel and toggle button
        $(panelElement).toggleClass('dark-mode', isDarkMode);
        $(toggleButtonElement).toggleClass('dark-mode', isDarkMode);

        // Apply to SweetAlert2 popups dynamically using a MutationObserver
        // This observer needs to be set up once and persist.
        // Store the observer instance globally or in a shared scope to disconnect later.
        if (!window._pfpSwalObserver) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        // Check if the added node is a SweetAlert2 popup
                        if (node.nodeType === 1 && node.classList && node.classList.contains('swal2-popup')) {
                            // Apply the dark mode class if enabled
                            if (config.isDarkMode) { // Use the current config state
                                $(node).addClass('dark-mode');
                                // Also apply to specific internal elements if needed (Swal titles, content)
                                $(node).find('.swal2-title, .swal2-html-container').addClass('dark-mode');
                            } else {
                                // Remove dark mode class if disabled
                                $(node).removeClass('dark-mode');
                                $(node).find('.swal2-title, .swal2-html-container').removeClass('dark-mode');
                            }
                             // Add custom classes too if they are used for styling
                             $(node).addClass('pfp-swal-popup'); // Add base custom class
                             if (node.classList.contains('swal2-toast')) {
                                 $(node).addClass('pfp-swal-toast-popup'); // Add toast custom class
                             }
                             $(node).find('.swal2-title').addClass('pfp-swal-title');
                             $(node).find('.swal2-html-container').addClass('pfp-swal-html');
                             $(node).find('.swal2-confirm').addClass('mini primary'); // Add mini.css button classes


                        }
                    });
                });
            });

            // Observe the document body for added nodes (SweetAlert2 popups are appended to body)
            observer.observe(document.body, { childList: true, subtree: true });
            window._pfpSwalObserver = observer; // Store the observer instance
            // GM_log("Pack Filler Pro: SweetAlert2 popup MutationObserver initialized."); // Minimal logging
        }

        // The observer will handle future popups.

        // GM_log(`Pack Filler Pro: Dark mode class toggled on panel and toggle button.`); // Minimal logging

    } catch (e) {
        // GM_log("Pack Filler Pro: Error applying dark mode.", e); // Minimal logging
         // Use SWAL_ALERT if available, assumes sanitize is available
        if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
             SWAL_ALERT('UI Error', sanitize(`Failed to apply dark mode: ${e.message}.`), 'error', config);
        }
    }
}


/* --- UI Event Binding --- */
/**
 * Binds event listeners to the UI panel elements.
 * Assumes necessary DOM elements and functions from other modules are available in scope.
 * Includes robustness checks for dependencies.
 * @param {object} config - The script's configuration object.
 */
function bindPanelEvents(config) { // Accept config here
    // GM_log("Pack Filler Pro: bindPanelEvents started."); // Minimal logging

    // Check if critical DOM elements and core functions are available before binding events
    if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement ||
        typeof fillPacks !== 'function' || typeof clearAllInputs !== 'function' ||
        typeof updateConfigFromUI !== 'function' || typeof debouncedSaveConfig !== 'function' ||
        typeof updatePanelModeDisplay !== 'function' || typeof updatePanelVisibility !== 'function' ||
        typeof applyDarkMode !== 'function' || typeof getPackInputs !== 'function' ||
        typeof SELECTOR === 'undefined' || typeof SWAL_ALERT === 'undefined' || typeof SWAL_TOAST === 'undefined' || typeof sanitize === 'function' || typeof clamp === 'function') { // Added more checks

        const errorMessage = "Critical UI binding dependencies missing. UI events will not be bound.";
        // GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`); // Minimal logging
        // Use fallback alert if SWAL_ALERT is not available
        if (typeof SWAL_ALERT === 'function') SWAL_ALERT('UI Binding Error', sanitize(errorMessage), 'error', config);
        else alert(`Pack Filler Pro Error: ${errorMessage}`);
        return; // Abort binding if critical dependencies are missing
    }


    // Fill Packs Button
    // Assumes fillPacks, updateConfigFromUI, debouncedSaveConfig are available
    $(`#${FILL_PACKS_BTN_ID}`).on('click', async () => { // Make async to await fillPacks
        // GM_log("Pack Filler Pro: 'Fill Packs' button clicked."); // Minimal logging
        try {
            // Ensure config is updated from UI before filling
            updateConfigFromUI(config); // Pass config
            debouncedSaveConfig(config); // Save config immediately on manual trigger

            // Trigger the main fill logic
            await fillPacks(config); // Pass config (isAutoFill is not used in minimal)

        } catch (e) {
            // GM_log("Pack Filler Pro: Error during 'Fill Packs' click handler.", e); // Minimal logging
            // fillPacks is expected to handle its own errors and display SWALs,
            // but this catch is a safeguard for errors *within* the handler itself.
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Action Error', sanitize(`An unexpected error occurred: ${e.message}`), 'error', config);
        }
    });

    // Clear All Button
    // Assumes clearAllInputs, updateConfigFromUI, debouncedSaveConfig are available
    $(`#${CLEAR_ALL_BTN_ID}`).on('click', () => {
        // GM_log("Pack Filler Pro: 'Clear All' button clicked."); // Minimal logging
        try {
            // Clear inputs
            clearAllInputs(); // clearAllInputs handles its own feedback

            // Update config (specifically the 'clear' checkbox state, although it's applied on click)
            updateConfigFromUI(config); // Pass config
            debouncedSaveConfig(config); // Save config

        } catch (e) {
             // GM_log("Pack Filler Pro: Error during 'Clear All' click handler.", e); // Minimal logging
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Clear Action Error', sanitize(`An unexpected error occurred: ${e.message}`), 'error', config);
        }
    });

    // Fill 1 Random Pack Button - NOT included in minimal UI HTML
    // This event listener is commented out as the button is not in the minimal HTML.
    /*
     $(`#${FILL_RANDOM_BTN_ID}`).on('click', async () => {
        GM_log("Pack Filler Pro: 'Fill 1 Random Pack' button clicked.");
        try {
             updateConfigFromUI(config);
             debouncedSaveConfig(config);
             await fillRandomPackInput(config);
        } catch (e) {
             GM_log("Pack Filler Pro: Error during 'Fill 1 Random Pack' click handler.", e);
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Action Error', sanitize(`An unexpected error occurred: ${e.message}`), 'error', config);
        }
     });
     */


    // Panel Toggle Button
    // Assumes panelElement, toggleButtonElement, updatePanelVisibility, debouncedSaveConfig are available
    $(toggleButtonElement).on('click', () => {
        // GM_log("Pack Filler Pro: Toggle button clicked."); // Minimal logging
        // Toggle visibility state in config
        config.panelVisible = !config.panelVisible;
        // Update UI visibility and save config
        updatePanelVisibility(config, config.panelVisible, config.panelPos); // Pass config
        debouncedSaveConfig(config); // Save config
    });

    // Panel Close Button
    // Assumes panelElement, updatePanelVisibility, debouncedSaveConfig are available
    $(panelElement).find('.pfp-close').on('click', () => {
        // GM_log("Pack Filler Pro: Close button clicked."); // Minimal logging
        // Set visibility state in config to false
        config.panelVisible = false;
        // Update UI visibility and save config
        updatePanelVisibility(config, config.panelVisible, config.panelPos); // Pass config
        debouncedSaveConfig(config); // Save config
    });

    // Panel Dragging
    // Assumes panelElement reference is available
    // Relies on standard mouse events
    const $panel = $(panelElement);
    const $header = $panel.find('.pfp-header');
    let isDragging = false;
    let offsetX, offsetY;

    $header.on('mousedown', (e) => {
        // GM_log("Pack Filler Pro: Panel header mousedown."); // Minimal logging
        isDragging = true;
        $panel.addClass('dragging'); // Add class for styling (e.g., cursor)
        // Calculate offset relative to the panel's current position
        const panelRect = panelElement.getBoundingClientRect();
        offsetX = e.clientX - panelRect.left;
        offsetY = e.clientY - panelRect.top;

        // Prevent default text selection/dragging behavior
        e.preventDefault();
    });

    $(document).on('mousemove', (e) => {
        if (!isDragging) return;
        // GM_log("Pack Filler Pro: Document mousemove (dragging)."); // Too chatty

        // Calculate new position based on mouse position and initial offset
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const panelRect = panelElement.getBoundingClientRect();
        const panelWidth = panelRect.width;
        const panelHeight = panelRect.height;


        // Clamp position to stay within viewport bounds
        newLeft = clamp(newLeft, 0, viewportWidth - panelWidth);
        newTop = clamp(newTop, 0, viewportHeight - panelHeight);


        // Apply new position using 'left' and 'top' properties
        // Ensure units are 'px'
        $panel.css({
            left: `${newLeft}px`,
            top: `${newTop}px`,
            right: 'auto', // Reset right/bottom when using left/top
            bottom: 'auto'
        });
         // GM_log(`Panel position updated: top=${newTop}px, left=${newLeft}px`); // Too chatty

        // Prevent default behavior (e.g., selecting text outside the panel)
        e.preventDefault();
    });

    $(document).on('mouseup', () => {
        if (!isDragging) return;
        // GM_log("Pack Filler Pro: Document mouseup (dragging finished)."); // Minimal logging
        isDragging = false;
        $panel.removeClass('dragging'); // Remove dragging class

        // Save the final position after dragging stops
        // Get the final calculated position relative to the viewport
        const panelRect = panelElement.getBoundingClientRect();
        config.panelPos = {
             top: `${panelRect.top}px`,
             left: `${panelRect.left}px`,
             right: 'auto', // Always save as left/top for consistency after drag
             bottom: 'auto'
        };
        debouncedSaveConfig(config); // Save config with new position
    });


    // Configuration Control Change Handlers
    // Update config and save whenever a relevant control changes
    // Assumes updateConfigFromUI and debouncedSaveConfig are available
    // Use constants for IDs
    $(`#${MODE_SELECT_ID}, #${COUNT_INPUT_ID}, #${FIXED_INPUT_ID}, #${MIN_INPUT_ID}, #${MAX_INPUT_ID}`).on('input change', () => {
        // Use 'input' for immediate updates (like range sliders - none in minimal) and 'change' for others
        updateConfigFromUI(config); // Pass config
        debouncedSaveConfig(config); // Save config

        // Special UI updates based on changes
        updateQuantityInputVisibility(config.lastMode); // Update visibility based on mode
        // Minimal version doesn't have pattern params visibility logic tied to UI changes here

        updatePanelModeDisplay(config.lastMode); // Update header text based on mode
    });

    // Checkbox change handlers (use 'change' event)
    // Assumes updateConfigFromUI and debouncedSaveConfig are available
    // Use constants for IDs
    $(`#${CLEAR_INPUTS_CHECKBOX_ID}, #${DARK_MODE_CHECKBOX_ID}`).on('change', function() { // Use function() for 'this' context
        updateConfigFromUI(config); // Pass config
        debouncedSaveConfig(config); // Save config

        // Special UI updates based on changes
        if (this.id === DARK_MODE_CHECKBOX_ID) {
             applyDarkMode(config, config.isDarkMode); // Apply dark mode based on checkbox state
        }
    });


    // MutationObserver to apply dark mode to SweetAlert2 popups
    // This is initialized in applyDarkMode, but the observer instance is stored
    // on window._pfpSwalObserver to be disconnected on unload.

    // GM_log("Pack Filler Pro: bindPanelEvents finished."); // Minimal logging
}

/**
 * Updates the visibility and position of the UI panel.
 * Assumes panelElement, toggleButtonElement references and $ from cash-dom are available.
 * Assumes config object is available.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isVisible - Whether the panel should be visible.
 * @param {object} position - The desired panel position {top, right, bottom, left}.
 */
function updatePanelVisibility(config, isVisible, position) {
     // Check critical dependencies
    if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement) {
         // GM_log("Pack Filler Pro: updatePanelVisibility dependencies ($, panelElement, toggleButtonElement) missing. Aborting."); // Minimal logging
         return;
    }
     // Ensure config object and position object are valid
     if (typeof config !== 'object' || config === null || typeof position !== 'object' || position === null) {
          // GM_log("Pack Filler Pro: updatePanelVisibility called with invalid config or position object. Aborting.", {config: config, position: position}); // Minimal logging
          return;
     }


    const $panel = $(panelElement);
    const $toggleButton = $(toggleButtonElement);

    if (isVisible) {
        $panel.removeClass('hidden');
        $toggleButton.removeClass('hidden'); // Show toggle button too (it hides when panel is closed)

        // Apply position from config
        // Use .css() with an object to set multiple styles
        $panel.css({
            top: position.top || 'auto', // Use 'auto' if value is falsy
            right: position.right || 'auto',
            bottom: position.bottom || 'auto',
            left: position.left || 'auto'
        });
        // GM_log(`Pack Filler Pro: Panel shown and positioned: top=${position.top}, right=${position.right}, bottom=${position.bottom}, left=${position.left}`); // Minimal logging

        // SimpleBar is not included in minimal, so no recalculate needed here.

    } else {
        $panel.addClass('hidden');
        // Keep toggle button visible so the user can reopen the panel
        // $toggleButton.addClass('hidden'); // Decide if toggle button should hide or not
        // GM_log("Pack Filler Pro: Panel hidden."); // Minimal logging
    }
}


// The functions loadConfigIntoUI, updateConfigFromUI, updatePanelModeDisplay,
// updateQuantityInputVisibility, updatePatternParamsVisibility, applyDarkMode,
// bindPanelEvents, and updatePanelVisibility are made available to the main script's scope via @require.
