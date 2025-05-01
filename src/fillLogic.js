// This file contains the main logic for calculating and applying quantities to inputs.
// Assumes constants, utils, helpers, config manager are available.
// Assumes _pendingWorkerRequests object and _workerRequestId are managed globally (or scoped appropriately) by the main script.

// --- Sanitization & Validation (Keep from previous revision) ---
const sanitize = (str) => { /* ... */ };
const validateFillConfig = (config) => { /* ... */ };

// --- Worker Interaction (Modified for Page Context Injection) ---

// NOTE: _workerRequestId and _pendingWorkerRequests are now managed in the main script's scope

/**
 * Sends a message via window.postMessage to the injected script which forwards it to the worker.
 * Returns a Promise that will be resolved/rejected when the corresponding response is received
 * by the main script's window message listener.
 *
 * @param {object} data - Data to post (strategy, count, config).
 * @param {number} timeoutMs - Timeout duration in milliseconds.
 * @returns {Promise<object>} Promise resolving with { quantities, metadata } or rejecting with an error.
 */
function callWorkerAsync(data, timeoutMs = 10000) { // Renamed slightly for clarity
    // Check if the page context worker setup was successful (e.g., check a flag set during init)
    // For simplicity, assume it was, or add a check here if needed.

    const requestId = ++_workerRequestId; // Increment global request ID (managed in main script)
    const messagePayload = { ...data, requestId }; // Add requestId

    GM_log(`Pack Filler Pro: Preparing to post message to page context for worker (Request ID: ${requestId}).`);

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            delete _pendingWorkerRequests[requestId]; // Remove from global map
            GM_log(`Pack Filler Pro: Worker request ${requestId} timed out after ${timeoutMs}ms.`);
            reject(new Error(`Worker request timed out after ${timeoutMs / 1000} seconds.`));
        }, timeoutMs);

        // Store the resolve/reject functions and timeoutId globally for this request
        _pendingWorkerRequests[requestId] = { resolve, reject, timeoutId };

        // Post the message to the window (page context)
        // The injected script will listen for 'source: pfp-contentscript-message'
        try {
            window.postMessage({
                source: 'pfp-contentscript-message', // Identifier for the injected listener
                payload: messagePayload
            }, window.location.origin); // Target the current page origin for security
             GM_log(`Pack Filler Pro: Posted message to page context listener (Request ID: ${requestId}).`);
        } catch (postError) {
             GM_log("Pack Filler Pro: Error posting message to page context:", postError);
             // Clean up and reject if posting fails
             clearTimeout(timeoutId);
             delete _pendingWorkerRequests[requestId];
             reject(new Error(`Failed to send message to page context: ${postError.message}`));
        }
    });
}

// NOTE: The function 'setupWorkerMessageHandler' is REMOVED from here.
//       The listener for 'pfp-worker-message' events is added in the main script's init.


// --- Main Thread Fill Strategies & Helpers (Keep from previous revision) ---
const fixedStrategy = (config, index, total) => { /* ... */ };
const randomStrategy = (config, index, total) => { /* ... */ };
const alternatingStrategy = (config, index, total) => { /* ... */ };
const gradientStrategyMain = (config, index, total) => { /* ... */ };
function getMainThreadStrategy(type) { /* ... */ }
function determineTargetInputs(allInputs, config) { /* ... */ }


// --- Main Fill Function (Modified to use callWorkerAsync) ---

/**
 * Fills pack inputs based on current settings.
 * Uses page-context worker via window.postMessage for complex patterns.
 * @param {object} config - The script's configuration object.
 * @param {boolean} [isAutoFill=false] - True if triggered by the auto-load process.
 */
async function fillPacks(config, isAutoFill = false) {
    GM_log(`Fill process started. Mode/Pattern: ${config.patternType}, AutoFill: ${isAutoFill}`);
    let quantitiesToApply = [];
    let workerMetadata = null;
    let calculationSource = "Main Thread";

    try {
        // 1. Validate Config
        validateFillConfig(config);

        // 2. Get Inputs & Determine Targets
        const allInputs = getPackInputs();
        if (allInputs.length === 0) { /* ... no inputs found ... */ return; }
        const potentialInputsToFill = determineTargetInputs(allInputs, config);
        const targetedCount = potentialInputsToFill.length;
        if (targetedCount === 0) { /* ... no targets found ... */ return; }

        // 3. Handle Clear Option
        if (config.lastClear && !isAutoFill) clearAllInputs();

        // 4. Filter by 'Fill Empty Only'
        const fillEmptyOnly = config.fillEmptyOnly;
        const inputsToActuallyFill = fillEmptyOnly
            ? potentialInputsToFill.filter(el => !el.value || parseInt(el.value, 10) === 0)
            : potentialInputsToFill;
        const finalFillCount = inputsToActuallyFill.length;
        if (finalFillCount === 0) { /* ... no action needed ... */ return; }

        // 5. Calculate Quantities
        const patternType = config.patternType;
        const workerStrategies = ['simplex', 'gradient']; // Strategies suitable for worker
        const useWorker = workerStrategies.includes(patternType); // Check if worker should be used

        if (useWorker) {
            calculationSource = "Web Worker (Page Context)";
            GM_log(`Attempting calculation via page context worker: ${patternType}`);
            try {
                const workerConfig = { /* ... config subset for worker ... */ };
                const workerData = { strategy: patternType, count: finalFillCount, config: workerConfig };

                // Call worker via window.postMessage and wait for result
                const result = await callWorkerAsync(workerData); // *** USE ASYNC CALL ***
                quantitiesToApply = result.quantities;
                workerMetadata = result.metadata;
                calculationSource += ` (Seed: ${workerMetadata.seedUsed ?? 'N/A'})`;
                GM_log(`Worker calculation successful. Received ${quantitiesToApply.length} quantities.`);

            } catch (workerError) {
                // Fallback logic (same as previous revision)
                GM_log(`Worker calculation failed: ${workerError.message}. Falling back.`);
                SWAL_TOAST(`Worker failed: ${workerError.message}. Using random.`, 'warning', config);
                calculationSource = "Main Thread (Fallback)";
                const fallbackStrategy = getMainThreadStrategy('random');
                const useMaxTotal = config.maxTotalAmount > 0;
                let currentTotal = 0;
                quantitiesToApply = inputsToActuallyFill.map((input, index) => {
                    let qty = fallbackStrategy(config, index, finalFillCount);
                    qty = clamp(qty, config.lastMinQty, Math.min(config.lastMaxQty, MAX_QTY));
                    if (useMaxTotal) { /* ... limit by total ... */ }
                    currentTotal += qty;
                    return qty;
                });
                workerMetadata = { actualTotal: currentTotal, seedUsed: null };
            }
        } else {
            // Main Thread calculation (same as previous revision)
            calculationSource = "Main Thread";
            GM_log(`Calculating on main thread: ${patternType}`);
            const strategyFn = getMainThreadStrategy(patternType);
            const useMaxTotal = config.maxTotalAmount > 0;
            let currentTotal = 0;
            quantitiesToApply = inputsToActuallyFill.map((input, index) => {
                let qty = strategyFn(config, index, finalFillCount);
                qty = clamp(qty, 0, MAX_QTY); // Ensure absolute max
                if (useMaxTotal) { /* ... limit by total ... */ }
                currentTotal += qty;
                return qty;
            });
            workerMetadata = { actualTotal: currentTotal, seedUsed: null };
        }

        // 6. Apply Quantities to DOM
        if (quantitiesToApply.length > 0) {
            virtualUpdate(inputsToActuallyFill, quantitiesToApply); // Use simplified version
            GM_log(`Applied ${quantitiesToApply.length} quantities.`);
        }

        // 7. Generate and Show Feedback
        if (!isAutoFill || (isAutoFill && finalFillCount > 0)) {
            generateFeedback(config, isAutoFill, calculationSource, targetedCount, allInputs.length, finalFillCount, workerMetadata);
        }

    } catch (error) {
        GM_log(`Fill Error: ${error.message}`, error);
        SWAL_ALERT('Fill Error', sanitize(error.message), 'error', config);
    }
}

// --- virtualUpdate & generateFeedback (Keep from previous revision) ---
function virtualUpdate(inputs, quantities) { /* ... */ }
function generateFeedback(config, isAutoFill, calculationSource, targetedCount, availableCount, filledCount, metadata) { /* ... */ }
