// This file contains the main logic for calculating and applying quantities to inputs.
// It uses constants and DOM helper functions.

// Assumes constants (MAX_QTY, etc.), utils (getPackInputs, clamp, updateInput, clearAllInputs),
// helpers (SWAL_ALERT, SWAL_TOAST), config manager (updateConfigFromUI),
// and the persistent worker instance (patternWorker) are accessible.

// --- Sanitization & Validation ---

/**
 * Sanitizes a string by setting it as textContent and retrieving innerHTML.
 * Basic protection against XSS in feedback messages.
 * @param {string} str - The input string.
 * @returns {string} Sanitized string.
 */
const sanitize = (str) => {
    if (typeof str !== 'string') str = String(str); // Ensure input is a string
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Validates the configuration relevant to the fill operation.
 * @param {object} config - The configuration object.
 * @throws {Error} If validation fails.
 */
const validateFillConfig = (config) => {
    const errors = [];
    // Check modes (add pattern types if needed)
    if (!['fixed', 'max', 'unlimited', 'random', 'simplex', 'gradient', 'alternating'].includes(config.patternType)) {
         // Note: 'lastMode' is less relevant now as patternType controls the logic primarily
         // Consider removing lastMode or making patternType the single source of truth for fill style
        errors.push(`Invalid pattern type selected: ${config.patternType}`);
    }
    // Validate quantities based on the effective mode/pattern
    switch(config.patternType) {
        case 'fixed':
        case 'unlimited': // uses fixedQty
            if (typeof config.lastFixedQty !== 'number' || config.lastFixedQty < 0 || config.lastFixedQty > MAX_QTY) {
                errors.push(`Invalid Fixed Quantity: ${config.lastFixedQty}`);
            }
            break;
        case 'max':
        case 'random': // uses min/max
        case 'simplex':
        case 'gradient':
        case 'alternating':
            if (typeof config.lastMinQty !== 'number' || config.lastMinQty < 0 || config.lastMinQty > MAX_QTY) {
                errors.push(`Invalid Min Quantity: ${config.lastMinQty}`);
            }
            if (typeof config.lastMaxQty !== 'number' || config.lastMaxQty < config.lastMinQty || config.lastMaxQty > MAX_QTY) {
                errors.push(`Invalid Max Quantity: ${config.lastMaxQty}`);
            }
            break;
    }
    // Validate pattern params if applicable
    if (config.patternType === 'simplex' || config.patternType === 'gradient') {
         if (typeof config.patternScale !== 'number' || config.patternScale < 10 || config.patternScale > 1000) {
            errors.push(`Invalid Pattern Scale: ${config.patternScale}`);
        }
        if (typeof config.patternIntensity !== 'number' || config.patternIntensity < 0 || config.patternIntensity > 1) {
            errors.push(`Invalid Pattern Intensity: ${config.patternIntensity}`);
        }
    }
    if (config.patternType === 'simplex' && config.noiseSeed && typeof config.noiseSeed !== 'string' && typeof config.noiseSeed !== 'number') {
         errors.push(`Invalid Noise Seed type: ${typeof config.noiseSeed}`);
    }

    // Validate count if mode requires it (though count is less used now)
    if (config.lastMode === 'fixed' || config.lastMode === 'max') { // Keep this check based on old 'lastMode' for now
         if (typeof config.lastCount !== 'number' || config.lastCount < 0) {
              errors.push(`Invalid Pack Count: ${config.lastCount}`);
         }
    }
    // Validate max total
    if (typeof config.maxTotalAmount !== 'number' || config.maxTotalAmount < 0) {
         errors.push(`Invalid Max Total Amount: ${config.maxTotalAmount}`);
    }


    if (errors.length) {
        throw new Error(`Configuration Error(s): ${errors.join(', ')}`);
    }
};


// --- Worker Interaction ---

let _workerRequestId = 0;
const _pendingWorkerRequests = {};

/**
 * Sends a message to the persistent worker and returns a Promise for the result.
 * Handles message routing using request IDs.
 * @param {object} data - Data to post to the worker (strategy, count, config).
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @returns {Promise<object>} Promise resolving with { quantities, metadata } or rejecting with an error.
 */
function callWorker(data, timeoutMs = 10000) { // Increased default timeout
    // Ensure worker is available (should be initialized in main script)
    if (!patternWorker) {
        return Promise.reject(new Error("Pattern worker is not available."));
    }

    const requestId = ++_workerRequestId;
    const messageData = { ...data, requestId }; // Add requestId to the data sent

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            // Clean up the pending request and reject if timeout occurs
            delete _pendingWorkerRequests[requestId];
            GM_log(`Pack Filler Pro: Worker request ${requestId} timed out after ${timeoutMs}ms.`);
            reject(new Error(`Worker request timed out after ${timeoutMs / 1000} seconds.`));
        }, timeoutMs);

        // Store the resolve/reject functions for this request
        _pendingWorkerRequests[requestId] = { resolve, reject, timeoutId };

        // Post the message to the persistent worker
        try {
             patternWorker.postMessage(messageData);
             GM_log(`Pack Filler Pro: Posted message to worker with requestId: ${requestId}`);
        } catch (postError) {
             GM_log("Pack Filler Pro: Error posting message to worker:", postError);
             // Clean up and reject if posting fails
             clearTimeout(timeoutId);
             delete _pendingWorkerRequests[requestId];
             reject(new Error(`Failed to send message to worker: ${postError.message}`));
        }
    });
}

/**
 * Initialize the message handler for the persistent worker.
 * This should be called once during script initialization.
 */
function setupWorkerMessageHandler() {
    if (!patternWorker) return;

    patternWorker.onmessage = (e) => {
        const { type, requestId, ...data } = e.data;
        GM_log(`Pack Filler Pro: Received message from worker (Type: ${type}, RequestId: ${requestId})`);

        if (type === 'log') {
            GM_log("Pack Filler Pro Worker Log:", ...data.data);
            return; // Don't try to resolve/reject for log messages
        }

        const request = _pendingWorkerRequests[requestId];
        if (!request) {
            GM_log(`Pack Filler Pro: Received worker response for unknown or timed out requestId: ${requestId}`);
            return; // Ignore if request ID is not pending
        }

        // Clear the timeout associated with this request
        clearTimeout(request.timeoutId);
        // Remove the request from the pending map
        delete _pendingWorkerRequests[requestId];

        // Handle the response based on type
        if (type === 'result') {
            request.resolve(data); // Resolve the promise with { quantities, metadata }
        } else if (type === 'error') {
            GM_log("Pack Filler Pro: Worker reported an error:", data.message);
            request.reject(new Error(`Worker Error: ${data.message}`)); // Reject the promise
        } else {
             GM_log(`Pack Filler Pro: Received unknown message type from worker: ${type}`);
             request.reject(new Error(`Received unknown message type from worker: ${type}`));
        }
    };

    // Basic error handler for the worker itself (e.g., script loading issues)
    patternWorker.onerror = (error) => {
        GM_log("Pack Filler Pro: Persistent worker encountered an error:", error);
        // Optionally, reject all pending requests if a fundamental worker error occurs
        Object.keys(_pendingWorkerRequests).forEach(id => {
             const request = _pendingWorkerRequests[id];
             clearTimeout(request.timeoutId);
             request.reject(new Error(`Worker encountered an unrecoverable error: ${error.message}`));
             delete _pendingWorkerRequests[id];
        });
        // Potentially try to re-initialize the worker or disable pattern features
        // For now, just log it. Subsequent calls to callWorker will fail.
        patternWorker = null; // Mark worker as unusable
        SWAL_ALERT("Worker Error", "The pattern worker failed. Pattern features disabled.", "error");

    };

     GM_log("Pack Filler Pro: Persistent worker message handlers set up.");
}


// --- Main Thread Fill Strategies & Helpers ---

/**
 * Calculates quantity for 'fixed' mode.
 */
const fixedStrategy = (config, index, total) => {
    return config.lastFixedQty; // Already clamped during config update
};

/**
 * Calculates quantity for 'random' or 'max' modes.
 */
const randomStrategy = (config, index, total) => {
    const min = config.lastMinQty;
    const max = config.lastMaxQty;
    // Ensure min <= max (should be handled by config update, but double check)
    if (min > max) return 0;
    // Calculate random integer between min and max (inclusive)
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Calculates quantity for 'alternating' mode.
 */
const alternatingStrategy = (config, index, total) => {
    return index % 2 === 0 ? config.lastMinQty : config.lastMaxQty;
};

/**
 * Calculates quantity for 'gradient' mode (main thread fallback/version).
 */
const gradientStrategyMain = (config, index, total) => {
    const intensity = config.patternIntensity || 1.0;
    const minQty = config.lastMinQty;
    const maxQty = config.lastMaxQty;
    const range = maxQty - minQty;
    const progress = total <= 1 ? 0.5 : index / (total - 1);
    const baseValue = minQty + progress * range;
    const midPoint = minQty + range / 2;
    const finalValue = midPoint + (baseValue - midPoint) * intensity;
    // Clamp here as this runs on main thread
    return clamp(Math.round(finalValue), minQty, maxQty);
};


/**
 * Selects the appropriate quantity calculation function for the main thread.
 * @param {string} type - The patternType or mode.
 * @returns {Function} The calculation function.
 */
function getMainThreadStrategy(type) {
    switch (type) {
        case 'fixed':
        case 'unlimited': // uses fixedQty
            return fixedStrategy;
        case 'max': // 'max' mode uses random strategy
        case 'random':
            return randomStrategy;
        case 'alternating':
            return alternatingStrategy;
        case 'gradient': // Main thread version/fallback
            return gradientStrategyMain;
        default:
            GM_log(`getMainThreadStrategy: Unknown type "${type}", falling back to random.`);
            return randomStrategy; // Fallback
    }
}

/**
 * Determines the target inputs based on mode and count settings.
 * @param {Array<HTMLInputElement>} allInputs - All visible input elements.
 * @param {object} config - The configuration object.
 * @returns {Array<HTMLInputElement>} The array of inputs to potentially fill.
 */
function determineTargetInputs(allInputs, config) {
     // Use patternType as the primary mode indicator now
    const type = config.patternType;
    const count = config.lastCount; // Still potentially used by legacy modes?
    const availablePacks = allInputs.length;

    // If mode is 'unlimited' or a pattern type that applies to all...
    if (type === 'unlimited' || type === 'simplex' || type === 'gradient' || type === 'alternating' || type === 'random') {
         // These modes/patterns typically apply to all available inputs unless count is restricted
         // Let's check the old 'lastMode' for count restriction for backward compatibility/clarity
         if (config.lastMode === 'fixed' || config.lastMode === 'max') {
              // If the *old* mode was count-limited, respect that count
               const fillCount = Math.max(0, Math.min(count, availablePacks));
              return allInputs.slice(0, fillCount);
         } else {
              // Otherwise, apply to all visible inputs
              return allInputs;
         }
    } else if (type === 'fixed' || type === 'max') {
         // These modes inherently use the 'lastCount'
          const fillCount = Math.max(0, Math.min(count, availablePacks));
         return allInputs.slice(0, fillCount);
    } else {
         // Fallback: If patternType is somehow invalid, target none
         GM_log(`determineTargetInputs: Unknown patternType "${type}", targeting no inputs.`);
         return [];
    }
}


// --- Main Fill Function ---

/**
 * Fills pack inputs based on current settings.
 * Handles different modes, patterns, uses worker for complex patterns,
 * provides fallback, and shows feedback.
 * @param {object} config - The script's configuration object.
 * @param {boolean} [isAutoFill=false] - True if triggered by the auto-load process.
 */
async function fillPacks(config, isAutoFill = false) {
    GM_log(`Fill process started. Mode/Pattern: ${config.patternType}, AutoFill: ${isAutoFill}`);
    let quantitiesToApply = [];
    let workerMetadata = null; // To store seed, actualTotal from worker
    let calculationSource = "Main Thread"; // Track where calculation happened

    try {
        // 1. Validate Config
        validateFillConfig(config);

        // 2. Get Inputs & Determine Targets
        const allInputs = getPackInputs();
        if (allInputs.length === 0) {
            if (!isAutoFill) SWAL_ALERT('No Inputs', 'No visible pack inputs found on the page.', 'warning', config);
            GM_log("Fill operation aborted: No visible pack inputs found.");
            return;
        }

        // Determine which inputs might be filled based on mode/count
        const potentialInputsToFill = determineTargetInputs(allInputs, config);
        const targetedCount = potentialInputsToFill.length;

        if (targetedCount === 0) {
            const modeDesc = config.lastMode === 'fixed' || config.lastMode === 'max' ? `Mode (${config.lastMode}) and Count (${config.lastCount})` : `Pattern Type (${config.patternType})`;
            if (!isAutoFill) SWAL_ALERT('No Targets', `No packs targeted based on current ${modeDesc}.`, 'info', config);
            GM_log(`Fill operation aborted: No packs targeted. Mode/Pattern: ${config.patternType}, Count: ${config.lastCount}`);
            return;
        }

        // 3. Handle Clear Option (Manual Only)
        if (config.lastClear && !isAutoFill) {
            clearAllInputs(); // Uses utility function
        }

        // 4. Filter by 'Fill Empty Only'
        const fillEmptyOnly = config.fillEmptyOnly;
        const inputsToActuallyFill = fillEmptyOnly
            ? potentialInputsToFill.filter(el => !el.value || parseInt(el.value, 10) === 0)
            : potentialInputsToFill;

        const finalFillCount = inputsToActuallyFill.length;

        if (finalFillCount === 0) {
            const message = fillEmptyOnly
                ? `No empty packs found among the ${targetedCount} targeted.`
                : `All ${targetedCount} targeted packs already have a quantity.`;
            if (!isAutoFill) SWAL_ALERT('No Action Needed', message, 'info', config);
            GM_log(`Fill operation skipped: No packs needed filling. Targeted: ${targetedCount}, EmptyOnly: ${fillEmptyOnly}`);
            return;
        }

        // 5. Calculate Quantities
        const patternType = config.patternType;
        const workerStrategies = ['simplex', 'gradient']; // Strategies handled by worker
        const useWorker = workerStrategies.includes(patternType) && patternWorker;

        if (useWorker) {
            calculationSource = "Web Worker";
            GM_log(`Attempting to calculate ${finalFillCount} quantities using worker strategy: ${patternType}`);
            try {
                // Prepare config subset for worker
                const workerConfig = {
                    lastMinQty: config.lastMinQty,
                    lastMaxQty: config.lastMaxQty,
                    patternScale: config.patternScale,
                    patternIntensity: config.patternIntensity,
                    noiseSeed: config.noiseSeed,
                    maxTotalAmount: config.maxTotalAmount,
                    maxQtyOverride: MAX_QTY // Send absolute max
                };
                const workerData = {
                     strategy: patternType,
                     count: finalFillCount, // Only calculate for inputs we will actually fill
                     config: workerConfig
                 };

                // Call worker and wait for result
                const result = await callWorker(workerData); // Uses promise wrapper
                quantitiesToApply = result.quantities;
                workerMetadata = result.metadata; // Store metadata { actualTotal, seedUsed }
                calculationSource += ` (Seed: ${workerMetadata.seedUsed ?? 'N/A'})`;
                 GM_log(`Worker calculation successful. Received ${quantitiesToApply.length} quantities.`);

            } catch (workerError) {
                 GM_log(`Worker calculation failed: ${workerError.message}. Falling back to main thread 'random' strategy.`);
                 SWAL_TOAST(`Worker failed: ${workerError.message}. Using random quantities.`, 'warning', config);
                 calculationSource = "Main Thread (Fallback)";
                 // Fallback: Calculate using 'random' strategy on main thread
                 const fallbackStrategy = getMainThreadStrategy('random');
                 const useMaxTotal = config.maxTotalAmount > 0;
                 let currentTotal = 0;
                 quantitiesToApply = inputsToActuallyFill.map((input, index) => {
                      let qty = fallbackStrategy(config, index, finalFillCount);
                      qty = clamp(qty, config.lastMinQty, config.lastMaxQty); // Clamp result
                       // Apply Max Total Limit on fallback
                      if (useMaxTotal) {
                           const remaining = config.maxTotalAmount - currentTotal;
                           qty = Math.min(qty, Math.max(0, remaining));
                      }
                      currentTotal += qty;
                      return qty;
                 });
                 workerMetadata = { actualTotal: currentTotal, seedUsed: null }; // Set fallback metadata
            }

        } else {
            // Use Main Thread calculation
            calculationSource = "Main Thread";
            GM_log(`Calculating ${finalFillCount} quantities on main thread using strategy: ${patternType}`);
            const strategyFn = getMainThreadStrategy(patternType);
            const useMaxTotal = config.maxTotalAmount > 0;
            let currentTotal = 0;

            quantitiesToApply = inputsToActuallyFill.map((input, index) => {
                let qty = strategyFn(config, index, finalFillCount);
                // Clamp result according to main thread strategy rules (might be redundant if strategy clamps)
                qty = clamp(qty, config.lastMinQty, config.lastMaxQty);
                // Clamp against absolute MAX_QTY
                qty = clamp(qty, 0, MAX_QTY);

                // Apply Max Total Limit
                if (useMaxTotal) {
                     const remaining = config.maxTotalAmount - currentTotal;
                     qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative
                }
                currentTotal += qty;
                return qty;
            });
            workerMetadata = { actualTotal: currentTotal, seedUsed: null }; // Set metadata for consistency
        }

        // 6. Apply Quantities to DOM
        if (quantitiesToApply.length > 0) {
            // Use the simplified virtualUpdate (individual updates)
            virtualUpdate(inputsToActuallyFill, quantitiesToApply);
            GM_log(`Applied ${quantitiesToApply.length} quantities to inputs.`);
        } else {
             GM_log("No quantities were generated to apply.");
             // Should not happen if finalFillCount > 0, but safety check
        }


        // 7. Generate and Show Feedback
        // Only show detailed feedback for manual fills or if autofill did something
        if (!isAutoFill || (isAutoFill && finalFillCount > 0)) {
            generateFeedback(config, isAutoFill, calculationSource, targetedCount, allInputs.length, finalFillCount, workerMetadata);
        }

    } catch (error) {
        GM_log(`Fill Error: ${error.message}`, error);
        // Show sanitized error message to the user
        SWAL_ALERT('Fill Error', sanitize(error.message), 'error', config);
    }
}


/**
 * Applies quantities to inputs one by one.
 * @param {Array<HTMLInputElement>} inputs - The input elements to update.
 * @param {Array<number>} quantities - The quantities to apply.
 */
function virtualUpdate(inputs, quantities) {
    if (!inputs || !quantities || inputs.length !== quantities.length) {
        GM_log("virtualUpdate: Input/quantity mismatch or invalid arrays.");
        return;
    }
    inputs.forEach((input, i) => {
        // Clamping happens during calculation now, no need to reclamp here
        updateInput(input, quantities[i]); // Uses utility function
    });
}


/**
 * Generates the feedback summary HTML and displays it.
 */
function generateFeedback(config, isAutoFill, calculationSource, targetedCount, availableCount, filledCount, metadata) {
    let feedbackModeDesc = `Type: ${sanitize(config.patternType)}`;
    let feedbackQuantityDesc = "";
    let seedInfo = "";

    // Describe quantity range/rules
    switch(config.patternType) {
        case 'fixed':
        case 'unlimited':
             feedbackQuantityDesc = `${config.lastFixedQty} copies per pack.`;
             break;
        case 'max':
        case 'random':
        case 'alternating':
        case 'simplex':
        case 'gradient':
             feedbackQuantityDesc = `Copies between ${config.lastMinQty} and ${config.lastMaxQty}.`;
             break;
        default:
             feedbackQuantityDesc = "Quantity rules applied.";
    }

    // Add pattern specific details
    if (config.patternType === 'simplex' || config.patternType === 'gradient') {
         feedbackQuantityDesc += ` Scale: ${config.patternScale}, Intensity: ${config.patternIntensity}.`;
    }
    if (config.patternType === 'simplex' && metadata && metadata.seedUsed !== null) {
         seedInfo = `<br><strong>Seed Used:</strong> ${sanitize(metadata.seedUsed)}`;
    }

    const clearStatus = config.lastClear && !isAutoFill ? "<br>- Inputs Cleared First" : "";
    const autoFillStatus = isAutoFill ? "<br>- Triggered by Auto-Fill" : "";
    const emptyOnlyStatus = config.fillEmptyOnly ? "<br>- Only Empty Inputs Filled" : "";
    const maxTotalHit = config.maxTotalAmount > 0 && metadata && metadata.actualTotal >= config.maxTotalAmount;
    const maxTotalStatus = config.maxTotalAmount > 0 ? `<br>- Max Total Limit: ${config.maxTotalAmount} ${maxTotalHit ? '(Reached)' : ''}` : '';
    const totalAdded = metadata ? metadata.actualTotal : 'N/A';
    const averagePerFilled = filledCount > 0 && typeof totalAdded === 'number' ? (totalAdded / filledCount).toFixed(2) : 'N/A';

    let summaryHtml = `
         <p><strong>Operation Details:</strong>${clearStatus}${autoFillStatus}${emptyOnlyStatus}${maxTotalStatus}</p>
         <p><strong>Fill ${feedbackModeDesc}</strong></p>
         <p><strong>Calculation Source:</strong> ${sanitize(calculationSource)}${seedInfo}</p>
         <p><strong>Targeted Packs:</strong> ${targetedCount} / ${availableCount} visible</p>
         <p><strong>Packs Actually Filled:</strong> ${filledCount}</p>
         <p><strong>Quantity Rule:</strong> ${feedbackQuantityDesc}</p>
         <p><strong>Total Copies Added:</strong> ${totalAdded}</p>
         <p><strong>Average Copies per Filled Pack:</strong> ${averagePerFilled}</p>
     `;

     GM_log(`Pack Filler Pro: Fill complete. ${summaryHtml.replace(/<br.*?>/g, '; ').replace(/<.*?>/g, '').replace(/\n\s*/g, ' ')}`);

     if (isAutoFill) {
         SWAL_TOAST(`Auto-filled ${filledCount} packs (Total: ${totalAdded})`, 'success', config);
     } else {
         SWAL_ALERT('Fill Summary', summaryHtml, 'success', config);
     }
}

// Make functions available via @require if this file is used as a module
// For this script structure, they become globally available within the IIFE.
// Explicitly list functions intended for external use if modularizing further:
// export { fillPacks, setupWorkerMessageHandler }; // Example if using modules
