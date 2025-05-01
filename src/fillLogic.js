// This file contains the main logic for calculating and applying quantities...

// --- Sanitization & Validation (Keep from previous revision) ---
const sanitize = (str) => { /* ... */ };
const validateFillConfig = (config) => { /* ... */ };

// --- Worker Interaction (Keep from previous revision) ---
// NOTE: _workerRequestId and _pendingWorkerRequests managed in main script
function callWorkerAsync(data, timeoutMs = 10000) { /* ... */ }

// --- Main Thread Fill Strategies & Helpers (Keep from previous revision) ---
const fixedStrategy = (config, index, total) => { /* ... */ };
const randomStrategy = (config, index, total) => { /* ... */ };
const alternatingStrategy = (config, index, total) => { /* ... */ };
const gradientStrategyMain = (config, index, total) => { /* ... */ };
function getMainThreadStrategy(type) { /* ... */ }
function determineTargetInputs(allInputs, config) { /* ... */ }

// --- Main Fill Function (Keep from previous revision) ---
async function fillPacks(config, isAutoFill = false) { /* ... */ }

// --- New Function: Fill Single Random Pack ---

/**
 * Selects one random visible pack input and fills it based on current settings.
 * @param {object} config - The script's configuration object.
 */
async function fillRandomPackInput(config) {
    GM_log("Attempting to fill 1 random pack.");
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

        // 4. Calculate Quantity (using current patternType setting)
        let quantity = 0;
        let calculationSource = "Main Thread";
        const patternType = config.patternType;
        const workerStrategies = ['simplex', 'gradient'];
        const useWorker = workerStrategies.includes(patternType) && isPageContextWorkerInjected; // Check flag from main script

        if (useWorker) {
            calculationSource = "Web Worker";
            GM_log(`Calculating quantity for random pack via worker: ${patternType}`);
             try {
                const workerConfig = { /* ... config subset for worker ... */ };
                // Request calculation for just one item (index 0 of 1)
                const workerData = { strategy: patternType, count: 1, config: workerConfig };
                const result = await callWorkerAsync(workerData);
                quantity = result.quantities[0]; // Get the single quantity calculated
                if(result.metadata?.seedUsed) calculationSource += ` (Seed: ${result.metadata.seedUsed})`;
             } catch (workerError) {
                  GM_log(`Worker failed for random pack: ${workerError.message}. Using main thread random.`);
                  calculationSource = "Main Thread (Fallback)";
                  const fallbackStrategy = getMainThreadStrategy('random');
                  quantity = fallbackStrategy(config, 0, 1); // Calculate one random value
                  quantity = clamp(quantity, config.lastMinQty, Math.min(config.lastMaxQty, MAX_QTY));
             }
        } else {
            // Use Main Thread calculation
            calculationSource = "Main Thread";
            GM_log(`Calculating quantity for random pack on main thread: ${patternType}`);
            const strategyFn = getMainThreadStrategy(patternType);
            quantity = strategyFn(config, 0, 1); // Calculate for index 0 of total 1
             // Clamp result according to main thread strategy rules
            quantity = clamp(quantity, config.lastMinQty, config.lastMaxQty);
            quantity = clamp(quantity, 0, MAX_QTY); // Clamp against absolute MAX_QTY
        }

        // 5. Apply Quantity
        updateInput(targetInput, quantity); // Use utility function
        GM_log(`Applied quantity ${quantity} to random pack: ${packAlias}`);

        // 6. Feedback
        SWAL_TOAST(`Set "${sanitize(packAlias)}" to ${quantity} (via ${calculationSource})`, 'success', config);

    } catch (error) {
         GM_log(`Fill Random Pack Error: ${error.message}`, error);
         SWAL_ALERT('Fill Random Error', sanitize(error.message), 'error', config);
    }
}


// --- virtualUpdate & generateFeedback (Keep from previous revision) ---
function virtualUpdate(inputs, quantities) { /* ... */ }
function generateFeedback(config, isAutoFill, calculationSource, targetedCount, availableCount, filledCount, metadata) { /* ... */ }
