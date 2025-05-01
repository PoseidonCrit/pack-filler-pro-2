// This file contains functions for interacting with the DOM and utility helpers.
// It relies on the cash-dom library ($) and constants like SELECTOR and MAX_QTY,
// which are assumed to be defined in src/constants.js and available via @require.
// It also assumes SWAL_ALERT is available from src/swalHelpers.js via @require.

/* --- DOM Helpers & Utilities --- */

/**
 * Gets all visible pack input elements using the defined selector.
 * Visibility is checked using offsetParent.
 * Assumes $ from cash-dom and SELECTOR from constants.js are available.
 * @returns {Array<HTMLInputElement>} An array of visible input elements. Returns an empty array if $ or SELECTOR are not available.
 */
function getPackInputs() {
    // Use $ from cash-dom (assumed available via @require in main script)
    // Use SELECTOR from src/constants.js (assumed available via @require)
    if (typeof $ === 'undefined' || typeof SELECTOR === 'undefined') {
        GM_log("Pack Filler Pro: getPackInputs dependencies ($ or SELECTOR) missing. Returning empty array.");
        return []; // Return empty array if dependencies are missing
    }
    // .get() converts the cash-dom collection to a standard array
    return $(SELECTOR).get().filter(el => el instanceof HTMLInputElement && el.offsetParent !== null);
}

/**
 * Helper to clamp a value within min/max bounds.
 * @param {number} val - The value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @returns {number} The clamped value. Returns 0 if inputs are not valid numbers.
 */
const clamp = (val, min, max) => {
    const numVal = parseInt(val, 10);
    if (isNaN(numVal)) return 0; // Handle non-numeric input gracefully
    return Math.min(max, Math.max(min, numVal));
};

/**
 * Updates the value of a pack input element and dispatches necessary events.
 * Dispatches 'input' and 'change' events to ensure compatibility with front-end frameworks.
 * Assumes MAX_QTY from constants.js and clamp from this file are available.
 * @param {HTMLInputElement} input - The input element to update.
 * @param {number} qty - The new quantity value.
 */
function updateInput(input, qty) {
    // Ensure input is a valid HTMLInputElement
    if (!(input instanceof HTMLInputElement)) {
        GM_log("Pack Filler Pro: updateInput called with invalid input element.", input);
        return; // Abort if input is not valid
    }
    // Uses MAX_QTY from src/constants.js (assumed available via @require)
    const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
    const v = clamp(qty, 0, maxQty); // Use the clamp function
    const valueStr = String(v);

    // Only update and dispatch events if the value is actually changing
    if (input.value !== valueStr) {
        input.value = valueStr;
        // Dispatch events necessary for frameworks like React/Vue to detect changes
        // Using new Event ensures compatibility with modern event listeners
        // bubbles: true is important for events to propagate up the DOM tree
        try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            GM_log("Pack Filler Pro: Failed to dispatch input/change events.", e);
            // Error dispatching events might indicate a problem with the DOM or environment,
            // but the value is set, so the script might still partially work.
        }
    }
}

/**
 * Sets the value of all visible pack inputs to zero.
 * Provides user feedback via SweetAlert2.
 * Assumes getPackInputs, updateInput from this file, GM_log, and SWAL_ALERT are available.
 * Assumes config object might be needed by SWAL_ALERT (passed as null here as this function doesn't need it).
 */
function clearAllInputs() {
    // Assumes getPackInputs and updateInput are available
    if (typeof getPackInputs !== 'function' || typeof updateInput !== 'function') {
        GM_log("Pack Filler Pro: clearAllInputs dependencies (getPackInputs or updateInput) missing. Aborting.");
        // Use fallback alert if SWAL_ALERT is not available
        if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Clear Error', 'Required functions missing. Could not clear inputs.', 'error', null);
        else alert('Pack Filler Pro Error: Could not clear inputs due to missing functions.');
        return;
    }

    const inputs = getPackInputs(); // Uses getPackInputs from this file
    if (inputs.length > 0) {
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

    } else {
        GM_log("Clear All: No visible pack inputs found to clear.");
         if (typeof SWAL_ALERT === 'function') {
              SWAL_ALERT("Clear Packs", "No visible pack inputs found to clear.", 'info', null);
         } else {
             GM_log("Pack Filler Pro: SWAL_ALERT function not found for clear feedback (no inputs).");
         }
    }
}

// The functions getPackInputs, clamp, updateInput, and clearAllInputs are made available
// to the main script's scope via @require.
