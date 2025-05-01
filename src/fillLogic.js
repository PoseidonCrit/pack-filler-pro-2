// This file contains the main logic for calculating and applying quantities to inputs.
// It uses constants and DOM helper functions.
// Note: This module now accepts the 'config' object as a parameter where needed.

// It assumes 'MAX_QTY', 'getPackInputs', 'clamp', 'updateInput',
// 'clearAllInputs', 'SWAL_ALERT', 'SWAL_TOAST', 'updateConfigFromUI',
// and the pattern worker (patternWorker) are accessible.

/* --- Sanitization & Validation --- */
// Basic sanitization to prevent XSS in feedback messages
const sanitize = (str) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
};

// Validates the quantity-related parts of the config
function validateFillConfig(config) {
    if (typeof config.lastFixedQty !== 'number' || config.lastFixedQty < 0 || config.lastFixedQty > MAX_QTY) {
        throw new Error(`Invalid fixed quantity: ${config.lastFixedQty}. Must be between 0 and ${MAX_QTY}.`);
    }
    if (typeof config.lastMinQty !== 'number' || config.lastMinQty < 0 || config.lastMinQty > MAX_QTY) {
        throw new Error(`Invalid minimum quantity: ${config.lastMinQty}. Must be between 0 and ${MAX_QTY}.`);
    }
    if (typeof config.lastMaxQty !== 'number' || config.lastMaxQty < 0 || config.lastMaxQty > MAX_QTY) {
        throw new Error(`Invalid maximum quantity: ${config.lastMaxQty}. Must be between 0 and ${MAX_QTY}.`);
    }
    if (config.lastMinQty > config.lastMaxQty) {
         throw new Error(`Minimum quantity (${config.lastMinQty}) cannot be greater than maximum quantity (${config.lastMaxQty}).`);
    }
    if (typeof config.maxTotalAmount !== 'number' || config.maxTotalAmount < 0) {
         throw new Error(`Invalid max total amount: ${config.maxTotalAmount}. Must be 0 or greater.`);
    }
     if (typeof config.patternScale !== 'number' || config.patternScale < 10 || config.patternScale > 1000) {
          throw new Error(`Invalid pattern scale: ${config.patternScale}. Must be between 10 and 1000.`);
     }
     if (typeof config.patternIntensity !== 'number' || config.patternIntensity < 0.0 || config.patternIntensity > 1.0) {
          throw new Error(`Invalid pattern intensity: ${config.patternIntensity}. Must be between 0.0 and 1.0.`);
     }
     // Add validation for other config properties as needed
}


/* --- Worker Interaction --- */
// Manages requests sent to the Web Worker and their responses.
// Assumes 'patternWorker' is available globally (or in the scope via @require).
// Assumes GM_log is available.

let _workerRequestId = 0;
const _pendingWorkerRequests = new Map(); // Map<requestId, { resolve, reject, timeoutId }>

/**
 * Sends a message to the Web Worker and returns a Promise that resolves with the result.
 * Includes a timeout mechanism.
 * @param {object} data - The data to send to the worker.
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @returns {Promise<object>} A promise that resolves with the worker's result data.
 */
function callWorkerAsync(data, timeoutMs = 10000) {
     return new Promise((resolve, reject) => {
          if (typeof patternWorker === 'undefined' || patternWorker === null) {
               GM_log("Pack Filler Pro: callWorkerAsync called but worker is not available.");
               return reject(new Error("Web Worker is not available."));
          }

          const requestId = _workerRequestId++;
          const timeoutId = setTimeout(() => {
               GM_log(`Pack Filler Pro: Worker request ${requestId} timed out.`);
               _pendingWorkerRequests.delete(requestId);
               reject(new Error("Web Worker calculation timed out."));
          }, timeoutMs);

          _pendingWorkerRequests.set(requestId, { resolve, reject, timeoutId });

          // Add the requestId to the data being sent to the worker
          patternWorker.postMessage({ ...data, requestId: requestId });
     });
}

// Listener for messages coming back from the worker
if (typeof patternWorker !== 'undefined' && patternWorker !== null) {
     patternWorker.onmessage = (e) => {
          const { type, data, requestId, quantities, metadata } = e.data;

          if (type === 'log') {
               // Handle log messages from the worker
               GM_log("Pack Filler Pro Worker Log:", ...data);
          } else if (type === 'result') {
               // Handle result messages
               if (_pendingWorkerRequests.has(requestId)) {
                    const { resolve, timeoutId } = _pendingWorkerRequests.get(requestId);
                    clearTimeout(timeoutId);
                    _pendingWorkerRequests.delete(requestId);
                    resolve({ quantities, metadata }); // Resolve the promise with the result
               } else {
                    GM_log(`Pack Filler Pro: Received worker result for unknown request ID: ${requestId}`);
               }
          }
     };

     patternWorker.onerror = (error) => {
          GM_log("Pack Filler Pro: Web Worker encountered an error:", error);
          // Handle worker errors for all pending requests
          _pendingWorkerRequests.forEach(({ reject, timeoutId }, requestId) => {
               clearTimeout(timeoutId);
               reject(new Error(`Web Worker error: ${error.message || 'Unknown error'}`));
          });
          _pendingWorkerRequests.clear();
     };
} else {
     GM_log("Pack Filler Pro: Web Worker is not available, skipping onmessage/onerror binding.");
}


/* --- Main Thread Fill Strategies & Helpers --- */
// Simple strategies that can run efficiently on the main thread.

// Helper to clamp a value within min/max bounds (local to main thread logic)
// Assuming clamp is also available globally from domUtils.js, but redefining here for clarity/safety
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));


// Helper to choose a random quantity within the configured range
function chooseQuantity(config) {
    const min = clamp(config.lastMinQty, 0, MAX_QTY);
    const max = clamp(config.lastMaxQty, 0, MAX_QTY);
    if (min > max) return 0; // Should be prevented by validation, but defensive
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simple linear interpolation helper (local to main thread logic)
const lerp = (a, b, t) => a + t * (b - a);

// Strategy functions for main thread calculation
const MainThreadFillStrategies = {
    // Fixed quantity strategy
    fixed: (config, index, total) => clamp(config.lastFixedQty, 0, MAX_QTY),

    // Random quantity strategy (uses chooseQuantity)
    random: (config, index, total) => chooseQuantity(config),

    // Gradient strategy (can run on main thread, but included in worker for consistency if needed)
    // Keeping a fallback here in case worker fails
    gradient: (config, index, total) => {
        const intensity = config.patternIntensity || 1.0;
        const minQty = config.lastMinQty;
        const maxQty = config.lastMaxQty;
        const range = maxQty - minQty;

        // Ensure total is at least 1 to avoid division by zero
        const safeTotal = Math.max(1, total);

        // Calculate a base quantity based on position in the list
        const baseQty = minQty + (index / (safeTotal > 1 ? safeTotal - 1 : 1)) * range; // Handle total=1 case

        // Apply intensity to shift the quantity towards minQty or maxQty
        // If intensity is 1, quantity ranges from min to max.
        // If intensity is 0, quantity is always minQty + range/2 (midpoint).
        let quantity = lerp(minQty + range / 2, baseQty, intensity);


        quantity = clamp(Math.round(quantity), 0, MAX_QTY); // Clamp and round

        return quantity;
    },

    // Alternating strategy (runs on main thread)
    alternating: (config, index, total) => {
         const minQty = clamp(config.lastMinQty, 0, MAX_QTY);
         const maxQty = clamp(config.lastMaxQty, 0, MAX_QTY);
         if (minQty > maxQty) return 0; // Should be prevented by validation
         return index % 2 === 0 ? minQty : maxQty;
    },

    // Perlin strategy fallback (runs on main thread if worker fails or is unavailable)
    // Note: This requires a Perlin noise implementation available in the main thread scope.
    // For simplicity, we will use the 'random' strategy as a fallback if the worker fails.
    // A full Perlin implementation on the main thread would be more complex and potentially blocking.
    perlin: (config, index, total) => {
        // This function should ideally not be called if the worker is available for 'perlin'.
        // If it is called, it means the worker failed or wasn't available.
        // Fallback to random strategy.
         GM_log("Pack Filler Pro: Perlin strategy called on main thread. Falling back to random.");
         return MainThreadFillStrategies.random(config, index, total);
    }
};


// Determines the actual number of packs to fill based on mode and available inputs.
// Moved this function definition directly before fillPacks to ensure scope availability.
function calculateFillCount(config, availableCount) {
    // Use config object directly
    const { lastMode: mode, lastCount: count } = config;

    if (mode === 'unlimited') {
        return availableCount;
    } else {
        // Clamp count to available inputs, but not less than 0
        return clamp(count, 0, availableCount);
    }
}


/* --- Main Fill Function --- */
/**
 * Fills pack inputs based on current settings.
 * Now incorporates pattern strategies and batch DOM updates, using a Web Worker for heavy calculations.
 * @param {object} config - The script's configuration object.
 * @param {boolean} [isAutoFill=false] - True if triggered by the auto-load process.
 */
async function fillPacks(config, isAutoFill = false) { // Accept config here and make async
    GM_log(`Pack Filler Pro: fillPacks started (Auto-fill: ${isAutoFill}). Step 1: Function Entry.`); // Debugging log

    // Use config object directly
    const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty, lastClear: clear, maxTotalAmount, fillEmptyOnly, patternType } = config;

    try {
        // 1. Validate relevant parts of config (quantities and pattern params)
        GM_log("Pack Filler Pro: fillPacks Step 2: Validating config."); // Debugging log
        validateFillConfig(config); // Reuse existing validation
        GM_log("Pack Filler Pro: fillPacks Step 3: Config validated."); // Debugging log


        // 2. Get Inputs
        GM_log("Pack Filler Pro: fillPacks Step 4: Getting pack inputs."); // Debugging log
        const allInputs = getPackInputs(); // Assumes getPackInputs is accessible
        const availablePacks = allInputs.length;
        GM_log(`Pack Filler Pro: fillPacks Step 5: Found ${availablePacks} visible inputs.`); // Debugging log


        if (availablePacks === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 6: No visible pack inputs found."); // Debugging log
             // Pass config to SWAL_ALERT
             if (!isAutoFill) SWAL_ALERT('Fill Packs', 'No visible pack inputs found on the page.', 'warning', config);
             GM_log("Fill operation aborted: No visible pack inputs found.");
             return;
        }

        // 3. Determine the set of inputs potentially targeted by mode/count
        GM_log("Pack Filler Pro: fillPacks Step 7: Determining targeted inputs."); // Debugging log
        let potentialInputsToFill;
         if (mode === 'unlimited') {
              potentialInputsToFill = allInputs; // All visible
         } else {
               // Call calculateFillCount - now guaranteed to be defined in this scope
               const fillCount = calculateFillCount(config, availablePacks); // Pass config
              potentialInputsToFill = allInputs.slice(0, fillCount);
         }
        const targetedCount = potentialInputsToFill.length;
        GM_log(`Pack Filler Pro: fillPacks Step 8: Targeted ${targetedCount} inputs based on mode/count.`); // Debugging log


        if (targetedCount === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 9: No packs targeted."); // Debugging log
             // Pass config to SWAL_ALERT
             if (!isAutoFill) SWAL_ALERT('Fill Packs', `No packs targeted based on current mode (${mode}) and count (${count}).`, 'info', config);
             GM_log(`Fill operation aborted: No packs targeted. Mode: ${mode}, Count: ${count}.`);
             return;
        }

        // 4. Apply 'Clear Before Fill' option (only for manual trigger)
        GM_log("Pack Filler Pro: fillPacks Step 10: Checking 'Clear Before Fill' option."); // Debugging log
        if (clear && !isAutoFill) {
            GM_log("Pack Filler Pro: fillPacks Step 11: Clearing all inputs."); // Debugging log
            clearAllInputs(); // Assumes clearAllInputs is accessible
            GM_log("Pack Filler Pro: fillPacks Step 12: Inputs cleared."); // Debugging log
        } else {
             GM_log("Pack Filler Pro: fillPacks Step 11: 'Clear Before Fill' not active or auto-fill."); // Debugging log
        }


        // 5. Apply the 'Fill Empty Only' filter
        GM_log("Pack Filler Pro: fillPacks Step 13: Applying 'Fill Empty Only' filter."); // Debugging log
        const inputsToActuallyFill = fillEmptyOnly
            ? potentialInputsToFill.filter(el => !el.value || parseInt(el.value, 10) === 0)
            : potentialInputsToFill;

        const filledCount = inputsToActuallyFill.length;
        GM_log(`Pack Filler Pro: fillPacks Step 14: After filtering, ${filledCount} inputs will be filled.`); // Debugging log


        if (filledCount === 0 && targetedCount > 0) {
             GM_log("Pack Filler Pro: fillPacks Step 15: No packs needed filling after filter."); // Debugging log
             // If packs were targeted but none were empty (and Fill Empty Only is relevant)
             const message = fillEmptyOnly
                 ? `No empty packs found among the ${targetedCount} targeted.`
                 : `All ${targetedCount} targeted packs already have a quantity.`;
             // Pass config to SWAL_ALERT
             if (!isAutoFill) SWAL_ALERT('Fill Packs', message, 'info', config);
             GM_log(`Fill operation skipped: No packs needed filling. Targeted: ${targetedCount}, Filled: ${filledCount}`);
             return;
        } else if (filledCount === 0 && targetedCount === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 15: No packs targeted or matched criteria."); // Debugging log
             // This case is already handled above, but defensive check
             // Pass config to SWAL_ALERT
             if (!isAutoFill) SWAL_ALERT('Fill Packs', `No packs matched criteria to fill.`, 'info', config);
              GM_log(`Fill operation aborted: No packs matched criteria.`);
             return;
        }

        GM_log("Pack Filler Pro: fillPacks Step 16: Proceeding to quantity calculation."); // Debugging log

        let quantitiesToApply = [];
        let currentTotal = 0; // Track total added in this fill operation
        let maxTotalHit = false;
        const useMaxTotal = maxTotalAmount > 0;

        const totalPacksToFill = inputsToActuallyFill.length;
        let calculationSource = "Main Thread";
        let metadata = {}; // To store metadata from worker like seed used

        // --- Core Filling Logic ---
        // Determine quantities based on pattern or mode
        const workerStrategies = ['perlin', 'gradient']; // Strategies that can run in worker
        const useWorker = workerStrategies.includes(patternType) && typeof patternWorker !== 'undefined' && patternWorker !== null;

        GM_log(`Pack Filler Pro: fillPacks Step 17: Checking worker availability for pattern type "${patternType}". useWorker: ${useWorker}`); // Debugging log

        if (useWorker) {
            // Attempt to use the Web Worker for calculation
            GM_log(`Pack Filler Pro: fillPacks Step 18: Attempting to use Web Worker for "${patternType}" calculation.`); // Debugging log
            try {
                 // Pass necessary config subset to the worker
                 const workerConfig = {
                      noiseSeed: config.noiseSeed,
                      patternScale: config.patternScale,
                      patternIntensity: config.patternIntensity,
                      lastMinQty: config.lastMinQty,
                      lastMaxQty: config.lastMaxQty,
                      maxTotalAmount: config.maxTotalAmount,
                      // fillEmptyOnly is handled on main thread
                 };
                 const workerData = { strategy: patternType, count: totalPacksToFill, config: workerConfig };
                 GM_log(`Pack Filler Pro: fillPacks Step 19: Calling worker with data:`, workerData); // Debugging log
                 const result = await callWorkerAsync(workerData); // Await the worker result
                 GM_log(`Pack Filler Pro: fillPacks Step 20: Received result from worker:`, result); // Debugging log


                 quantitiesToApply = result.quantities;
                 metadata = result.metadata || {}; // Get metadata if available

                 // Calculate total from worker results
                 currentTotal = quantitiesToApply.reduce((sum, qty) => sum + qty, 0);
                 if (useMaxTotal && currentTotal >= maxTotalAmount) maxTotalHit = true;

                 calculationSource = "Web Worker";
                 if(metadata.seedUsed) calculationSource += ` (Seed: ${metadata.seedUsed})`;

                 GM_log(`Pack Filler Pro: fillPacks Step 21: Quantities received from worker (${quantitiesToApply.length}).`); // Debugging log

            } catch (error) {
                GM_log(`Pack Filler Pro: fillPacks Step 18a: Worker calculation failed for "${patternType}": ${error.message}. Falling back to main thread.`, error); // Debugging log
                // Worker failed, fall back to main thread random strategy
                calculationSource = "Main Thread (Fallback)";
                quantitiesToApply = []; // Clear any partial results from the failed worker attempt
                currentTotal = 0; // Reset total for main thread calculation
                maxTotalHit = false; // Reset max total hit flag
                metadata = {}; // Clear metadata

                // Proceed with main thread calculation using the fallback strategy
                const fallbackStrategy = MainThreadFillStrategies.random; // Fallback to random
                 GM_log(`Pack Filler Pro: fillPacks Step 18b: Using main thread fallback strategy "random".`); // Debugging log
                 inputsToActuallyFill.forEach((input, index) => {
                      let qty = fallbackStrategy(config, index, totalPacksToFill);
                      // Apply max total limit on main thread
                      if (useMaxTotal) {
                           const remaining = maxTotalAmount - currentTotal;
                           qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity
                           if (currentTotal + qty >= maxTotalAmount) maxTotalHit = true;
                      }
                      quantitiesToApply.push(qty);
                      currentTotal += qty;
                 });
                 GM_log(`Pack Filler Pro: fillPacks Step 18c: Main thread fallback calculation complete. Generated ${quantitiesToApply.length} quantities.`); // Debugging log
            }
        } else {
            // Not using a worker strategy or worker is unavailable, use main thread calculation
            const mainThreadStrategy = MainThreadFillStrategies[patternType] || MainThreadFillStrategies.random; // Use selected or default to random
            calculationSource = "Main Thread";
            GM_log(`Pack Filler Pro: fillPacks Step 17a: Calculating quantities on main thread using strategy: "${patternType}".`); // Debugging log

             inputsToActuallyFill.forEach((input, index) => {
                  let qty = mainThreadStrategy(config, index, totalPacksToFill);
                  // Apply max total limit on main thread
                  if (useMaxTotal) {
                       const remaining = maxTotalAmount - currentTotal;
                       qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity
                       if (currentTotal + qty >= maxTotalAmount) maxTotalHit = true;
                  }
                  quantitiesToApply.push(qty);
                  currentTotal += qty;
             });
             GM_log(`Pack Filler Pro: fillPacks Step 17b: Main thread calculation complete. Generated ${quantitiesToApply.length} quantities.`); // Debugging log
        }


        // --- Apply Quantities to DOM ---
        GM_log(`Pack Filler Pro: fillPacks Step 22: Applying quantities to DOM. Count: ${quantitiesToApply.length}`); // Debugging log
        if (quantitiesToApply.length > 0) {
            // Use the batch update function
            // Pass the original inputsToActuallyFill and the calculated quantities
            virtualUpdate(inputsToActuallyFill, quantitiesToApply); // Assumes virtualUpdate is accessible
            GM_log("Pack Filler Pro: fillPacks Step 23: Quantities applied via virtualUpdate."); // Debugging log
        } else {
             GM_log("Pack Filler Pro: fillPacks Step 22a: No quantities generated to apply."); // Debugging log
             // Pass config to SWAL_ALERT
             if (!isAutoFill) SWAL_ALERT('Fill Packs', 'Calculation failed. No quantities generated.', 'error', config);
             return; // Abort if no quantities were generated
        }


         // --- DETAILED FEEDBACK GENERATION (SweetAlert2 Modal/Toast) ---
         // Only show modal/toast for manual fills or if autofill resulted in actual fills
         GM_log("Pack Filler Pro: fillPacks Step 24: Generating feedback."); // Debugging log
         if (!isAutoFill || (isAutoFill && filledCount > 0)) {
            generateFeedback(config, isAutoFill, calculationSource, targetedCount, availablePacks, filledCount, metadata, currentTotal); // Pass all relevant info
         }
         GM_log("Pack Filler Pro: fillPacks Step 25: Feedback generated."); // Debugging log


     } catch (error) {
         GM_log(`Pack Filler Pro: fillPacks Step Error: Caught an error during fill process: ${error.message}`, error); // Debugging log
         // Pass config to SWAL_ALERT
         if (!isAutoFill) SWAL_ALERT('Fill Error', sanitize(error.message), 'error', config);
     }
     GM_log("Pack Filler Pro: fillPacks finished."); // Debugging log
 }

// --- New Function: Fill Single Random Pack ---

/**
 * Selects one random visible pack input and fills it based on current settings.
 * @param {object} config - The script's configuration object.
 */
async function fillRandomPackInput(config) {
    GM_log("Pack Filler Pro: Attempting to fill 1 random pack.");
    try {
        // 1. Validate relevant parts of config (quantities)
        validateFillConfig(config); // Reuse existing validation

        // 2. Get Inputs
        const allInputs = getPackInputs();
        if (allInputs.length === 0) {
            SWAL_ALERT('No Inputs', 'No visible pack inputs found to select from.', 'warning', config);
            return;
        }

        // 3. Select Random Input
        const randomIndex = Math.floor(Math.random() * allInputs.length);
        const targetInput = allInputs[randomIndex];
        const packAlias = targetInput.dataset.alias || targetInput.dataset.set || `Input #${randomIndex + 1}`; // Get name for feedback

        // 4. Determine quantity for this single pack
        let quantity = 0;
        let calculationSource = "Main Thread";
        let metadata = {}; // To store metadata from worker

        const patternType = config.patternType;
        const workerStrategies = ['perlin', 'gradient']; // Strategies that can run in worker
        const useWorker = workerStrategies.includes(patternType) && typeof patternWorker !== 'undefined' && patternWorker !== null;


        if (useWorker) {
            // Attempt to use the Web Worker for calculation (for a single item)
            GM_log(`Pack Filler Pro: Calculating quantity for random pack via worker: ${patternType}`);
            try {
                 // Pass necessary config subset to the worker
                 const workerConfig = {
                      noiseSeed: config.noiseSeed,
                      patternScale: config.patternScale,
                      patternIntensity: config.patternIntensity,
                      lastMinQty: config.lastMinQty,
                      lastMaxQty: config.lastMaxQty,
                      // maxTotalAmount is not relevant for a single random fill's quantity calculation
                 };
                 // Request calculation for just one item (index 0 of 1)
                 const workerData = { strategy: patternType, count: 1, config: workerConfig };
                 const result = await callWorkerAsync(workerData); // Await the worker result

                 if (result.quantities && result.quantities.length > 0) {
                     quantity = result.quantities[0]; // Get the single quantity calculated
                     metadata = result.metadata || {};
                     calculationSource = "Web Worker";
                     if(metadata.seedUsed) calculationSource += ` (Seed: ${metadata.seedUsed})`;
                 } else {
                     // Worker returned no quantities, fall back
                     throw new Error("Worker returned no quantities.");
                 }

            } catch (workerError) {
                GM_log(`Pack Filler Pro: Worker failed for random pack: ${workerError.message}. Using main thread random fallback.`);
                calculationSource = "Main Thread (Fallback)";
                // Fallback to main thread random
                const fallbackStrategy = MainThreadFillStrategies.random;
                quantity = fallbackStrategy(config, 0, 1); // Calculate one random value
                // Clamp result according to main thread strategy rules (random already does this)
                quantity = clamp(quantity, 0, MAX_QTY); // Clamp against absolute MAX_QTY
            }
        } else {
            // Use Main Thread calculation
            const mainThreadStrategy = MainThreadFillStrategies[patternType] || MainThreadFillStrategies.random; // Use selected or default to random
            calculationSource = "Main Thread";
            GM_log(`Pack Filler Pro: Calculating quantity for random pack on main thread using strategy: ${patternType}.`);
            quantity = mainThreadStrategy(config, 0, 1); // Calculate for index 0 of total 1
            // Clamp result according to main thread strategy rules
            // (MainThreadFillStrategies already handle clamping to min/max and MAX_QTY)
             quantity = clamp(quantity, 0, MAX_QTY); // Final clamp against absolute MAX_QTY
        }

        // 5. Apply Quantity
        updateInput(targetInput, quantity); // Use utility function

        // 6. Feedback
        const feedbackText = `Set "${sanitize(packAlias)}" to ${quantity} (via ${calculationSource})`;
        SWAL_TOAST(feedbackText, 'success', config);
        GM_log(`Pack Filler Pro: Applied quantity ${quantity} to random pack: ${packAlias} (Source: ${calculationSource}).`);


    } catch (error) {
         GM_log(`Pack Filler Pro: Fill Random Pack Error: ${error.message}`, error);
         SWAL_ALERT('Fill Random Error', sanitize(error.message), 'error', config);
    }
    GM_log("Pack Filler Pro: fillRandomPackInput finished.");
}


/* --- Feedback Generation Helper --- */
/**
 * Generates and displays feedback using SweetAlert2.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isAutoFill - True if triggered by auto-fill.
 * @param {string} calculationSource - Describes where calculation happened (Main Thread, Worker).
 * @param {number} targetedCount - Number of packs targeted by mode/count.
 * @param {number} availableCount - Total number of visible packs.
 * @param {number} filledCount - Number of packs actually updated.
 * @param {object} metadata - Additional data from calculation (e.g., seed).
 * @param {number} totalCopiesAdded - The sum of quantities added in this operation.
 */
function generateFeedback(config, isAutoFill, calculationSource, targetedCount, availableCount, filledCount, metadata, totalCopiesAdded) {
    const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty, lastClear: clear, maxTotalAmount, fillEmptyOnly, patternType } = config;
    const useMaxTotal = maxTotalAmount > 0;
    const maxTotalHit = useMaxTotal && totalCopiesAdded >= maxTotalAmount; // Recalculate if hit

    let feedbackModeDesc = "";
    let feedbackQuantityDesc = "";

    if (patternType && MainThreadFillStrategies[patternType] && patternType !== 'random') {
        feedbackModeDesc = `Pattern Mode: ${patternType.charAt(0).toUpperCase() + patternType.slice(1)}`;
        feedbackQuantityDesc = `Pattern applied with scale ${config.patternScale} and intensity ${config.patternIntensity}.`;
        if (patternType === 'perlin') {
            feedbackQuantityDesc += ` Seed: ${metadata.seedUsed || config.noiseSeed || 'Random'}.`; // Use metadata seed if available
        } else if (patternType === 'gradient') {
             // Add specific gradient info if needed
        }
    } else {
        // Fallback or standard modes
        switch (mode) {
            case 'fixed':
                feedbackModeDesc = `Fixed Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                feedbackQuantityDesc = `${fixedQty} copies per pack.`;
                break;
            case 'max': // This is the random range mode
                 feedbackModeDesc = `Random Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                 feedbackQuantityDesc = `Random copies (${minQty}-${maxQty}) per pack.`;
                 break;
            case 'unlimited':
                feedbackModeDesc = `All Visible Packs Mode`;
                // In unlimited mode, quantity is usually fixed, but could potentially use patterns too
                // Let's base the description on the patternType if it's not random, otherwise fixed.
                 if (patternType && MainThreadFillStrategies[patternType] && patternType !== 'random') {
                     feedbackQuantityDesc = `Pattern applied with scale ${config.patternScale} and intensity ${config.patternIntensity}.`;
                     if (patternType === 'perlin') {
                         feedbackQuantityDesc += ` Seed: ${metadata.seedUsed || config.noiseSeed || 'Random'}.`;
                     }
                 } else {
                     feedbackQuantityDesc = `${fixedQty} copies per pack.`; // Fallback to fixed if pattern is random or unknown
                 }
                break;
            default:
                feedbackModeDesc = `Mode: ${mode}`;
                feedbackQuantityDesc = `Quantity chosen per pack.`;
        }
    }

    const clearStatus = clear && !isAutoFill ? "<br>- Inputs Cleared First" : "";
    const autoFillStatus = isAutoFill ? "<br>- Triggered by Auto-Fill" : "";
    const emptyOnlyStatus = fillEmptyOnly ? "<br>- Only Empty Inputs Filled" : "";
    const maxTotalStatus = useMaxTotal && maxTotalHit ? `<br>- Max Total Limit (${maxTotalAmount}) Reached` : '';


    const averagePerFilled = filledCount > 0 ? (totalCopiesAdded / filledCount).toFixed(2) : 'N/A';

    let summaryHtml = `
         <p><strong>Operation Details:</strong>${clearStatus}${autoFillStatus}${emptyOnlyStatus}${maxTotalStatus}</p>
         <p><strong>Fill Mode:</strong> ${feedbackModeDesc}</p>
         <p><strong>Calculation Source:</strong> ${calculationSource}</p>
         <p><strong>Targeted Packs:</strong> ${targetedCount} / ${availablePacks} visible</p>
         <p><strong>Packs Actually Filled:</strong> ${filledCount}</p>
         <p><strong>Quantity Rule:</strong> ${feedbackQuantityDesc}</p>
         <p><strong>Total Copies Added:</strong> ${totalCopiesAdded}</p>
         <p><strong>Average Copies per Filled Pack:</strong> ${averagePerFilled}</p>
     `;

     GM_log(`Pack Filler Pro: Fill complete. ${summaryHtml.replace(/<br>- /g, '; ').replace(/<.*?>/g, '').replace(/\n/g, ' ')}`);


     if (isAutoFill) {
         // Use a toast for auto-fill, less intrusive
         SWAL_TOAST(`Auto-filled ${filledCount} packs (Total: ${totalCopiesAdded})`, 'success', config); // Pass config to SWAL
     } else {
         // Use a modal for manual fills
         SWAL_ALERT('Fill Summary', summaryHtml, 'success', config); // Pass config to SWAL
     }
}


/* --- Performance Optimization: Virtual DOM Batch Update --- */
/**
 * Updates the value of multiple input elements in a batch to minimize DOM reflows.
 * NOTE: This is a simplified approach using direct value setting and event dispatch.
 * A true "virtual DOM" would involve rendering to a fragment/string and replacing.
 * Given the site's structure, direct updates with event dispatch are usually sufficient
 * and less complex than HTML string manipulation.
 * @param {Array<HTMLInputElement>} inputs - The array of input elements to update.
 * @param {Array<number>} quantities - The array of new quantities corresponding to the inputs.
 */
function virtualUpdate(inputs, quantities) {
    if (!inputs || inputs.length === 0 || !quantities || inputs.length !== quantities.length) {
        GM_log("Pack Filler Pro: virtualUpdate called with invalid inputs or quantities. Aborting.");
        return;
    }

    // Use a document fragment for potential future optimizations, but for now,
    // directly update input values and dispatch events. This is generally
    // the most reliable way to interact with framework-controlled inputs.
    // The 'virtual' aspect here is more about conceptually batching the updates
    // rather than a full virtual DOM implementation.

    inputs.forEach((input, i) => {
        updateInput(input, quantities[i]); // Use updateInput from domUtils
    });

    GM_log(`Pack Filler Pro: Applied updates to ${inputs.length} inputs.`);
}


// The functions sanitize, validateFillConfig, callWorkerAsync, chooseQuantity,
// MainThreadFillStrategies, calculateFillCount, fillPacks, fillRandomPackInput,
// generateFeedback, and virtualUpdate are made available to the main script's scope via @require.
