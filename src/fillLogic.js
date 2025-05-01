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

/* --- Main Thread Fill Strategies & Helpers --- */
// Simple strategies that can run efficiently on the main thread.
// These are used for all modes in this main-thread-only version.


// Simple linear interpolation helper (local to main thread logic)
const lerp = (a, b, t) => a + t * (b - a);


// Basic 1D Perlin Noise implementation (simplified, local to main thread)
// Based on Ken Perlin's original Java implementation.
// Note: This is a 1D noise function suitable for a linear list of packs.
// Seed is used to make the noise repeatable.
// Assumes clamp from domUtils.js is available.
function perlinNoise(x, seed) {
    // Check dependency
    if (typeof clamp !== 'function') {
         GM_log("Pack Filler Pro: perlinNoise dependency (clamp) missing. Returning 0.");
         return 0;
    }

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
// Assumes GM_log is available.
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

// Helper to choose a random quantity within the configured range
// Assumes MAX_QTY from constants.js and clamp from domUtils.js are available.
function chooseQuantity(config) {
    // Assumes clamp from domUtils.js is available via @require
    if (typeof clamp !== 'function') {
         GM_log("Pack Filler Pro: chooseQuantity dependencies (clamp) missing. Cannot determine quantity.");
         return 0;
    }
    // Uses MAX_QTY from src/constants.js
    const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
    const min = clamp(config.lastMinQty, 0, maxQty);
    const max = clamp(config.lastMaxQty, 0, maxQty);
    if (min > max) {
         GM_log("Pack Filler Pro: chooseQuantity called with min > max, returning min.", {min: min, max: max});
         return min; // Return min if range is invalid (should be prevented by validation)
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


// Object containing different fill strategies that run on the main thread.
// These functions take config, current index, and total count as arguments.
// They should assume clamp from domUtils.js is available.
const MainThreadFillStrategies = {
    // Fixed quantity strategy: Always returns the configured fixed quantity.
    // Assumes MAX_QTY from constants.js and clamp from domUtils.js are available.
    fixed: (config, index, total) => {
        // Assumes clamp from domUtils.js is available via @require
         if (typeof clamp !== 'function') {
              GM_log("Pack Filler Pro: fixed strategy dependencies (clamp) missing. Cannot determine quantity.");
              return 0;
         }
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
        return clamp(config.lastFixedQty, 0, maxQty);
    },

    // Random quantity strategy: Returns a random quantity within the configured range.
    // Uses chooseQuantity helper (local).
    random: (config, index, total) => chooseQuantity(config), // chooseQuantity is defined above

    // Gradient strategy: Calculates quantity based on position in the list (linear gradient).
    // Assumes MAX_QTY from constants.js, clamp from domUtils.js, and lerp (local) are available.
    gradient: (config, index, total) => {
        // Assumes clamp from domUtils.js is available via @require
        if (typeof clamp !== 'function' || typeof lerp !== 'function') {
             GM_log("Pack Filler Pro: gradient strategy dependencies (clamp or lerp) missing. Cannot determine quantity.");
             return 0;
        }
        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
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
        // Dividing by (safeTotal > 1 ? safeTotal - 1 : 1) maps index 0 to 0 and index total-1 to 1
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
     // Assumes MAX_QTY from constants.js, clamp from domUtils.js, lerp (local), perlinNoise (local), generateSeed (local) are available.
     // The perlin strategy function now returns { quantity, seed } to pass metadata.
    perlin: (config, index, total) => {
        // Assumes clamp from domUtils.js is available via @require
        if (typeof clamp !== 'function' || typeof lerp !== 'function' || typeof perlinNoise !== 'function' || typeof generateSeed !== 'function') {
             GM_log("Pack Filler Pro: perlin strategy dependencies (clamp, lerp, perlinNoise, generateSeed) missing. Cannot determine quantity.");
             return { quantity: 0, seed: null }; // Return zero quantity on dependency error
        }

        const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
        const minQty = config.lastMinQty;
        const maxQtyCfg = config.lastMaxQty; // Use different name to avoid conflict with MAX_QTY constant
        const scale = typeof config.patternScale === 'number' ? config.patternScale : 100; // Default scale
        const intensity = typeof config.patternIntensity === 'number' ? config.patternIntensity : 1.0; // Default intensity (0.0 to 1.0)
        const range = maxQtyCfg - minQty; // The range of possible quantities

        // Generate or parse seed (generateSeed is assumed available in this file's scope)
        const actualSeed = generateSeed(config.noiseSeed);

        // Ensure scale is at least 1 to avoid issues
        const safeScale = Math.max(1, scale);

        // Map index (0 to total-1) to a position in the noise space, influenced by scale.
        // Dividing by safeScale determines how 'zoomed in' the noise is.
        const noiseInput = index / safeScale;

        // Get noise value (typically -1 to 1) (perlinNoise is assumed available in this file's scope)
        const noiseValue = perlinNoise(noiseInput, actualSeed);

        // Map noise value (-1 to 1) to a quantity range (minQty to maxQtyCfg)
        // Normalize noise from [-1, 1] to [0, 1]
        const normalizedNoise = (noiseValue + 1) / 2; // Now 0 to 1

        // Interpolate between the midpoint and the quantity determined purely by noise, based on intensity.
        // Intensity controls how much the noise affects the final quantity.
        // If intensity is 1, quantity ranges fully from minQty to maxQtyCfg based on noise.
        // If intensity is 0, quantity is always the midpoint (minQty + range/2).
        // We interpolate between the midpoint and the quantity determined purely by noise.
        const midpoint = minQty + range / 2;
        const quantityFromNoise = minQty + normalizedNoise * range;
        let finalQuantityFloat = lerp(midpoint, quantityFromNoise, intensity);

        // Clamp the final quantity to the allowed range [0, MAX_QTY] and round to nearest integer.
        const finalQuantity = clamp(Math.round(finalQuantityFloat), 0, maxQty);

        // Return quantity and seed info for feedback
        return { quantity: finalQuantity, seed: actualSeed };
    },


    // Alternating strategy: Assigns minQty and maxQty alternately.
    // Assumes MAX_QTY from constants.js and clamp from domUtils.js are available.
    alternating: (config, index, total) => {
        // Assumes clamp from domUtils.js is available via @require
         if (typeof clamp !== 'function') {
              GM_log("Pack Filler Pro: alternating strategy dependencies (clamp) missing. Cannot determine quantity.");
              return 0;
         }
         const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
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
 * Assumes MainThreadFillStrategies (local), clamp (from domUtils.js), generateSeed (local), MAX_QTY are available.
 * @param {Array<HTMLInputElement>} inputsToFill - The array of input elements to calculate quantities for. Should be valid HTMLInputElements.
 * @param {object} config - The script's configuration object.
 * @returns {{quantities: number[], metadata: object, totalCopiesAdded: number}} An object containing the calculated quantities, any relevant metadata (e.g., seed used), and the total copies added.
 * @throws {Error} Throws an error if a critical function (like clamp or the selected strategy) is not found or input is invalid.
 */
function calculateQuantitiesMainThread(inputsToFill, config) {
    // Check critical dependencies
    if (typeof clamp !== 'function') {
         const errorMsg = "calculateQuantitiesMainThread failed: clamp function from domUtils.js not found.";
         GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
         throw new Error(errorMsg);
    }
     if (typeof MainThreadFillStrategies !== 'object') {
          const errorMsg = "calculateQuantitiesMainThread failed: MainThreadFillStrategies object not found.";
          GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
          throw new Error(errorMsg);
     }
     if (!Array.isArray(inputsToFill)) {
          const errorMsg = "calculateQuantitiesMainThread failed: inputsToFill is not a valid array.";
          GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, inputsToFill);
          throw new Error(errorMsg);
     }
      if (typeof config !== 'object' || config === null) {
          const errorMsg = "calculateQuantitiesMainThread failed: Invalid config object.";
          GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, config);
          throw new Error(errorMsg);
      }


    const quantities = [];
    let metadata = {};
    let currentTotal = 0;
    const maxTotalAmount = clamp(config.maxTotalAmount, 0, Infinity); // Max total can be very large or 0
    const totalPacksToFill = inputsToFill.length;

    const strategy = MainThreadFillStrategies[config.patternType];

    if (typeof strategy !== 'function') {
        const errorMsg = `calculateQuantitiesMainThread failed: Main thread strategy function for "${config.patternType}" not found.`;
        GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
        throw new Error(errorMsg);
    }

    // Special handling for Perlin to generate/use seed once for the batch
    let perlinSeed = null;
    if (config.patternType === 'perlin') {
         // Use the seed that the perlin strategy will use (either config.noiseSeed or random)
         // Call generateSeed once with the config's seed input to get the actual seed used.
         // Assumes generateSeed is available in this file's scope
          if (typeof generateSeed === 'function') {
             perlinSeed = generateSeed(config.noiseSeed);
             metadata.seedUsed = perlinSeed; // Store seed in metadata
          } else {
              GM_log("Pack Filler Pro: Perlin strategy requires generateSeed function, which was not found. Falling back to random seed.");
              // Fallback to random seed if function is missing
              metadata.seedUsed = Math.floor(Math.random() * 2**32);
          }
    }


    inputsToFill.forEach((input, index) => {
        // Basic validation for each input element in the array
        if (!(input instanceof HTMLInputElement)) {
            GM_log("Pack Filler Pro: calculateQuantitiesMainThread encountered invalid input element. Skipping.", input);
            quantities.push(0); // Push 0 for invalid elements
            return; // Skip to the next iteration
        }

        let qtyInfo;
        if (config.patternType === 'perlin' && typeof perlinNoise === 'function' && typeof generateSeed === 'function') {
             // Call Perlin strategy. Assumes perlinNoise and generateSeed are available.
             // Pass the pre-generated seed to the strategy.
             // The perlin strategy function now returns { quantity, seed }
             qtyInfo = MainThreadFillStrategies.perlin({ ...config, noiseSeed: perlinSeed }, index, totalPacksToFill);
             let qty = qtyInfo.quantity;

              // Apply max total limit manually on main thread
              if (maxTotalAmount > 0) {
                   const remaining = maxTotalAmount - currentTotal;
                   qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity and cap
              }
             quantities.push(qty);
             currentTotal += qty;

        } else if (config.patternType !== 'perlin' && typeof strategy === 'function') { // Handle other strategies if available
            // For other strategies, calculate quantity directly
             // Strategy functions are assumed to return just the quantity
             let qty = strategy(config, index, totalPacksToFill);

             // Ensure quantity is a number before clamping
             qty = typeof qty === 'number' && !isNaN(qty) ? qty : 0;

             // Apply max total limit manually on main thread
             if (maxTotalAmount > 0) {
                  const remaining = maxTotalAmount - currentTotal;
                  qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity and cap
             }
            quantities.push(qty);
            currentTotal += qty; // Add the quantity actually set to the total
        } else {
             // This else block should ideally not be reached if initial checks are thorough,
             // but as a fallback, push 0 and log if strategy or perlin dependencies are missing.
             GM_log(`Pack Filler Pro: calculateQuantitiesMainThread: Strategy "${config.patternType}" or its dependencies (perlinNoise, generateSeed) not fully available for input at index ${index}. Pushing 0.`, {patternType: config.patternType, strategyExists: typeof strategy === 'function', perlinDeps: typeof perlinNoise === 'function' && typeof generateSeed === 'function'});
             quantities.push(0);
             // currentTotal does not increase if quantity is 0
        }


         // If max total is reached, fill remaining quantities with 0 and stop
         if (maxTotalAmount > 0 && currentTotal >= maxTotalAmount) {
              GM_log(`Pack Filler Pro: Max Total Amount (${maxTotalAmount}) reached at index ${index}. Filling remaining with 0.`);
              for (let j = index + 1; j < totalPacksToFill; j++) {
                   quantities.push(0);
              }
              // Update totalCopiesAdded to be exactly maxTotalAmount if it was reached
              currentTotal = maxTotalAmount;
              break; // Exit the forEach loop
         }

    });

     // Final safety clamp for totalCopiesAdded
     if (maxTotalAmount > 0 && currentTotal > maxTotalAmount) {
          GM_log(`Pack Filler Pro: calculateQuantitiesMainThread: Correcting currentTotal (${currentTotal}) to maxTotalAmount (${maxTotalAmount}).`);
          currentTotal = maxTotalAmount;
     }


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

     // Check critical dependency
     if (typeof clamp !== 'function') {
          GM_log("Pack Filler Pro: calculateFillCount failed: clamp function from domUtils.js not found.");
          return 0; // Cannot calculate safely without clamp
     }


    // Use config object directly
    const { lastMode: mode, lastCount: count } = config;

    if (mode === 'unlimited') {
        return availableCount;
    } else {
        // Clamp count to available inputs, but not less than 0
        // Assumes clamp from domUtils.js is available via @require
        // count should be parsed as integer for modes other than unlimited
        const parsedCount = parseInt(count, 10) || 0;
        return clamp(parsedCount, 0, availableCount);
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
 * @param {boolean} [isAutoFill=false] - True if triggered by the auto-load process (not used in essential version).
 */
async function fillPacks(config, isAutoFill = false) { // Accept config here and make async
    GM_log(`Pack Filler Pro: fillPacks started (Auto-fill: ${isAutoFill}, Main Thread Only).`);

    // Check critical dependencies before starting core logic
     if (typeof getPackInputs !== 'function' || typeof validateFillConfig !== 'function' || typeof clearAllInputs !== 'function' ||
         typeof virtualUpdate !== 'function' || typeof generateFeedback !== 'function' || typeof SWAL_ALERT === 'undefined' || // SWAL_ALERT must be defined
         typeof SWAL_TOAST === 'undefined' || typeof calculateQuantitiesMainThread !== 'function' || typeof clamp !== 'function' ||
         typeof sanitize !== 'function' || typeof MAX_QTY === 'undefined' || typeof DEFAULT_CONFIG === 'undefined') {

          const errorMessage = "fillPacks critical dependencies missing. Aborting fill operation.";
          GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
           // Use fallback alert if SWAL_ALERT is missing, sanitize might also be missing
           const fallbackMsg = `Pack Filler Pro Error: ${errorMessage}. Check script installation or dependencies.`;
           // Attempt to use SWAL_ALERT if available, otherwise fallback to alert
           if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Fill Error', sanitize(errorMessage), 'error', config);
           else alert(fallbackMsg);
          throw new Error(errorMessage); // Abort the async function
     }


    // Use config object directly
    const { lastMode: mode, lastCount: count, lastClear: clear, fillEmptyOnly } = config;

    try {
        // 1. Validate relevant parts of config (quantities and pattern params)
        GM_log("Pack Filler Pro: fillPacks Step 1: Validating config.");
        // Assumes validateFillConfig from configManager.js is accessible and throws on critical error
        validateFillConfig(config);
        GM_log("Pack Filler Pro: fillPacks Step 2: Config validated successfully.");


        // 2. Get Inputs
        GM_log("Pack Filler Pro: fillPacks Step 3: Getting pack inputs.");
        // Assumes getPackInputs from domUtils.js is accessible and returns an array (possibly empty)
        const allInputs = getPackInputs();
        const availablePacks = Array.isArray(allInputs) ? allInputs.length : 0; // Ensure availablePacks is a number
        GM_log(`Pack Filler Pro: fillPacks Step 4: Found ${availablePacks} visible inputs.`);


        if (availablePacks === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 5: No visible pack inputs found.");
             // Pass config to SWAL_ALERT
             // isAutoFill is always false in this essential version
             if (!isAutoFill) SWAL_ALERT('Fill Packs', 'No visible pack inputs found on the page.', 'warning', config);
             GM_log("Fill operation aborted: No visible pack inputs found.");
             return; // Exit function if no inputs are found
        }

        // 3. Determine the set of inputs potentially targeted by mode/count
        GM_log("Pack Filler Pro: fillPacks Step 6: Determining targeted inputs.");
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
        const targetedCount = Array.isArray(potentialInputsToFill) ? potentialInputsToFill.length : 0; // Ensure targetedCount is a number
        GM_log(`Pack Filler Pro: fillPacks Step 7: Targeted ${targetedCount} inputs based on mode/count.`);


        if (targetedCount === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 8: No packs targeted.");
             // If packs were available but none targeted (e.g., count set to 0)
             const finalMessage = availablePacks > 0
                 ? `No packs targeted based on current mode (${mode}) and count (${count}).`
                 : 'No visible pack inputs found on the page.'; // Should have been caught earlier, but defensive

             // isAutoFill is always false in this essential version
             if (!isAutoFill) SWAL_ALERT('Fill Packs', finalMessage, 'info', config);
             GM_log(`Fill operation aborted: No packs targeted. Mode: ${mode}, Count: ${count}.`);
             return; // Exit function if no packs need filling
        }

        // 4. Apply 'Clear Before Fill' option (only for manual trigger)
        GM_log("Pack Filler Pro: fillPacks Step 9: Checking 'Clear Before Fill' option.");
        // isAutoFill is always false in this essential version
        if (clear && !isAutoFill) {
            GM_log("Pack Filler Pro: fillPacks Step 10: Clearing all inputs.");
             // Assumes clearAllInputs from domUtils.js is accessible and handles its own feedback/logging
             clearAllInputs(); // clearAllInputs has internal checks
             GM_log("Pack Filler Pro: fillPacks Step 11: Inputs cleared.");
        } else {
             GM_log("Pack Filler Pro: fillPacks Step 10: 'Clear Before Fill' not active or auto-fill.");
        }


        // 5. Apply the 'Fill Empty Only' filter
        GM_log("Pack Filler Pro: fillPacks Step 12: Applying 'Fill Empty Only' filter.");
        // Ensure potentialInputsToFill is an array before filtering
        const inputsToActuallyFill = (Array.isArray(potentialInputsToFill) && fillEmptyOnly)
            ? potentialInputsToFill.filter(el => {
                 // Check if el is a valid input element before accessing properties
                 if (!(el instanceof HTMLInputElement)) {
                     GM_log("Pack Filler Pro: fillPacks filter encountered non-input element. Skipping.", el);
                     return false; // Skip invalid elements
                 }
                 const value = parseInt(el.value, 10);
                 // Consider empty string or 0 as "empty"
                 return !el.value || isNaN(value) || value === 0;
              })
            : potentialInputsToFill; // If not fillEmptyOnly or not an array, use the potential list


        const filledCount = Array.isArray(inputsToActuallyFill) ? inputsToActuallyFill.length : 0; // Ensure filledCount is a number
        GM_log(`Pack Filler Pro: fillPacks Step 13: After filtering, ${filledCount} inputs will be filled.`);


        if (filledCount === 0) {
             GM_log("Pack Filler Pro: fillPacks Step 14: No packs needed filling after filter.");
             // If packs were targeted but none were empty (and Fill Empty Only is relevant)
             const finalMessage = (targetedCount > 0 && fillEmptyOnly)
                 ? `No empty packs found among the ${targetedCount} targeted packs.`
                 : (targetedCount > 0 && !fillEmptyOnly)
                     ? `All ${targetedCount} targeted packs already have a quantity, and 'Fill empty inputs only' is disabled.`
                     : `No packs matched criteria to fill.`; // Should ideally be caught earlier if targetedCount is 0

             // isAutoFill is always false in this essential version
             if (!isAutoFill) SWAL_ALERT('Fill Packs', finalMessage, 'info', config);
             GM_log(`Fill operation skipped: No packs needed filling. Targeted: ${targetedCount}, Filled: ${filledCount}`);
             return; // Exit function if no packs need filling
        }


        GM_log("Pack Filler Pro: fillPacks Step 15: Proceeding to quantity calculation (Main Thread).");

        let quantitiesToApply = [];
        let metadata = {}; // To store metadata like seed used (from main thread calculation)
        let totalCopiesAdded = 0; // Track total added after calculation and max total application

        // --- Core Filling Logic - All on Main Thread ---
        GM_log(`Pack Filler Pro: fillPacks Step 16: Calculating quantities on main thread using strategy: "${config.patternType}".`);
        // Assumes calculateQuantitiesMainThread is available in this file's scope and throws on critical error
        try {
            const calculationResult = calculateQuantitiesMainThread(inputsToActuallyFill, config);
            // Ensure calculationResult is valid before destructuring
            if (!calculationResult || !Array.isArray(calculationResult.quantities)) {
                 const errorMsg = "calculateQuantitiesMainThread returned invalid result.";
                 GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, calculationResult);
                 // isAutoFill is always false in this essential version
                 if (!isAutoFill) SWAL_ALERT('Fill Error', sanitize(errorMsg), 'error', config);
                 return; // Abort if calculation failed
            }
            quantitiesToApply = calculationResult.quantities;
            metadata = calculationResult.metadata || {}; // Default to empty object if null/undefined
            totalCopiesAdded = calculationResult.totalCopiesAdded || 0; // Default to 0 if null/undefined or not a number

            GM_log(`Pack Filler Pro: fillPacks Step 17: Main thread calculation complete. Generated ${quantitiesToApply.length} quantities. Final total: ${totalCopiesAdded}`);
            const calculationSource = "Main Thread"; // Source is always main thread in this version

            // --- Apply Quantities to DOM ---
            GM_log(`Pack Filler Pro: fillPacks Step 18: Applying quantities to DOM. Count: ${quantitiesToApply.length}`);
             // Assumes virtualUpdate function is available in scope
            if (quantitiesToApply.length > 0) {
                // Use the batch update function
                // Pass the original inputsToActuallyFill and the calculated quantities
                 virtualUpdate(inputsToActuallyFill, quantitiesToApply); // virtualUpdate has internal checks
                GM_log("Pack Filler Pro: fillPacks Step 19: Quantities applied via virtualUpdate.");
            } else { // quantitiesToApply.length === 0
                 GM_log("Pack Filler Pro: fillPacks Step 18a: No quantities generated to apply.");
                 // This scenario should ideally be caught earlier if calculationResult.quantities is empty
                 const msg = 'Calculation resulted in zero quantities to apply.';
                 // isAutoFill is always false in this essential version
                 if (!isAutoFill) SWAL_ALERT('Fill Packs', sanitize(msg), 'warning', config);
                 return; // Abort
            }

             // --- DETAILED FEEDBACK GENERATION (SweetAlert2 Modal/Toast) ---
             // Only show modal/toast for manual fills or if autofill resulted in actual fills
             GM_log("Pack Filler Pro: fillPacks Step 20: Generating feedback.");
             // Assumes generateFeedback and SWAL_TOAST, SWAL_ALERT, sanitize are available
             // Check if feedback is needed based on trigger and filled count
             // isAutoFill is always false in this essential version, so feedback is always shown if filledCount > 0
             if (filledCount > 0) {
                if (typeof generateFeedback === 'function') {
                     // Pass all relevant info including the final calculated total
                     generateFeedback(config, isAutoFill, calculationSource, targetedCount, availablePacks, filledCount, metadata, totalCopiesAdded);
                } else {
                     GM_log("Pack Filler Pro: generateFeedback function not found. Skipping feedback.");
                     // Fallback logging if feedback function is missing
                     const feedbackSummary = `Fill complete. Auto-fill: ${isAutoFill}, Source: ${calculationSource}, Targeted: ${targetedCount}/${availablePacks}, Filled: ${filledCount}, Total Added: ${totalCopiesAdded}.`;
                     GM_log(feedbackSummary);
                     // isAutoFill is always false in this essential version
                     if (!isAutoFill && typeof SWAL_TOAST === 'function') SWAL_TOAST(`Fill Complete: ${filledCount} packs filled.`, 'success', config);

                }
             } else {
                 // If filledCount is 0, feedback was already handled earlier.
                 GM_log("Pack Filler Pro: No packs filled, skipping feedback generation.");
             }
             GM_log("Pack Filler Pro: fillPacks finished.");

        } catch (calculationError) {
             // Catch errors specifically from the calculation or application steps
             GM_log(`Pack Filler Pro: fillPacks Calculation/Application Caught Error: ${calculationError.message}`, calculationError);
             // Pass config to SWAL_ALERT for user feedback, ensure sanitize is available
             if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') {
                 SWAL_ALERT('Fill Error', sanitize(calculationError.message), 'error', config);
             } else {
                 // Fallback alert if SWAL or sanitize is missing
                 alert(`Pack Filler Pro Error: ${calculationError.message}`);
             }
        }


     } catch (initialError) {
         // Catch errors from initial steps (validation, getting inputs)
         GM_log(`Pack Filler Pro: fillPacks Initial Step Caught Error: ${initialError.message}`, initialError);
         // Initial steps should have their own error handling / alerts, but this is a final fallback.
     }
 }

// --- Function: Fill Single Random Pack ---

/**
 * Selects one random visible pack input and fills it based on current settings.
 * Uses current config for quantity calculation on the main thread.
 * Provides user feedback via SweetAlert2 toast.
 * Assumes the following are available in scope:
 * getPackInputs, validateFillConfig, updateInput, SWAL_ALERT, SWAL_TOAST,
 * MainThreadFillStrategies, clamp (from domUtils.js), sanitize, MAX_QTY, generateSeed (local).
 * @param {object} config - The script's configuration object.
 */
async function fillRandomPackInput(config) { // Accept config here and make async
    GM_log("Pack Filler Pro: Attempting to fill 1 random pack (Main Thread Only).");

     // Check critical dependencies before starting
      if (typeof getPackInputs !== 'function' || typeof validateFillConfig !== 'function' || typeof updateInput !== 'function' ||
          typeof SWAL_ALERT === 'undefined' || typeof SWAL_TOAST === 'undefined' || typeof MainThreadFillStrategies === 'undefined' || // SWAL_ALERT, SWAL_TOAST, Strategies must be defined
          typeof clamp !== 'function' || typeof sanitize !== 'function' || typeof MAX_QTY === 'undefined') {

           const errorMessage = "fillRandomPackInput critical dependencies missing. Aborting.";
           GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
            const fallbackMsg = `Pack Filler Pro Error: ${errorMessage}. Check script installation or dependencies.`;
           // Attempt to use SWAL_ALERT if available, otherwise fallback to alert
           if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Fill Random Error', sanitize(errorMessage), 'error', config);
           else alert(fallbackMsg);
           return; // Abort the async function
      }


    try {
        // 1. Validate relevant parts of config (quantities)
        GM_log("Pack Filler Pro: fillRandomPackInput Step 1: Validating config.");
        validateFillConfig(config); // Assumes validateFillConfig throws on critical error
        GM_log("Pack Filler Pro: fillRandomPackInput Step 2: Config validated.");

        // 2. Get Inputs
        GM_log("Pack Filler Pro: fillRandomPackInput Step 3: Getting pack inputs.");
        const allInputs = getPackInputs(); // Assumes getPackInputs returns an array
        if (!Array.isArray(allInputs) || allInputs.length === 0) {
            if (typeof SWAL_ALERT === 'function') SWAL_ALERT('No Inputs', 'No visible pack inputs found to select from.', 'warning', config);
            GM_log("Fill random aborted: No visible pack inputs found.");
            return; // Exit if no inputs
        }
         GM_log(`Pack Filler Pro: fillRandomPackInput Step 4: Found ${allInputs.length} visible inputs.`);


        // 3. Select Random Input
        const randomIndex = Math.floor(Math.random() * allInputs.length);
        const targetInput = allInputs[randomIndex];

         // Check if the selected element is a valid input element
         if (!(targetInput instanceof HTMLInputElement)) {
             const errorMsg = `Selected random element at index ${randomIndex} is not a valid input. Aborting.`;
             GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, targetInput);
             if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', sanitize(errorMsg), 'error', config);
             return; // Abort if selected element is invalid
         }

        const packAlias = targetInput.dataset.alias || targetInput.dataset.set || `Input #${randomIndex + 1}`; // Get name for feedback

        // 4. Determine quantity for this single pack (Always Main Thread)
        let quantity = 0;
        let metadata = {}; // To store metadata like seed used

        const patternType = config.patternType;

        // Use Main Thread calculation
         let mainThreadStrategy = MainThreadFillStrategies[patternType]; // Use let because we might assign a fallback

         if (typeof mainThreadStrategy !== 'function') {
              // Fallback to random if the selected pattern strategy function is missing
              GM_log(`Pack Filler Pro: Main thread strategy "${patternType}" function not found. Falling back to random.`, {patternType: patternType});
              const fallbackStrategy = MainThreadFillStrategies.random;
              if (typeof fallbackStrategy !== 'function') {
                  const errorMsg = "Main thread fallback strategy (random) function not found. Cannot calculate quantity.";
                  GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                   if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', sanitize(errorMsg), 'error', config);
                  return; // Abort if random strategy is also missing
              }
              mainThreadStrategy = fallbackStrategy; // Assign the fallback strategy
         }

        const calculationSource = "Main Thread";
        GM_log(`Pack Filler Pro: Calculating quantity for random pack on main thread using strategy: "${mainThreadStrategy === MainThreadFillStrategies.random ? 'random (fallback)' : patternType}".`);

        // Calculate quantity. For Perlin, get seed here.
        if (patternType === 'perlin' && mainThreadStrategy === MainThreadFillStrategies.perlin) {
             // Assumes generateSeed is available in this file's scope
             const actualSeed = typeof generateSeed === 'function' ? generateSeed(config.noiseSeed) : config.noiseSeed; // Fallback if generateSeed is missing
             metadata.seedUsed = actualSeed;
             // Call Perlin strategy, passing the seed and faking total/index for a single pack (total 1, index 0)
             // The perlin strategy function now returns { quantity, seed }
             // Ensure perlinNoise and lerp are available for the strategy call
             if (typeof perlinNoise === 'function' && typeof lerp === 'function') {
                  const qtyResult = mainThreadStrategy({ ...config, noiseSeed: actualSeed }, 0, 1);
                  quantity = qtyResult.quantity; // Get quantity from result object
             } else {
                  const errorMsg = "Perlin strategy dependencies (perlinNoise, lerp) missing. Cannot calculate quantity.";
                  GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
                   if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Fill Random Error', sanitize(errorMsg), 'error', config);
                  return; // Abort
             }

        } else if (typeof mainThreadStrategy === 'function') { // Handle other strategies if available
            // Calculate quantity for other strategies
             // Strategy functions are assumed to return just the quantity
             quantity = mainThreadStrategy(config, 0, 1); // Calculate for index 0 of total 1
        } else {
             // Fallback if strategy is not available
              GM_log(`Pack Filler Pro: fillRandomPackInput: Strategy "${patternType}" or its fallback not available. Pushing 0.`);
              quantity = 0; // Default to 0 if strategy is missing
        }


         // Ensure quantity is a number before clamping and applying
         quantity = typeof quantity === 'number' && !isNaN(quantity) ? quantity : 0;

        // Clamp result according to main thread strategy rules
        // (MainThreadFillStrategies already handle clamping to min/max internally, but a final clamp is good practice)
         // Use clamp from domUtils
         const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY
         quantity = clamp(quantity, 0, maxQty); // Final clamp against absolute MAX_QTY


        // 5. Apply Quantity
         GM_log(`Pack Filler Pro: fillRandomPackInput Step 5: Applying quantity ${quantity} to input.`);
        updateInput(targetInput, quantity); // Use utility function (Assumes updateInput is available)


        // 6. Feedback
         GM_log("Pack Filler Pro: fillRandomPackInput Step 6: Generating feedback.");
         // Assumes SWAL_TOAST and sanitize are available
         let feedbackText = `Set "${sanitize(packAlias)}" to ${quantity} (via ${calculationSource})`;
          if (patternType === 'perlin' && metadata.seedUsed) {
              feedbackText += ` (Seed: ${metadata.seedUsed})`;
          }
         SWAL_TOAST(sanitize(feedbackText), 'success', config); // Sanitize feedback text
         GM_log(`Pack Filler Pro: Applied quantity ${quantity} to random pack: ${packAlias} (Source: ${calculationSource}).`);


    } catch (error) {
         GM_log(`Pack Filler Pro: fillRandomPackInput Caught Error: ${error.message}`, error);
         // Pass config to SWAL_ALERT for user feedback, ensure sanitize is available
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
 * @param {boolean} isAutoFill - True if triggered by auto-fill (always false in essential version).
 * @param {string} calculationSource - Describes where calculation happened (should always be "Main Thread" in this version).
 * @param {number} targetedCount - Number of packs targeted by mode/count.
 * @param {number} availableCount - Total number of visible packs.
 * @param {number} filledCount - Number of packs actually updated.
 * @param {object} metadata - Additional data from calculation (e.g., seed).
 * @param {number} totalCopiesAdded - The sum of quantities added in this operation.
 */
function generateFeedback(config, isAutoFill, calculationSource, targetedCount, availableCount, filledCount, metadata, totalCopiesAdded) {
     // Check critical dependencies
     if (typeof SWAL_ALERT === 'undefined' || typeof SWAL_TOAST === 'undefined' || typeof sanitize === 'function' || typeof MainThreadFillStrategies === 'undefined') {
          GM_log("Pack Filler Pro: generateFeedback critical dependencies missing (SWAL, sanitize, or strategies). Skipping feedback.");
          return; // Cannot generate feedback without these
     }


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
        const intensityDisplay = typeof config.patternIntensity === 'number' ? (config.patternIntensity * 100).toFixed(0) : 'N/A'; // Display intensity as 0-100
        feedbackQuantityDesc = `Pattern applied with scale ${config.patternScale}, intensity ${intensityDisplay}%.`;
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


    // isAutoFill is always false in this essential version
    const clearStatus = clear && !isAutoFill ? "<br>- Inputs Cleared First" : "";
    const autoFillStatus = isAutoFill ? "<br>- Triggered by Auto-Fill" : ""; // This will never show in essential version
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


     // isAutoFill is always false in this essential version, so always use modal if filledCount > 0
     if (filledCount > 0) {
         SWAL_ALERT('Fill Summary', sanitizedSummaryHtml, 'success', config); // Use sanitized HTML
     } else {
          // If filledCount is 0, feedback was already handled earlier.
          GM_log("Pack Filler Pro: No packs filled, skipping feedback display.");
     }
}


/* --- Performance Optimization: Virtual DOM Batch Update --- */
/**
 * Updates the value of multiple input elements in a batch to minimize DOM reflows.
 * Iterates through the provided inputs and quantities, calling updateInput for each.
 * Assumes updateInput from domUtils.js and GM_log are available.
 * @param {Array<HTMLInputElement>} inputs - The array of input elements to update. Should contain valid HTMLInputElements.
 * @param {Array<number>} quantities - The array of new quantities corresponding to the inputs.
 */
function virtualUpdate(inputs, quantities) {
    // Check critical dependencies
    if (typeof updateInput !== 'function') {
         GM_log("Pack Filler Pro: virtualUpdate called but updateInput function not found. Aborting.");
         return; // Abort if updateInput is missing
    }

    // Basic validation of inputs and quantities arrays
    if (!Array.isArray(inputs) || inputs.length === 0 || !Array.isArray(quantities) || inputs.length !== quantities.length) {
        GM_log("Pack Filler Pro: virtualUpdate called with invalid inputs or quantities. Aborting.", {inputs: inputs, quantities: quantities});
        return; // Abort if inputs/quantities are invalid
    }

    // Directly update input values and dispatch events using the updateInput helper.
    inputs.forEach((input, i) => {
         // Check if the current item in the array is a valid input element
         if (input instanceof HTMLInputElement) {
            updateInput(input, quantities[i]); // Use updateInput from domUtils
         } else {
             GM_log(`Pack Filler Pro: virtualUpdate encountered invalid element at index ${i}. Skipping.`, input);
         }
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
// - MainThreadFillStrategies (object containing the strategy functions)

// Note: chooseQuantity, lerp, perlinNoise, generateSeed
// are internal helpers/variables and are not explicitly exported,
// but are accessible within this file's scope.
