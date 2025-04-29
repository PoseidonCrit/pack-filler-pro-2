// This file contains functions for interacting with the DOM and utility helpers.
// It relies on the cash-dom library ($) and constants like SELECTOR and MAX_QTY,
// which are assumed to be defined in src/constants.js and available via @require.
// It also assumes SWAL_ALERT is available from src/swalHelpers.js via @require.

/* --- DOM Helpers & Utilities --- */
// Gets all visible pack input elements using the defined selector.
function getPackInputs() {
    // Uses $ from cash-dom (assumed available via @require in main script)
    // Uses SELECTOR from src/constants.js (assumed available via @require)
    return $(SELECTOR).get().filter(el => el.offsetParent !== null);
}

// Helper to clamp a value within min/max bounds.
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

// Updates the value of a pack input element and dispatches necessary events.
function updateInput(input, qty) {
    // Uses MAX_QTY from src/constants.js (assumed available via @require)
    const v = clamp(parseInt(qty, 10) || 0, 0, MAX_QTY);
    const valueStr = String(v);
    if (input.value !== valueStr) {
        input.value = valueStr;
        // Dispatch events necessary for frameworks like React/Vue to detect changes
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Sets the value of all visible pack inputs to zero.
function clearAllInputs() {
    const inputs = getPackInputs(); // Uses getPackInputs from this file
    if (inputs.length > 0) {
        inputs.forEach(input => updateInput(input, 0)); // Uses updateInput from this file
        GM_log(`Cleared ${inputs.length} pack input(s).`); // Assumes GM_log is available
         SWAL_ALERT("Cleared Packs", `Set ${inputs.length} visible pack input(s) to zero.`, 'success'); // Assumes SWAL_ALERT is available
    } else {
        GM_log("Clear All: No visible pack inputs found to clear.");
         SWAL_ALERT("Clear Packs", "No visible pack inputs found to clear.", 'info');
    }
}

// Note: No IIFE wrapper needed in this file if the main script uses one,
// as the functions and constants defined here will be added to the main script's scope.
