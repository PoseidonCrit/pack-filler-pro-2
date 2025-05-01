// This file contains the main logic for calculating and applying quantities to inputs.
// It orchestrates the fill process, including selecting packs, determining quantities
// using main thread strategies, and applying updates to the DOM.

// THIS VERSION PERFORMS ALL PATTERN CALCULATIONS ON THE MAIN THREAD.

// It assumes the following are available in the main script's scope via @require:
// - constants from constants.js (MAX_QTY, SELECTOR, etc.)
// - functions from domUtils.js (getPackInputs, clamp, updateInput, clearAllInputs, sanitize)
// - functions from swalHelpers.js (SWAL_ALERT, SWAL_TOAST)
// - functions from configManager.js (validateFillConfig)
// - GM_log function

/* --- Worker Interaction - REMOVED IN THIS VERSION --- */
// The Web Worker and related functions (callWorkerAsync, handleWorkerMessage) are
// removed as all calculations are now done on the main thread.


/* --- Main Thread Fill Strategies & Helpers --- */
// Simple strategies that can run efficiently on the main thread.
// These are used for all modes in this main-thread-only version.

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


// Basic 1D Perlin Noise implementation (simplified, local to main thread)
// Based on Ken Perlin's original Java implementation.
// Note: This is a 1D noise function suitable for a linear list of packs.
// Seed is used to make the noise repeatable.
// This is a direct copy from the original worker code's noise implementation.
function perlinNoise(x, seed) {
    // Simple hashing function using bitwise operations and a seed.
    // Needs to be deterministic based on input (x) and seed.
    // Using prime multipliers and XOR with seed for mixing.
    const hash = (n, s) => {
        let i = ((n * 0x1357) ^ s) >>> 0; // Multiply, XOR with seed, ensure positive 32-bit int
        i = ((i * 0x4593) ^ (i >>> 16)) >>> 0; // More mixing
        i = ((i * 0x8295) ^ (i >>> 16)) >>> 0; // Final mixing
        return i;
    };

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10); // Smooth interpolation curve (6t^5 - 15t^4 - 10t^3)
    // lerp is defined above

    // Gradient function for 1D noise
    // Determines the influence of the random gradient at an integer coordinate.
    const grad = (hashValue, xDistance) => {
        // Get the last bit of the hash to determine gradient direction (-1 or 1)
        const h = hashValue & 1; // Use just one bit for 1D gradient direction
        const gradient = (h === 0) ? xDistance : -xDistance; // If bit is 0, gradient is positive; otherwise negative
        return gradient;
    };

    const x0 = Math.floor(x); // Integer part
    const x1 = x0 + 1; // Next integer part
    const t = x - x0; // Fractional part (0 to 1)
    const t_faded = fade(t); // Smooth the fractional part

    // Calculate gradients at the integer coordinates based on their hash and the seed
    const hash0 = hash(x0, seed);
    const hash1 = hash(x1, seed);

    const grad0 = grad(hash0, t); // Gradient at x0, influenced by distance t
    const grad1 = grad(hash1, t - 1); // Gradient at x1, influenced by distance t-1

    // Interpolate between the gradients
    return lerp(grad0, grad1, t_faded); // Result is typically between -1 and 1
}

// Generates a random seed if none is provided or if seed is an empty string (local to main thread)
// Direct copy from original worker code.
function generateSeed(seedInput) {
    // If seedInput is provided and is a non-empty string, try to parse it as an integer.
    // Otherwise, generate a random seed.
    if (seedInput && typeof seedInput === 'string' && seedInput.trim() !== '') {
        const parsedSeed = parseInt(seedInput, 10);
        // Use the parsed seed if it's a valid number, otherwise generate random
        if (!isNaN(parsedSeed)) {
             GM_log(`Pack Filler Pro: Using provided seed: ${parsedSeed}`);
             return parsedSeed;
        } else {
             GM_log(`Pack Filler Pro: Invalid seed input '${seedInput}'. Generating random seed.`);
        }
    }
    // Generate a random seed (a large integer)
    const randomSeed = Math.floor(Math.random() * 2**32); // Use a large range for the seed
    GM_log(`Pack Filler Pro: Generating random seed: ${randomSeed}`);
    return randomSeed;
}


// Object containing different fill strategies that run on the main thread.
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
    // Assumes MAX_QTY from constants.js, clamp, and lerp are available.
    gradient: (config, index, total) => {
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
        const intensity = typeof config.patternIntensity === 'number' ? config.patternIntensity : 1.0; // Default intensity (0.0 to 1.0)
        const scale = typeof config.patternScale === 'number' ? config.patternScale : 100; // Default scale (affects gradient steepness over the count)
        const minQty = config.lastMinQty;
        const maxQtyCfg = config.lastMaxQty; // Use different name to avoid conflict with MAX_QTY constant
        const range = maxQtyCfg - minQty; // The range of possible quantities

        // Ensure total count is at least 1 to avoid division by zero in position mapping
        const safeTotal = Math.max(1, total);
        // Ensure scale is at least 1 for mapping index to position factor
        const safeScale = Math.max(1, scale);

        // Calculate position factor (0 to 1) based on index and effective scale.
        // Dividing by (safeScale - 1) determines how quickly the gradient progresses over the list.
        // Clamp to 1 to ensure the factor doesn't exceed 1 even if index > scale.
        // Note: When scale = 1, gradient is effectively linear over the total count.
        // We map index 0 to factor 0, index total-1 to factor 1 (if total > 1).
        const positionFactor = safeTotal > 1 ? clamp(index / (safeTotal - 1), 0, 1) : 0;


        // Calculate a quantity based on position in the list (linear gradient from minQty to maxQtyCfg)
        const baseQty = minQty + positionFactor * range;

        // Apply intensity to shift the quantity towards minQty or the linear gradient value.
        // If intensity is 1, quantity follows the linear gradient (min to max).
        // If intensity is 0, quantity is always minQty (the starting point).
        let finalQuantityFloat = lerp(minQty, baseQty, intensity);


        // Clamp the final quantity to the allowed range [0, MAX_QTY] and round to nearest integer.
        const finalQuantity = clamp(Math.round(finalQuantityFloat), 0, maxQty);

        return finalQuantity;
    },

     // Perlin strategy: Calculates quantities based on the Perlin Noise pattern.
     // Assumes MAX_QTY from constants.js, clamp, lerp, perlinNoise, generateSeed are available.
    perlin: (config, index, total) => {
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
        const minQty = config.lastMinQty;
        const maxQtyCfg = config.lastMaxQty; // Use different name to avoid conflict with MAX_QTY constant
        const scale = typeof config.patternScale === 'number' ? config.patternScale : 100; // Default scale
        const intensity = typeof config.patternIntensity === 'number' ? config.patternIntensity : 1.0; // Default intensity (0.0 to 1.0)
        const range = maxQtyCfg - minQty; // The range of possible quantities

        // Generate or parse seed
        const actualSeed = generateSeed(config.noiseSeed); // Uses generateSeed from above

        // Ensure scale is at least 1 to avoid issues
        const safeScale = Math.max(1, scale);

        // Map index (0 to total-1) to a position in the noise space, influenced by scale.
        // Dividing by safeScale determines how 'zoomed in' the noise is.
        const noiseInput = index / safeScale;

        // Get noise value (typically -1 to 1)
        const noiseValue = perlinNoise(noiseInput, actualSeed); // Uses perlinNoise from above

        // Map noise value (-1 to 1) to a quantity range (minQty to maxQtyCfg)
        // Normalize noise from [-1, 1] to [0, 1]
        const normalizedNoise = (noiseValue + 1) / 2; // Now 0 to 1

        // Interpolate between minQty and maxQtyCfg based on normalized noise and intensity.
        // Intensity controls how much the noise affects the final quantity.
        // If intensity is 1, quantity ranges fully from minQty to maxQtyCfg based on noise.
        // If intensity is 0, quantity is always the midpoint (minQty + range/2).
        // We interpolate between the midpoint and the quantity determined purely by noise.
        const midpoint = minQty + range / 2;
        const quantityFromNoise = minQty + normalizedNoise * range;
        let finalQuantityFloat = lerp(midpoint, quantityFromNoise, intensity);

        // Clamp the final quantity to the allowed range [0, MAX_QTY] and round to nearest integer.
        const finalQuantity = clamp(Math.round(finalQuantityFloat), 0, maxQty);

        // Store seed used for feedback (can't return metadata directly from strategy function)
        // We'll log it here and update feedback generation logic to reflect main thread calculation.
        // Alternatively, calculate ALL quantities in fillPacks and pass the metadata back from the calculation function.
        // Let's adjust fillPacks to get all quantities at once.
        return { quantity: finalQuantity, seed: actualSeed }; // Return quantity and seed info


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
};


/**
 * Calculates quantities for a given set of inputs based on the configured strategy.
 * Handles fixed, random, gradient, perlin, and alternating strategies on the main thread.
 * Applies the maxTotalAmount constraint.
 * Assumes MainThreadFillStrategies, clamp, generateSeed (for perlin), MAX_QTY are available.
 * @param {Array<HTMLInputElement>} inputsToFill - The array of input elements to calculate quantities for.
 * @param {object} config - The script's configuration object.
 * @returns {{quantities: number[], metadata: object}} An object containing the calculated quantities and any relevant metadata (e.g., seed used).
 * @throws {Error} Throws an error if the strategy function is not found.
 */
function calculateQuantitiesMainThread(inputsToFill, config) {
    const quantities = [];
    let metadata = {};
    let currentTotal = 0;
    const maxTotalAmount = clamp(config.maxTotalAmount, 0, Infinity); // Max total can be very large or 0
    const totalPacksToFill = inputsToFill.length;

    const strategy = MainThreadFillStrategies[config.patternType];

    if (typeof strategy !== 'function') {
        const errorMsg = `Main thread strategy function for "${config.patternType}" not found. Cannot calculate quantities.`;
        GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
        throw new Error(errorMsg);
    }

    // Special handling for Perlin to generate/use seed once for the batch
    let perlinSeed = null;
    if (config.patternType === 'perlin') {
        perlinSeed = generateSeed(config.noiseSeed); // Generate/get seed once for the batch
        metadata.seedUsed = perlinSeed; // Store seed in metadata
    }


    inputsToFill.forEach((input, index) => {
        let qtyInfo;
        if (config.patternType === 'perlin') {
             // Pass the pre-generated seed for Perlin calculation
             qtyInfo = MainThreadFillStrategies.perlin({ ...config, noiseSeed: perlinSeed }, index, totalPacksToFill);
             // The perlin strategy function now returns { quantity, seed }
             let qty = qtyInfo.quantity;

              // Apply max total limit manually on main thread
              if (maxTotalAmount > 0) {
                   const remaining = maxTotalAmount - currentTotal;
                   qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity and cap
              }
             quantities.push(qty);
             currentTotal += qty;

        } else {
            // For other strategies, calculate quantity directly
             let qty = strategy(config, index, totalPacksToFill);

             // Apply max total limit manually on main thread
             if (maxTotalAmount > 0) {
                  const remaining = maxTotalAmount - currentTotal;
                  qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity and cap
             }
            quantities.push(qty);
            currentTotal += qty; // Add the quantity actually set to the total
        }

         // If max total is reached, fill remaining quantities with 0 and stop
         if (maxTotalAmount > 0 && currentTotal >= maxTotalAmount) {
              for (let j = index + 1; j < totalPacksToFill; j++) {
                   quantities.push(0);
              }
              break; // Exit the forEach loop
         }

    });

    return { quantities, metadata, totalCopiesAdded: currentTotal };
}


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
 * Incorporates pattern strategies and batch DOM updates, all on the main thread.
 * Handles configuration validation, clearing inputs, filtering empty inputs,
 * calculating quantities, applying updates, and providing feedback.
 * Assumes the following are available in scope:
 * getPackInputs, validateFillConfig, clearAllInputs, virtualUpdate, generateFeedback,
 * SWAL_ALERT, SWAL_TOAST, calculateQuantitiesMainThread, clamp, sanitize, MAX_QTY, DEFAULT_CONFIG.
 * @param {object} config - The script's configuration object.
 * @param {boolean} [isAutoFill=false] - True if triggered by the auto-load process.
 */
async function fillPacks(config, isAutoFill = false) { // Accept config here and make async
    GM_log(`Pack Filler Pro: fillPacks started (Auto-fill: ${isAutoFill}, Main Thread Only).`);

    // Use config object directly
    const { lastMode: mode, lastCount: count, lastClear: clear, fillEmptyOnly } = config;

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


        GM_log("Pack Filler Pro: fillPacks Step 15: Proceeding to quantity calculation (Main Thread).");

        let quantitiesToApply = [];
        let metadata = {}; // To store metadata like seed used (from main thread calculation)
        let totalCopiesAdded = 0; // Track total added after calculation and max total application

        // --- Core Filling Logic - All on Main Thread ---
        GM_log(`Pack Filler Pro: fillPacks Step 16: Calculating quantities on main thread using strategy: "${config.patternType}".`);
        // Assumes calculateQuantitiesMainThread is available in this file's scope
        if (typeof calculateQuantitiesMainThread !== 'function') {
            const errorMsg = "calculateQuantitiesMainThread function not found within fillLogic.js.";
            GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
             if (!isAutoFill && typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Error', errorMsg, 'error', config);
            throw new ReferenceError(errorMsg); // Abort if calculation function is missing
        }

        // Perform calculation on the main thread
        const calculationResult = calculateQuantitiesMainThread(inputsToActuallyFill, config);
        quantitiesToApply = calculationResult.quantities;
        metadata = calculationResult.metadata;
        totalCopiesAdded = calculationResult.totalCopiesAdded; // Get total from the calculation function

        GM_log(`Pack Filler Pro: fillPacks Step 17: Main thread calculation complete. Generated ${quantitiesToApply.length} quantities. Final total: ${totalCopiesAdded}`);
        const calculationSource = "Main Thread"; // Source is always main thread in this version


        // --- Apply Quantities to DOM ---
        GM_log(`Pack Filler Pro: fillPacks Step 18: Applying quantities to DOM. Count: ${quantitiesToApply.length}`);
         // Assumes virtualUpdate function is available in scope
        if (quantitiesToApply.length > 0 && typeof virtualUpdate === 'function') {
            // Use the batch update function
            // Pass the original inputsToActuallyFill and the calculated quantities
            virtualUpdate(inputsToActuallyFill, quantitiesToApply);
            GM_log("Pack Filler Pro: fillPacks Step 19: Quantities applied via virtualUpdate.");
        } else if (quantitiesToApply.length === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 18a: No quantities generated to apply.");
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
         GM_log("Pack Filler Pro: fillPacks Step 20: Generating feedback.");
         // Assumes generateFeedback and SWAL_TOAST, SWAL_ALERT are available
         if (!isAutoFill || (isAutoFill && filledCount > 0)) {
            if (typeof generateFeedback === 'function') {
                 // Pass all relevant info including the final calculated total
                 generateFeedback(config, isAutoFill, calculationSource, targetedCount, availablePacks, filledCount, metadata, totalCopiesAdded);
            } else {
                 GM_log("Pack Filler Pro: generateFeedback function not found. Skipping feedback.");
                 // Fallback logging if feedback function is missing
                 const feedbackSummary = `Fill complete. Auto-fill: ${isAutoFill}, Source: ${calculationSource}, Targeted: ${targetedCount}/${availablePacks}, Filled: ${filledCount}, Total Added: ${totalCopiesAdded}.`;
                 GM_log(feedbackSummary);
                 if (!isAutoFill && typeof SWAL_TOAST === 'function') SWAL_TOAST(`Fill Complete: ${filledCount} packs filled.`, 'success', config);

            }
         }
         GM_log("Pack Filler Pro: fillPacks finished.");


     } catch (error) {
         GM_log(`Pack Filler Pro: fillPacks Caught Error: ${error.message}`, error);
         // Pass config to SWAL_ALERT for user feedback
         if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
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
 * Uses current config for quantity calculation on the main thread.
 * Provides user feedback via SweetAlert2 toast.
 * Assumes the following are available in scope:
 * getPackInputs, validateFillConfig, updateInput, SWAL_ALERT, SWAL_TOAST,
 * MainThreadFillStrategies, clamp, sanitize, MAX_QTY, generateSeed (for perlin).
 * @param {object} config - The script's configuration object.
 */
async function fillRandomPackInput(config) { // Accept config here and make async
    GM_log("Pack Filler Pro: Attempting to fill 1 random pack (Main Thread Only).");
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

        // 4. Determine quantity for this single pack (Always Main Thread)
        let quantity = 0;
        let metadata = {}; // To store metadata like seed used

        const patternType = config.patternType;

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

        const calculationSource = "Main Thread";
        GM_log(`Pack Filler Pro: Calculating quantity for random pack on main thread using strategy: "${mainThreadStrategy === MainThreadFillStrategies.random ? 'random (fallback)' : patternType}".`);

        // Calculate quantity. For Perlin, get seed here.
        if (patternType === 'perlin' && mainThreadStrategy === MainThreadFillStrategies.perlin) {
             const actualSeed = generateSeed(config.noiseSeed);
             metadata.seedUsed = actualSeed;
             // Call Perlin strategy, passing the seed and faking total/index for a single pack
             quantity = mainThreadStrategy({ ...config, noiseSeed: actualSeed }, 0, 1).quantity; // Get quantity from result object
        } else {
            // Calculate quantity for other strategies
             quantity = mainThreadStrategy(config, 0, 1); // Calculate for index 0 of total 1
        }

        // Clamp result according to main thread strategy rules
        // (MainThreadFillStrategies already handle clamping to min/max and MAX_QTY)
         // Use clamp from domUtils or local clamp
         const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99;
         if (typeof clamp === 'function') {
              quantity = clamp(quantity, 0, maxQty); // Final clamp against absolute MAX_QTY
         } else {
              GM_log("Pack Filler Pro: clamp function not found for final clamp on main thread.");
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
             let feedbackText = `Set "${sanitize(packAlias)}" to ${quantity} (via ${calculationSource})`;
              if (patternType === 'perlin' && metadata.seedUsed) {
                  feedbackText += ` (Seed: ${metadata.seedUsed})`;
              }
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
 * @param {string} calculationSource - Describes where calculation happened (should always be "Main Thread" in this version).
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
     const isPatternStrategy = typeof MainThreadFillStrategies === 'object' && MainThreadFillStrategies[patternType] && patternType !== 'random' && patternType !== 'fixed' && patternType !== 'alternating'; // Exclude simple strategies


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
        switch (patternType) { // Use patternType for quantity description logic
            case 'fixed':
                 feedbackQuantityDesc = `${fixedQty} copie${fixedQty === 1 ? '' : 's'} per pack (Fixed Pattern).`;
                 break;
            case 'random':
                 feedbackQuantityDesc = `Random copies (${minQty}-${maxQty}) per pack (Random Pattern).`;
                 break;
             case 'alternating':
                  feedbackQuantityDesc = `Alternating copies (${minQty}/${maxQty}) per pack (Alternating Pattern).`;
                  break;
            default: // Should not happen with validation, but defensive
                feedbackQuantityDesc = `Quantity chosen per pack (Unknown Pattern: ${patternType}).`;
        }

        // Describe mode separately as it affects WHICH inputs are targeted
        switch (mode) {
            case 'fixed': // Refers to the number of packs
                feedbackModeDesc = `Fixed Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                break;
            case 'max': // Refers to the number of packs
                 feedbackModeDesc = `Random Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                 break;
            case 'unlimited':
                feedbackModeDesc = `All Visible Packs Mode`;
                break;
            default: // Should not happen
                feedbackModeDesc = `Mode: ${mode}`;
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

     // Use sanitize for feedback HTML to prevent basic HTML injection
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
// - calculateQuantitiesMainThread

// Note: chooseQuantity, lerp, perlinNoise, generateSeed, MainThreadFillStrategies
// are internal helpers/variables and are not explicitly exported,
// but are accessible within this file's scope.
