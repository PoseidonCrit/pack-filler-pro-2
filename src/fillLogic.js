// This file contains the main logic for calculating and applying quantities to inputs.
// It uses constants and DOM helper functions.
// Note: This module now accepts the 'config' object as a parameter where needed.

// It assumes 'MAX_QTY', 'getPackInputs', 'clamp', 'updateInput',
// 'clearAllInputs', 'SWAL_ALERT', 'SWAL_TOAST', 'updateConfigFromUI',
// and the pattern worker (patternWorker) are accessible.

/* --- Pattern Strategies --- */
// Note: Perlin Noise and clamp implementations are now ONLY in the worker code string.
// These functions are no longer needed directly in the main thread's fillLogic.js
// unless the worker initialization fails and we fallback.

// Main thread strategies (simple ones or fallback)
const FillStrategies = {
    // Random strategy (uses existing chooseQuantity logic)
    random: (config, index, total) => chooseQuantity(config),

    // Gradient strategy (can run on main thread, but included in worker for consistency if needed)
    // Keeping a fallback here in case worker fails
    gradient: (config, index, total) => {
        const intensity = config.patternIntensity || 1.0;
        const minQty = config.lastMinQty;
        const maxQty = config.lastMaxQty;
        const range = maxQty - minQty;
        const MAX_QTY = 99; // Define MAX_QTY locally for fallback

        // Assumes clamp is available globally from domUtils.js for fallback
        const baseQty = minQty + (index / (total - 1)) * range;
        let quantity = minQty + (baseQty - minQty) * intensity;

        quantity = clamp(quantity, minQty, maxQty);
        quantity = clamp(Math.round(quantity), 0, MAX_QTY);

        return quantity;
    },

    // Alternating strategy (runs on main thread)
    alternating: (config, index, total) => {
         const minQty = config.lastMinQty;
         const maxQty = config.lastMaxQty;
         const MAX_QTY = 99; // Define MAX_QTY locally
         // Assumes clamp is available globally from domUtils.js
         return index % 2 === 0 ? clamp(minQty, 0, MAX_QTY) : clamp(maxQty, 0, MAX_QTY);
    },

    // Perlin strategy fallback (runs on main thread if worker fails or is unavailable)
    perlinFallback: (config, index, total) => {
         // This requires the perlinNoise and clamp functions to be available
         // in the main thread's scope if the worker fails.
         // For now, we'll rely on the worker. If fallback is essential,
         // we might need to include perlinNoise/clamp in domUtils or similar.
         // For this iteration, this is a placeholder indicating where the fallback logic would go.
         // A more robust solution would ensure perlinNoise is available in the main thread.
         GM_log("Pack Filler Pro: Perlin noise calculation falling back to main thread (worker failed or unavailable). Performance may be impacted.");
         // Replicate logic from worker (requires clamp and perlinNoise in this scope)
         // Assuming clamp and perlinNoise are available globally if this fallback is hit
         // Note: perlinNoise is NOT currently available in the main thread scope.
         // This fallback will fail unless perlinNoise is added to domUtils or similar.
         // For now, returning a simple random value as a temporary fallback
         GM_log("Pack Filler Pro: Perlin noise fallback not fully implemented on main thread. Using random quantity.");
         const minQty = config.lastMinQty;
         const maxQty = config.lastMaxQty;
         const MAX_QTY = 99; // Define MAX_QTY locally
         const clampedMin = clamp(minQty, 0, MAX_QTY);
         const clampedMax = clamp(maxQty, 0, MAX_QTY);
         if (clampedMin > clampedMax) return 0;
         return Math.floor(Math.random() * (clampedMax - clampedMin + 1)) + clampedMin;
    }
};

// Strategy selector
function getFillStrategy(config, useFallback = false) {
    const type = config.patternType;
    if (useFallback && type === 'perlin') {
        // If fallback is requested for Perlin, return the main thread fallback
        return FillStrategies.perlinFallback;
    }
    switch (type) {
        case 'perlin':
             // If not requesting fallback, return the worker placeholder (actual logic in worker)
             // This function is mainly for determining the *type* of strategy.
             // The actual execution logic is in fillPacks.
             return FillStrategies.perlin; // Placeholder for worker strategy
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

    // Find the common parent of the pack containers
    const packContainers = inputs.map(input => input.closest('.pack')).filter(Boolean);
     if (packContainers.length === 0 || packContainers.length !== inputs.length) {
          GM_log("Pack Filler Pro: virtualUpdate could not find .pack containers for all inputs or input count mismatch. Falling back to individual updates.");
          inputs.forEach((input, i) => updateInput(input, quantities[i])); // Use updateInput from domUtils
          return;
     }

     const parentOfPacks = packContainers[0]?.parentNode;
     if (!parentOfPacks) {
         GM_log("Pack Filler Pro: virtualUpdate could not find the parent of .pack containers. Falling back to individual updates.");
         inputs.forEach((input, i) => updateInput(input, quantities[i])); // Use updateInput from domUtils
         return;
     }

     // Create a temporary div to hold the new HTML structure
     const tempDiv = document.createElement('div');
     tempDiv.style.display = 'none'; // Hide the temporary div
     document.body.appendChild(tempDiv); // Append to body to allow innerHTML parsing

     let newInnerHTML = '';

     // Reconstruct the HTML for the relevant packs with updated input values
     inputs.forEach((input, i) => {
         const originalPack = inputs[i].closest('.pack');
         if (originalPack) {
             let packHtml = originalPack.outerHTML;
             // Use a simple string replacement for the input value within the HTML string
             // This is fragile if the input structure changes, but avoids complex DOM manipulation
             // Ensure we handle potential attributes and closing tags correctly
             const inputRegex = new RegExp(`(<input[^>]*id="${input.id}"[^>]*value=")[^"]*(".*?/?>)`, 'i'); // Added 'i' for case-insensitivity, adjusted regex for potential self-closing tag
             packHtml = packHtml.replace(inputRegex, `$1${String(quantities[i])}$2`);
             newInnerHTML += packHtml; // Accumulate the new HTML
         }
     });

     // Set the innerHTML of the temporary div to parse the HTML string into DOM nodes
     tempDiv.innerHTML = newInnerHTML;

     // Create a DocumentFragment to hold the new nodes before inserting them
     const fragment = document.createDocumentFragment();
     while (tempDiv.firstChild) {
         fragment.appendChild(tempDiv.firstChild);
     }

     // Replace the original pack containers with the new ones from the fragment
     // This still involves multiple replaceChild operations, but avoids repeated string parsing.
     // A true single batch update would require replacing the parentOfPacks's children entirely,
     // which might remove other non-pack elements if they exist.
     // Let's stick to replacing individual pack containers for safety, but use the fragment.
     packContainers.forEach((originalPack, i) => {
          const newPack = fragment.children[i]; // Get the corresponding new pack from the fragment
          if (newPack) {
               try {
                   originalPack.parentNode.replaceChild(newPack, originalPack);
               } catch (e) {
                   GM_log("Pack Filler Pro: Error replacing pack container in virtualUpdate. Falling back to individual updates.", e);
                   // Fallback for this specific input if replaceChild fails
                   updateInput(inputs[i], quantities[i]);
               }
          } else {
               GM_log("Pack Filler Pro: Mismatch between original and new pack containers in virtualUpdate. Falling back to individual updates for remaining.", inputs[i]);
               // Fallback for this specific input
               updateInput(inputs[i], quantities[i]);
          }
     });


     // Clean up the temporary div
     document.body.removeChild(tempDiv);


     // After replacing the DOM nodes, dispatch events on the newly created inputs
     // We need to re-select the inputs from the DOM as the original references are no longer valid.
     const updatedInputs = getPackInputs().filter(input => inputs.some(originalInput => originalInput.id === input.id));

     updatedInputs.forEach(input => {
         input.dispatchEvent(new Event('input', { bubbles: true }));
         input.dispatchEvent(new Event('change', { bubbles: true }));
     });


     GM_log(`Pack Filler Pro: Applied batch DOM update for ${inputs.length} inputs.`);
}


/**
 * Fills pack inputs based on current settings.
 * Now incorporates pattern strategies and batch DOM updates, using a Web Worker for heavy calculations.
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

    const totalPacksToFill = inputsToActuallyFill.length;

    // Determine the strategy to use for calculation *before* attempting to use the worker
    // This ensures calculationStrategy is always defined.
    let calculationStrategy = getFillStrategy(config, true); // Get the appropriate main thread strategy or fallback

    // Check if we should attempt to use the worker for Perlin noise
    if (patternType === 'perlin' && typeof patternWorker !== 'undefined' && patternWorker !== null) {
        GM_log("Pack Filler Pro: Attempting to use Web Worker for Perlin noise calculation.");
        try {
            // Offload heavy computation to the worker
            quantitiesToApply = await new Promise((resolve, reject) => {
                // Ensure previous message handlers are cleared to avoid race conditions
                patternWorker.onmessage = (e) => {
                    if (e.data && e.data.type === 'result') {
                        resolve(e.data.quantities);
                    } else if (e.data && e.data.type === 'log') {
                         // Handle logs from worker here if needed, or in the main worker.onmessage handler
                         GM_log("Pack Filler Pro Worker Log (from fillPacks):", ...e.data.data);
                    }
                };
                patternWorker.onerror = (error) => {
                    GM_log("Pack Filler Pro: Web Worker error during calculation:", error);
                    // On worker error, we will fall back to main thread calculation
                    reject(error); // Reject the promise to trigger the catch block
                };
                // Post message to worker with necessary data
                patternWorker.postMessage({
                    strategy: patternType, // Should be 'perlin' here
                    count: totalPacksToFill,
                    config: { // Pass relevant config for the worker
                         noiseSeed: config.noiseSeed,
                         patternScale: config.patternScale,
                         patternIntensity: config.patternIntensity,
                         lastMinQty: config.lastMinQty,
                         lastMaxQty: config.lastMaxQty,
                         maxTotalAmount: config.maxTotalAmount,
                         // fillEmptyOnly is handled on main thread
                    }
                });
            });

            // If worker succeeded, calculate total copies added
            if (quantitiesToApply.length > 0) {
                 currentTotal = quantitiesToApply.reduce((sum, qty) => sum + qty, 0);
                 if (useMaxTotal && currentTotal >= maxTotalAmount) maxTotalHit = true;
            }
            GM_log("Pack Filler Pro: Quantities received from worker.");

            // If worker was used successfully, we skip the main thread calculation loop below.

        } catch (error) {
            GM_log("Pack Filler Pro: Worker calculation failed, proceeding with main thread fallback.", error);
            // Worker failed, quantitiesToApply is still empty.
            // calculationStrategy is already set to the fallback (Perlin fallback or default random).
            // Proceed to the main thread calculation block below.
            quantitiesToApply = []; // Ensure it's empty
            currentTotal = 0; // Reset total
            maxTotalHit = false; // Reset flag
        }
    }

    // If quantities were NOT calculated by the worker (either worker failed/unavailable or not Perlin)
    // AND a valid main thread strategy function was determined
    // This block also handles non-Perlin patterns directly.
    if (quantitiesToApply.length === 0 && typeof calculationStrategy === 'function') {
         GM_log(`Pack Filler Pro: Calculating quantities on main thread using strategy: ${patternType === 'perlin' ? 'Perlin Fallback' : patternType}.`);
         inputsToActuallyFill.forEach((input, index) => {
              let qty = calculationStrategy(config, index, totalPacksToFill);
              // Apply max total limit on main thread
              if (useMaxTotal) {
                   const remaining = maxTotalAmount - currentTotal;
                   qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity
                   if (currentTotal + qty >= maxTotalAmount) maxTotalHit = true;
              }
              quantitiesToApply.push(qty);
              currentTotal += qty;
         });
    } else if (quantitiesToApply.length === 0) {
         // This case should ideally not happen if getFillStrategy always returns a function,
         // but it's a safeguard.
         GM_log("Pack Filler Pro: No quantities calculated and no valid main thread strategy found.");
         if (!isAutoFill) SWAL_ALERT('Fill Packs', 'Calculation failed. No quantities generated.', 'error', config);
         return; // Abort if no quantities were generated
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

