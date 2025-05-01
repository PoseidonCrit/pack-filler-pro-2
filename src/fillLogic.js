// This file contains the main logic for calculating and applying quantities to inputs.
// It orchestrates the fill process, including selecting packs, determining quantities
// using main thread strategies or a Web Worker, and applying updates to the DOM.

// It assumes the following are available in the main script's scope via @require:
// - constants from constants.js (MAX_QTY, SELECTOR, etc.)
// - functions from domUtils.js (getPackInputs, clamp, updateInput, clearAllInputs, sanitize)
// - functions from swalHelpers.js (SWAL_ALERT, SWAL_TOAST)
// - functions from configManager.js (validateFillConfig)
// - patternWorker instance (the Worker object)
// - GM_log function

/* --- Worker Interaction (Local to fillLogic.js) --- */
// Manages requests sent to the Web Worker and their responses using Promises.
// This logic is kept local to fillLogic.js because it manages the _pendingWorkerRequests map.

let _workerRequestId = 0;
const _pendingWorkerRequests = new Map(); // Map<requestId, { resolve, reject, timeoutId }>

/**
 * Sends a calculation request message to the Web Worker and returns a Promise.
 * Handles timeouts and processes results or errors received from the worker.
 * Assumes patternWorker instance is available and GM_log is available.
 * @param {object} data - The data to send to the worker (should include strategy, count, config).
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @returns {Promise<{quantities: number[], metadata: object}>} A promise that resolves with the worker's result data.
 */
async function callWorkerAsync(data, timeoutMs = 10000) {
     // Check if patternWorker instance exists and is not terminated
     if (typeof patternWorker === 'undefined' || patternWorker === null) {
          GM_log("Pack Filler Pro: callWorkerAsync called but worker instance is not available.");
          // Immediately reject if the worker instance is not ready
          throw new Error("Web Worker instance is not available.");
     }

     // Return a new Promise that will be resolved or rejected when the worker responds or times out
     return new Promise((resolve, reject) => {
          const requestId = _workerRequestId++; // Generate a unique request ID

          // Set up a timeout for the worker request
          const timeoutId = setTimeout(() => {
               GM_log(`Pack Filler Pro: Worker request ${requestId} timed out after ${timeoutMs}ms.`);
               // Clean up the pending request map entry
               _pendingWorkerRequests.delete(requestId);
               // Reject the promise on timeout
               reject(new Error(`Web Worker calculation timed out (Request ID: ${requestId}).`));
          }, timeoutMs);

          // Store the resolve/reject functions and timeout ID for this request
          _pendingWorkerRequests.set(requestId, { resolve, reject, timeoutId });

          // Send the message to the worker.
          // The worker expects data.type to be 'calculate' and includes the requestId.
          try {
              patternWorker.postMessage({ ...data, requestId: requestId, type: 'calculate' });
              // GM_log(`Pack Filler Pro: Sent message to worker (ID: ${requestId}):`, { ...data, requestId: requestId, type: 'calculate' }); // Too chatty
          } catch (e) {
              // Handle errors that occur when posting the message (e.g., worker is terminated)
              GM_log(`Pack Filler Pro: Error posting message to worker (ID: ${requestId}).`, e);
              clearTimeout(timeoutId); // Clear the timeout
              _pendingWorkerRequests.delete(requestId); // Clean up the pending request
              reject(new Error(`Failed to send message to Web Worker: ${e.message}`)); // Reject the promise
          }
     });
}

// Listener for messages coming back from the worker.
// This function processes the received messages and resolves/rejects the corresponding Promises
// stored in the _pendingWorkerRequests map.
// This function should be set as the onmessage handler for the worker instance in the main script.
/**
 * Processes messages received from the Web Worker.
 * Looks up the pending request by ID and resolves or rejects its promise.
 * @param {MessageEvent} e - The message event from the worker. Expected data includes type, requestId, and either quantities/metadata or error.
 */
function handleWorkerMessage(e) {
    // Destructure the data from the worker message
    const { type, data, requestId, quantities, metadata, error } = e.data;

    // Handle log messages from the worker separately
    if (type === 'log') {
        GM_log("Pack Filler Pro Worker Log:", ...data); // Log worker messages to the main console
        return; // Processed log message, exit handler
    }

    // For 'result' or 'error' messages, look up the pending request by ID
    if (_pendingWorkerRequests.has(requestId)) {
        const { resolve, reject, timeoutId } = _pendingWorkerRequests.get(requestId);

        // Clear the timeout since we received a response
        clearTimeout(timeoutId);
        // Remove the request from the pending map
        _pendingWorkerRequests.delete(requestId);

        if (type === 'result') {
            // If the message type is 'result', resolve the promise with the quantities and metadata
            resolve({ quantities: quantities || [], metadata: metadata || {} }); // Ensure quantities/metadata are not null/undefined
        } else if (type === 'error') {
            // If the message type is 'error', reject the promise with the error details
            reject(new Error(`Web Worker error (ID: ${requestId}): ${error && error.message ? error.message : 'Unknown error'}`));
        } else {
            // Handle unexpected message types for a known request ID
            GM_log(`Pack Filler Pro: Received unexpected message type from worker for request ID ${requestId}: ${type}`, e.data);
            reject(new Error(`Received unexpected message type from worker: ${type}`));
        }
    } else {
        // If the request ID is not found in the pending map, it might be a stale response
        GM_log(`Pack Filler Pro: Received worker message for unknown or stale request ID: ${requestId} (Type: ${type})`);
    }
}

// Note: The patternWorker.onmessage handler in the main script's init function
// should be set to call this handleWorkerMessage function.


/* --- Main Thread Fill Strategies & Helpers --- */
// Simple strategies that can run efficiently on the main thread.
// These are used for modes that don't require complex calculations (fixed, random, alternating)
// or as fallbacks if the Web Worker is unavailable or fails.

// Helper to clamp a value within min/max bounds (local to main thread logic)
// Assumes clamp from domUtils.js is available globally.
const clamp = typeof clamp === 'function' ? clamp : (val, min, max) => {
    const numVal = parseInt(val, 10);
    if (isNaN(numVal)) return 0;
    return Math.min(max, Math.max(min, numVal));
};


// Helper to choose a random quantity within the configured range
// Assumes MAX_QTY from constants.js and clamp are available.
function chooseQuantity(config) {
    // Uses MAX_QTY from src/constants.js
    const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
    const min = clamp(config.lastMinQty, 0, maxQty);
    const max = clamp(config.lastMaxQty, 0, maxQty);
    if (min > max) {
         GM_log("Pack Filler Pro: chooseQuantity called with min > max, returning 0.", {min: min, max: max});
         return 0; // Should be prevented by validation, but defensive
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simple linear interpolation helper (local to main thread logic)
const lerp = (a, b, t) => a + t * (b - a);

// Object containing different fill strategies that can run on the main thread.
// These functions take config, current index, and total count as arguments.
const MainThreadFillStrategies = {
    // Fixed quantity strategy: Always returns the configured fixed quantity.
    // Assumes MAX_QTY from constants.js and clamp are available.
    fixed: (config, index, total) => {
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
        return clamp(config.lastFixedQty, 0, maxQty);
    },

    // Random quantity strategy: Returns a random quantity within the configured range.
    // Uses chooseQuantity helper.
    random: (config, index, total) => chooseQuantity(config),

    // Gradient strategy: Calculates quantity based on position in the list (linear gradient).
    // Can also run in the worker for performance. This is the main thread fallback/implementation.
    // Assumes MAX_QTY from constants.js, clamp, and lerp are available.
    gradient: (config, index, total) => {
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
        const intensity = config.patternIntensity || 1.0; // Default intensity (0.0 to 1.0)
        const scale = config.patternScale || 100; // Default scale (affects gradient steepness over the count)
        const minQty = config.lastMinQty;
        const maxQty = config.lastMaxQty;
        const range = maxQty - minQty; // The range of possible quantities

        // Ensure total count is at least 1 to avoid division by zero in position mapping
        const safeCount = Math.max(1, total);
        // Ensure scale is at least 1 for mapping index to position factor
        const safeScale = Math.max(1, scale);


        // Calculate position factor (0 to 1) based on index and effective scale.
        // Dividing by (safeScale - 1) determines how quickly the gradient progresses over the list.
        // Clamp to 1 to ensure the factor doesn't exceed 1 even if index > scale.
        const positionFactor = clamp(i / (safeScale > 1 ? safeScale - 1 : 1), 0, 1); // Handle scale=1 case


        // Calculate a base quantity based on position in the list (linear gradient from minQty to maxQty)
        const baseQty = minQty + positionFactor * range;

        // Apply intensity to shift the quantity towards minQty or the linear gradient value.
        // If intensity is 1, quantity follows the linear gradient (min to max).
        // If intensity is 0, quantity is always minQty (the starting point).
        let finalQuantityFloat = lerp(minQty, baseQty, intensity);


        // Clamp the final quantity to the allowed range [0, MAX_QTY] and round to nearest integer.
        const finalQuantity = clamp(Math.round(finalQuantityFloat), 0, maxQty);

        return finalQuantity;
    },

    // Alternating strategy: Assigns minQty and maxQty alternately.
    // Assumes MAX_QTY from constants.js and clamp are available.
    alternating: (config, index, total) => {
         const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
         const minQty = clamp(config.lastMinQty, 0, maxQty);
         const maxQtyClamped = clamp(config.lastMaxQty, 0, maxQty);
         if (minQty > maxQtyClamped) {
             GM_log("Pack Filler Pro: alternating strategy called with min > max, using min for both.", {min: minQty, max: maxQtyClamped});
             return minQty; // Return min if range is invalid
         }
         return index % 2 === 0 ? minQty : maxQtyClamped;
    },

    // Perlin strategy fallback: If the worker fails for Perlin, fall back to random.
    // Assumes MainThreadFillStrategies.random is available.
    perlin: (config, index, total) => {
        // This function should ideally not be called if the worker is available for 'perlin'.
        // If it is called, it means the worker failed or wasn't available.
        // Fallback to random strategy.
         GM_log("Pack Filler Pro: Perlin strategy called on main thread. Falling back to random.");
         // Assumes MainThreadFillStrategies object and random strategy are available
         if (typeof MainThreadFillStrategies === 'object' && typeof MainThreadFillStrategies.random === 'function') {
             return MainThreadFillStrategies.random(config, index, total);
         } else {
             GM_log("Pack Filler Pro: MainThreadFillStrategies.random fallback not found.");
             return 0; // Ultimate fallback if random strategy is also missing
         }
    }
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
        GM_log("Pack Filler Pro: calculateFillCount called with invalid config or availableCount.", {config: config, availableCount: availableCount});
        return 0; // Return 0 for invalid input
    }

    // Use config object directly
    const { lastMode: mode, lastCount: count } = config;

    if (mode === 'unlimited') {
        return availableCount;
    } else {
        // Clamp count to available inputs, but not less than 0
        // Assumes clamp is available
        if (typeof clamp !== 'function') {
            GM_log("Pack Filler Pro: clamp function not found in calculateFillCount. Cannot clamp count.");
            // Fallback to basic Math.min/max if clamp is missing
            return Math.min(availableCount, Math.max(0, parseInt(count, 10) || 0));
        }
        return clamp(count, 0, availableCount);
    }
}


/* --- Main Fill Function --- */
/**
 * Fills pack inputs based on current settings.
 * Incorporates pattern strategies and batch DOM updates, using a Web Worker for heavy calculations.
 * Handles configuration validation, clearing inputs, filtering empty inputs,
 * calculating quantities (via worker or main thread), applying updates, and providing feedback.
 * Assumes the following are available in scope:
 * getPackInputs, validateFillConfig, clearAllInputs, virtualUpdate, generateFeedback,
 * SWAL_ALERT, SWAL_TOAST, patternWorker instance, callWorkerAsync, handleWorkerMessage,
 * MainThreadFillStrategies, clamp, sanitize, MAX_QTY, DEFAULT_CONFIG.
 * @param {object} config - The script's configuration object.
 * @param {boolean} [isAutoFill=false] - True if triggered by the auto-load process.
 */
async function fillPacks(config, isAutoFill = false) { // Accept config here and make async
    GM_log(`Pack Filler Pro: fillPacks started (Auto-fill: ${isAutoFill}).`);

    // Use config object directly
    const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty, lastClear: clear, maxTotalAmount, fillEmptyOnly, patternType } = config;

    try {
        // 1. Validate relevant parts of config (quantities and pattern params)
        GM_log("Pack Filler Pro: fillPacks Step 1: Validating config.");
        // Assumes validateFillConfig from configManager.js is accessible
        if (typeof validateFillConfig === 'function') {
            validateFillConfig(config); // Reuse existing validation
            GM_log("Pack Filler Pro: fillPacks Step 2: Config validated successfully.");
        } else {
            const errorMessage = "Configuration validation function (validateFillConfig) not found. Cannot proceed safely.";
            GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
             if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMessage, 'error', config);
            throw new Error(errorMessage); // Abort if validation function is missing
        }


        // 2. Get Inputs
        GM_log("Pack Filler Pro: fillPacks Step 3: Getting pack inputs.");
        // Assumes getPackInputs from domUtils.js is accessible
        if (typeof getPackInputs !== 'function') {
             const errorMessage = "getPackInputs function not found. Cannot retrieve pack inputs.";
             GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
              if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMessage, 'error', config);
             throw new Error(errorMessage); // Abort if input retrieval is impossible
        }
        const allInputs = getPackInputs();
        const availablePacks = allInputs.length;
        GM_log(`Pack Filler Pro: fillPacks Step 4: Found ${availablePacks} visible inputs.`);


        if (availablePacks === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 5: No visible pack inputs found.");
             // Pass config to SWAL_ALERT
             if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Packs', 'No visible pack inputs found on the page.', 'warning', config);
             GM_log("Fill operation aborted: No visible pack inputs found.");
             return; // Exit function if no inputs are found
        }

        // 3. Determine the set of inputs potentially targeted by mode/count
        GM_log("Pack Filler Pro: fillPacks Step 6: Determining targeted inputs.");
        let potentialInputsToFill;
         if (mode === 'unlimited') {
              potentialInputsToFill = allInputs; // All visible inputs are targeted
         } else {
               // Call calculateFillCount - now guaranteed to be defined in this file's scope
               // Assumes calculateFillCount is defined just above this function
               if (typeof calculateFillCount !== 'function') {
                   const errorMsg = "Pack Filler Pro Error: calculateFillCount function not found within fillLogic.js.";
                   GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                    if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMsg, 'error', config);
                   throw new ReferenceError(errorMsg); // Abort if calculation function is missing
               }
               const fillCount = calculateFillCount(config, availablePacks); // Pass config and available count
              potentialInputsToFill = allInputs.slice(0, fillCount); // Target the first 'fillCount' inputs
         }
        const targetedCount = potentialInputsToFill.length;
        GM_log(`Pack Filler Pro: fillPacks Step 7: Targeted ${targetedCount} inputs based on mode/count.`);


        if (targetedCount === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 8: No packs targeted.");
             // Pass config to SWAL_ALERT
             if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Packs', `No packs targeted based on current mode (${mode}) and count (${count}).`, 'info', config);
             GM_log(`Fill operation aborted: No packs targeted. Mode: ${mode}, Count: ${count}.`);
             return; // Exit function if no packs are targeted
        }

        // 4. Apply 'Clear Before Fill' option (only for manual trigger)
        GM_log("Pack Filler Pro: fillPacks Step 9: Checking 'Clear Before Fill' option.");
        if (clear && !isAutoFill) {
            GM_log("Pack Filler Pro: fillPacks Step 10: Clearing all inputs.");
             // Assumes clearAllInputs from domUtils.js is accessible and handles its own feedback/logging
             if (typeof clearAllInputs === 'function') {
                 clearAllInputs();
                 GM_log("Pack Filler Pro: fillPacks Step 11: Inputs cleared.");
             } else {
                 GM_log("Pack Filler Pro: clearAllInputs function not found. Skipping clear.");
                 // Script can continue, but inputs won't be cleared.
             }

        } else {
             GM_log("Pack Filler Pro: fillPacks Step 10: 'Clear Before Fill' not active or auto-fill.");
        }


        // 5. Apply the 'Fill Empty Only' filter
        GM_log("Pack Filler Pro: fillPacks Step 12: Applying 'Fill Empty Only' filter.");
        const inputsToActuallyFill = fillEmptyOnly
            ? potentialInputsToFill.filter(el => {
                 const value = parseInt(el.value, 10);
                 // Consider empty string or 0 as "empty"
                 return !el.value || isNaN(value) || value === 0;
              })
            : potentialInputsToFill;

        const filledCount = inputsToActuallyFill.length;
        GM_log(`Pack Filler Pro: fillPacks Step 13: After filtering, ${filledCount} inputs will be filled.`);


        if (filledCount === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 14: No packs needed filling after filter.");
             // If packs were targeted but none were empty (and Fill Empty Only is relevant)
             const finalMessage = (targetedCount > 0 && !fillEmptyOnly)
                ? `All ${targetedCount} targeted packs already have a quantity, and 'Fill empty inputs only' is disabled.`
                : (fillEmptyOnly && targetedCount > 0)
                    ? `No empty packs found among the ${targetedCount} targeted packs.`
                    : `No packs matched criteria to fill.`; // Should ideally be caught earlier if targetedCount is 0

             // Pass config to SWAL_ALERT
             if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Packs', finalMessage, 'info', config);
             GM_log(`Fill operation skipped: No packs needed filling. Targeted: ${targetedCount}, Filled: ${filledCount}`);
             return; // Exit function if no packs need filling
        }


        GM_log("Pack Filler Pro: fillPacks Step 15: Proceeding to quantity calculation.");

        let quantitiesToApply = [];
        let currentTotal = 0; // Track total added in this fill operation

        const totalPacksToFill = inputsToActuallyFill.length; // The actual number of inputs we will attempt to fill
        let calculationSource = "Main Thread";
        let metadata = {}; // To store metadata from worker like seed used

        // --- Core Filling Logic ---
        // Determine quantities based on pattern or mode
        const workerStrategies = ['perlin', 'gradient']; // Strategies that can run in worker
        // Check if worker instance is available AND the selected pattern type is one the worker handles AND callWorkerAsync is available
        const useWorker = workerStrategies.includes(patternType) && typeof patternWorker !== 'undefined' && patternWorker !== null && typeof callWorkerAsync === 'function';

        GM_log(`Pack Filler Pro: fillPacks Step 16: Checking worker availability for pattern type "${patternType}". useWorker: ${useWorker}`);

        if (useWorker) {
            // Attempt to use the Web Worker for calculation
            GM_log(`Pack Filler Pro: fillPacks Step 17: Attempting to use Web Worker for "${patternType}" calculation.`);
            try {
                 // Pass necessary config subset to the worker.
                 // The worker needs min/max/maxTotalAmount/pattern specific configs.
                 const workerConfig = {
                      noiseSeed: config.noiseSeed,
                      patternScale: config.patternScale,
                      patternIntensity: config.patternIntensity,
                      lastMinQty: config.lastMinQty,
                      lastMaxQty: config.lastMaxQty,
                      maxTotalAmount: config.maxTotalAmount, // Worker will apply maxTotalAmount constraint
                 };
                 const workerData = { strategy: patternType, count: totalPacksToFill, config: workerConfig };
                 GM_log(`Pack Filler Pro: fillPacks Step 18: Calling worker with data:`, workerData);

                 const result = await callWorkerAsync(workerData); // Await the worker result (Promise from callWorkerAsync)
                 GM_log(`Pack Filler Pro: fillPacks Step 19: Received result from worker:`, result);

                 quantitiesToApply = result.quantities || []; // Ensure it's an array, handle potential null/undefined
                 metadata = result.metadata || {}; // Get metadata if available

                 // Calculate total from worker results (worker should have applied maxTotalAmount)
                 currentTotal = quantitiesToApply.reduce((sum, qty) => sum + qty, 0);

                 calculationSource = "Web Worker";
                 if(metadata.seedUsed) calculationSource += ` (Seed: ${metadata.seedUsed})`;

                 GM_log(`Pack Filler Pro: fillPacks Step 20: Quantities received from worker (${quantitiesToApply.length}). Calculated total: ${currentTotal}`);

                 // Check if the number of quantities returned matches the number of inputs we intended to fill
                 if (quantitiesToApply.length !== totalPacksToFill) {
                      const errorMsg = `Worker returned unexpected number of quantities (${quantitiesToApply.length}) vs inputs to fill (${totalPacksToFill}).`;
                      GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`);
                      // Decide whether to throw, warn, or use partial results. Throwing is safer to indicate a calculation issue.
                      throw new Error(errorMsg);
                 }


            } catch (error) {
                // Catch errors from callWorkerAsync (timeout, postMessage error, worker internal error)
                GM_log(`Pack Filler Pro: fillPacks Step 17a: Worker calculation failed for "${patternType}": ${error.message}. Falling back to main thread random strategy.`, error);
                // Worker failed, fall back to main thread random strategy
                calculationSource = "Main Thread (Fallback)";
                quantitiesToApply = []; // Clear any partial results from the failed worker attempt
                currentTotal = 0; // Reset total for main thread calculation
                metadata = {}; // Clear metadata

                // Proceed with main thread calculation using the fallback strategy
                const fallbackStrategy = MainThreadFillStrategies.random; // Fallback to random
                 // Assumes MainThreadFillStrategies object and random strategy are available
                 if (typeof MainThreadFillStrategies !== 'object' || typeof fallbackStrategy !== 'function') {
                     const errorMsg = "Main thread fallback strategy (random) function not found.";
                     GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                     if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMsg, 'error', config);
                     throw new Error(errorMsg); // Abort if fallback is also missing
                 }
                 GM_log(`Pack Filler Pro: fillPacks Step 17b: Using main thread fallback strategy "random".`);

                 // Calculate quantities on the main thread, applying max total constraint manually
                 inputsToActuallyFill.forEach((input, index) => {
                      let qty = fallbackStrategy(config, index, totalPacksToFill);
                      // Apply max total limit on main thread
                      if (maxTotalAmount > 0) {
                           const remaining = maxTotalAmount - currentTotal;
                           qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity and cap
                      }
                      quantitiesToApply.push(qty);
                      currentTotal += qty; // Add the quantity actually set to the total
                 });
                 GM_log(`Pack Filler Pro: fillPacks Step 17c: Main thread fallback calculation complete. Generated ${quantitiesToApply.length} quantities. Final total: ${currentTotal}`);
            }
        } else {
            // Not using a worker strategy or worker/callWorkerAsync is unavailable, use main thread calculation
             // Assumes MainThreadFillStrategies object is available
             if (typeof MainThreadFillStrategies !== 'object') {
                  const errorMsg = "MainThreadFillStrategies object not found. Cannot calculate quantities.";
                  GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                   if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMsg, 'error', config);
                  throw new Error(errorMsg); // Abort if strategies object is missing
             }
            const mainThreadStrategy = MainThreadFillStrategies[patternType];
             if (typeof mainThreadStrategy !== 'function') {
                  // Fallback to random if the selected pattern strategy function is missing
                  GM_log(`Pack Filler Pro: Main thread strategy "${patternType}" function not found. Falling back to random.`, {patternType: patternType});
                  const fallbackStrategy = MainThreadFillStrategies.random;
                  if (typeof fallbackStrategy !== 'function') {
                      const errorMsg = "Main thread fallback strategy (random) function not found.";
                      GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                       if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMsg, 'error', config);
                      throw new Error(errorMsg); // Abort if random strategy is also missing
                  }
                  mainThreadStrategy = fallbackStrategy;
             }

            calculationSource = "Main Thread";
            GM_log(`Pack Filler Pro: fillPacks Step 16a: Calculating quantities on main thread using strategy: "${mainThreadStrategy === MainThreadFillStrategies.random ? 'random (fallback)' : patternType}".`);

             // Calculate quantities on the main thread, applying max total constraint manually
             inputsToActuallyFill.forEach((input, index) => {
                  let qty = mainThreadStrategy(config, index, totalPacksToFill);
                  // Apply max total limit on main thread
                  if (maxTotalAmount > 0) {
                       const remaining = maxTotalAmount - currentTotal;
                       qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity and cap
                  }
                  quantitiesToApply.push(qty);
                  currentTotal += qty; // Add the quantity actually set to the total
             });
             GM_log(`Pack Filler Pro: fillPacks Step 16b: Main thread calculation complete. Generated ${quantitiesToApply.length} quantities. Final total: ${currentTotal}`);
        }


        // --- Apply Quantities to DOM ---
        GM_log(`Pack Filler Pro: fillPacks Step 21: Applying quantities to DOM. Count: ${quantitiesToApply.length}`);
         // Assumes virtualUpdate function is available in scope
        if (quantitiesToApply.length > 0 && typeof virtualUpdate === 'function') {
            // Use the batch update function
            // Pass the original inputsToActuallyFill and the calculated quantities
            virtualUpdate(inputsToActuallyFill, quantitiesToApply);
            GM_log("Pack Filler Pro: fillPacks Step 22: Quantities applied via virtualUpdate.");
        } else if (quantitiesToApply.length === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 21a: No quantities generated to apply.");
             // Pass config to SWAL_ALERT
             if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Packs', 'Calculation failed. No quantities generated.', 'error', config);
             return; // Abort if no quantities were generated
        } else { // quantitiesToApply.length > 0 but virtualUpdate not found
             const errorMessage = "virtualUpdate function not found. Cannot apply quantities to DOM.";
             GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
             // Pass config to SWAL_ALERT
             if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMessage, 'error', config);
             throw new Error(errorMessage); // Abort
        }


         // --- DETAILED FEEDBACK GENERATION (SweetAlert2 Modal/Toast) ---
         // Only show modal/toast for manual fills or if autofill resulted in actual fills
         GM_log("Pack Filler Pro: fillPacks Step 23: Generating feedback.");
         // Assumes generateFeedback and SWAL_TOAST, SWAL_ALERT are available
         if (!isAutoFill || (isAutoFill && filledCount > 0)) {
            if (typeof generateFeedback === 'function') {
                 // Pass all relevant info including the final calculated total
                 generateFeedback(config, isAutoFill, calculationSource, targetedCount, availablePacks, filledCount, metadata, currentTotal);
            } else {
                 GM_log("Pack Filler Pro: generateFeedback function not found. Skipping feedback.");
                 // Fallback logging if feedback function is missing
                 const feedbackSummary = `Fill complete. Auto-fill: ${isAutoFill}, Source: ${calculationSource}, Targeted: ${targetedCount}/${availablePacks}, Filled: ${filledCount}, Total Added: ${currentTotal}.`;
                 GM_log(feedbackSummary);
                 if (!isAutoFill && typeof SWAL_TOAST === 'function') SWAL_TOAST(`Fill Complete: ${filledCount} packs filled.`, 'success', config);

            }
         }
         GM_log("Pack Filler Pro: fillPacks finished.");


     } catch (error) {
         GM_log(`Pack Filler Pro: fillPacks Caught Error: ${error.message}`, error);
         // Pass config to SWAL_ALERT for user feedback
         if (!isAutoFill && typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
             SWAL_ALERT('Fill Error', sanitize(error.message), 'error', config);
         } else {
             // Fallback alert if SWAL or sanitize is missing
             alert(`Pack Filler Pro Error: ${error.message}`);
         }
    }
 }

// --- Function: Fill Single Random Pack ---

/**
 * Selects one random visible pack input and fills it based on current settings.
 * Uses current config for quantity calculation (via worker or main thread).
 * Provides user feedback via SweetAlert2 toast.
 * Assumes the following are available in scope:
 * getPackInputs, validateFillConfig, updateInput, SWAL_ALERT, SWAL_TOAST,
 * patternWorker instance, callWorkerAsync, MainThreadFillStrategies, clamp, sanitize, MAX_QTY.
 * @param {object} config - The script's configuration object.
 */
async function fillRandomPackInput(config) {
    GM_log("Pack Filler Pro: Attempting to fill 1 random pack.");
    try {
        // 1. Validate relevant parts of config (quantities)
        if (typeof validateFillConfig !== 'function') {
            const errorMessage = "Configuration validation function not found. Cannot fill random pack.";
            GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', errorMessage, 'error', config);
            throw new Error(errorMessage); // Abort
        }
        validateFillConfig(config); // Reuse existing validation


        // 2. Get Inputs
        if (typeof getPackInputs !== 'function') {
            const errorMessage = "getPackInputs function not found. Cannot retrieve pack inputs.";
            GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', errorMessage, 'error', config);
            throw new Error(errorMessage); // Abort
        }
        const allInputs = getPackInputs();
        if (allInputs.length === 0) {
            if (typeof SWAL_ALERT === 'function') SWAL_ALERT('No Inputs', 'No visible pack inputs found to select from.', 'warning', config);
            GM_log("Fill random aborted: No visible pack inputs found.");
            return; // Exit if no inputs
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
        // Check if worker instance is available AND the strategy is one the worker handles AND callWorkerAsync is available
        const useWorker = workerStrategies.includes(patternType) && typeof patternWorker !== 'undefined' && patternWorker !== null && typeof callWorkerAsync === 'function';


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
                      // maxTotalAmount is not relevant for a single random fill's quantity calculation in the worker
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
                     // Worker returned no quantities, treat as a worker error
                     throw new Error("Worker returned no quantities.");
                 }

            } catch (workerError) {
                // Catch errors from callWorkerAsync (timeout, postMessage error, worker internal error)
                GM_log(`Pack Filler Pro: Worker failed for random pack: ${workerError.message}. Using main thread random fallback.`, workerError);
                calculationSource = "Main Thread (Fallback)";
                // Fallback to main thread random
                const fallbackStrategy = MainThreadFillStrategies.random;
                 // Assumes MainThreadFillStrategies object and random strategy are available
                 if (typeof MainThreadFillStrategies !== 'object' || typeof fallbackStrategy !== 'function') {
                      const errorMsg = "Main thread fallback strategy (random) function not found.";
                      GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                       if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', errorMsg, 'error', config);
                      throw new Error(errorMsg); // Abort if fallback is also missing
                 }
                quantity = fallbackStrategy(config, 0, 1); // Calculate one random value
                // Clamp result according to main thread strategy rules (random already does this)
                // Use clamp from domUtils or local clamp
                 const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
                 if (typeof clamp === 'function') {
                      quantity = clamp(quantity, 0, maxQty); // Clamp against absolute MAX_QTY
                 } else {
                      GM_log("Pack Filler Pro: clamp function not found for final clamp in fallback.");
                 }
            }
        } else {
            // Use Main Thread calculation
             // Assumes MainThreadFillStrategies object is available
             if (typeof MainThreadFillStrategies !== 'object') {
                  const errorMsg = "MainThreadFillStrategies object not found. Cannot calculate quantity.";
                  GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                   if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', errorMsg, 'error', config);
                  throw new Error(errorMsg); // Abort if strategies object is missing
             }
            const mainThreadStrategy = MainThreadFillStrategies[patternType];
             if (typeof mainThreadStrategy !== 'function') {
                  // Fallback to random if the selected pattern strategy function is missing
                  GM_log(`Pack Filler Pro: Main thread strategy "${patternType}" function not found. Falling back to random.`, {patternType: patternType});
                  const fallbackStrategy = MainThreadFillStrategies.random;
                  if (typeof fallbackStrategy !== 'function') {
                      const errorMsg = "Main thread fallback strategy (random) function not found.";
                      GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                       if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', errorMsg, 'error', config);
                      throw new Error(errorMsg); // Abort if random strategy is also missing
                  }
                  mainThreadStrategy = fallbackStrategy;
             }


            calculationSource = "Main Thread";
            GM_log(`Pack Filler Pro: Calculating quantity for random pack on main thread using strategy: "${mainThreadStrategy === MainThreadFillStrategies.random ? 'random (fallback)' : patternType}".`);
            quantity = mainThreadStrategy(config, 0, 1); // Calculate for index 0 of total 1
            // Clamp result according to main thread strategy rules
            // (MainThreadFillStrategies already handle clamping to min/max and MAX_QTY)
             // Use clamp from domUtils or local clamp
             const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
             if (typeof clamp === 'function') {
                  quantity = clamp(quantity, 0, maxQty); // Final clamp against absolute MAX_QTY
             } else {
                  GM_log("Pack Filler Pro: clamp function not found for final clamp on main thread.");
             }
        }

        // 5. Apply Quantity
         if (typeof updateInput !== 'function') {
              const errorMessage = "updateInput function not found. Cannot apply quantity to input.";
              GM_log(`Pack Filler Pro: ERROR - ${errorMessage}`);
               if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', errorMessage, 'error', config);
              throw new Error(errorMessage); // Abort
         }
        updateInput(targetInput, quantity); // Use utility function

        // 6. Feedback
         // Assumes SWAL_TOAST and sanitize are available
         if (typeof SWAL_TOAST === 'function' && typeof sanitize === 'function') {
             const feedbackText = `Set "${sanitize(packAlias)}" to ${quantity} (via ${calculationSource})`;
             SWAL_TOAST(feedbackText, 'success', config);
             GM_log(`Pack Filler Pro: Applied quantity ${quantity} to random pack: ${packAlias} (Source: ${calculationSource}).`);
         } else {
             GM_log(`Pack Filler Pro: Applied quantity ${quantity} to random pack: ${packAlias} (Source: ${calculationSource}). Feedback skipped (SWAL_TOAST or sanitize not found).`);
         }


    } catch (error) {
         GM_log(`Pack Filler Pro: fillRandomPackInput Caught Error: ${error.message}`, error);
         // Pass config to SWAL_ALERT for user feedback
         if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
             SWAL_ALERT('Fill Random Error', sanitize(error.message), 'error', config);
         } else {
             // Fallback alert if SWAL or sanitize is missing
             alert(`Pack Filler Pro Error: ${error.message}`);
         }
    }
    GM_log("Pack Filler Pro: fillRandomPackInput finished.");
}


/* --- Feedback Generation Helper --- */
/**
 * Generates and displays feedback using SweetAlert2.
 * Assumes SWAL_ALERT, SWAL_TOAST, sanitize, MainThreadFillStrategies are available.
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
    // Use config object directly
    const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty, lastClear: clear, maxTotalAmount, fillEmptyOnly, patternType } = config;
    const useMaxTotal = maxTotalAmount > 0;
    // Check if max total was hit. It's hit if useMaxTotal is true AND the total added is >= the max total AND the total added is > 0.
    const maxTotalHit = useMaxTotal && totalCopiesAdded >= maxTotalAmount && totalCopiesAdded > 0;

    let feedbackModeDesc = "";
    let feedbackQuantityDesc = "";

     // Check if MainThreadFillStrategies object is available before accessing properties
     const isPatternStrategy = typeof MainThreadFillStrategies === 'object' && MainThreadFillStrategies[patternType] && patternType !== 'random';

    if (isPatternStrategy) {
        feedbackModeDesc = `Pattern Mode: ${patternType.charAt(0).toUpperCase() + patternType.slice(1)}`;
        // Ensure patternIntensity is a number before calling toFixed
        const intensityDisplay = typeof config.patternIntensity === 'number' ? config.patternIntensity.toFixed(2) : 'N/A';
        feedbackQuantityDesc = `Pattern applied with scale ${config.patternScale}, intensity ${intensityDisplay}.`;
        if (patternType === 'perlin') {
            feedbackQuantityDesc += ` Seed: ${metadata.seedUsed || config.noiseSeed || 'Random'}.`; // Use metadata seed if available
        }
    } else {
        // Fallback or standard modes
        switch (mode) {
            case 'fixed':
                feedbackModeDesc = `Fixed Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                feedbackQuantityDesc = `${fixedQty} copie${fixedQty === 1 ? '' : 's'} per pack.`;
                break;
            case 'max': // This is the random range mode
                 feedbackModeDesc = `Random Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                 feedbackQuantityDesc = `Random copies (${minQty}-${maxQty}) per pack.`;
                 break;
            case 'unlimited':
                feedbackModeDesc = `All Visible Packs Mode`;
                // In unlimited mode, quantity is usually fixed, but could potentially use patterns too
                // Let's base the description on the patternType if it's not random, otherwise fixed.
                 const isUnlimitedPatternStrategy = typeof MainThreadFillStrategies === 'object' && MainThreadFillStrategies[patternType] && patternType !== 'random';
                 if (isUnlimitedPatternStrategy) {
                      const intensityDisplay = typeof config.patternIntensity === 'number' ? config.patternIntensity.toFixed(2) : 'N/A';
                     feedbackQuantityDesc = `Pattern applied with scale ${config.patternScale}, intensity ${intensityDisplay}.`;
                     if (patternType === 'perlin') {
                         feedbackQuantityDesc += ` Seed: ${metadata.seedUsed || config.noiseSeed || 'Random'}.`;
                     }
                 } else {
                     // Fallback to fixed quantity description if pattern is random or unavailable
                     feedbackQuantityDesc = `${fixedQty} copie${fixedQty === 1 ? '' : 's'} per pack.`;
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
         <p><strong>Targeted Packs:</strong> ${targetedCount} / ${availableCount} visible</p>
         <p><strong>Packs Actually Filled:</strong> ${filledCount}</p>
         <p><strong>Quantity Rule:</strong> ${feedbackQuantityDesc}</p>
         <p><strong>Total Copies Added:</strong> ${totalCopiesAdded}</p>
         <p><strong>Average Copies per Filled Pack:</strong> ${averagePerFilled}</p>
     `;

     // Use sanitize for feedback HTML to prevent XSS if any part came from user input (like seed?)
     // Assumes sanitize function is available
     const sanitizedSummaryHtml = typeof sanitize === 'function' ? sanitize(summaryHtml) : summaryHtml;


     GM_log(`Pack Filler Pro: Fill complete. ${summaryHtml.replace(/<br>- /g, '; ').replace(/<.*?>/g, '').replace(/\n/g, ' ')}`);


     if (isAutoFill) {
         // Use a toast for auto-fill, less intrusive
         // Assumes SWAL_TOAST is available
         if (typeof SWAL_TOAST === 'function') SWAL_TOAST(`Auto-filled ${filledCount} packs (Total: ${totalCopiesAdded})`, 'success', config);
         else GM_log("Pack Filler Pro: SWAL_TOAST function not found for auto-fill feedback.");
     } else {
         // Use a modal for manual fills
         // Assumes SWAL_ALERT is available
         if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Summary', sanitizedSummaryHtml, 'success', config); // Use sanitized HTML
         else GM_log("Pack Filler Pro: SWAL_ALERT function not found for manual fill feedback.");
     }
}


/* --- Performance Optimization: Virtual DOM Batch Update --- */
/**
 * Updates the value of multiple input elements in a batch to minimize DOM reflows.
 * Iterates through the provided inputs and quantities, calling updateInput for each.
 * Assumes updateInput from domUtils.js and GM_log are available.
 * @param {Array<HTMLInputElement>} inputs - The array of input elements to update.
 * @param {Array<number>} quantities - The array of new quantities corresponding to the inputs.
 */
function virtualUpdate(inputs, quantities) {
    // Assumes updateInput function is available
    if (typeof updateInput !== 'function') {
         GM_log("Pack Filler Pro: virtualUpdate called but updateInput function not found. Aborting.");
         // Decide if this should throw or just log and return. Logging and returning might be safer.
         return;
    }

    // Basic validation of inputs and quantities arrays
    if (!Array.isArray(inputs) || inputs.length === 0 || !Array.isArray(quantities) || inputs.length !== quantities.length) {
        GM_log("Pack Filler Pro: virtualUpdate called with invalid inputs or quantities. Aborting.", {inputs: inputs, quantities: quantities});
        return;
    }

    // Directly update input values and dispatch events using the updateInput helper.
    // This is generally the most reliable way to interact with framework-controlled inputs
    // in a userscript context without a full virtual DOM implementation.

    inputs.forEach((input, i) => {
        updateInput(input, quantities[i]); // Use updateInput from domUtils
    });

    GM_log(`Pack Filler Pro: Applied updates to ${inputs.length} inputs via virtualUpdate.`);
}


// The following functions are made available to the main script's scope via @require.
// - calculateFillCount
// - fillPacks
// - fillRandomPackInput
// - generateFeedback
// - virtualUpdate
// - handleWorkerMessage (set as the worker's onmessage handler in the main script)

// Note: chooseQuantity, lerp, MainThreadFillStrategies, callWorkerAsync,
// _workerRequestId, _pendingWorkerRequests are internal helpers/variables
// and are not explicitly exported, but are accessible within this file's scope.
