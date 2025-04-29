// This file contains the main logic for calculating and applying quantities to inputs.
// It uses constants and DOM helper functions.
// Note: This module now accepts the 'config' object as a parameter where needed.
// Includes seeded randomness and a simple noise-like quantity generation.

// It assumes 'MAX_QTY', 'getPackInputs', 'clamp', 'updateInput',
// 'clearAllInputs', 'SWAL_ALERT', 'SWAL_TOAST', and 'updateConfigFromUI'
// (or a mechanism to get current UI state) are accessible.

/* --- Seeded Randomness (Simple LCG) --- */
// A simple Linear Congruential Generator for seeded random numbers.
// Not cryptographically secure, but sufficient for generating reproducible patterns.
let currentSeed = 1; // Default seed

function setSeed(seed) {
    // Use a simple hashing to convert string seeds to numbers
    let numericSeed = 0;
    if (typeof seed === 'string' && seed.length > 0) {
        for (let i = 0; i < seed.length; i++) {
            numericSeed = (numericSeed << 5) - numericSeed + seed.charCodeAt(i);
            numericSeed = numericSeed & numericSeed; // Convert to 32bit integer
        }
    } else if (typeof seed === 'number' && !isNaN(seed)) {
        numericSeed = seed;
    } else {
        numericSeed = new Date().getTime(); // Use current time if seed is invalid or empty
    }
    currentSeed = numericSeed % 2147483647; // Keep seed within a reasonable range
    if (currentSeed <= 0) currentSeed += 2147483646;
     GM_log(`Pack Filler Pro: Seed set to ${seed} (Numeric: ${currentSeed})`); // Debugging log
}

function seededRandom() {
    // LCG parameters (Numerical Recipes)
    const a = 1664525;
    const c = 1013904223;
    const m = 2**32; // Using 2^32 for modulus

    currentSeed = (a * currentSeed + c) % m;
    return currentSeed / m; // Return a value between 0 (inclusive) and 1 (exclusive)
}


/* --- Core Logic --- */
 /**
  * Determines how many packs to target based on mode and available inputs.
  * @param {object} config - The script's configuration object.
  * @param {number} availablePackCount - The total number of visible pack inputs.
  * @returns {number} The calculated number of packs to fill.
  */
 function calculateFillCount(config, availablePackCount) { // Accept config here
     const mode = config.lastMode;
     const requestedCount = config.lastCount;
     const count = parseInt(requestedCount, 10) || 0;
     switch (mode) {
         case 'fixed':
         case 'max':
              return clamp(count, 0, availablePackCount);
         case 'unlimited':
              return availablePackCount;
         default:
              return 0;
     }
 }

 /**
  * Determines the quantity for a single pack based on mode, settings, and index.
  * Incorporates seeded randomness and simple noise.
  * @param {object} config - The script's configuration object.
  * @param {number} index - The index of the current pack input being filled (0-based).
  * @param {number} totalInputsToFill - The total number of inputs being filled in this operation.
  * @returns {number} The calculated quantity for a single pack.
  */
 function chooseQuantity(config, index, totalInputsToFill) { // Accept config, index, totalInputsToFill
     const mode = config.lastMode;
     const fixedQty = config.lastFixedQty;
     const minQty = config.lastMinQty;
     const maxQty = config.lastMaxQty;

     const fQty = parseInt(fixedQty, 10) || 0;
     const mnQty = parseInt(minQty, 10) || 0; // Allow min 0
     const mxQty = parseInt(maxQty, 10) || 0; // Allow min 0

     let baseQty = 0;

     switch (mode) {
         case 'fixed':
         case 'unlimited':
              baseQty = clamp(fQty, 0, MAX_QTY);
              // For fixed/unlimited, we can still apply a subtle noise based on index
              // This makes quantities slightly vary even if the base is fixed
              const noiseFactor = (seededRandom() - 0.5) * 2; // Random value between -1 and 1
              // Adjust baseQty by a small percentage based on noise and MAX_QTY
              const noiseAdjustment = Math.floor(noiseFactor * (MAX_QTY * 0.05)); // Up to 5% of MAX_QTY adjustment
              baseQty = clamp(baseQty + noiseAdjustment, 0, MAX_QTY);
              break;
         case 'max':
              const min = Math.min(mnQty, mxQty);
              const max = Math.max(mnQty, mxQty);
              const clampedMin = clamp(min, 0, MAX_QTY);
              const clampedMax = clamp(max, 0, MAX_QTY);

              if (clampedMin > clampedMax) return 0; // Should not happen with clamping/swapping

              // Generate a random quantity within the specified range using seeded random
              baseQty = Math.floor(seededRandom() * (clampedMax - clampedMin + 1)) + clampedMin;

              // Optional: Add a more pronounced noise/pattern effect in random mode
              // Example: Simple sinusoidal pattern based on index
              // const patternFactor = Math.sin((index / totalInputsToFill) * Math.PI * 2); // Value between -1 and 1
              // const patternAdjustment = Math.floor(patternFactor * (clampedMax - clampedMin) * 0.1); // Adjust by up to 10% of range
              // baseQty = clamp(baseQty + patternAdjustment, clampedMin, clampedMax); // Clamp within the original range

              break;
         default:
              return 0;
     }

     return baseQty;
 }

// This function is primarily used internally now when Max Total is NOT active in Random mode.
// The logic for Max Total in Random mode is now handled directly in fillPacks.
function distribute(n, total) {
    if (n <= 0 || total <= 0 || isNaN(n) || isNaN(total)) return Array(n).fill(0);

    let quantities = [];
    const base = Math.floor(total / n);
    let remainder = total % n;

    for (let i = 0; i < n; i++) {
         quantities.push(base);
    }

    // Randomly distribute the remainder using seeded random
    let indices = Array.from({length: n}, (_, i) => i); // Create an array of indices
    // Shuffle the indices using seeded random
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]]; // Swap
    }

    for (let i = 0; i < remainder; i++) {
        quantities[indices[i]]++;
    }

    // Clamp individual quantities to MAX_QTY
    for (let i = 0; i < n; i++) {
        quantities[i] = clamp(quantities[i], 0, MAX_QTY);
    }

    return quantities;
}


/**
 * Fills pack inputs based on current settings.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isAutoFill - True if triggered by the auto-load process.
 */
function fillPacks(config, isAutoFill = false) { // Accept config here
    GM_log("Pack Filler Pro: fillPacks function started."); // Debugging log
    // Read current values from UI inputs before filling (only for manual trigger)
    if (!isAutoFill) {
        // Assumes updateConfigFromUI is available to sync UI state to config
        updateConfigFromUI(config); // Pass config
        // Debounced save handled by input/change listeners in UI Events module
    }

    // Use config object directly (assumes 'config' is accessible)
    const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty, lastClear: clear, maxTotalAmount, fillEmptyOnly, noiseSeed } = config;

    // Set the seed for reproducible randomness
    setSeed(noiseSeed); // Use the seed from the config

    const inputs = getPackInputs(); // Assumes getPackInputs is accessible
    const availablePacks = inputs.length;

    if (availablePacks === 0) {
         if (!isAutoFill) SWAL_ALERT('Fill Packs', 'No visible pack inputs found on the page.', 'warning', config); // Pass config to SWAL
         GM_log("Fill operation aborted: No visible pack inputs found.");
         return;
    }

    // Determine the set of inputs potentially targeted by mode/count
    let potentialInputsToFill;
     if (mode === 'unlimited') {
          potentialInputsToFill = inputs; // All visible
     } else {
           const fillCount = calculateFillCount(config, availablePacks); // Pass config
          potentialInputsToFill = inputs.slice(0, fillCount);
     }
    const targetedCount = potentialInputsToFill.length;


    if (targetedCount === 0) {
         if (!isAutoFill) SWAL_ALERT('Fill Packs', `No packs targeted based on current mode (${mode}) and count (${count}).`, 'info', config); // Pass config to SWAL
         GM_log(`Pack Filler Pro: Fill operation aborted: No packs targeted. Mode: ${mode}, Count: ${count}.`);
         return;
    }

    // Apply 'Clear Before Fill' option (only for manual trigger)
    if (clear && !isAutoFill) {
        clearAllInputs(); // Assumes clearAllInputs is accessible
    }

    // Apply the 'Fill Empty Only' filter
    const inputsToActuallyFill = fillEmptyOnly
        ? potentialInputsToFill.filter(el => !el.value || parseInt(el.value, 10) === 0)
        : potentialInputsToFill;

    const filledCount = inputsToActuallyFill.length;


    if (filledCount === 0 && targetedCount > 0) {
         // If packs were targeted but none were empty (and Fill Empty Only is relevant)
         const message = fillEmptyOnly
             ? `No empty packs found among the ${targetedCount} targeted.`
             : `All ${targetedCount} targeted packs already have a quantity.`;
         if (!isAutoFill) SWAL_ALERT('Fill Packs', message, 'info', config); // Pass config to SWAL
         GM_log(`Pack Filler Pro: Fill operation skipped: No packs needed filling. Targeted: ${targetedCount}, Filled: ${filledCount}`);
         return;
    } else if (filledCount === 0 && targetedCount === 0) {
         // This case is already handled above, but defensive check
         if (!isAutoFill) SWAL_ALERT('Fill Packs', `No packs matched criteria to fill.`, 'info', config); // Pass config to SWAL
          GM_log(`Pack Filler Pro: Fill operation aborted: No packs matched criteria.`);
         return;
    }


    let totalCopiesAdded = 0;
    const useMaxTotal = maxTotalAmount > 0;
    let currentTotal = 0; // Track total added in this fill operation
    let maxTotalHit = false;

    // --- Core Filling Logic ---
    // Iterate through the inputs that should actually be filled
    inputsToActuallyFill.forEach((input, index) => { // Added index here
        let qty;

        // Determine quantity using the updated chooseQuantity function
        qty = chooseQuantity(config, index, inputsToActuallyFill.length); // Pass config, index, and total inputs being filled

        // Apply Max Total cap if active
        if (useMaxTotal) {
            const remaining = maxTotalAmount - currentTotal;
            if (currentTotal + qty > maxTotalAmount) {
                qty = Math.max(0, remaining); // Set quantity to whatever is left, or 0
                maxTotalHit = true; // Mark that the total limit was hit
            }
        }

        // Update the input with the determined quantity
        updateInput(input, qty); // Assumes updateInput is accessible
        currentTotal += qty; // Add the quantity actually set to the total
    });


     // --- DETAILED FEEDBACK GENERATION (SweetAlert2 Modal/Toast) ---
     // Only show modal/toast for manual fills or if autofill resulted in actual fills
     if (!isAutoFill || (isAutoFill && filledCount > 0)) {

         let feedbackModeDesc = "";
         let feedbackQuantityDesc = "";

         switch (mode) {
             case 'fixed':
                 feedbackModeDesc = `Fixed Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                 feedbackQuantityDesc = `${fixedQty} copies per pack (with subtle noise).`;
                 break;
             case 'max':
                  feedbackModeDesc = `Random Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                  feedbackQuantityDesc = `Random copies (${minQty}-${maxQty}) per pack.`;
                  if (useMaxTotal) {
                       feedbackQuantityDesc += ` Max Total Limit: ${maxTotalAmount}.`;
                  }
                  break;
             case 'unlimited':
                 feedbackModeDesc = `All Visible Packs Mode`;
                 feedbackQuantityDesc = `${fixedQty} copies per pack (with subtle noise).`;
                 break;
             default:
                 feedbackModeDesc = `Mode: ${mode}`;
                 feedbackQuantityDesc = `Quantity chosen per pack.`;
         }

         const clearStatus = clear && !isAutoFill ? "<br>- Inputs Cleared First" : "";
         const autoFillStatus = isAutoFill ? "<br>- Triggered by Auto-Fill" : "";
         const emptyOnlyStatus = fillEmptyOnly ? "<br>- Only Empty Inputs Filled" : "";
         const maxTotalStatus = useMaxTotal && maxTotalHit ? `<br>- Max Total Limit (${maxTotalAmount}) Reached` : '';
         const seedStatus = noiseSeed ? `<br>- Using Seed: "${noiseSeed}"` : '';


         const averagePerFilled = filledCount > 0 ? (currentTotal / filledCount).toFixed(2) : 'N/A';

         let summaryHtml = `
              <p><strong>Operation Details:</strong>${clearStatus}${autoFillStatus}${emptyOnlyStatus}${maxTotalStatus}${seedStatus}</p>
              <p><strong>Fill Mode:</strong> ${feedbackModeDesc}</p>
              <p><strong>Targeted Packs:</strong> ${targetedCount} / ${availablePacks} visible</p>
              <p><strong>Packs Actually Filled:</strong> ${filledCount}</p>
              <p><strong>Quantity Rule:</strong> ${feedbackQuantityDesc}</p>
              <p><strong>Total Copies Added:</strong> ${currentTotal}</p>
              <p><strong>Average Copies per Filled Pack:</strong> ${averagePerFilled}</p>
          `;

          GM_log(`Pack Filler Pro: Fill complete. ${summaryHtml.replace(/<br>- /g, '; ').replace(/<.*?>/g, '').replace(/\n/g, ' ')}`);


          if (isAutoFill) {
              SWAL_TOAST(`Auto-filled ${filledCount} packs (Total: ${currentTotal})`, 'success', config); // Pass config to SWAL
          } else {
              SWAL_ALERT('Fill Summary', summaryHtml, 'success', config); // Pass config to SWAL
          }
     }
     GM_log("Pack Filler Pro: fillPacks function finished."); // Debugging log
 }

// The functions calculateFillCount, chooseQuantity, setSeed, seededRandom, and fillPacks are made available
// to the main script's scope via @require.
