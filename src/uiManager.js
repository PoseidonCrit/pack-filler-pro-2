// This file handles updating the UI based on config, updating config from UI,
// and binding event listeners to UI elements.
// It relies heavily on the cash-dom library ($).
// Wrapped in an IIFE and attaches functions to window.pfpMinimal.

(function() {
    'use strict';

    // Ensure the global namespace object exists and get references to shared dependencies
    window.pfpMinimal = window.pfpMinimal || {};
    const $ = window.pfpMinimal.$; // From constants
    const fillPacks = window.pfpMinimal.fillPacks; // From fillLogic
    const clearAllInputs = window.pfpMinimal.clearAllInputs; // From domUtils
    const getPackInputs = window.pfpMinimal.getPackInputs; // From domUtils
    const clamp = window.pfpMinimal.clamp; // From domUtils
    const sanitize = window.pfpMinimal.sanitize; // From domUtils
    const loadConfig = window.pfpMinimal.loadConfig; // From configManager (not used in this file but good practice)
    const saveConfig = window.pfpMinimal.saveConfig; // From configManager (not used in this file but good practice)
    const debouncedSaveConfig = window.pfpMinimal.debouncedSaveConfig; // From configManager
    const SWAL_ALERT = window.pfpMinimal.SWAL_ALERT; // From swalHelpers
    const SWAL_TOAST = window.pfpMinimal.SWAL_TOAST; // From swalHelpers
    const SELECTOR = window.pfpMinimal.SELECTOR; // From constants
    const MAX_QTY = window.pfpMinimal.MAX_QTY; // From constants
    const PANEL_ID = window.pfpMinimal.PANEL_ID; // From constants
    const TOGGLE_BUTTON_ID = window.pfpMinimal.TOGGLE_BUTTON_ID; // From constants
    const MODE_SELECT_ID = window.pfpMinimal.MODE_SELECT_ID; // From constants
    const COUNT_INPUT_ID = window.pfpMinimal.COUNT_INPUT_ID; // From constants
    const FIXED_INPUT_ID = window.pfpMinimal.FIXED_INPUT_ID; // From constants
    const MIN_INPUT_ID = window.pfpMinimal.MIN_INPUT_ID; // From constants
    const MAX_INPUT_ID = window.pfpMinimal.MAX_INPUT_ID; // From constants
    const CLEAR_INPUTS_CHECKBOX_ID = window.pfpMinimal.CLEAR_INPUTS_CHECKBOX_ID; // From constants
    const DARK_MODE_CHECKBOX_ID = window.pfpMinimal.DARK_MODE_CHECKBOX_ID; // From constants
    const FILL_PACKS_BTN_ID = window.pfpMinimal.FILL_PACKS_BTN_ID; // From constants
    const CLEAR_ALL_BTN_ID = window.pfpMinimal.CLEAR_ALL_BTN_ID; // From constants
    const GM_log = window.GM_log; // Get GM_log from window
    const MutationObserver = window.MutationObserver; // Get MutationObserver from window
    const Swal = window.Swal; // Get SweetAlert2 from window

    // References to panel elements will be passed from the main script during bindPanelEvents
    let panelElement = null;
    let toggleButtonElement = null;
    // SimpleBar is not used in minimal version


    /* --- UI State Management --- */

    /**
     * Loads configuration values into the UI controls.
     * Assumes config object and necessary UI element IDs are available via window.pfpMinimal.
     * Assumes $ from window.pfpMinimal is available.
     * @param {object} config - The script's configuration object.
     */
    function loadConfigIntoUI(config) {
        // GM_log("Pack Filler Pro: Loading config into UI."); // Minimal logging
        if (typeof $ === 'undefined') {
             if (typeof GM_log === 'function') GM_log("Pack Filler Pro: loadConfigIntoUI dependency ($) missing. Aborting.");
             return;
        }
         if (typeof config !== 'object' || config === null) {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: loadConfigIntoUI called with invalid config object. Aborting.", config);
              return;
         }

        try {
            $(`#${MODE_SELECT_ID}`).val(config.lastMode);
            $(`#${COUNT_INPUT_ID}`).val(config.lastCount);
            $(`#${FIXED_INPUT_ID}`).val(config.lastFixedQty);
            $(`#${MIN_INPUT_ID}`).val(config.lastMinQty);
            $(`#${MAX_INPUT_ID}`).val(config.lastMaxQty);
            $(`#${CLEAR_INPUTS_CHECKBOX_ID}`).prop('checked', config.lastClear);
            $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked', config.isDarkMode);

            // Minimal version doesn't have pattern type select in UI HTML,
            // so we don't load config.patternType into a UI element here.

            // GM_log("Pack Filler Pro: Config loaded into UI."); // Minimal logging
        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error loading config into UI.", e);
            if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
                 SWAL_ALERT('UI Error', sanitize(`Failed to load settings into UI: ${e.message}.`), 'error', config);
            }
        }
    }

    /**
     * Updates the configuration object based on the current values in the UI controls.
     * Assumes config object and necessary UI element IDs are available via window.pfpMinimal.
     * Assumes $ from window.pfpMinimal and clamp from window.pfpMinimal are available.
     * @param {object} config - The script's configuration object to update.
     */
    function updateConfigFromUI(config) {
        // GM_log("Pack Filler Pro: Updating config from UI."); // Minimal logging
         if (typeof $ === 'undefined' || typeof clamp !== 'function') {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updateConfigFromUI dependencies ($ or clamp) missing. Aborting.");
              return;
         }
         if (typeof config !== 'object' || config === null) {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updateConfigFromUI called with invalid config object. Aborting.", config);
              return;
         }

         const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;

        try {
            config.lastMode = $(`#${MODE_SELECT_ID}`).val();
            config.lastCount = clamp($(`#${COUNT_INPUT_ID}`).val(), 0, Infinity);
            config.lastFixedQty = clamp($(`#${FIXED_INPUT_ID}`).val(), 0, maxQty);
            config.lastMinQty = clamp($(`#${MIN_INPUT_ID}`).val(), 0, maxQty);
            config.lastMaxQty = clamp($(`#${MAX_INPUT_ID}`).val(), 0, maxQty);
            config.lastClear = $(`#${CLEAR_INPUTS_CHECKBOX_ID}`).prop('checked');
            config.isDarkMode = $(`#${DARK_MODE_CHECKBOX_ID}`).prop('checked');

            // Minimal version doesn't have pattern type select in UI HTML,
            // so config.patternType is not updated from UI here.
            // It will retain its value from loadConfig or DEFAULT_CONFIG.


            // GM_log("Pack Filler Pro: Config updated from UI:", config); // Minimal logging
        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error updating config from UI.", e);
            if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
                 SWAL_ALERT('UI Error', sanitize(`Failed to read settings from UI: ${e.message}.`), 'error', config);
            }
        }
    }

    /**
     * Updates the display text in the panel header to show the current mode.
     * Assumes panelElement reference and necessary constants are available via window.pfpMinimal.
     * Assumes $ from window.pfpMinimal is available.
     * @param {string} mode - The current fill mode ('fixed', 'random', 'unlimited').
     */
    function updatePanelModeDisplay(mode) {
        if (typeof $ === 'undefined' || !panelElement) {
             if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updatePanelModeDisplay dependencies ($ or panelElement) missing. Aborting.");
             return;
        }

        const modeText = {
            fixed: 'Fixed Count',
            random: 'Random Count',
            unlimited: 'All Visible'
        }[mode] || 'Unknown Mode';

        try {
            $(panelElement).find('.pfp-title').text(`Pack Filler Pro - ${modeText}`);
            // GM_log(`Pack Filler Pro: Panel mode display updated to "${modeText}".`); // Minimal logging
        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error updating panel mode display.", e);
        }
    }

    /**
     * Updates the visibility of quantity input groups based on the selected mode.
     * Assumes $ from window.pfpMinimal and necessary UI element IDs are available via window.pfpMinimal.
     * @param {string} mode - The current fill mode ('fixed', 'random', 'unlimited').
     */
    function updateQuantityInputVisibility(mode) {
        if (typeof $ === 'undefined') {
             if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updateQuantityInputVisibility dependency ($) missing. Aborting.");
             return;
        }

        try {
            const $countGroup = $(`#pfp-count-group`);
            const $fixedGroup = $(`#pfp-fixed-group`);
            const $rangeInputs = $(`#pfp-range-inputs`);

            if (!$countGroup.length || !$fixedGroup.length || !$rangeInputs.length) {
                 if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updateQuantityInputVisibility: Required UI elements not found. Skipping visibility update.");
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
                    $countGroup.addClass('hidden');
                    $fixedGroup.addClass('hidden');
                    $rangeInputs.addClass('hidden');
                    if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Unknown mode "${mode}" received. Hiding quantity inputs.`);
            }
            // GM_log(`Pack Filler Pro: Quantity input visibility updated for mode "${mode}".`); // Minimal logging
        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error updating quantity input visibility.", e);
        }
    }

    /**
     * Updates the visibility of pattern parameter inputs.
     * In the minimal version, this section is always hidden.
     * Assumes $ from window.pfpMinimal and necessary UI element IDs are available via window.pfpMinimal.
     * @param {string} patternType - The current fill pattern type (ignored in minimal).
     */
    function updatePatternParamsVisibility(patternType) {
         if (typeof $ === 'undefined') {
             if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updatePatternParamsVisibility dependency ($) missing. Aborting.");
             return;
         }

        // Minimal version doesn't have pattern parameters in the UI HTML
        // The div with ID PATTERN_PARAMS_DIV_ID is not present in minimal HTML.
        // This function will do nothing in the minimal version.
        // If the div were present but hidden by default CSS, we would ensure it stays hidden.
        // Example if the div existed:
        /*
        const PATTERN_PARAMS_DIV_ID = window.pfpMinimal.PATTERN_PARAMS_DIV_ID;
        if (typeof PATTERN_PARAMS_DIV_ID !== 'undefined') {
             const $patternParamsDiv = $(`#${PATTERN_PARAMS_DIV_ID}`);
             if ($patternParamsDiv.length) {
                  $patternParamsDiv.addClass('hidden'); // Always hide in minimal
                  // GM_log(`Pack Filler Pro: Pattern parameters hidden (minimal version).`); // Minimal logging
             }
        }
        */
         // GM_log("Pack Filler Pro: updatePatternParamsVisibility called (minimal version, no action)."); // Minimal logging
    }


    /**
     * Applies or removes the dark mode class to relevant elements.
     * Assumes config object, panelElement, toggleButtonElement references are available.
     * Assumes $ from window.pfpMinimal, window.Swal, and window.MutationObserver are available.
     * @param {object} config - The script's configuration object.
     * @param {boolean} isDarkMode - Whether dark mode should be applied.
     */
    function applyDarkMode(config, isDarkMode) {
        // GM_log(`Pack Filler Pro: Applying dark mode: ${isDarkMode}`); // Minimal logging
         if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement || typeof Swal === 'undefined' || typeof MutationObserver === 'undefined') {
             if (typeof GM_log === 'function') GM_log("Pack Filler Pro: applyDarkMode dependencies ($, panelElement, toggleButtonElement, Swal, MutationObserver) missing. Aborting.");
             return;
         }

        try {
            $(panelElement).toggleClass('dark-mode', isDarkMode);
            $(toggleButtonElement).toggleClass('dark-mode', isDarkMode);

            // Apply to SweetAlert2 popups dynamically using a MutationObserver
            // This observer needs to be set up once and persist.
            // Store the observer instance globally or in a shared scope to disconnect later.
            if (!window._pfpSwalObserver) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && node.classList && node.classList.contains('swal2-popup')) {
                                if (config.isDarkMode) {
                                    $(node).addClass('dark-mode');
                                    $(node).find('.swal2-title, .swal2-html-container').addClass('dark-mode');
                                } else {
                                    $(node).removeClass('dark-mode');
                                    $(node).find('.swal2-title, .swal2-html-container').removeClass('dark-mode');
                                }
                                 $(node).addClass('pfp-swal-popup');
                                 if (node.classList.contains('swal2-toast')) {
                                     $(node).addClass('pfp-swal-toast-popup');
                                 }
                                 $(node).find('.swal2-title').addClass('pfp-swal-title');
                                 $(node).find('.swal2-html-container').addClass('pfp-swal-html');
                                 $(node).find('.swal2-confirm').addClass('mini primary');
                            }
                        });
                    });
                });

                observer.observe(document.body, { childList: true, subtree: true });
                window._pfpSwalObserver = observer;
                // GM_log("Pack Filler Pro: SweetAlert2 popup MutationObserver initialized."); // Minimal logging
            }

            // GM_log(`Pack Filler Pro: Dark mode class toggled on panel and toggle button.`); // Minimal logging

        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error applying dark mode.", e);
            if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
                 SWAL_ALERT('UI Error', sanitize(`Failed to apply dark mode: ${e.message}.`), 'error', config);
            }
        }
    }


    /* --- UI Event Binding --- */
    /**
     * Binds event listeners to the UI panel elements.
     * Assumes necessary DOM elements and functions from other modules are available via window.pfpMinimal or window.
     * Includes robustness checks for dependencies.
     * @param {object} config - The script's configuration object.
     * @param {HTMLElement} panelEl - The main UI panel element.
     * @param {HTMLElement} toggleBtnEl - The panel toggle button element.
     */
    function bindPanelEvents(config, panelEl, toggleBtnEl) { // Accept elements as parameters
        // GM_log("Pack Filler Pro: bindPanelEvents started."); // Minimal logging

        // Assign passed elements to the variables in this IIFE's scope
        panelElement = panelEl;
        toggleButtonElement = toggleBtnEl;

        // Check critical dependencies from namespace and passed elements
        if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement ||
            typeof fillPacks !== 'function' || typeof clearAllInputs !== 'function' ||
            typeof updateConfigFromUI !== 'function' || typeof debouncedSaveConfig !== 'function' ||
            typeof updatePanelModeDisplay !== 'function' || typeof updatePanelVisibility !== 'function' ||
            typeof applyDarkMode !== 'function' || typeof getPackInputs !== 'function' ||
            typeof SELECTOR === 'undefined' || typeof SWAL_ALERT === 'undefined' || typeof SWAL_TOAST === 'undefined' || typeof sanitize === 'function' || typeof clamp === 'function') {

            const errorMessage = "Critical UI binding dependencies missing from namespace or elements. UI events will not be bound.";
            if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
            const alertFn = typeof SWAL_ALERT === 'function' ? SWAL_ALERT : alert;
            const sanitizeFn = typeof sanitize === 'function' ? sanitize : (text) => text;
            alertFn('UI Binding Error', sanitizeFn(errorMessage), 'error', config);
            return;
        }


        // Fill Packs Button
        $(`#${FILL_PACKS_BTN_ID}`).on('click', async () => {
            // GM_log("Pack Filler Pro: 'Fill Packs' button clicked."); // Minimal logging
            try {
                updateConfigFromUI(config);
                debouncedSaveConfig(config);
                await fillPacks(config);

            } catch (e) {
                if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error during 'Fill Packs' click handler.", e);
                 if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Fill Action Error', sanitize(`An unexpected error occurred: ${e.message}`), 'error', config);
            }
        });

        // Clear All Button
        $(`#${CLEAR_ALL_BTN_ID}`).on('click', () => {
            // GM_log("Pack Filler Pro: 'Clear All' button clicked."); // Minimal logging
            try {
                clearAllInputs();
                updateConfigFromUI(config);
                debouncedSaveConfig(config);

            } catch (e) {
                 if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error during 'Clear All' click handler.", e);
                 if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Clear Action Error', sanitize(`An unexpected error occurred: ${e.message}`), 'error', config);
            }
        });

        // Panel Toggle Button
        $(toggleButtonElement).on('click', () => {
            // GM_log("Pack Filler Pro: Toggle button clicked."); // Minimal logging
            config.panelVisible = !config.panelVisible;
            updatePanelVisibility(config, config.panelVisible, config.panelPos);
            debouncedSaveConfig(config);
        });

        // Panel Close Button
        $(panelElement).find('.pfp-close').on('click', () => {
            // GM_log("Pack Filler Pro: Close button clicked."); // Minimal logging
            config.panelVisible = false;
            updatePanelVisibility(config, config.panelVisible, config.panelPos);
            debouncedSaveConfig(config);
        });

        // Panel Dragging
        const $panel = $(panelElement);
        const $header = $panel.find('.pfp-header');
        let isDragging = false;
        let offsetX, offsetY;

        $header.on('mousedown', (e) => {
            // GM_log("Pack Filler Pro: Panel header mousedown."); // Minimal logging
            isDragging = true;
            $panel.addClass('dragging');
            const panelRect = panelElement.getBoundingClientRect();
            offsetX = e.clientX - panelRect.left;
            offsetY = e.clientY - panelRect.top;
            e.preventDefault();
        });

        $(document).on('mousemove', (e) => {
            if (!isDragging) return;
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const panelRect = panelElement.getBoundingClientRect();
            const panelWidth = panelRect.width;
            const panelHeight = panelRect.height;

            newLeft = clamp(newLeft, 0, viewportWidth - panelWidth);
            newTop = clamp(newTop, 0, viewportHeight - panelHeight);

            $panel.css({
                left: `${newLeft}px`,
                top: `${newTop}px`,
                right: 'auto',
                bottom: 'auto'
            });
            e.preventDefault();
        });

        $(document).on('mouseup', () => {
            if (!isDragging) return;
            // GM_log("Pack Filler Pro: Document mouseup (dragging finished)."); // Minimal logging
            isDragging = false;
            $panel.removeClass('dragging');

            const panelRect = panelElement.getBoundingClientRect();
            config.panelPos = {
                 top: `${panelRect.top}px`,
                 left: `${panelRect.left}px`,
                 right: 'auto',
                 bottom: 'auto'
            };
            debouncedSaveConfig(config);
        });


        // Configuration Control Change Handlers
        // Update config and save whenever a relevant control changes
        // Assumes updateConfigFromUI and debouncedSaveConfig are available via window.pfpMinimal
        // Use constants for IDs
        $(`#${MODE_SELECT_ID}, #${COUNT_INPUT_ID}, #${FIXED_INPUT_ID}, #${MIN_INPUT_ID}, #${MAX_INPUT_ID}`).on('input change', function() { // Use function() for 'this' context
            updateConfigFromUI(config);
            debouncedSaveConfig(config);

            updateQuantityInputVisibility(config.lastMode);
            updatePanelModeDisplay(config.lastMode);
             // Minimal version doesn't have pattern params visibility tied to UI changes here
        });

        // Checkbox change handlers (use 'change' event)
        // Assumes updateConfigFromUI and debouncedSaveConfig are available via window.pfpMinimal
        // Use constants for IDs
        $(`#${CLEAR_INPUTS_CHECKBOX_ID}, #${DARK_MODE_CHECKBOX_ID}`).on('change', function() {
            updateConfigFromUI(config);
            debouncedSaveConfig(config);

            if (this.id === DARK_MODE_CHECKBOX_ID) {
                 applyDarkMode(config, config.isDarkMode);
            }
        });


        // MutationObserver to apply dark mode to SweetAlert2 popups
        // This is initialized in applyDarkMode and stored on window._pfpSwalObserver

        // GM_log("Pack Filler Pro: bindPanelEvents finished."); // Minimal logging
    }

    /**
     * Updates the visibility and position of the UI panel.
     * Assumes panelElement, toggleButtonElement references are available in this IIFE's scope.
     * Assumes $ from window.pfpMinimal and config object are available.
     * @param {object} config - The script's configuration object.
     * @param {boolean} isVisible - Whether the panel should be visible.
     * @param {object} position - The desired panel position {top, right, bottom, left}.
     */
    function updatePanelVisibility(config, isVisible, position) {
         if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement) {
             if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updatePanelVisibility dependencies ($, panelElement, toggleButtonElement) missing. Aborting.");
             return;
         }
         if (typeof config !== 'object' || config === null || typeof position !== 'object' || position === null) {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: updatePanelVisibility called with invalid config or position object. Aborting.", {config: config, position: position});
              return;
         }


        const $panel = $(panelElement);
        const $toggleButton = $(toggleButtonElement);

        if (isVisible) {
            $panel.removeClass('hidden');
            $toggleButton.removeClass('hidden');

            $panel.css({
                top: position.top || 'auto',
                right: position.right || 'auto',
                bottom: position.bottom || 'auto',
                left: position.left || 'auto'
            });
            // GM_log(`Pack Filler Pro: Panel shown and positioned: top=${position.top}, right=${position.right}, bottom=${position.bottom}, left=${position.left}`); // Minimal logging

        } else {
            $panel.addClass('hidden');
            // Keep toggle button visible so the user can reopen the panel
            // $toggleButton.addClass('hidden');
            // GM_log("Pack Filler Pro: Panel hidden."); // Minimal logging
        }
    }


    // Attach functions to the global namespace object
    window.pfpMinimal.loadConfigIntoUI = loadConfigIntoUI;
    window.pfpMinimal.updateConfigFromUI = updateConfigFromUI;
    window.pfpMinimal.updatePanelModeDisplay = updatePanelModeDisplay;
    window.pfpMinimal.updateQuantityInputVisibility = updateQuantityInputVisibility;
    window.pfpMinimal.updatePatternParamsVisibility = updatePatternParamsVisibility;
    window.pfpMinimal.applyDarkMode = applyDarkMode;
    window.pfpMinimal.bindPanelEvents = bindPanelEvents; // This function needs panelElement and toggleButtonElement passed to it
    window.pfpMinimal.updatePanelVisibility = updatePanelVisibility;

})(); // End of IIFE
