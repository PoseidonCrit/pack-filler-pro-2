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
         alert('Pack Filler Pro Error: Invalid configuration. Auto-loading aborted.');
         return;
    }

    // Check if auto-load is enabled in the configuration
    if (!config.loadFullPage) {
         GM_log("Pack Filler Pro: Auto-load full page is disabled in config.");
         // Ensure max count for input is updated based on initially visible if not auto-loading
         // Assumes getPackInputs and $ are available
         if (typeof getPackInputs === 'function' && typeof $ === 'function') {
              $('#pfp-count').attr('max', getPackInputs().length); // Assumes $ is cash-dom
              GM_log("Pack Filler Pro: Max count for input set based on initially visible inputs.");
         } else {
              GM_log("Pack Filler Pro: getPackInputs or $ function not found. Could not set max count.");
         }
         return; // Exit if auto-load is disabled
    }

    GM_log("Pack Filler Pro: Auto-load full page is enabled. Starting scroll process...");

    const scrollDelay = 300; // ms to wait after each scroll
    const scrollCheckIterations = 20; // Number of times to check for height/input change after a scroll
    const scrollCheckInterval = 100; // ms between height/input checks
    const maxScrollAttempts = 150; // Safety break to prevent infinite loops

    // Check if necessary functions/constants are available before starting the process
    if (typeof getPackInputs !== 'function' || typeof $ === 'undefined' || typeof SELECTOR === 'undefined') {
         const errorMessage = "Required dependencies (getPackInputs, $, or SELECTOR) missing for auto-load. Auto-loading aborted.";
         GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMessage}`);
         if (typeof SWAL_ALERT === 'function') SWAL_ALERT('Auto-Load Error', errorMessage, 'error', config);
         else alert(`Pack Filler Pro Error: ${errorMessage}`);
         return; // Abort if critical dependencies are missing
    }
    // Check if fillPacks is available if auto-fill is enabled
    if (config.autoFillLoaded && typeof fillPacks !== 'function') {
         const errorMessage = "fillPacks function not found, but auto-fill loaded is enabled. Auto-fill will be skipped.";
         GM_log(`Pack Filler Pro: WARNING - ${errorMessage}`);
          if (typeof SWAL_TOAST === 'function') SWAL_TOAST('Auto-Fill Warning', errorMessage, 'warning', config);
    }


    let lastHeight = 0;
    let currentHeight = document.body.scrollHeight;
    let scrollAttempts = 0;
    const initialInputCount = getPackInputs().length;

    GM_log(`Pack Filler Pro: Starting auto-load. Initial height: ${currentHeight}, Initial Inputs: ${initialInputCount}.`);


    // Initial short wait for page elements to render before the first scroll/check
    await new Promise(resolve => setTimeout(resolve, 500));
    currentHeight = document.body.scrollHeight; // Update height after initial wait

    while (scrollAttempts < maxScrollAttempts) {
         lastHeight = currentHeight;

         // Scroll to the bottom of the page. Use smooth scrolling if enabled in config.
         window.scrollTo({ top: document.body.scrollHeight, behavior: config.scrollToBottomAfterLoad ? 'smooth' : 'auto' });


         let contentIncreased = false;
         let currentInputCount = getPackInputs().length; // Get input count after scrolling
         // Wait and check height/input count multiple times as new content might load in chunks
         for(let i = 0; i < scrollCheckIterations; i++) {
              await new Promise(resolve => setTimeout(resolve, scrollCheckInterval));
              const newHeight = document.body.scrollHeight;
              const newInputCount = getPackInputs().length;

              // Check if either height or the number of inputs has increased
              if (newHeight > currentHeight || newInputCount > currentInputCount) {
                   // GM_log(`Pack Filler Pro: Polling detected content increase (Height: ${newHeight}, Inputs: ${newInputCount}) in scroll attempt ${scrollAttempts}, check ${i}.`); // Too chatty
                   currentHeight = newHeight; // Update current height
                   currentInputCount = newInputCount; // Update current input count
                   contentIncreased = true;

                   // Break the inner loop as soon as an increase is detected
                   break;
              }
         }

         scrollAttempts++;

         // Break the main loop if content (height or input count) hasn't increased after checks
         if (!contentIncreased) {
             GM_log(`Pack Filler Pro: Polling: Page height and input count did not increase after ${scrollCheckIterations} checks in scroll attempt ${scrollAttempts}. Final height: ${currentHeight}, Final Inputs: ${currentInputCount}. Stopping scroll.`);
             break; // Stop the main while loop
         }

         // Check for a Load More button as an alternative end condition
         // '.load-more-btn' class might indicate an explicit load button exists on the page.
         // If it's present but no longer visible or is disabled, assume end of content.
          const loadMoreButton = document.querySelector('.load-more-btn');
          if (loadMoreButton && (!loadMoreButton.offsetParent || loadMoreButton.disabled)) {
              GM_log("Pack Filler Pro: Load More button is now hidden or disabled. Assuming end of content.");
              break;
          }

         // Add a general delay between scrolls if content did increase
         await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }

    if (scrollAttempts >= maxScrollAttempts) {
        GM_log(`Pack Filler Pro: Polling reached max scroll attempts (${maxScrollAttempts}). Stopping auto-load.`);
    }

    // Trigger auto-fill if enabled AFTER loading is complete and if fillPacks is available
    const finalInputCount = getPackInputs().length;
    GM_log(`Pack Filler Pro: Full page auto-load process finished. Final visible input count after load: ${finalInputCount}.`);

    // Only trigger auto-fill if enabled, if fillPacks function exists, and if any inputs were found (either initially or after loading)
    if (config.autoFillLoaded && typeof fillPacks === 'function' && finalInputCount > 0) {
        GM_log(`Pack Filler Pro: Auto-fill loaded enabled. Triggering fillPacks for ${finalInputCount} inputs.`);
        // Small delay before filling to ensure inputs are fully rendered/interactive
        setTimeout(() => {
            fillPacks(config, true); // Pass config and isAutoFill=true
        }, 100); // 100ms delay

    } else {
        GM_log("Pack Filler Pro: Auto-fill loaded is disabled, fillPacks function not found, or no inputs were found. Auto-fill skipped.");
        // Optional: Show a final toast message if auto-fill didn't run
         if (typeof SWAL_TOAST === 'function') {
              if (finalInputCount > initialInputCount) {
                   SWAL_TOAST(`Auto-load complete. Found ${finalInputCount - initialInputCount} additional packs.`, 'success', config); // Pass config to SWAL
              } else if (initialInputCount > 0) {
                   SWAL_TOAST(`Auto-load finished. Found ${initialInputCount} packs initially.`, 'info', config); // Pass config to SWAL
              } else {
                   // Check if any inputs exist at all (even hidden ones) using the selector
                   if ($(SELECTOR).length === 0) {
                        SWAL_TOAST('No pack inputs found on the page.', 'info', config); // Pass config to SWAL
                   } else {
                        SWAL_TOAST("Auto-load finished. Found packs.", 'info', config); // Pass config to SWAL
                   }
              }
         } else {
              GM_log("Pack Filler Pro: SWAL_TOAST function not found for auto-load feedback.");
         }
    }
}


// The function loadFullPageIfNeeded is made available to the main script's scope via @require.
// loadWithIntersectionObserver and loadWithScrollPolling are internal helpers (polling logic is within loadFullPageIfNeeded now).
