// This file contains functions for interacting with the DOM and utility helpers.
// It relies on the cash-dom library ($) and constants defined in constants.js.
// Wrapped in an IIFE and attaches functions to window.pfpMinimal.

(function() {
    'use strict';

    // Ensure the global namespace object exists and get references to shared dependencies
    window.pfpMinimal = window.pfpMinimal || {};
    const $ = window.pfpMinimal.$; // Get cash-dom from namespace
    const SELECTOR = window.pfpMinimal.SELECTOR; // Get selector from namespace
    const MAX_QTY = window.pfpMinimal.MAX_QTY; // Get max quantity from namespace
    const SWAL_ALERT = window.pfpMinimal.SWAL_ALERT; // Get SWAL_ALERT from namespace (for clear feedback)
    const sanitize = window.pfpMinimal.sanitize; // Get sanitize from namespace (defined below)


    /* --- DOM Helpers & Utilities --- */

    /**
     * Helper to clamp a value within min/max bounds.
     * @param {number} val - The value to clamp.
     * @param {number} min - The minimum allowed value.
     * @param {number} max - The maximum allowed value.
     * @returns {number} The clamped value. Returns min (or 0 if min is invalid) if inputs are not valid numbers.
     */
    const clamp = (val, min, max) => {
        const numVal = parseFloat(val);
        const safeMin = typeof min === 'number' && !isNaN(min) ? min : 0;
        const safeMax = typeof max === 'number' && !isNaN(max) ? max : Infinity;

        if (isNaN(numVal)) {
            // GM_log(`Pack Filler Pro: clamp received non-numeric value '${val}'. Clamping to min (${safeMin}).`); // Minimal logging
            return safeMin;
        }

        return Math.min(safeMax, Math.max(safeMin, numVal));
    };

    /**
     * Basic HTML sanitization helper.
     * Prevents simple XSS by escaping HTML entities.
     * @param {string} str - The string to sanitize.
     * @returns {string} The sanitized string. Returns empty string for non-string inputs.
     */
    function sanitize(str) {
        if (typeof str !== 'string') {
            // GM_log("Pack Filler Pro: sanitize received non-string input.", str); // Minimal logging
            return '';
        }
        try {
            const div = document.createElement('div');
            div.appendChild(document.createTextNode(str));
            return div.innerHTML;
        } catch (e) {
             // GM_log("Pack Filler Pro: Error sanitizing string.", e); // Minimal logging
             return '';
        }
    }


    /**
     * Gets all visible pack input elements using the defined selector.
     * Visibility is checked using offsetParent.
     * Assumes $ and SELECTOR are available via window.pfpMinimal.
     * @returns {Array<HTMLInputElement>} An array of visible input elements. Returns an empty array if dependencies are not available or no inputs found.
     */
    function getPackInputs() {
        // Check critical dependencies from namespace
        if (typeof $ === 'undefined' || typeof SELECTOR === 'undefined') {
            // GM_log("Pack Filler Pro: getPackInputs dependencies ($ or SELECTOR) missing. Returning empty array."); // Minimal logging
            return [];
        }
        try {
             const inputs = $(SELECTOR).get();
             if (!Array.isArray(inputs)) {
                  // GM_log("Pack Filler Pro: $(SELECTOR).get() did not return an array. Returning empty array.", inputs); // Minimal logging
                  return [];
             }
            return inputs.filter(el => el instanceof HTMLInputElement && el.offsetParent !== null);
        } catch (e) {
             // GM_log("Pack Filler Pro: Error getting pack inputs.", e); // Minimal logging
             return [];
        }
    }


    /**
     * Updates the value of a pack input element and dispatches necessary events.
     * Dispatches 'input' and 'change' events to ensure compatibility with front-end frameworks.
     * Assumes MAX_QTY is available via window.pfpMinimal and clamp from this file's scope.
     * @param {HTMLInputElement} input - The input element to update.
     * @param {number} qty - The new quantity value.
     */
    function updateInput(input, qty) {
        // Check critical dependencies
        if (!(input instanceof HTMLInputElement)) {
            // GM_log("Pack Filler Pro: updateInput called with invalid input element.", input); // Minimal logging
            return;
        }
         if (typeof clamp !== 'function') { // clamp is defined within this IIFE
              // GM_log("Pack Filler Pro: updateInput dependencies (clamp) missing. Aborting."); // Minimal logging
              return;
         }
         // Assumes MAX_QTY from constants.js is available via window.pfpMinimal
         if (typeof MAX_QTY === 'undefined') {
             // GM_log("Pack Filler Pro: updateInput dependency (MAX_QTY) missing from namespace. Using fallback 99."); // Minimal logging
         }

        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
        const clampedQty = clamp(qty, 0, maxQty);
        const roundedQty = Math.round(clampedQty);
        const valueStr = String(roundedQty);

        if (input.value !== valueStr) {
            input.value = valueStr;
            try {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
                // GM_log(`Pack Filler Pro: Error dispatching input/change events for input ${input.id || input.name || 'unknown'}: ${e.message}`, e); // Minimal logging
            }
        }
    }

    /**
     * Sets the value of all visible pack inputs to zero.
     * Assumes getPackInputs, updateInput from this file's scope are available.
     * Assumes SWAL_ALERT is available via window.pfpMinimal for feedback.
     */
    function clearAllInputs() {
        // Check critical dependencies from namespace and this IIFE's scope
        if (typeof getPackInputs !== 'function' || typeof updateInput !== 'function') {
            // GM_log("Pack Filler Pro: clearAllInputs dependencies (getPackInputs or updateInput) missing. Aborting."); // Minimal logging
            // Use fallback alert if SWAL_ALERT is not available via namespace, sanitize might also be missing
            const alertFn = typeof SWAL_ALERT === 'function' ? SWAL_ALERT : alert;
            const sanitizeFn = typeof sanitize === 'function' ? sanitize : (text) => text;
            alertFn('Clear Error', sanitizeFn('Required functions missing. Could not clear inputs.'), 'error', null); // Pass null for config here
            return;
        }

        const inputs = getPackInputs();
        if (inputs.length > 0) {
            try {
                 inputs.forEach(input => updateInput(input, 0));
                 // GM_log(`Cleared ${inputs.length} pack input(s).`); // Minimal logging
                  if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
                      SWAL_ALERT("Cleared Packs", sanitize(`Set ${inputs.length} visible pack input(s) to zero.`), 'success', null); // Pass null for config here
                  } else {
                      // GM_log("Pack Filler Pro: SWAL_ALERT or sanitize function not found for clear feedback."); // Minimal logging
                  }
            } catch (e) {
                 const msg = `Error clearing inputs: ${e.message}`;
                 // GM_log(`Pack Filler Pro: ERROR - ${msg}`, e); // Minimal logging
                  if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Clear Error', sanitize(msg), 'error', null);
                  else alert(`Pack Filler Pro Error: ${msg}`);
            }
        } else {
            // GM_log("Clear All: No visible pack inputs found to clear."); // Minimal logging
             if (typeof SWAL_ALERT === 'function') {
                  SWAL_ALERT("Clear Packs", "No visible pack inputs found to clear.", 'info', null);
             } else {
                 // GM_log("Pack Filler Pro: SWAL_ALERT function not found for clear feedback (no inputs)."); // Minimal logging
             }
        }
    }

    // Attach functions and variables to the global namespace object
    window.pfpMinimal.getPackInputs = getPackInputs;
    window.pfpMinimal.clamp = clamp; // Clamp is needed by other modules
    window.pfpMinimal.updateInput = updateInput;
    window.pfpMinimal.clearAllInputs = clearAllInputs;
    window.pfpMinimal.sanitize = sanitize; // Sanitize is needed by swalHelpers

})(); // End of IIFE
