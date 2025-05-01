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
        typeof SELECTOR === 'undefined' || typeof updateUIFromConfig === 'undefined' || // Added check for updateUIFromConfig
        typeof sanitize === 'undefined') // Added check for sanitize
        {

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
            debouncedSaveConfig(config); // Save config immediately on manual trigger

            // Call the fill logic - pass config
            await fillPacks(config, false); // Pass config and isAutoFill=false, await the async function

        } catch (error) {
            GM_log("Pack Filler Pro: Error during 'Fill Packs' click handler:", error);
            // fillPacks should handle its own error feedback via SWAL, but defensive log here
        }
    });


    // Clear All Button
    // Assumes clearAllInputs is available
    $('#pfp-clear-btn').on('click', () => {
        GM_log("Pack Filler Pro: 'Clear All' button clicked.");
        try {
             // Clear all inputs - clearAllInputs handles its own feedback
             clearAllInputs();
             // Update config state after clearing if needed (config.lastClear doesn't change here)
             // No config update needed for just clearing inputs.
        } catch (error) {
             GM_log("Pack Filler Pro: Error during 'Clear All' click handler:", error);
             // clearAllInputs should handle its own error feedback via SWAL
        }

    });


    // Toggle Button
    // Assumes updatePanelVisibility, updateConfigFromUI, debouncedSaveConfig, panelElement, toggleButtonElement are available
    $(toggleButtonElement).on('click', () => {
        GM_log("Pack Filler Pro: 'Toggle Panel' button clicked.");
        // Toggle panel visibility state in config
        config.panelVisible = !config.panelVisible;
        // Update UI visibility based on new state
        updatePanelVisibility(config, config.panelVisible, config.panelPos); // Pass config
        // Save updated config
        debouncedSaveConfig(config); // Pass config
    });

    // Close Button (inside panel header)
    // Assumes updatePanelVisibility, updateConfigFromUI, debouncedSaveConfig, panelElement are available
    $(panelElement).find('.pfp-close').on('click', () => {
        GM_log("Pack Filler Pro: 'Close Panel' button clicked.");
        // Set panel visibility state to false in config
        config.panelVisible = false;
        // Update UI visibility
        updatePanelVisibility(config, config.panelVisible, config.panelPos); // Pass config
        // Save updated config
        debouncedSaveConfig(config); // Pass config
    });

    // Panel Dragging (Header)
    // Assumes panelElement, toggleButtonElement are available
    // Uses cash-dom's .on() which supports event delegation if needed, but direct on header is fine
    const header = $(panelElement).find('.pfp-header')[0]; // Get the native DOM element
    if (header) {
        let isDragging = false;
        let offsetX, offsetY;

        $(header).on('mousedown', (e) => {
            // Only start drag if it's the left mouse button and not clicking the close button
            if (e.button === 0 && !e.target.classList.contains('pfp-close')) {
                isDragging = true;
                // Calculate offset relative to the panel's current position
                const panelRect = panelElement.getBoundingClientRect();
                offsetX = e.clientX - panelRect.left;
                offsetY = e.clientY - panelRect.top;

                // Prevent text selection during drag
                $(panelElement).addClass('pfp-dragging');
                // Add dragging class to body to prevent text selection globally
                 $('body').addClass('pfp-body-dragging');

                // Set cursor style directly on body while dragging
                document.body.style.cursor = 'grabbing';
            }
        });

        $(document).on('mousemove', (e) => {
            if (isDragging) {
                // Calculate new panel position
                let newLeft = e.clientX - offsetX;
                let newTop = e.clientY - offsetY;

                // Optional: Clamp panel position to viewport bounds
                const panelRect = panelElement.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                newLeft = Math.max(0, Math.min(newLeft, viewportWidth - panelRect.width));
                newTop = Math.max(0, Math.min(newTop, viewportHeight - panelRect.height));


                // Update panel position
                panelElement.style.left = `${newLeft}px`;
                panelElement.style.top = `${newTop}px`;
                panelElement.style.right = 'auto'; // Ensure right/bottom are auto when using top/left
                panelElement.style.bottom = 'auto';

                // Update config position (using top/left)
                config.panelPos = { top: `${newTop}px`, left: `${newLeft}px`, right: 'auto', bottom: 'auto' };
                debouncedSaveConfig(config); // Pass config

                // Prevent default text selection/dragging behavior
                e.preventDefault();
            }
        });

        $(document).on('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                // Remove dragging classes and reset cursor
                $(panelElement).removeClass('pfp-dragging');
                 $('body').removeClass('pfp-body-dragging');
                 document.body.style.cursor = '';

                // The debouncedSaveConfig would have already been called during mousemove
                // but calling it one last time on mouseup ensures the final position is saved reliably.
                 debouncedSaveConfig(config); // Pass config
            }
        });

         GM_log("Pack Filler Pro: Panel dragging events bound.");

    } else {
         GM_log("Pack Filler Pro: Panel header element not found. Dragging not enabled.");
    }


    // Bind change/input events to form elements for config updates
    // Assumes updateConfigFromUI and debouncedSaveConfig are available
    $('#pfp-mode, #pfp-count, #pfp-fixed, #pfp-min, #pfp-max, #' + MAX_TOTAL_INPUT_ID + ', #' + FULL_PAGE_CHECKBOX_ID + ', #' + DARK_MODE_CHECKBOX_ID + ', #' + AUTO_FILL_LOADED_CHECKBOX_ID + ', #' + FILL_EMPTY_ONLY_CHECKBOX_ID + ', #' + SCROLL_TO_BOTTOM_CHECKBOX_ID + ', #' + PATTERN_TYPE_SELECT_ID + ', #' + NOISE_SEED_INPUT_ID + ', #' + PATTERN_SCALE_INPUT_ID + ', #' + PATTERN_INTENSITY_INPUT_ID + ', #' + CLICK_PAGE_RANDOM_COUNT_ID).on('change input', (e) => {
        // Input event for text/number/range, change event for select/checkbox
        // GM_log(`Pack Filler Pro: Config input changed: ${e.target.id}`); // Too chatty
        // Update config object based on current UI state
        updateConfigFromUI(config); // Pass config
        // Save config after a short delay
        debouncedSaveConfig(config); // Pass config

        // Special handling for pattern type select change
        if (e.target.id === PATTERN_TYPE_SELECT_ID) {
             updatePatternParamsVisibility(config.patternType); // Update which pattern parameters are visible
        }
         // Special handling for Dark Mode checkbox
         if (e.target.id === DARK_MODE_CHECKBOX_ID) {
              applyDarkMode(config, config.isDarkMode); // Apply dark mode class immediately
         }

         // Special handling for Fill Mode select change to toggle quantity inputs
         if (e.target.id === 'pfp-mode') {
              updateQuantityInputVisibility(config.lastMode); // Toggle fixed vs range inputs
         }

    });

    // Bind input event for range sliders to update value display span
    // Assumes PATTERN_SCALE_INPUT_ID, PATTERN_INTENSITY_INPUT_ID, $ are available
    const scaleInput = $('#' + PATTERN_SCALE_INPUT_ID);
    const intensityInput = $('#' + PATTERN_INTENSITY_INPUT_ID);
    const scaleValueSpan = $('#pfp-pattern-scale-value');
    const intensityValueSpan = $('#pfp-pattern-intensity-value');

    if (scaleInput.length && scaleValueSpan.length) {
        scaleInput.on('input', () => {
            scaleValueSpan.text(scaleInput.val());
        });
        // Trigger once to set initial value display
         scaleValueSpan.text(scaleInput.val());
    }
     if (intensityInput.length && intensityValueSpan.length) {
        intensityInput.on('input', () => {
             // Convert 0-100 range to 0.0-1.0 for display and config
            const value = parseFloat(intensityInput.val()) / 100.0;
            intensityValueSpan.text(value.toFixed(2)); // Display with 2 decimal places
        });
        // Trigger once to set initial value display
         const initialIntensityValue = parseFloat(intensityInput.val()) / 100.0;
         intensityValueSpan.text(initialIntensityValue.toFixed(2));
    }

    // Bind event for "Fill 1 Random Pack" button
    // Assumes fillRandomPackInput is available
    $('#' + FILL_RANDOM_BTN_ID).on('click', async () => { // Make async to await fillRandomPackInput
        GM_log("Pack Filler Pro: 'Fill 1 Random Pack' button clicked.");
        try {
            // Ensure config is updated from UI before filling
            updateConfigFromUI(config); // Pass config
            debouncedSaveConfig(config); // Save config immediately

            // Call the random fill logic - pass config
            await fillRandomPackInput(config); // Pass config and await

        } catch (error) {
            GM_log("Pack Filler Pro: Error during 'Fill 1 Random Pack' click handler:", error);
            // fillRandomPackInput should handle its own error feedback via SWAL
        }
    });

     // Bind event for "Click Page Random Button"
     // Assumes CLICK_PAGE_RANDOM_BTN_ID, CLICK_PAGE_RANDOM_COUNT_ID, $, getPackInputs, SWAL_TOAST, sanitize are available
     $('#' + CLICK_PAGE_RANDOM_BTN_ID).on('click', async () => {
          GM_log("Pack Filler Pro: 'Click Page Random Button' clicked.");
           try {
               updateConfigFromUI(config); // Ensure config is updated for the count
               debouncedSaveConfig(config); // Save config

               const clickCount = config.clickPageRandomCount; // Use count from config

               if (clickCount <= 0) {
                    if (typeof SWAL_TOAST === 'function') SWAL_TOAST('Click Random', 'Click count must be at least 1.', 'warning', config);
                     GM_log("Click Page Random aborted: Click count is not positive.");
                    return;
               }

               // Find the actual page button (adjust selector as needed for the target site)
               const pageRandomButton = $('button.pack-open-button:visible, a.pack-open-button:visible').filter((i, el) => {
                   // Filter for buttons/links that look like the main "Open Random Pack" button
                    const text = $(el).text().toLowerCase();
                    return text.includes('open random pack'); // Example filtering
               })[0]; // Get the first visible matching element

               if (!pageRandomButton) {
                    const errorMsg = "Could not find the page's 'Open Random Pack' button.";
                     if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Click Random Error', sanitize(errorMsg), 'error', config);
                     GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`);
                    return;
               }

               GM_log(`Pack Filler Pro: Clicking page's random button ${clickCount} time(s).`);

               let clicksDone = 0;
               const clickInterval = 50; // ms between clicks to simulate user, adjust if needed

               async function performClick() {
                   if (clicksDone < clickCount) {
                        pageRandomButton.click(); // Simulate click
                        clicksDone++;
                        GM_log(`Pack Filler Pro: Clicked page random button (${clicksDone}/${clickCount}).`);
                        // Add a small delay before the next click
                        await new Promise(resolve => setTimeout(resolve, clickInterval));
                        // Recursively call for the next click
                        performClick();
                   } else {
                       // All clicks done
                       if (typeof SWAL_TOAST === 'function') SWAL_TOAST(`Clicked page random button ${clickCount} time(s).`, 'success', config);
                        GM_log("Pack Filler Pro: Finished clicking page random button.");
                        // Re-check inputs and update count after clicks (optional, depends on if clicks add new inputs)
                         if (typeof getPackInputs === 'function' && typeof $ === 'function' && typeof clamp === 'function') {
                              const currentInputCount = getPackInputs().length;
                              $('#pfp-count').attr('max', clamp(currentInputCount, 0, Infinity));
                         }
                   }
               }

               // Start the click sequence
               performClick();


           } catch (error) {
                GM_log(`Pack Filler Pro: Error during 'Click Page Random Button' click handler: ${error.message}`, error);
                 if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Click Random Error', sanitize(error.message), 'error', config);
           }

     });


     // Initialize the visibility of quantity inputs based on current mode
     updateQuantityInputVisibility(config.lastMode);
     // Initialize the visibility of pattern parameters based on current pattern type
     updatePatternParamsVisibility(config.patternType);


    // MutationObserver to detect SweetAlert2 popups and apply dark mode class
    // This ensures dynamically created Swal elements get the dark mode class if enabled.
    // Assumes DARK_MODE_CHECKBOX_ID is defined and config is available.
    // Also assumes window.Swal is available.
    if (typeof window.Swal !== 'undefined' && typeof DARK_MODE_CHECKBOX_ID !== 'undefined') {
        const swalObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    // Check if the added node is a SweetAlert2 popup element
                    // Swal popups have the class 'swal2-popup'
                    if (node.classList && node.classList.contains('swal2-popup')) {
                        GM_log("Pack Filler Pro: Detected new SweetAlert2 popup. Applying dark mode if enabled.");
                        // Check the current dark mode state from config
                        if (config.isDarkMode) {
                            node.classList.add('dark-mode');
                            // Also apply dark mode to the backdrop if it exists and is a direct sibling or parent's sibling
                             const backdrop = node.parentElement ? node.parentElement.querySelector('.swal2-backdrop-show') : null;
                             if (backdrop) {
                                  backdrop.classList.add('dark-mode');
                             }
                        }
                         // Note: We could also add observers to the popup itself if needed,
                         // but applying the class on creation is usually sufficient with CSS variables.
                    }
                });
            });
        });

        // Start observing the document body for added nodes (subtree includes children)
        swalObserver.observe(document.body, { childList: true, subtree: true });
        // Store the observer globally (or in a cleanup array) so it can be disconnected on unload
        window._pfpSwalObserver = swalObserver; // Store on window for unload cleanup
        GM_log("Pack Filler Pro: SweetAlert2 popup MutationObserver started.");

    } else {
         GM_log("Pack Filler Pro: Skipping SweetAlert2 popup MutationObserver setup (Swal or DARK_MODE_CHECKBOX_ID missing).");
    }


    GM_log("Pack Filler Pro: bindPanelEvents finished.");
}


/* --- UI Update Functions --- */
/**
 * Updates the UI form elements to reflect the values in the config object.
 * Assumes $ from cash-dom and element IDs are available.
 * Assumes config object is available.
 * @param {object} config - The script's configuration object.
 */
function loadConfigIntoUI(config) { // Accept config here
    // Check for dependencies before updating UI
    if (typeof $ === 'undefined' || typeof MAX_TOTAL_INPUT_ID === 'undefined' || typeof FULL_PAGE_CHECKBOX_ID === 'undefined' ||
        typeof DARK_MODE_CHECKBOX_ID === 'undefined' || typeof AUTO_FILL_LOADED_CHECKBOX_ID === 'undefined' || typeof FILL_EMPTY_ONLY_CHECKBOX_ID === 'undefined' ||
        typeof SCROLL_TO_BOTTOM_CHECKBOX_ID === 'undefined' || typeof PATTERN_TYPE_SELECT_ID === 'undefined' || typeof NOISE_SEED_INPUT_ID === 'undefined' ||
        typeof PATTERN_SCALE_INPUT_ID === 'undefined' || typeof PATTERN_INTENSITY_INPUT_ID === 'undefined' || typeof CLICK_PAGE_RANDOM_COUNT_ID === 'undefined') {
         GM_log("Pack Filler Pro: loadConfigIntoUI dependencies ($, IDs) missing. Cannot load config into UI.");
         return; // Abort if dependencies are missing
     }


    // Load general settings
    $('#pfp-mode').val(config.lastMode);
    $('#pfp-count').val(config.lastCount);
    $('#pfp-fixed').val(config.lastFixedQty);
    $('#pfp-min').val(config.lastMinQty);
    $('#pfp-max').val(config.lastMaxQty);
    $('#' + MAX_TOTAL_INPUT_ID).val(config.maxTotalAmount);

    // Load checkbox states
    $('#pfp-clear').prop('checked', config.lastClear);
    $('#' + FULL_PAGE_CHECKBOX_ID).prop('checked', config.loadFullPage);
    $('#' + DARK_MODE_CHECKBOX_ID).prop('checked', config.isDarkMode);
    $('#' + AUTO_FILL_LOADED_CHECKBOX_ID).prop('checked', config.autoFillLoaded);
    $('#' + FILL_EMPTY_ONLY_CHECKBOX_ID).prop('checked', config.fillEmptyOnly);
    $('#' + SCROLL_TO_BOTTOM_CHECKBOX_ID).prop('checked', config.scrollToBottomAfterLoad);

    // Load pattern settings
    $('#' + PATTERN_TYPE_SELECT_ID).val(config.patternType);
    $('#' + NOISE_SEED_INPUT_ID).val(config.noiseSeed);
    // Convert 0.0-1.0 intensity to 0-100 slider value
     $('#' + PATTERN_INTENSITY_INPUT_ID).val(Math.round(config.patternIntensity * 100));
     $('#' + PATTERN_SCALE_INPUT_ID).val(config.patternScale);
    // Update range slider display spans immediately
     $('#pfp-pattern-scale-value').text(config.patternScale);
     $('#pfp-pattern-intensity-value').text(config.patternIntensity.toFixed(2)); // Display with 2 decimals

    // Load Page Random Clicker setting
     $('#' + CLICK_PAGE_RANDOM_COUNT_ID).val(config.clickPageRandomCount);


    GM_log("Pack Filler Pro: Config loaded into UI.");
}


/**
 * Updates the config object based on the current state of the UI form elements.
 * Assumes $ from cash-dom and element IDs are available.
 * Assumes config object is available.
 * @param {object} config - The script's configuration object to update.
 */
function updateConfigFromUI(config) { // Accept config here
    // Check for dependencies before updating config
     if (typeof $ === 'undefined' || typeof MAX_TOTAL_INPUT_ID === 'undefined' || typeof FULL_PAGE_CHECKBOX_ID === 'undefined' ||
         typeof DARK_MODE_CHECKBOX_ID === 'undefined' || typeof AUTO_FILL_LOADED_CHECKBOX_ID === 'undefined' || typeof FILL_EMPTY_ONLY_CHECKBOX_ID === 'undefined' ||
         typeof SCROLL_TO_BOTTOM_CHECKBOX_ID === 'undefined' || typeof PATTERN_TYPE_SELECT_ID === 'undefined' || typeof NOISE_SEED_INPUT_ID === 'undefined' ||
         typeof PATTERN_SCALE_INPUT_ID === 'undefined' || typeof PATTERN_INTENSITY_INPUT_ID === 'undefined' || typeof CLICK_PAGE_RANDOM_COUNT_ID === 'undefined') {
         GM_log("Pack Filler Pro: updateConfigFromUI dependencies ($, IDs) missing. Cannot update config from UI.");
         return; // Abort if dependencies are missing
     }

    // Update general settings - ensure conversion to number where appropriate
    config.lastMode = $('#pfp-mode').val();
    config.lastCount = parseInt($('#pfp-count').val(), 10) || 0;
    config.lastFixedQty = parseInt($('#pfp-fixed').val(), 10) || 0;
    config.lastMinQty = parseInt($('#pfp-min').val(), 10) || 0;
    config.lastMaxQty = parseInt($('#pfp-max').val(), 10) || 0;
    config.maxTotalAmount = parseInt($('#' + MAX_TOTAL_INPUT_ID).val(), 10) || 0;

    // Update checkbox states
    config.lastClear = $('#pfp-clear').prop('checked');
    config.loadFullPage = $('#' + FULL_PAGE_CHECKBOX_ID).prop('checked');
    config.isDarkMode = $('#' + DARK_MODE_CHECKBOX_ID).prop('checked');
    config.autoFillLoaded = $('#' + AUTO_FILL_LOADED_CHECKBOX_ID).prop('checked');
    config.fillEmptyOnly = $('#' + FILL_EMPTY_ONLY_CHECKBOX_ID).prop('checked');
    config.scrollToBottomAfterLoad = $('#' + SCROLL_TO_BOTTOM_CHECKBOX_ID).prop('checked');


    // Update pattern settings - ensure conversion to number where appropriate
    config.patternType = $('#' + PATTERN_TYPE_SELECT_ID).val();
    config.noiseSeed = $('#' + NOISE_SEED_INPUT_ID).val();
    // Convert 0-100 slider value back to 0.0-1.0 for config storage
    config.patternIntensity = parseFloat($('#' + PATTERN_INTENSITY_INPUT_ID).val()) / 100.0;
    config.patternScale = parseInt($('#' + PATTERN_SCALE_INPUT_ID).val(), 10) || DEFAULT_CONFIG.patternScale; // Use default if parsing fails


    // Update Page Random Clicker setting
     config.clickPageRandomCount = parseInt($('#' + CLICK_PAGE_RANDOM_COUNT_ID).val(), 10) || 1;


    // The config object is updated by reference, no need to return it.
    // GM_log("Pack Filler Pro: Config updated from UI.", config); // Too chatty
}


/**
 * Updates the text display for the selected fill mode.
 * Assumes $ from cash-dom is available.
 * @param {string} mode - The current fill mode ('fixed', 'max', 'unlimited').
 */
function updatePanelModeDisplay(mode) {
    // Check for dependency before updating
    if (typeof $ === 'undefined') {
        GM_log("Pack Filler Pro: updatePanelModeDisplay dependencies ($) missing. Cannot update mode display.");
        return;
    }
    const modeText = $('#pfp-mode option:selected').text();
    $(panelElement).find('.pfp-title').text(`Pack Filler Pro – ${modeText}`);
    // GM_log(`Pack Filler Pro: Panel mode display updated to: ${modeText}`); // Too chatty
}


/**
 * Toggles the visibility of the UI panel and updates the toggle button text/class.
 * Updates panel position if needed based on saved state.
 * Assumes $ from cash-dom, panelElement, toggleButtonElement, config object are available.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isVisible - Whether the panel should be visible.
 * @param {object} [pos] - The saved position {top, right, bottom, left}.
 */
function updatePanelVisibility(config, isVisible, pos) { // Accept config here
     // Check for dependencies before updating visibility
     if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement) {
          GM_log("Pack Filler Pro: updatePanelVisibility dependencies ($, panel/toggle elements) missing. Cannot update visibility.");
          return; // Abort if dependencies are missing
     }

    if (isVisible) {
        $(panelElement).removeClass('hidden');
        $(toggleButtonElement).addClass('hidden');
        GM_log("Pack Filler Pro: Panel shown.");

        // Apply saved position if available and valid
        if (pos && typeof pos === 'object') {
             // Clear previous positioning styles to apply new ones cleanly
             panelElement.style.top = '';
             panelElement.style.right = '';
             panelElement.style.bottom = '';
             panelElement.style.left = '';

             // Apply saved positions
             if (pos.top !== 'auto') panelElement.style.top = pos.top;
             if (pos.right !== 'auto') panelElement.style.right = pos.right;
             if (pos.bottom !== 'auto') panelElement.style.bottom = pos.bottom;
             if (pos.left !== 'auto') panelElement.style.left = pos.left;

             // Default to top-right if no valid position properties were set
             if (panelElement.style.top === '' && panelElement.style.bottom === '') panelElement.style.top = DEFAULT_CONFIG.panelPos.top;
             if (panelElement.style.left === '' && panelElement.style.right === '') panelElement.style.right = DEFAULT_CONFIG.panelPos.right;


             // Save the *applied* position back to config, standardizing to top/left if it was drag-moved,
             // or keeping the saved format if it wasn't dragged.
             // The dragging logic in bindPanelEvents ensures config.panelPos is updated correctly.
             // This just ensures that if the config load somehow resulted in weird values,
             // we default them and save the default/corrected position.
             config.panelPos = {
                  top: panelElement.style.top,
                  right: panelElement.style.right,
                  bottom: panelElement.style.bottom,
                  left: panelElement.style.left
             };
             // Use a small delay before saving the *applied* position to avoid race conditions
             // if this is called right after loading config on init.
             setTimeout(() => debouncedSaveConfig(config), 50); // Pass config

        } else {
             // If no saved position, apply default position
             panelElement.style.top = DEFAULT_CONFIG.panelPos.top;
             panelElement.style.right = DEFAULT_CONFIG.panelPos.right;
             panelElement.style.bottom = DEFAULT_CONFIG.panelPos.bottom;
             panelElement.style.left = DEFAULT_CONFIG.panelPos.left;
              GM_log("Pack Filler Pro: No valid saved position found. Applying default position.");
              // Save the default position
              config.panelPos = { ...DEFAULT_CONFIG.panelPos };
              setTimeout(() => debouncedSaveConfig(config), 50); // Pass config
        }

        // If SimpleBar is initialized, update its scrollbar
         if (panelSimpleBarInstance) {
              try {
                   panelSimpleBarInstance.recalculate();
              } catch (e) {
                   GM_log("Pack Filler Pro: Failed to recalculate SimpleBar on panel show.", e);
              }
         }


    } else {
        $(panelElement).addClass('hidden');
        $(toggleButtonElement).removeClass('hidden');
        GM_log("Pack Filler Pro: Panel hidden.");
        // When hiding, no need to save position, as it's saved on drag/move.
    }
}


/**
 * Updates the visibility of quantity input fields (fixed vs range) based on the selected fill mode.
 * Assumes $ from cash-dom and element IDs are available.
 * @param {string} mode - The current fill mode ('fixed', 'max', 'unlimited').
 */
function updateQuantityInputVisibility(mode) {
    // Check for dependencies before updating visibility
     if (typeof $ === 'undefined') {
          GM_log("Pack Filler Pro: updateQuantityInputVisibility dependencies ($) missing. Cannot update input visibility.");
          return; // Abort if dependencies are missing
     }

    const countGroup = $('#pfp-count-group');
    const fixedGroup = $('#pfp-fixed-group');
    const rangeInputsDiv = $('#pfp-range-inputs'); // The div wrapping min/max/max-total

    // Ensure elements exist before trying to toggle classes
    if (!countGroup.length || !fixedGroup.length || !rangeInputsDiv.length) {
         GM_log("Pack Filler Pro: Quantity input elements not found. Cannot update their visibility.");
         return; // Abort if elements are missing
    }


    // Hide all quantity-related inputs initially
    countGroup.addClass('hidden');
    fixedGroup.addClass('hidden');
    rangeInputsDiv.addClass('hidden');


    // Show inputs based on the selected mode
    switch (mode) {
        case 'fixed':
            countGroup.removeClass('hidden'); // Show count input
            fixedGroup.removeClass('hidden'); // Show fixed quantity input
            break;
        case 'max': // Random count range
            countGroup.removeClass('hidden'); // Show count input
            rangeInputsDiv.removeClass('hidden'); // Show min/max/max-total inputs
            break;
        case 'unlimited':
            // In unlimited mode, count is implicitly all visible inputs, so count input is hidden
            fixedGroup.removeClass('hidden'); // Show fixed quantity input (unlimited mode usually means fixed qty per pack)
            // Note: Could potentially allow range/pattern in unlimited mode, needs UI adjustment
            break;
    }
    // GM_log(`Pack Filler Pro: Quantity input visibility updated for mode: ${mode}`); // Too chatty
}

/**
 * Updates the visibility of pattern parameter input fields based on the selected pattern type.
 * Assumes $ from cash-dom and PATTERN_PARAMS_DIV_ID, NOISE_SEED_INPUT_ID, PATTERN_SCALE_INPUT_ID, PATTERN_INTENSITY_INPUT_ID are available.
 * @param {string} patternType - The current pattern type ('random', 'fixed', 'gradient', 'perlin', 'alternating').
 */
function updatePatternParamsVisibility(patternType) {
     // Check for dependencies before updating visibility
     if (typeof $ === 'undefined' || typeof PATTERN_PARAMS_DIV_ID === 'undefined') {
          GM_log("Pack Filler Pro: updatePatternParamsVisibility dependencies ($, IDs) missing. Cannot update pattern params visibility.");
          return; // Abort if dependencies are missing
     }

    const patternParamsDiv = $('#' + PATTERN_PARAMS_DIV_ID);
    const noiseSeedGroup = patternParamsDiv.find('#' + NOISE_SEED_INPUT_ID).parent('.pfp-form-group'); // Find parent form group
    const patternScaleGroup = patternParamsDiv.find('#' + PATTERN_SCALE_INPUT_ID).parent('.pfp-form-group'); // Find parent form group
    const patternIntensityGroup = patternParamsDiv.find('#' + PATTERN_INTENSITY_INPUT_ID).parent('.pfp-form-group'); // Find parent form group

     // Ensure elements exist
     if (!patternParamsDiv.length || !noiseSeedGroup.length || !patternScaleGroup.length || !patternIntensityGroup.length) {
          GM_log("Pack Filler Pro: Pattern parameter elements not found. Cannot update their visibility.");
          return; // Abort if elements are missing
     }


     // Hide all pattern parameter groups initially
     noiseSeedGroup.addClass('hidden');
     patternScaleGroup.addClass('hidden');
     patternIntensityGroup.addClass('hidden');
     // Hide the main params div too if no params will be shown
     patternParamsDiv.addClass('hidden');


     // Show parameters based on the selected pattern type
     switch (patternType) {
          case 'perlin':
               noiseSeedGroup.removeClass('hidden');
               patternScaleGroup.removeClass('hidden');
               patternIntensityGroup.removeClass('hidden');
               patternParamsDiv.removeClass('hidden'); // Show the parent div
               break;
          case 'gradient':
               // Gradient uses Scale and Intensity, but not Seed
               patternScaleGroup.removeClass('hidden');
               patternIntensityGroup.removeClass('hidden');
               patternParamsDiv.removeClass('hidden'); // Show the parent div
               break;
          // 'random', 'fixed', 'alternating' have no specific parameters to show
          default:
               // Keep all pattern parameter groups and the parent div hidden
               break;
     }
     // GM_log(`Pack Filler Pro: Pattern parameter visibility updated for pattern type: ${patternType}`); // Too chatty
}


/**
 * Applies or removes the 'dark-mode' class to relevant UI elements and SweetAlert2 popups.
 * Assumes $ from cash-dom, panelElement, toggleButtonElement, and window.Swal are available.
 * Assumes the MutationObserver for Swal popups is set up in init.
 * @param {object} config - The script's configuration object.
 * @param {boolean} enable - Whether to enable dark mode.
 */
function applyDarkMode(config, enable) { // Accept config here
     // Check for dependencies before applying dark mode
     if (typeof $ === 'undefined' || !panelElement || !toggleButtonElement || typeof window.Swal === 'undefined') {
          GM_log("Pack Filler Pro: applyDarkMode dependencies ($, panel/toggle elements, Swal) missing. Cannot apply dark mode.");
          return; // Abort if dependencies are missing
     }

     const panel = $(panelElement);
     const toggleButton = $(toggleButtonElement);

     if (enable) {
          panel.addClass('dark-mode');
          toggleButton.addClass('dark-mode');
          // Also apply to any currently open SweetAlert2 popups
          $('.swal2-popup, .swal2-backdrop-show').addClass('dark-mode');
          GM_log("Pack Filler Pro: Dark mode enabled.");
     } else {
          panel.removeClass('dark-mode');
          toggleButton.removeClass('dark-mode');
          // Also remove from any currently open SweetAlert2 popups
          $('.swal2-popup, .swal2-backdrop-show').removeClass('dark-mode');
          GM_log("Pack Filler Pro: Dark mode disabled.");
     }
    // Save the state immediately (debounced)
     debouncedSaveConfig(config); // Pass config
}


// The following functions are made available to the main script's scope via @require.
// - bindPanelEvents
// - loadConfigIntoUI
// - updateConfigFromUI
// - updatePanelModeDisplay
// - updatePanelVisibility
// - updateQuantityInputVisibility
// - updatePatternParamsVisibility
// - applyDarkMode
