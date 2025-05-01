// This file contains the minimal logic for calculating and applying quantities to inputs.
// It includes basic main thread strategies (fixed, random, unlimited).

// It assumes the following are available in the main script's scope via @require:
// - constants from constants.js (MAX_QTY, SELECTOR, etc.)
// - functions from domUtils.js (getPackInputs, clamp, updateInput, clearAllInputs, sanitize)
// - functions from swalHelpers.js (SWAL_ALERT, SWAL_TOAST)
// - functions from configManager.js (validateFillConfig - although minimal validation here)
// - GM_log function

/* --- Minimal Main Thread Fill Strategies --- */
// Only include fixed and random for the minimal version.
const MainThreadFillStrategies = {
    // Fixed quantity strategy: Always returns the configured fixed quantity.
    // Assumes MAX_QTY from constants.js and clamp from domUtils.js are available.
    fixed: (config, index, total) => {
        // Assumes clamp from domUtils.js is available via @require
         if (typeof clamp !== 'function') {
              // GM_log("Pack Filler Pro: fixed strategy dependencies (clamp) missing. Cannot determine quantity."); // Minimal logging
              return 0;
         }
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
        // Ensure config.lastFixedQty is treated as a number
        const fixedQty = parseInt(config.lastFixedQty, 10) || 0;
        return clamp(fixedQty, 0, maxQty);
    },

    // Random quantity strategy: Returns a random quantity within the configured range.
    // Assumes MAX_QTY from constants.js and clamp from domUtils.js are available.
    random: (config, index, total) => {
        // Assumes clamp from domUtils.js is available via @require
        if (typeof clamp !== 'function') {
             // GM_log("Pack Filler Pro: random strategy dependencies (clamp) missing. Cannot determine quantity."); // Minimal logging
             return 0;
        }
        // Uses MAX_QTY from src/constants.js
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
        // Ensure config min/max quantities are treated as numbers
        const min = clamp(parseInt(config.lastMinQty, 10) || 0, 0, maxQty);
        const max = clamp(parseInt(config.lastMaxQty, 10) || 0, 0, maxQty);
        if (min > max) {
             // GM_log("Pack Filler Pro: random strategy called with min > max, returning min.", {min: min, max: max}); // Minimal logging
             return min; // Return min if range is invalid
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
};


/**
 * Determines the actual number of packs to fill based on mode and available inputs.
 * Assumes clamp from domUtils.js is available.
 * @param {object} config - The script's configuration object.
 * @param {number} availableCount - The total number of available pack inputs.
 * @returns {number} The calculated number of packs to fill. Returns 0 if config or availableCount is invalid.
 */
function calculateFillCount(config, availableCount) {
    // Basic validation
    if (typeof config !== 'object' || config === null || typeof availableCount !== 'number' || availableCount < 0) {
        // GM_log("Pack Filler Pro: calculateFillCount called with invalid config or availableCount.", {config: config, availableCount: availableCount}); // Minimal logging
        return 0; // Return 0 for invalid input
    }

     // Check critical dependency
     if (typeof clamp !== 'function') {
          // GM_log("Pack Filler Pro: calculateFillCount failed: clamp function from domUtils.js not found."); // Minimal logging
          return 0; // Cannot calculate safely without clamp
     }

    // Use config object directly
    const { lastMode: mode, lastCount: count } = config;

    if (mode === 'unlimited') {
        return availableCount;
    } else {
        // Clamp count to available inputs, but not less than 0
        // count should be parsed as integer for modes other than unlimited
        const parsedCount = parseInt(count, 10) || 0;
        return clamp(parsedCount, 0, availableCount);
    }
}


/* --- Main Fill Function --- */
/**
 * Fills pack inputs based on current settings.
 * Uses minimal main thread strategies and batch DOM updates.
 * Handles getting inputs, filtering, calculating quantities, and applying updates.
 * Assumes the following are available in scope:
 * getPackInputs, clearAllInputs, virtualUpdate, SWAL_ALERT, SWAL_TOAST,
 * calculateQuantitiesMainThread (local), calculateFillCount (local), clamp, sanitize, MAX_QTY.
 * @param {object} config - The script's configuration object.
 */
async function fillPacks(config) { // Minimal version doesn't need isAutoFill parameter for now
    // GM_log(`Pack Filler Pro: fillPacks started (Minimal).`); // Minimal logging

    // Check critical dependencies before starting core logic
     if (typeof getPackInputs !== 'function' || typeof clearAllInputs !== 'function' ||
         typeof virtualUpdate !== 'function' || typeof SWAL_ALERT === 'undefined' || // SWAL_ALERT must be defined
         typeof SWAL_TOAST === 'undefined' || typeof calculateQuantitiesMainThread !== 'function' || typeof clamp !== 'function' ||
         typeof sanitize !== 'function' || typeof MAX_QTY === 'undefined') {

          const errorMessage = "fillPacks critical dependencies missing. Aborting fill operation.";
          // GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`); // Minimal logging
           // Use fallback alert if SWAL_ALERT is missing, sanitize might also be missing
           const fallbackMsg = `Pack Filler Pro Error: ${errorMessage}. Check script installation or dependencies.`;
           // Attempt to use SWAL_ALERT if available, otherwise fallback to alert
           if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Fill Error', sanitize(errorMessage), 'error', config);
           else alert(fallbackMsg);
          throw new Error(errorMessage); // Abort the async function
     }


    // Use config object directly
    const { lastMode: mode, lastCount: count, lastClear: clear } = config; // Minimal config properties


    // 1. Get Inputs
    // GM_log("Pack Filler Pro: fillPacks Step 1: Getting pack inputs."); // Minimal logging
    const allInputs = getPackInputs();
    const availablePacks = Array.isArray(allInputs) ? allInputs.length : 0;
    // GM_log(`Pack Filler Pro: fillPacks Step 2: Found ${availablePacks} visible inputs.`); // Minimal logging


    if (availablePacks === 0) {
         // GM_log("Pack Filler Pro: fillPacks Step 3: No visible pack inputs found."); // Minimal logging
         SWAL_ALERT('Fill Packs', 'No visible pack inputs found on the page.', 'warning', config);
         // GM_log("Fill operation aborted: No visible pack inputs found."); // Minimal logging
         return; // Exit function if no inputs are found
    }

    // 2. Determine the set of inputs potentially targeted by mode/count
    // GM_log("Pack Filler Pro: fillPacks Step 4: Determining targeted inputs."); // Minimal logging
    let potentialInputsToFill;
     if (mode === 'unlimited') {
          potentialInputsToFill = allInputs; // All visible inputs are targeted
     } else {
           // Call calculateFillCount - Assumes it's defined in this file's scope and returns a number >= 0
           const fillCount = calculateFillCount(config, availablePacks); // Pass config and available count
           // Ensure fillCount is a valid non-negative number
           const safeFillCount = typeof fillCount === 'number' && !isNaN(fillCount) && fillCount >= 0 ? fillCount : 0;
          potentialInputsToFill = allInputs.slice(0, safeFillCount); // Target the first 'fillCount' inputs
     }
    const targetedCount = Array.isArray(potentialInputsToFill) ? potentialInputsToFill.length : 0;
    // GM_log(`Pack Filler Pro: fillPacks Step 5: Targeted ${targetedCount} inputs based on mode/count.`); // Minimal logging


    if (targetedCount === 0) {
         // GM_log("Pack Filler Pro: fillPacks Step 6: No packs targeted."); // Minimal logging
         const finalMessage = availablePacks > 0
             ? `No packs targeted based on current mode (${mode}) and count (${count}).`
             : 'No visible pack inputs found on the page.';
         SWAL_ALERT('Fill Packs', finalMessage, 'info', config);
         // GM_log(`Fill operation aborted: No packs targeted. Mode: ${mode}, Count: ${count}.`); // Minimal logging
         return; // Exit function if no packs are targeted
    }

    // 3. Apply 'Clear Before Fill' option
    // GM_log("Pack Filler Pro: fillPacks Step 7: Checking 'Clear Before Fill' option."); // Minimal logging
    if (clear) { // Always applies if checked in minimal version
        // GM_log("Pack Filler Pro: fillPacks Step 8: Clearing all inputs."); // Minimal logging
         clearAllInputs(); // clearAllInputs handles its own feedback
         // GM_log("Pack Filler Pro: fillPacks Step 9: Inputs cleared."); // Minimal logging
    } else {
         // GM_log("Pack Filler Pro: fillPacks Step 8: 'Clear Before Fill' not active."); // Minimal logging
    }


    // 4. Apply the 'Fill Empty Only' filter (NOT included in minimal version)
    // This is skipped in the minimal version to simplify.
    const inputsToActuallyFill = potentialInputsToFill; // Use all targeted inputs

    const filledCount = Array.isArray(inputsToActuallyFill) ? inputsToActuallyFill.length : 0;
    // GM_log(`Pack Filler Pro: fillPacks Step 10: After filtering (none in minimal), ${filledCount} inputs will be filled.`); // Minimal logging


    if (filledCount === 0) {
         // GM_log("Pack Filler Pro: fillPacks Step 11: No packs needed filling after filter."); // Minimal logging
         const finalMessage = `No packs matched criteria to fill.`; // Simplified message
         SWAL_ALERT('Fill Packs', finalMessage, 'info', config);
         // GM_log(`Fill operation skipped: No packs needed filling.`); // Minimal logging
         return; // Exit function if no packs need filling
    }


    // GM_log("Pack Filler Pro: fillPacks Step 12: Proceeding to quantity calculation (Main Thread)."); // Minimal logging

    let quantitiesToApply = [];
    let metadata = {}; // Minimal metadata
    let totalCopiesAdded = 0; // Track total added

    // --- Core Filling Logic - All on Main Thread ---
    // GM_log(`Pack Filler Pro: fillPacks Step 13: Calculating quantities on main thread using strategy: "${config.patternType}".`); // Minimal logging
    try {
        // calculateQuantitiesMainThread is defined below in this file's scope
        const calculationResult = calculateQuantitiesMainThread(inputsToActuallyFill, config);
        // Ensure calculationResult is valid before destructuring
        if (!calculationResult || !Array.isArray(calculationResult.quantities)) {
             const errorMsg = "calculateQuantitiesMainThread returned invalid result.";
             // GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, calculationResult); // Minimal logging
             SWAL_ALERT('Fill Error', sanitize(errorMsg), 'error', config);
             return; // Abort if calculation failed
        }
        quantitiesToApply = calculationResult.quantities;
        totalCopiesAdded = calculationResult.totalCopiesAdded || 0; // Default to 0 if null/undefined or not a number

        // GM_log(`Pack Filler Pro: fillPacks Step 14: Main thread calculation complete. Generated ${quantitiesToApply.length} quantities. Final total: ${totalCopiesAdded}`); // Minimal logging
        const calculationSource = "Main Thread";

        // --- Apply Quantities to DOM ---
        // GM_log(`Pack Filler Pro: fillPacks Step 15: Applying quantities to DOM. Count: ${quantitiesToApply.length}`); // Minimal logging
         // virtualUpdate is defined below in this file's scope
        if (quantitiesToApply.length > 0) {
             virtualUpdate(inputsToActuallyFill, quantitiesToApply);
            // GM_log("Pack Filler Pro: fillPacks Step 16: Quantities applied via virtualUpdate."); // Minimal logging
        } else { // quantitiesToApply.length === 0
             // GM_log("Pack Filler Pro: fillPacks Step 15a: No quantities generated to apply."); // Minimal logging
             const msg = 'Calculation resulted in zero quantities to apply.';
             SWAL_ALERT('Fill Packs', sanitize(msg), 'warning', config);
             return; // Abort
        }

         // --- Minimal Feedback Generation (SweetAlert2 Modal/Toast) ---
         // GM_log("Pack Filler Pro: fillPacks Step 17: Generating feedback."); // Minimal logging
         // generateFeedback is defined below in this file's scope
         if (filledCount > 0) { // Only show feedback if something was actually filled
            generateFeedback(config, false, calculationSource, targetedCount, availablePacks, filledCount, metadata, totalCopiesAdded);
         } else {
             // If filledCount is 0, feedback was already handled earlier.
             // GM_log("Pack Filler Pro: No packs filled, skipping feedback generation."); // Minimal logging
         }
         // GM_log("Pack Filler Pro: fillPacks finished."); // Minimal logging


    } catch (calculationError) {
         // Catch errors specifically from the calculation or application steps
         // GM_log(`Pack Filler Pro: fillPacks Calculation/Application Caught Error: ${calculationError.message}`, calculationError); // Minimal logging
         // Pass config to SWAL_ALERT for user feedback, assumes sanitize is available
         if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
             SWAL_ALERT('Fill Error', sanitize(calculationError.message), 'error', config);
         } else {
             alert(`Pack Filler Pro Error: ${calculationError.message}`);
         }
    }
 }


/**
 * Calculates quantities for a given set of inputs based on the configured strategy.
 * Handles fixed and random strategies on the main thread.
 * Minimal version does NOT apply maxTotalAmount constraint here.
 * Assumes MainThreadFillStrategies (local), clamp (from domUtils.js), MAX_QTY are available.
 * @param {Array<HTMLInputElement>} inputsToFill - The array of input elements to calculate quantities for. Should be valid HTMLInputElements.
 * @param {object} config - The script's configuration object.
 * @returns {{quantities: number[], metadata: object, totalCopiesAdded: number}} An object containing the calculated quantities, any relevant metadata (empty in minimal), and the total copies added.
 * @throws {Error} Throws an error if a critical function (like clamp or the selected strategy) is not found or input is invalid.
 */
function calculateQuantitiesMainThread(inputsToFill, config) {
    // Check critical dependencies
    if (typeof clamp !== 'function') {
         const errorMsg = "calculateQuantitiesMainThread failed: clamp function from domUtils.js not found.";
         // GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`); // Minimal logging
         throw new Error(errorMsg);
    }
     if (typeof MainThreadFillStrategies !== 'object') {
          const errorMsg = "calculateQuantitiesMainThread failed: MainThreadFillStrategies object not found.";
          // GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`); // Minimal logging
          throw new Error(errorMsg);
     }
     if (!Array.isArray(inputsToFill)) {
          const errorMsg = "calculateQuantitiesMainThread failed: inputsToFill is not a valid array.";
          // GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, inputsToFill); // Minimal logging
          throw new Error(errorMsg);
     }
      if (typeof config !== 'object' || config === null) {
          const errorMsg = "calculateQuantitiesMainThread failed: Invalid config object.";
          // GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, config); // Minimal logging
          throw new Error(errorMsg);
      }


    const quantities = [];
    let currentTotal = 0;
    const totalPacksToFill = inputsToFill.length;

    const strategy = MainThreadFillStrategies[config.patternType];

    if (typeof strategy !== 'function') {
        const errorMsg = `calculateQuantitiesMainThread failed: Main thread strategy function for "${config.patternType}" not found.`;
        // GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`); // Minimal logging
        throw new Error(errorMsg);
    }

    inputsToFill.forEach((input, index) => {
        // Basic validation for each input element in the array
        if (!(input instanceof HTMLInputElement)) {
            // GM_log("Pack Filler Pro: calculateQuantitiesMainThread encountered invalid input element. Skipping.", input); // Minimal logging
            quantities.push(0); // Push 0 for invalid elements
            return; // Skip to the next iteration
        }

        // Calculate quantity using the selected strategy
        // Strategy functions are assumed to return just the quantity in minimal version
        let qty = strategy(config, index, totalPacksToFill);

        // Ensure quantity is a number before clamping
        qty = typeof qty === 'number' && !isNaN(qty) ? qty : 0;

        // Clamp the final quantity to the allowed range [0, MAX_QTY] and round to nearest integer.
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
        qty = clamp(Math.round(qty), 0, maxQty);

        quantities.push(qty);
        currentTotal += qty; // Add the quantity actually set to the total
    });

    // Minimal version does not apply maxTotalAmount here.
    // It's assumed the user either doesn't use it or it will be added in scaling.

    return { quantities: quantities, metadata: {}, totalCopiesAdded: currentTotal }; // Return empty metadata in minimal
}


/* --- Performance Optimization: Virtual DOM Batch Update --- */
/**
 * Updates the value of multiple input elements in a batch to minimize DOM reflows.
 * Iterates through the provided inputs and quantities, calling updateInput for each.
 * Assumes updateInput from domUtils.js is available.
 * @param {Array<HTMLInputElement>} inputs - The array of input elements to update. Should contain valid HTMLInputElements.
 * @param {Array<number>} quantities - The array of new quantities corresponding to the inputs.
 */
function virtualUpdate(inputs, quantities) {
    // Check critical dependencies
    if (typeof updateInput !== 'function') {
         // GM_log("Pack Filler Pro: virtualUpdate called but updateInput function not found. Aborting."); // Minimal logging
         return; // Abort if updateInput is missing
    }

    // Basic validation of inputs and quantities arrays
    if (!Array.isArray(inputs) || inputs.length === 0 || !Array.isArray(quantities) || inputs.length !== quantities.length) {
        // GM_log("Pack Filler Pro: virtualUpdate called with invalid inputs or quantities. Aborting.", {inputs: inputs, quantities: quantities}); // Minimal logging
        return; // Abort if inputs/quantities are invalid
    }

    // Directly update input values and dispatch events using the updateInput helper.
    inputs.forEach((input, i) => {
         // Check if the current item in the array is a valid input element
         if (input instanceof HTMLInputElement) {
            updateInput(input, quantities[i]); // Use updateInput from domUtils
         } else {
             // GM_log(`Pack Filler Pro: virtualUpdate encountered invalid element at index ${i}. Skipping.`, input); // Minimal logging
         }
    });

    // GM_log(`Pack Filler Pro: Applied updates to ${inputs.length} inputs via virtualUpdate.`); // Minimal logging
}


/* --- Minimal Feedback Generation Helper --- */
/**
 * Generates and displays minimal feedback using SweetAlert2.
 * Assumes SWAL_ALERT, SWAL_TOAST, sanitize are available.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isAutoFill - True if triggered by auto-fill (always false in minimal version).
 * @param {string} calculationSource - Describes where calculation happened (always "Main Thread" in minimal version).
 * @param {number} targetedCount - Number of packs targeted by mode/count.
 * @param {number} availableCount - Total number of visible packs.
 * @param {number} filledCount - Number of packs actually updated.
 * @param {object} metadata - Additional data from calculation (empty in minimal).
 * @param {number} totalCopiesAdded - The sum of quantities added in this operation.
 */
function generateFeedback(config, isAutoFill, calculationSource, targetedCount, availableCount, filledCount, metadata, totalCopiesAdded) {
     // Check critical dependencies
     if (typeof SWAL_ALERT === 'undefined' || typeof SWAL_TOAST === 'undefined' || typeof sanitize === 'function') {
          // GM_log("Pack Filler Pro: generateFeedback critical dependencies missing (SWAL or sanitize). Skipping feedback."); // Minimal logging
          return; // Cannot generate feedback without these
     }

    // Use config object directly
    const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty } = config; // Minimal config properties

    let feedbackModeDesc = "";
    let feedbackQuantityDesc = "";

    switch (mode) {
        case 'fixed':
            feedbackModeDesc = `Fixed Count (${count} pack${count === 1 ? '' : 's'})`;
            feedbackQuantityDesc = `${fixedQty} copie${fixedQty === 1 ? '' : 's'} per pack`;
            break;
        case 'random':
            feedbackModeDesc = `Random Count (${count} pack${count === 1 ? '' : 's'})`;
            feedbackQuantityDesc = `Random copies (${minQty}-${maxQty}) per pack`;
            break;
        case 'unlimited':
            feedbackModeDesc = `All Visible Packs`;
            feedbackQuantityDesc = `Quantity based on pattern "${config.patternType}"`; // Refer to pattern type
            break;
        default:
            feedbackModeDesc = `Mode: ${mode}`;
            feedbackQuantityDesc = `Quantity based on pattern "${config.patternType}"`;
    }


    const clearStatus = config.lastClear ? "<br>- Inputs Cleared First" : ""; // Use config.lastClear directly

    let summaryHtml = `
         <p><strong>Operation Details:</strong>${clearStatus}</p>
         <p><strong>Fill Mode:</strong> ${feedbackModeDesc}</p>
         <p><strong>Packs Actually Filled:</strong> ${filledCount} / ${availableCount} visible</p>
         <p><strong>Quantity Rule:</strong> ${feedbackQuantityDesc}</p>
         <p><strong>Total Copies Added:</strong> ${totalCopiesAdded}</p>
     `;

     // Use sanitize for feedback HTML
     const sanitizedSummaryHtml = typeof sanitize === 'function' ? sanitize(summaryHtml) : summaryHtml;


     // GM_log(`Pack Filler Pro: Fill complete. ${summaryHtml.replace(/<br>- /g, '; ').replace(/<.*?>/g, '').replace(/\n/g, ' ')}`); // Minimal logging


     // Always use modal for feedback in minimal version if filledCount > 0
     if (filledCount > 0) {
         SWAL_ALERT('Fill Summary', sanitizedSummaryHtml, 'success', config); // Use sanitized HTML
     } else {
          // If filledCount is 0, feedback was already handled earlier.
          // GM_log("Pack Filler Pro: No packs filled, skipping feedback display."); // Minimal logging
     }
}


// The following functions are made available to the main script's scope via @require.
// - calculateFillCount
// - fillPacks
// - virtualUpdate
// - calculateQuantitiesMainThread
// - MainThreadFillStrategies (object containing the strategy functions)
// - generateFeedback

// Note: chooseQuantity, lerp, perlinNoise, generateSeed
// are internal helpers/variables and are not explicitly exported.
