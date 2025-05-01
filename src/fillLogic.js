// This file contains the minimal logic for calculating and applying quantities to inputs.
// It includes basic main thread strategies (fixed, random, unlimited).
// Wrapped in an IIFE and attaches functions/strategies to window.pfpMinimal.

(function() {
    'use strict';

    // Ensure the global namespace object exists and get references to shared dependencies
    window.pfpMinimal = window.pfpMinimal || {};
    const getPackInputs = window.pfpMinimal.getPackInputs; // From domUtils
    const clamp = window.pfpMinimal.clamp; // From domUtils
    const updateInput = window.pfpMinimal.updateInput; // From domUtils
    const clearAllInputs = window.pfpMinimal.clearAllInputs; // From domUtils
    const sanitize = window.pfpMinimal.sanitize; // From domUtils
    const SWAL_ALERT = window.pfpMinimal.SWAL_ALERT; // From swalHelpers
    const SWAL_TOAST = window.pfpMinimal.SWAL_TOAST; // From swalHelpers
    const validateFillConfig = window.pfpMinimal.validateFillConfig; // From configManager
    const MAX_QTY = window.pfpMinimal.MAX_QTY; // From constants
    const DEFAULT_CONFIG = window.pfpMinimal.DEFAULT_CONFIG; // From constants
    const GM_log = window.GM_log; // Get GM_log from window


    /* --- Minimal Main Thread Fill Strategies --- */
    // Only include fixed and random for the minimal version.
    // Access via window.pfpMinimal.MainThreadFillStrategies
    const MainThreadFillStrategies = {
        // Fixed quantity strategy: Always returns the configured fixed quantity.
        // Assumes MAX_QTY is available via window.pfpMinimal and clamp from namespace.
        fixed: (config, index, total) => {
             if (typeof clamp !== 'function') {
                  if (typeof GM_log === 'function') GM_log("Pack Filler Pro: fixed strategy dependencies (clamp) missing. Cannot determine quantity.");
                  return 0;
             }
            const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
            const fixedQty = parseInt(config.lastFixedQty, 10) || 0;
            return clamp(fixedQty, 0, maxQty);
        },

        // Random quantity strategy: Returns a random quantity within the configured range.
        // Assumes MAX_QTY is available via window.pfpMinimal and clamp from namespace.
        random: (config, index, total) => {
            if (typeof clamp !== 'function') {
                 if (typeof GM_log === 'function') GM_log("Pack Filler Pro: random strategy dependencies (clamp) missing. Cannot determine quantity.");
                 return 0;
            }
            const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
            const min = clamp(parseInt(config.lastMinQty, 10) || 0, 0, maxQty);
            const max = clamp(parseInt(config.lastMaxQty, 10) || 0, 0, maxQty);
            if (min > max) {
                 if (typeof GM_log === 'function') GM_log("Pack Filler Pro: random strategy called with min > max, returning min.", {min: min, max: max});
                 return min;
            }
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
    };


    /**
     * Determines the actual number of packs to fill based on mode and available inputs.
     * Assumes clamp is available via window.pfpMinimal.
     * @param {object} config - The script's configuration object.
     * @param {number} availableCount - The total number of available pack inputs.
     * @returns {number} The calculated number of packs to fill. Returns 0 if config or availableCount is invalid.
     */
    function calculateFillCount(config, availableCount) {
        if (typeof config !== 'object' || config === null || typeof availableCount !== 'number' || availableCount < 0) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: calculateFillCount called with invalid config or availableCount.", {config: config, availableCount: availableCount});
            return 0;
        }

         if (typeof clamp !== 'function') {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: calculateFillCount failed: clamp function not found in namespace.");
              return 0;
         }

        const { lastMode: mode, lastCount: count } = config;

        if (mode === 'unlimited') {
            return availableCount;
        } else {
            const parsedCount = parseInt(count, 10) || 0;
            return clamp(parsedCount, 0, availableCount);
        }
    }


    /* --- Main Fill Function --- */
    /**
     * Fills pack inputs based on current settings.
     * Uses minimal main thread strategies and batch DOM updates.
     * Handles getting inputs, filtering, calculating quantities, and applying updates.
     * Assumes necessary functions/constants are available via window.pfpMinimal or window.
     * @param {object} config - The script's configuration object.
     */
    async function fillPacks(config) {
        // GM_log(`Pack Filler Pro: fillPacks started (Minimal).`); // Minimal logging

        if (typeof getPackInputs !== 'function' || typeof clearAllInputs !== 'function' ||
            typeof virtualUpdate !== 'function' || typeof SWAL_ALERT === 'undefined' ||
            typeof SWAL_TOAST === 'undefined' || typeof calculateQuantitiesMainThread !== 'function' || typeof clamp !== 'function' ||
            typeof sanitize !== 'function' || typeof MAX_QTY === 'undefined') {

             const errorMessage = "fillPacks critical dependencies missing from namespace. Aborting fill operation.";
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
             const alertFn = typeof SWAL_ALERT === 'function' ? SWAL_ALERT : alert;
             const sanitizeFn = typeof sanitize === 'function' ? sanitize : (text) => text;
             alertFn('Fill Error', sanitizeFn(errorMessage), 'error', config);
             throw new Error(errorMessage);
        }

        const { lastMode: mode, lastCount: count, lastClear: clear } = config;

        const allInputs = getPackInputs();
        const availablePacks = Array.isArray(allInputs) ? allInputs.length : 0;

        if (availablePacks === 0) {
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Packs', 'No visible pack inputs found on the page.', 'warning', config);
             if (typeof GM_log === 'function') GM_log("Fill operation aborted: No visible pack inputs found.");
             return;
        }

        let potentialInputsToFill;
         if (mode === 'unlimited') {
              potentialInputsToFill = allInputs;
         } else {
               const fillCount = calculateFillCount(config, availablePacks);
               const safeFillCount = typeof fillCount === 'number' && !isNaN(fillCount) && fillCount >= 0 ? fillCount : 0;
              potentialInputsToFill = allInputs.slice(0, safeFillCount);
         }
        const targetedCount = Array.isArray(potentialInputsToFill) ? potentialInputsToFill.length : 0;

        if (targetedCount === 0) {
             const finalMessage = availablePacks > 0
                 ? `No packs targeted based on current mode (${mode}) and count (${count}).`
                 : 'No visible pack inputs found on the page.';
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Packs', finalMessage, 'info', config);
             if (typeof GM_log === 'function') GM_log(`Fill operation aborted: No packs targeted. Mode: ${mode}, Count: ${count}.`);
             return;
        }

        if (clear) {
             clearAllInputs();
        }

        // Minimal version does NOT apply 'Fill Empty Only' filter here.
        const inputsToActuallyFill = potentialInputsToFill;
        const filledCount = Array.isArray(inputsToActuallyFill) ? inputsToActuallyFill.length : 0;

        if (filledCount === 0) {
             const finalMessage = `No packs matched criteria to fill.`;
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Packs', finalMessage, 'info', config);
             if (typeof GM_log === 'function') GM_log(`Fill operation skipped: No packs needed filling.`);
             return;
        }

        let quantitiesToApply = [];
        let metadata = {};
        let totalCopiesAdded = 0;

        try {
            // calculateQuantitiesMainThread is defined below in this file's scope
            const calculationResult = calculateQuantitiesMainThread(inputsToActuallyFill, config);
            if (!calculationResult || !Array.isArray(calculationResult.quantities)) {
                 const errorMsg = "calculateQuantitiesMainThread returned invalid result.";
                 if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, calculationResult);
                 if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Fill Error', sanitize(errorMsg), 'error', config);
                 return;
            }
            quantitiesToApply = calculationResult.quantities;
            totalCopiesAdded = calculationResult.totalCopiesAdded || 0;

            const calculationSource = "Main Thread";

            if (quantitiesToApply.length > 0) {
                 virtualUpdate(inputsToActuallyFill, quantitiesToApply);
            } else {
                 const msg = 'Calculation resulted in zero quantities to apply.';
                 if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Fill Packs', sanitize(msg), 'warning', config);
                 return;
            }

             // generateFeedback is defined below in this file's scope
             if (filledCount > 0) {
                generateFeedback(config, false, calculationSource, targetedCount, availablePacks, filledCount, metadata, totalCopiesAdded);
             }
             // GM_log("Pack Filler Pro: fillPacks finished."); // Minimal logging

        } catch (calculationError) {
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: fillPacks Calculation/Application Caught Error: ${calculationError.message}`, calculationError);
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
     * Assumes MainThreadFillStrategies (local), clamp (from namespace), MAX_QTY (from namespace) are available.
     * @param {Array<HTMLInputElement>} inputsToFill - The array of input elements to calculate quantities for.
     * @param {object} config - The script's configuration object.
     * @returns {{quantities: number[], metadata: object, totalCopiesAdded: number}}
     * @throws {Error} Throws an error if a critical function is not found or input is invalid.
     */
    function calculateQuantitiesMainThread(inputsToFill, config) {
        if (typeof clamp !== 'function') {
             const errorMsg = "calculateQuantitiesMainThread failed: clamp function not found in namespace.";
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
             throw new Error(errorMsg);
        }
         if (typeof MainThreadFillStrategies !== 'object') {
              const errorMsg = "calculateQuantitiesMainThread failed: MainThreadFillStrategies object not found.";
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
              throw new Error(errorMsg);
         }
         if (!Array.isArray(inputsToFill)) {
              const errorMsg = "calculateQuantitiesMainThread failed: inputsToFill is not a valid array.";
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, inputsToFill);
              throw new Error(errorMsg);
         }
          if (typeof config !== 'object' || config === null) {
              const errorMsg = "calculateQuantitiesMainThread failed: Invalid config object.";
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, config);
              throw new Error(errorMsg);
          }

        const quantities = [];
        let currentTotal = 0;
        const totalPacksToFill = inputsToFill.length;

        const strategy = MainThreadFillStrategies[config.patternType]; // Use patternType from config

        if (typeof strategy !== 'function') {
            // Fallback to 'random' if the configured patternType strategy is missing
            const fallbackStrategy = MainThreadFillStrategies.random;
            if (typeof fallbackStrategy !== 'function') {
                 const errorMsg = `calculateQuantitiesMainThread failed: Strategy "${config.patternType}" and fallback "random" function not found.`;
                 if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                 throw new Error(errorMsg);
            }
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Strategy "${config.patternType}" not found, falling back to "random".`);
            strategy = fallbackStrategy; // Use fallback
        }


        inputsToFill.forEach((input, index) => {
            if (!(input instanceof HTMLInputElement)) {
                if (typeof GM_log === 'function') GM_log("Pack Filler Pro: calculateQuantitiesMainThread encountered invalid input element. Skipping.", input);
                quantities.push(0);
                return;
            }

            let qty = strategy(config, index, totalPacksToFill);

            qty = typeof qty === 'number' && !isNaN(qty) ? qty : 0;

            const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
            qty = clamp(Math.round(qty), 0, maxQty);

            quantities.push(qty);
            currentTotal += qty;
        });

        return { quantities: quantities, metadata: {}, totalCopiesAdded: currentTotal };
    }


    /**
     * Updates the value of multiple input elements in a batch.
     * Iterates through the provided inputs and quantities, calling updateInput for each.
     * Assumes updateInput from window.pfpMinimal is available.
     * @param {Array<HTMLInputElement>} inputs - The array of input elements to update.
     * @param {Array<number>} quantities - The array of new quantities corresponding to the inputs.
     */
    function virtualUpdate(inputs, quantities) {
        if (typeof updateInput !== 'function') {
             if (typeof GM_log === 'function') GM_log("Pack Filler Pro: virtualUpdate called but updateInput function not found in namespace. Aborting.");
             return;
        }

        if (!Array.isArray(inputs) || inputs.length === 0 || !Array.isArray(quantities) || inputs.length !== quantities.length) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: virtualUpdate called with invalid inputs or quantities. Aborting.", {inputs: inputs, quantities: quantities});
            return;
        }

        inputs.forEach((input, i) => {
             if (input instanceof HTMLInputElement) {
                updateInput(input, quantities[i]);
             } else {
                 if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: virtualUpdate encountered invalid element at index ${i}. Skipping.`, input);
             }
        });

        // GM_log(`Pack Filler Pro: Applied updates to ${inputs.length} inputs via virtualUpdate.`); // Minimal logging
    }


    /**
     * Generates and displays minimal feedback using SweetAlert2.
     * Assumes SWAL_ALERT, SWAL_TOAST, sanitize are available via window.pfpMinimal.
     * @param {object} config - The script's configuration object.
     * @param {boolean} isAutoFill - Always false in minimal version.
     * @param {string} calculationSource - Always "Main Thread" in minimal version.
     * @param {number} targetedCount - Number of packs targeted by mode/count.
     * @param {number} availableCount - Total number of visible packs.
     * @param {number} filledCount - Number of packs actually updated.
     * @param {object} metadata - Empty in minimal version.
     * @param {number} totalCopiesAdded - The sum of quantities added in this operation.
     */
    function generateFeedback(config, isAutoFill, calculationSource, targetedCount, availableCount, filledCount, metadata, totalCopiesAdded) {
         if (typeof SWAL_ALERT === 'undefined' || typeof SWAL_TOAST === 'undefined' || typeof sanitize === 'function') {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: generateFeedback critical dependencies missing (SWAL or sanitize). Skipping feedback.");
              return;
         }

        const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty } = config;

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
                feedbackQuantityDesc = `Quantity based on pattern "${config.patternType}"`;
                break;
            default:
                feedbackModeDesc = `Mode: ${mode}`;
                feedbackQuantityDesc = `Quantity based on pattern "${config.patternType}"`;
        }

        const clearStatus = config.lastClear ? "<br>- Inputs Cleared First" : "";

        let summaryHtml = `
             <p><strong>Operation Details:</strong>${clearStatus}</p>
             <p><strong>Fill Mode:</strong> ${feedbackModeDesc}</p>
             <p><strong>Packs Actually Filled:</strong> ${filledCount} / ${availableCount} visible</p>
             <p><strong>Quantity Rule:</strong> ${feedbackQuantityDesc}</p>
             <p><strong>Total Copies Added:</strong> ${totalCopiesAdded}</p>
         `;

         const sanitizedSummaryHtml = typeof sanitize === 'function' ? sanitize(summaryHtml) : summaryHtml;

         if (filledCount > 0) {
             SWAL_ALERT('Fill Summary', sanitizedSummaryHtml, 'success', config);
         } else {
              // GM_log("Pack Filler Pro: No packs filled, skipping feedback display."); // Minimal logging
         }
    }


    // Attach functions and strategies to the global namespace object
    window.pfpMinimal.calculateFillCount = calculateFillCount;
    window.pfpMinimal.fillPacks = fillPacks;
    window.pfpMinimal.virtualUpdate = virtualUpdate;
    window.pfpMinimal.calculateQuantitiesMainThread = calculateQuantitiesMainThread;
    window.pfpMinimal.MainThreadFillStrategies = MainThreadFillStrategies; // Attach strategies object
    window.pfpMinimal.generateFeedback = generateFeedback;

})(); // End of IIFE
