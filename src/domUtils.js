// This block contains functions for interacting with the DOM and utility helpers.
// It relies on the cash-dom library ($).
// In a modular setup, this could be a 'domUtils.js' or 'helpers.js' module.

// Assumes '$', 'SELECTOR', 'MAX_QTY', and GM_log are accessible.
// Assumes SWAL_ALERT is accessible (defined in the SweetAlert2 Helpers module).

/* --- DOM Helpers & Utilities --- */
function getPackInputs() {
    // Use $ (cash-dom) for robust selection and filter for visible ones
    return $(SELECTOR).get().filter(el => el.offsetParent !== null);
}

// Helper to clamp a value within min/max bounds
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

function updateInput(input, qty) {
    const v = clamp(parseInt(qty, 10) || 0, 0, MAX_QTY);
    const valueStr = String(v);
    if (input.value !== valueStr) {
        input.value = valueStr;
        // Dispatch events necessary for frameworks like React/Vue to detect changes
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

function clearAllInputs() {
    const inputs = getPackInputs();
    if (inputs.length > 0) {
        inputs.forEach(input => updateInput(input, 0));
        GM_log(`Cleared ${inputs.length} pack input(s).`);
         SWAL_ALERT("Cleared Packs", `Set ${inputs.length} visible pack input(s) to zero.`, 'success');
    } else {
        GM_log("Clear All: No visible pack inputs found to clear.");
         SWAL_ALERT("Clear Packs", "No visible pack inputs found to clear.", 'info');
    }
}

// Assumes other modules will call these functions as needed.
