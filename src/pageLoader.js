// This file handles the logic for automatically scrolling the page to load all packs.
// It uses the 'config' object (now passed as a parameter)
// and relies on browser window/document properties.

// It assumes the following are available in the main script's scope via @require:
// - functions from domUtils.js (getPackInputs, $)
// - functions from fillLogic.js (fillPacks)
// - functions from swalHelpers.js (SWAL_TOAST, SWAL_ALERT)
// - constants from constants.js (SELECTOR, SCROLL_TO_BOTTOM_CHECKBOX_ID etc.)
// - GM_log function

/* --- Full Page Load Functionality (Programmatic Scrolling) --- */

/**
 * Scrolls the page to load all packs if enabled in the config.
 * Uses scroll polling to detect new content.
 * Provides user feedback via SweetAlert2 toasts.
 * Assumes getPackInputs, fillPacks, SWAL_TOAST, SWAL_ALERT, $ from cash-dom, SELECTOR,
 * SCROLL_TO_BOTTOM_CHECKBOX_ID, AUTO_FILL_LOADED_CHECKBOX_ID, and GM_log are available.
 * @param {object} config - The script's configuration object.
 */
async function loadFullPageIfNeeded(config) {
    GM_log("Pack Filler Pro: loadFullPageIfNeeded function entered.");

    // Basic validation of config object
    if (typeof config !== 'object' || config === null) {
         GM_log("Pack Filler Pro: Invalid config object passed to loadFullPageIfNeeded. Aborting.");
         // Cannot use Swal without config, fallback to alert
         if (typeof SWAL_ALERT === 'function') {
             // Assumes sanitize is available
             if (typeof sanitize === 'function') SWAL_ALERT('Auto-Load Error', sanitize('Invalid configuration. Auto-loading aborted.'), 'error', null);
             else SWAL_ALERT('Auto-Load Error', 'Invalid configuration. Auto-loading aborted.', 'error', null); // Fallback if sanitize missing
         } else {
              alert('Pack Filler Pro Error: Invalid configuration. Auto-loading aborted.');
         }
         return;
    }

    // Check if auto-load is enabled in the config
    if (!config.loadFullPage) {
        GM_log("Pack Filler Pro: Auto-load is disabled in config. Exiting loadFullPageIfNeeded.");
         // If not auto-loading, ensure the max count for the count input is set based on initially visible inputs
         // Uses $ from cash-dom and getPackInputs from src/domUtils.js
         // Assumes getPackInputs, $, and clamp are available
         if (typeof $ === 'function' && typeof getPackInputs === 'function' && typeof clamp === 'function') {
              const maxCount = getPackInputs().length;
              $(`#${COUNT_INPUT_ID}`).attr('max', clamp(maxCount, 0, Infinity));
              GM_log("Pack Filler Pro: Max count for input set based on initially visible inputs (auto-load disabled).");
         } else {
              GM_log("Pack Filler Pro: Dependencies for setting max count missing (getPackInputs, $, clamp). Skipping.");
         }
        return;
    }

    GM_log("Pack Filler Pro: Auto-load is enabled. Starting page loading process.");


    // Check essential dependencies for page loading
     if (typeof getPackInputs !== 'function' || typeof $ === 'undefined' || typeof SELECTOR === 'undefined') {
          const errorMessage = "Page loading dependencies (getPackInputs, $, SELECTOR) missing. Auto-loading aborted.";
          GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
          // Use SWAL_ALERT if available, assumes sanitize is available
          if (typeof SWAL_ALERT === 'function' && typeof sanitize === 'function') SWAL_ALERT('Auto-Load Error', sanitize(errorMessage), 'error', config);
          else alert(`Pack Filler Pro Error: ${errorMessage}`);
          return; // Abort if critical dependencies are missing
     }

    // Get initial state
    const initialInputCount = getPackInputs().length;
    let lastHeight = document.body.scrollHeight;
    let currentInputCount = initialInputCount;
    let scrollAttempts = 0;
    const maxScrollAttempts = 50; // Limit scroll attempts to prevent infinite loops
    const scrollStep = window.innerHeight * 0.8; // Scroll by 80% of viewport height
    const pollInterval = 100; // Milliseconds to wait between polls after a scroll
    const pollDuration = 1000; // Total milliseconds to poll after a scroll
    const smoothScroll = config.scrollToBottomAfterLoad; // Use config for smooth scroll option

    GM_log(`Pack Filler Pro: Starting auto-load scroll polling. Initial inputs: ${initialInputCount}`);
     if (typeof SWAL_TOAST === 'function') {
          // Assumes sanitize is available
          if (typeof sanitize === 'function') SWAL_TOAST(sanitize(`Starting auto-load... Found ${initialInputCount} packs.`), 'info', config);
          else SWAL_TOAST(`Starting auto-load... Found ${initialInputCount} packs.`, 'info', config); // Fallback if sanitize missing
     } else {
          GM_log("Pack Filler Pro: SWAL_TOAST function not found for auto-load start feedback.");
     }


    // Use a Promise to manage the async scrolling loop
    await new Promise(resolve => {
        const scrollAndPoll = () => {
            scrollAttempts++;
            // GM_log(`Pack Filler Pro: Scroll attempt ${scrollAttempts}/${maxScrollAttempts}.`); // Too chatty

            // Scroll down the page
            window.scrollBy({
                top: scrollStep, // Scroll down by step amount
                behavior: smoothScroll ? 'smooth' : 'auto' // Use smooth behavior if enabled
            });

            // Poll for new content after scrolling
            let pollTime = 0;
            const poll = () => {
                const newHeight = document.body.scrollHeight;
                const newInputCount = getPackInputs().length; // Get count of visible inputs

                // GM_log(`Pack Filler Pro: Polling... Height: ${newHeight}, Inputs: ${newInputCount}`); // Too chatty

                // Check if height increased OR input count increased
                if (newHeight > lastHeight || newInputCount > currentInputCount) {
                    lastHeight = newHeight;
                    currentInputCount = newInputCount;
                    scrollAttempts = 0; // Reset scroll attempts if new content is found
                    // GM_log(`Pack Filler Pro: New content detected. Total inputs now: ${currentInputCount}. Resetting scroll attempts.`); // Too chatty
                    // Continue polling briefly to catch subsequent loads
                    if (pollTime < pollDuration) {
                         pollTime += pollInterval;
                         setTimeout(poll, pollInterval);
                    } else {
                         // Finished polling after detecting new content, scroll again
                         setTimeout(scrollAndPoll, 50); // Small delay before next scroll
                    }
                } else {
                    // No new content detected during this poll interval
                    pollTime += pollInterval;
                    if (pollTime < pollDuration) {
                        // Continue polling if poll duration not reached
                        setTimeout(poll, pollInterval);
                    } else {
                        // Finished polling, no new content detected after scroll
                        // Check if max scroll attempts reached or if we're already at the bottom
                        const atBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight;
                        if (scrollAttempts >= maxScrollAttempts || atBottom) {
                            GM_log(`Pack Filler Pro: Auto-load finished. Max attempts reached (${maxScrollAttempts}) or reached bottom.`);
                            resolve(); // Resolve the promise to exit the loop
                        } else {
                            // Not at bottom and attempts remaining, scroll again
                            setTimeout(scrollAndPoll, 50); // Small delay before next scroll
                        }
                    }
                }
            };

            // Start polling after a short delay to allow content to render
            setTimeout(poll, 300); // Initial delay after scroll
        };

        // Start the first scroll and poll sequence
        scrollAndPoll();
    });

    // --- Auto-load finished ---
    const finalInputCount = getPackInputs().length;
    GM_log(`Pack Filler Pro: Auto-load process complete. Final visible inputs: ${finalInputCount}.`);

    // Update the max value for the count input based on the final visible inputs
     // Assumes $ from cash-dom and getPackInputs from src/domUtils.js are available
     // Assumes clamp is available
     if (typeof $ === 'function' && typeof getPackInputs === 'function' && typeof clamp === 'function') {
          $(`#${COUNT_INPUT_ID}`).attr('max', clamp(finalInputCount, 0, Infinity));
          GM_log("Pack Filler Pro: Max count for input set based on final visible inputs.");
     } else {
          GM_log("Pack Filler Pro: Dependencies for setting max count missing (getPackInputs, $, clamp). Skipping.");
     }


    // Trigger auto-fill if enabled and fillPacks function is available
    // Assumes fillPacks function from fillLogic.js is available
    if (config.autoFillLoaded && typeof fillPacks === 'function' && finalInputCount > 0) {
        GM_log(`Pack Filler Pro: Auto-fill loaded packs is enabled. Triggering fillPacks for ${finalInputCount} inputs.`);
         // Use a short delay before triggering fillPacks to allow UI to settle
        setTimeout(() => fillPacks(config, true), 50); // Pass config and isAutoFill=true

    } else {
        GM_log("Pack Filler Pro: Auto-fill loaded is disabled, fillPacks function not found, or no inputs were found. Auto-fill skipped.");
        // Optional: Show a final toast message if auto-fill didn't run
         if (typeof SWAL_TOAST === 'function') {
              // Assumes sanitize is available
              const sanitizeFn = typeof sanitize === 'function' ? sanitize : (text) => text; // Use sanitize if available, otherwise identity
              if (finalInputCount > initialInputCount) {
                   SWAL_TOAST(sanitizeFn(`Auto-load complete. Found ${finalInputCount - initialInputCount} additional packs.`), 'success', config); // Pass config to SWAL
              } else if (initialInputCount > 0) {
                   SWAL_TOAST(sanitizeFn(`Auto-load finished. Found ${initialInputCount} packs initially.`), 'info', config); // Pass config to SWAL
              } else {
                   // Check if any inputs exist at all (even hidden ones) using the selector
                   if ($(SELECTOR).length === 0) {
                        SWAL_TOAST(sanitizeFn('No pack inputs found on the page.'), 'info', config); // Pass config to SWAL
                   } else {
                        SWAL_TOAST(sanitizeFn("Auto-load finished. Found packs."), 'info', config); // Pass config to SWAL
                   }
              }
         } else {
              GM_log("Pack Filler Pro: SWAL_TOAST function not found for auto-load feedback.");
         }
    }
}


// The function loadFullPageIfNeeded is made available to the main script's scope via @require.
// loadWithIntersectionObserver and loadWithScrollPolling are internal helpers (polling logic is within loadFullPageIfNeeded now).
