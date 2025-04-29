// This file contains the main logic for calculating and applying quantities to inputs.
// It uses constants and DOM helper functions.
// Note: This module now accepts the 'config' object as a parameter where needed.

// It assumes 'MAX_QTY', 'getPackInputs', 'clamp', 'updateInput',
// 'clearAllInputs', 'SWAL_ALERT', 'SWAL_TOAST', 'updateConfigFromUI',
// and the pattern worker (patternWorker) are accessible.

/* --- Pattern Strategies --- */
// Basic Perlin Noise implementation (simplified for demonstration)
// A more robust implementation might be needed for better noise distribution.
function perlinNoise(x, seed) {
    // Simple deterministic hash for seeding
    const hash = (n) => {
        let i = (n * 0x1357) ^ seed;
        return (i * i * 0x8295) >>> 0;
    };

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const grad = (hash, x) => {
        const h = hash & 15;
        const grad = 1 + (h & 7);
        if (h & 8) return -grad * x;
        return grad * x;
    };

    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const t = x - x0;
    const t_faded = fade(t);

    const hash0 = hash(x0);
    const hash1 = hash(x1);

    const grad0 = grad(hash0, t);
    const grad1 = grad(hash1, t - 1);

    return lerp(grad0, grad1, t_faded);
}


// New pattern strategies
const FillStrategies = {
    // Random strategy (uses existing chooseQuantity logic)
    random: (config, index, total) => chooseQuantity(config),

    // Perlin Noise based strategy
    perlin: (config, index, total) => {
        const seed = config.noiseSeed === '' ? Date.now() : parseInt(config.noiseSeed, 10);
        const scale = config.patternScale || 100;
        const intensity = config.patternIntensity || 1.0;

        // Normalize index to a value between 0 and scale for noise function
        const noiseInput = (index / total) * scale;

        // Get noise value (typically between -1 and 1)
        const noiseValue = perlinNoise(noiseInput, seed);

        // Map noise value to a quantity range (e.g., 0 to MAX_QTY)
        // Adjust range based on intensity
        const minQty = config.lastMinQty; // Use min/max from config for bounds
        const maxQty = config.lastMaxQty;
        const range = maxQty - minQty;

        // Scale noise value to the desired range and apply intensity
        const scaledNoise = noiseValue * (range / 2) * intensity; // Scale to half the range, apply intensity

        // Shift the scaled noise to be centered around the midpoint of the range
        const midpoint = minQty + range / 2;
        let quantity = midpoint + scaledNoise;

        // Clamp the final quantity to the min/max range and then to 0/MAX_QTY
        quantity = clamp(quantity, minQty, maxQty);
        quantity = clamp(Math.round(quantity), 0, MAX_QTY); // Round to integer

        return quantity;
    },

    // Gradient strategy
    gradient: (config, index, total) => {
        const intensity = config.patternIntensity || 1.0;
        const minQty = config.lastMinQty;
        const maxQty = config.lastMaxQty;
        const range = maxQty - minQty;

        // Calculate base quantity based on position in the list
        const baseQty = minQty + (index / (total - 1)) * range; // Linear gradient from min to max

        // Apply intensity (blends between minQty and the calculated gradient value)
        let quantity = minQty + (baseQty - minQty) * intensity;


        // Clamp and round
        quantity = clamp(quantity, minQty, maxQty);
        quantity = clamp(Math.round(quantity), 0, MAX_QTY);

        return quantity;
    },

    // Alternating strategy
    alternating: (config, index, total) => {
         const minQty = config.lastMinQty;
         const maxQty = config.lastMaxQty;
         // Simple alternating between min and max
         return index % 2 === 0 ? clamp(minQty, 0, MAX_QTY) : clamp(maxQty, 0, MAX_QTY);
    }
};

// Strategy selector
function getFillStrategy(config) {
    switch (config.patternType) {
        case 'perlin':
            return FillStrategies.perlin;
        case 'gradient':
            return FillStrategies.gradient;
        case 'alternating':
            return FillStrategies.alternating;
        case 'random': // Fallback to random if patternType is 'random' or unknown
        default:
            return FillStrategies.random;
    }
}

/* --- Performance Optimization: Virtual DOM Batch Update --- */
/**
 * Updates the value of multiple input elements in a batch to minimize DOM reflows.
 * @param {Array<HTMLInputElement>} inputs - The array of input elements to update.
 * @param {Array<number>} quantities - The array of new quantities corresponding to the inputs.
 */
function virtualUpdate(inputs, quantities) {
    if (!inputs || inputs.length === 0 || !quantities || inputs.length !== quantities.length) {
        GM_log("Pack Filler Pro: virtualUpdate called with invalid inputs or quantities.");
        return;
    }

    // Find the common parent of the inputs
    // Assuming all inputs share the same direct parent for simplicity
    const parent = inputs[0]?.parentNode;
    if (!parent) {
        GM_log("Pack Filler Pro: virtualUpdate could not find a common parent for inputs.");
        // Fallback to individual updates if batch update fails
        inputs.forEach((input, i) => updateInput(input, quantities[i]));
        return;
    }

    // Create a DocumentFragment to build the new DOM structure offline
    const fragment = document.createDocumentFragment();

    // Iterate through the *original* inputs to maintain their order and attributes
    // Create clones, update their values, and append to the fragment
    inputs.forEach((input, i) => {
        const clone = input.cloneNode(true); // Clone the input element
        const valueStr = String(clamp(quantities[i], 0, MAX_QTY)); // Clamp and convert to string
        if (clone.value !== valueStr) {
             clone.value = valueStr;
             // While updating detached elements, dispatching events here might not
             // be effective for frameworks. Events will be dispatched after re-attaching
             // or the framework might pick up changes via MutationObserver if configured.
             // For now, we rely on setting the value directly.
        }
        fragment.appendChild(clone);
    });

    // Replace the original parent's children with the new fragment in a single DOM operation
    // This triggers only one major reflow/repaint instead of one per input.
    // Note: This replaces ALL children of the parent. Ensure the parent only contains the inputs.
    // If the parent contains other elements, a more complex approach is needed (e.g., replacing inputs individually but detaching/reattaching the parent).
    // For the current structure (.pack-list > .pack > input), we need to replace the parent of the inputs, which is the '.pack' div.
    // Let's refine this to replace the parent .pack divs.

    const packContainers = inputs.map(input => input.closest('.pack')).filter(Boolean); // Get parent .pack divs
     if (packContainers.length !== inputs.length) {
          GM_log("Pack Filler Pro: virtualUpdate could not find .pack containers for all inputs. Falling back to individual updates.");
          inputs.forEach((input, i) => updateInput(input, quantities[i]));
          return;
     }

     const parentOfPacks = packContainers[0]?.parentNode; // Get the parent of the .pack divs (likely .pack-list)
     if (!parentOfPacks) {
         GM_log("Pack Filler Pro: virtualUpdate could not find the parent of .pack containers. Falling back to individual updates.");
         inputs.forEach((input, i) => updateInput(input, quantities[i]));
         return;
     }

     // Create a map of original .pack containers for easy lookup
     const originalPackMap = new Map(packContainers.map(container => [container, container.outerHTML]));

     const tempDiv = document.createElement('div');
     // Reconstruct the HTML for the relevant packs with updated input values
     inputs.forEach((input, i) => {
         const originalPack = inputs[i].closest('.pack');
         if (originalPack) {
             let packHtml = originalPack.outerHTML;
             // Use a simple string replacement for the input value within the HTML string
             // This is fragile if the input structure changes, but avoids complex DOM manipulation
             const inputRegex = new RegExp(`(<input[^>]*id="${input.id}"[^>]*value=")[^"]*(".*?>)`);
             packHtml = packHtml.replace(inputRegex, `$1${String(quantities[i])}$2`);
             tempDiv.innerHTML += packHtml; // Build the new HTML structure
         }
     });

     // Replace the original pack containers with the new ones from the temp div
     // This is still not a single DOM operation for replacing all children,
     // but it avoids modifying the DOM tree structure repeatedly.
     // A true batch update would involve detaching the parentOfPacks, updating children, and reattaching.
     // Let's stick to replacing the parentOfPacks's innerHTML for a simpler batch update.

     // Store original non-pack elements if any, or assume parentOfPacks only contains .pack divs
     // Given the typical structure, assuming .pack-list only contains .pack divs is safer.
     parentOfPacks.innerHTML = tempDiv.innerHTML; // Replace content in one go

     // After replacing innerHTML, re-get the updated inputs to dispatch events
     const updatedInputs = getPackInputs().filter(input => inputs.some(originalInput => originalInput.id === input.id));

     // Dispatch events on the newly created inputs
     updatedInputs.forEach(input => {
         input.dispatchEvent(new Event('input', { bubbles: true }));
         input.dispatchEvent(new Event('change', { bubbles: true }));
     });

     GM_log(`Pack Filler Pro: Applied batch DOM update for ${inputs.length} inputs.`);
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
  * Determines the quantity for a single pack based on mode and settings.
  * This function is now primarily used for the 'fixed' and 'random' modes
  * when no pattern is selected. Pattern logic is handled in fillPacks.
  * @param {object} config - The script's configuration object.
  * @returns {number} The calculated quantity for a single pack.
  */
 function chooseQuantity(config) { // Accept config here
     const mode = config.lastMode;
     const fixedQty = config.lastFixedQty;
     const minQty = config.lastMinQty;
     const maxQty = config.lastMaxQty;

     const fQty = parseInt(fixedQty, 10) || 0;
     const mnQty = parseInt(minQty, 10) || 0; // Allow min 0
     const mxQty = parseInt(maxQty, 10) || 0; // Allow min 0

     switch (mode) {
         case 'fixed':
         case 'unlimited': // Unlimited mode still uses fixed quantity
              return clamp(fQty, 0, MAX_QTY);
         case 'max': // Random range mode
              const min = Math.min(mnQty, mxQty);
              const max = Math.max(mnQty, mxQty);
              const clampedMin = clamp(min, 0, MAX_QTY);
              const clampedMax = clamp(max, 0, MAX_QTY);

              if (clampedMin > clampedMax) return 0; // Should not happen with clamping/swapping, but safe check

              return Math.floor(Math.random() * (clampedMax - clampedMin + 1)) + clampedMin;
         default:
              return 0;
     }
 }

// This function is primarily used internally now when Max Total is NOT active in Random mode.
// The logic for Max Total in Random mode is now handled directly in fillPacks.
// This function might become less relevant with pattern strategies.
function distribute(n, total) {
    if (n <= 0 || total <= 0 || isNaN(n) || isNaN(total)) return Array(n).fill(0);

    let quantities = [];
    const base = Math.floor(total / n);
    let remainder = total % n;

    for (let i = 0; i < n; i++) {
         quantities.push(base);
    }

    // Randomly distribute the remainder
    let indices = Array.from({length: n}, (_, i) => i); // Create an array of indices
    // Shuffle the indices
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
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
 * Now incorporates pattern strategies and batch DOM updates.
 * @param {object} config - The script's configuration object.
 * @param {boolean} isAutoFill - True if triggered by the auto-load process.
 */
async function fillPacks(config, isAutoFill = false) { // Accept config here and make async
    // Read current values from UI inputs before filling (only for manual trigger)
    // This is now handled by the event listener calling updateConfigFromUI before fillPacks
    // if (!isAutoFill) {
    //     updateConfigFromUI(config); // Pass config
    // }

    // Use config object directly
    const { lastMode: mode, lastCount: count, lastFixedQty: fixedQty, lastMinQty: minQty, lastMaxQty: maxQty, lastClear: clear, maxTotalAmount, fillEmptyOnly, patternType } = config;

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
         GM_log(`Fill operation aborted: No packs targeted. Mode: ${mode}, Count: ${count}.`);
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
         GM_log(`Fill operation skipped: No packs needed filling. Targeted: ${targetedCount}, Filled: ${filledCount}`);
         return;
    } else if (filledCount === 0 && targetedCount === 0) {
         // This case is already handled above, but defensive check
         if (!isAutoFill) SWAL_ALERT('Fill Packs', `No packs matched criteria to fill.`, 'info', config); // Pass config to SWAL
          GM_log(`Fill operation aborted: No packs matched criteria.`);
         return;
    }


    let quantitiesToApply = [];
    const useMaxTotal = maxTotalAmount > 0;
    let currentTotal = 0; // Track total added in this fill operation
    let maxTotalHit = false;

    // --- Core Filling Logic ---
    // Determine quantities based on pattern or mode
    if (patternType && patternType !== 'random') {
         // Use pattern strategy (potentially offloaded to worker)
         const strategy = getFillStrategy(config);
         const totalPacksToFill = inputsToActuallyFill.length;

         // Check if we should use the worker for heavy patterns (like Perlin)
         if (patternType === 'perlin' && typeof patternWorker !== 'undefined') {
             GM_log("Pack Filler Pro: Using Web Worker for Perlin noise calculation.");
             // Offload heavy computation to the worker
             quantitiesToApply = await new Promise((resolve, reject) => {
                 patternWorker.onmessage = (e) => {
                     resolve(e.data);
                 };
                 patternWorker.onerror = (error) => {
                     GM_log("Pack Filler Pro: Web Worker error:", error);
                     reject(error);
                 };
                 // Post message to worker with necessary data
                 patternWorker.postMessage({
                     strategy: patternType,
                     count: totalPacksToFill,
                     config: { // Pass relevant config for the worker
                          noiseSeed: config.noiseSeed,
                          patternScale: config.patternScale,
                          patternIntensity: config.patternIntensity,
                          lastMinQty: config.lastMinQty,
                          lastMaxQty: config.lastMaxQty,
                          maxTotalAmount: config.maxTotalAmount,
                          fillEmptyOnly: config.fillEmptyOnly // Worker needs to know if fillEmptyOnly was active
                     }
                 });
             }).catch(error => {
                  GM_log("Pack Filler Pro: Error receiving data from worker, falling back to main thread calculation.", error);
                  // Fallback to main thread calculation if worker fails
                  return inputsToActuallyFill.map((input, index) => {
                      let qty = strategy(config, index, totalPacksToFill);
                       // Apply max total limit on main thread if worker didn't
                       if (useMaxTotal) {
                            const remaining = maxTotalAmount - currentTotal;
                            qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity
                            if (currentTotal + qty >= maxTotalAmount) maxTotalHit = true;
                       }
                       currentTotal += qty;
                       return qty;
                  });
             });

             // If worker returned quantities, calculate total copies added
             if (quantitiesToApply.length > 0) {
                  currentTotal = quantitiesToApply.reduce((sum, qty) => sum + qty, 0);
                  if (useMaxTotal && currentTotal >= maxTotalAmount) maxTotalHit = true;
             }


         } else {
             // Calculate pattern quantities on the main thread
             GM_log(`Pack Filler Pro: Calculating pattern (${patternType}) on main thread.`);
             inputsToActuallyFill.forEach((input, index) => {
                 let qty = strategy(config, index, totalPacksToFill);

                 // Apply Max Total Limit if active
                 if (useMaxTotal) {
                     const remaining = maxTotalAmount - currentTotal;
                     qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity
                     if (currentTotal + qty >= maxTotalAmount) maxTotalHit = true;
                 }
                 quantitiesToApply.push(qty);
                 currentTotal += qty;
             });
         }

    } else {
         // Use existing mode logic (fixed, random range, unlimited fixed)
         GM_log(`Pack Filler Pro: Using standard fill mode (${mode}).`);
         inputsToActuallyFill.forEach(input => {
             let qty = chooseQuantity(config);

             // Apply Max Total Limit if active (only relevant for fixed/unlimited fixed now)
             if (useMaxTotal) {
                 const remaining = maxTotalAmount - currentTotal;
                 qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity
                 if (currentTotal + qty >= maxTotalAmount) maxTotalHit = true;
             }
             quantitiesToApply.push(qty);
             currentTotal += qty;
         });
    }

    // --- Apply Quantities to DOM ---
    if (quantitiesToApply.length > 0) {
        // Use the batch update function
        // Pass the original inputsToActuallyFill and the calculated quantities
        virtualUpdate(inputsToActuallyFill, quantitiesToApply);
    }


     // --- DETAILED FEEDBACK GENERATION (SweetAlert2 Modal/Toast) ---
     // Only show modal/toast for manual fills or if autofill resulted in actual fills
     if (!isAutoFill || (isAutoFill && filledCount > 0)) {

         let feedbackModeDesc = "";
         let feedbackQuantityDesc = "";

         if (patternType && patternType !== 'random') {
             feedbackModeDesc = `Pattern Mode: ${patternType.charAt(0).toUpperCase() + patternType.slice(1)}`;
             feedbackQuantityDesc = `Pattern applied with scale ${config.patternScale} and intensity ${config.patternIntensity}.`;
             if (patternType === 'perlin') {
                 feedbackQuantityDesc += ` Seed: ${config.noiseSeed === '' ? 'Random' : config.noiseSeed}.`;
             }
         } else {
             switch (mode) {
                 case 'fixed':
                     feedbackModeDesc = `Fixed Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                     feedbackQuantityDesc = `${fixedQty} copies per pack.`;
                     break;
                 case 'max':
                      feedbackModeDesc = `Random Count Mode (${count} pack${count === 1 ? '' : 's'})`;
                      feedbackQuantityDesc = `Random copies (${minQty}-${maxQty}) per pack.`;
                      break;
                 case 'unlimited':
                     feedbackModeDesc = `All Visible Packs Mode`;
                     feedbackQuantityDesc = `${fixedQty} copies per pack.`;
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


         const averagePerFilled = filledCount > 0 ? (currentTotal / filledCount).toFixed(2) : 'N/A';

         let summaryHtml = `
              <p><strong>Operation Details:</strong>${clearStatus}${autoFillStatus}${emptyOnlyStatus}${maxTotalStatus}</p>
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
 }

// The functions calculateFillCount, chooseQuantity, distribute, fillPacks,
// FillStrategies, getFillStrategy, and virtualUpdate are made available
// to the main script's scope via @require.

