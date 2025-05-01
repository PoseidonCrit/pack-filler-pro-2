// This file contains functions for interacting with the DOM and utility helpers.
// It relies on the cash-dom library ($) and constants like SELECTOR and MAX_QTY,
// which are assumed to be defined in src/constants.js and available via @require.
// It also assumes SWAL_ALERT is available from src/swalHelpers.js via @require.

/* --- DOM Helpers & Utilities --- */

/**
 * Gets all visible pack input elements using the defined selector.
 * Visibility is checked using offsetParent.
 * Assumes $ from cash-dom and SELECTOR from constants.js are available.
 * @returns {Array<HTMLInputElement>} An array of visible input elements. Returns an empty array if dependencies are not available or no inputs found.
 */
function getPackInputs() {
    // Check critical dependencies
    if (typeof $ === 'undefined' || typeof SELECTOR === 'undefined') {
        GM_log("Pack Filler Pro: getPackInputs dependencies ($ or SELECTOR) missing. Returning empty array.");
        return []; // Return empty array if dependencies are missing
    }
    try {
         // Use .get() to convert the cash-dom collection to a standard array
         // Use filter to check for valid HTMLInputElement and visibility
         const inputs = $(SELECTOR).get();
         if (!Array.isArray(inputs)) {
              GM_log("Pack Filler Pro: $(SELECTOR).get() did not return an array. Returning empty array.", inputs);
              return [];
         }
        return inputs.filter(el => el instanceof HTMLInputElement && el.offsetParent !== null);
    } catch (e) {
         GM_log("Pack Filler Pro: Error getting pack inputs.", e);
         return []; // Return empty array on error
    }
}

/**
 * Helper to clamp a value within min/max bounds.
 * @param {number} val - The value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @returns {number} The clamped value. Returns min (or 0 if min is invalid) if inputs are not valid numbers.
 */
const clamp = (val, min, max) => {
    const numVal = parseFloat(val); // Use parseFloat to handle potential decimal inputs before rounding later
    const safeMin = typeof min === 'number' && !isNaN(min) ? min : 0;
    const safeMax = typeof max === 'number' && !isNaN(max) ? max : Infinity;


    if (isNaN(numVal)) {
        GM_log(`Pack Filler Pro: clamp received non-numeric value '${val}'. Clamping to min (${safeMin}).`);
        return safeMin; // Return min for non-numeric input
    }

    return Math.min(safeMax, Math.max(safeMin, numVal));
};

/**
 * Updates the value of a pack input element and dispatches necessary events.
 * Dispatches 'input' and 'change' events to ensure compatibility with front-end frameworks.
 * Assumes MAX_QTY from constants.js and clamp from this file are available.
 * @param {HTMLInputElement} input - The input element to update.
 * @param {number} qty - The new quantity value.
 */
function updateInput(input, qty) {
    // Check critical dependencies
    if (!(input instanceof HTMLInputElement)) {
        GM_log("Pack Filler Pro: updateInput called with invalid input element.", input);
        return; // Abort if input is not valid
    }
     if (typeof clamp !== 'function') {
          GM_log("Pack Filler Pro: updateInput dependencies (clamp) missing. Aborting.");
          return; // Abort if clamp is missing
     }

    // Uses MAX_QTY from src/constants.js (assumed available via @require)
    const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
    // Clamp and round the quantity before setting the value
    const clampedQty = clamp(qty, 0, maxQty);
    const roundedQty = Math.round(clampedQty);
    const valueStr = String(roundedQty);

    // Only update and dispatch events if the value is actually changing
    if (input.value !== valueStr) {
        input.value = valueStr;
        // Dispatch events necessary for frameworks like React/Vue to detect changes
        // Using new Event ensures compatibility with modern event listeners
        // bubbles: true is important for events to propagate up the DOM tree
        try {
            // Catch errors during event dispatching specifically
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            // Log the error but don't necessarily abort, as the value might still be set.
            GM_log(`Pack Filler Pro: Error dispatching input/change events for input ${input.id || input.name || 'unknown'}: ${e.message}`, e);
        }
         // Optional: Add a small delay and re-check/re-dispatch if needed, but this adds complexity.
    }
}

/**
 * Sets the value of all visible pack inputs to zero.
 * Provides user feedback via SweetAlert2.
 * Assumes getPackInputs, updateInput from this file, GM_log, and SWAL_ALERT are available.
 * Assumes config object might be needed by SWAL_ALERT (passed as null here as this function doesn't need it).
 */
function clearAllInputs() {
    // Check critical dependencies
    if (typeof getPackInputs !== 'function' || typeof updateInput !== 'function') {
        GM_log("Pack Filler Pro: clearAllInputs dependencies (getPackInputs or updateInput) missing. Aborting.");
        // Use fallback alert if SWAL_ALERT is not available
        if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Clear Error', 'Required functions missing. Could not clear inputs.', 'error', null);
        else alert('Pack Filler Pro Error: Could not clear inputs due to missing functions.');
        return;
    }

    const inputs = getPackInputs(); // Uses getPackInputs from this file
    if (inputs.length > 0) {
        try {
             inputs.forEach(input => updateInput(input, 0)); // Uses updateInput from this file
             GM_log(`Cleared ${inputs.length} pack input(s).`);
             // Assumes SWAL_ALERT is available and accepts optional config
              if (typeof SWAL_ALERT === 'function') {
                 // Pass null for config here as clearAllInputs doesn't strictly need config for itself,
                 // but SWAL_ALERT might need it for dark mode.
                  SWAL_ALERT("Cleared Packs", `Set ${inputs.length} visible pack input(s) to zero.`, 'success', null);
              } else {
                  GM_log("Pack Filler Pro: SWAL_ALERT function not found for clear feedback.");
              }
        } catch (e) {
             const msg = `Error clearing inputs: ${e.message}`;
             GM_log(`Pack Filler Pro: ERROR - ${msg}`, e);
              if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Clear Error', sanitize(msg), 'error', null);
              else alert(`Pack Filler Pro Error: ${msg}`);
        }


    } else {
        GM_log("Clear All: No visible pack inputs found to clear.");
         if (typeof SWAL_ALERT === 'function') {
              SWAL_ALERT("Clear Packs", "No visible pack inputs found to clear.", 'info', null);
         } else {
             GM_log("Pack Filler Pro: SWAL_ALERT function not found for clear feedback (no inputs).");
         }
    }
}

// Basic HTML sanitization helper
// Prevents simple XSS by escaping HTML entities. Not a complete solution for all cases.
// Assumes this function is used before inserting user-provided strings into HTML (like in Swal).
/**
 * Sanitizes a string to prevent basic HTML injection.
 * @param {string} str - The string to sanitize.
 * @returns {string} The sanitized string. Returns empty string for non-string inputs.
 */
function sanitize(str) {
    if (typeof str !== 'string') {
        GM_log("Pack Filler Pro: sanitize received non-string input.", str);
        return '';
    }
    try {
        const div = document.createElement('div');
        // Using createTextNode and appendChild is a safe way to escape HTML
        div.appendChild(document.createTextNode(str));
        return div.innerHTML; // This will return the escaped HTML
    } catch (e) {
         GM_log("Pack Filler Pro: Error sanitizing string.", e);
         return ''; // Return empty string on error
    }
}


// The functions getPackInputs, clamp, updateInput, clearAllInputs, and sanitize are made available
// to the main script's scope via @require.
