// This file handles the logic for automatically scrolling the page to load all packs.
// It uses the 'config' object (now passed as a parameter)
// and relies on browser window/document properties.
// It assumes 'getPackInputs' from src/domUtils.js,
// 'fillPacks' from src/fillLogic.js,
// 'SWAL_TOAST' from src/swalHelpers.js,
// '$' from cash-dom, and GM_log are available via @require.

/* --- Full Page Load Functionality (Programmatic Scrolling) --- */
/**
 * Scrolls the page to load all packs if enabled in the config.
 * @param {object} config - The script's configuration object.
 */
async function loadFullPageIfNeeded(config) { // Accept config as a parameter
    GM_log("Pack Filler Pro: loadFullPageIfNeeded function entered."); // Debugging log

    // Uses 'config' passed as a parameter. Add a check for config validity.
    if (!config || !config.loadFullPage) { // Check if config is valid and auto-load is enabled
         GM_log("Pack Filler Pro: Auto-load full page is disabled in config or config is invalid."); // Assumes GM_log is available
         // Ensure max count for input is updated based on initially visible if not auto-loading
         // Uses $ from cash-dom and getPackInputs from src/domUtils.js
         $('#pfp-count').attr('max', getPackInputs().length);
         return;
    }

    GM_log("Pack Filler Pro: Auto-load full page is enabled. Starting scroll process...");

    // Use constants for timing parameters for easier adjustment
    const scrollDelay = 300; // ms to wait after each scroll
    const scrollCheckIterations = 20; // Increased checks: Number of times to check for height/input change after a scroll
    const scrollCheckInterval = 100; // ms between height/input checks
    const maxScrollAttempts = 200; // Increased safety break

    let lastHeight = 0;
    let currentHeight = document.body.scrollHeight;
    let lastInputCount = 0; // Track input count to detect loading
    let currentInputCount = getPackInputs().length; // Uses getPackInputs from src/domUtils.js
    let scrollAttempts = 0;
    const initialInputCount = currentInputCount;


    // Initial short wait for page elements to render
    await new Promise(resolve => setTimeout(resolve, 500)); // Initial delay
    currentHeight = document.body.scrollHeight; // Update height after initial wait
    currentInputCount = getPackInputs().length; // Update input count


    while (scrollAttempts < maxScrollAttempts) {
         lastHeight = currentHeight;
         lastInputCount = currentInputCount;

         // Scroll to the bottom of the page
         window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

         let contentIncreased = false;
         // Wait and check height AND input count multiple times
         for(let i = 0; i < scrollCheckIterations; i++) {
             await new Promise(resolve => setTimeout(resolve, scrollCheckInterval));
             currentHeight = document.body.scrollHeight;
             currentInputCount = getPackInputs().length; // Check input count again

             if (currentHeight > lastHeight || currentInputCount > lastInputCount) {
                 contentIncreased = true;
                 GM_log(`Pack Filler Pro: Detected content increase (Height: ${currentHeight - lastHeight}, Inputs: ${currentInputCount - lastInputCount}) in scroll attempt ${scrollAttempts}.`);
                 break; // Content increased, likely loaded more, break inner loop and check again
             }
         }

         scrollAttempts++;

         // Break if neither height nor input count increased after checks
         if (!contentIncreased) {
             GM_log(`Pack Filler Pro: Page height and input count did not increase after ${scrollCheckIterations} checks in scroll attempt ${scrollAttempts}. Final height: ${currentHeight}, Final Inputs: ${currentInputCount}. Stopping scroll.`);
             break;
         }

        // Optional: Call fillPacks with isAutoFill=true if auto-fill is enabled
        // Uses fillPacks from src/fillLogic.js
        if (config.autoFillLoaded) { // Access config from the parameter
             GM_log("Pack Filler Pro: Auto-fill loaded enabled, triggering fillPacks.");
             // Small delay before filling to ensure inputs are fully rendered/interactive
             setTimeout(() => {
                 fillPacks(config, true); // Pass config and isAutoFill=true
             }, 100); // Increased delay slightly
        }

        // Check for a Load More button as an alternative end condition
         const loadMoreButton = document.querySelector('.load-more-btn');
         if (loadMoreButton && (!loadMoreButton.offsetParent || loadMoreButton.disabled)) {
             GM_log("Pack Filler Pro: Load More button is now hidden or disabled. Assuming end of content.");
             break;
         }

         // Add a general delay between scrolls if content did increase
         await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }

    if (scrollAttempts >= maxScrollAttempts) {
        GM_log(`Pack Filler Pro: Reached max scroll attempts (${maxScrollAttempts}). Stopping auto-load.`);
    }

    GM_log("Pack Filler Pro: Full page auto-load process finished.");

    // Optional: Scroll to the very bottom after loading is finished
    if (config.scrollToBottomAfterLoad) { // New config option
         GM_log("Pack Filler Pro: Scrolling to bottom after load.");
         window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }


     // Final update to max count
     // Uses $ from cash-dom and getPackInputs from src/domUtils.js
     $('#pfp-count').attr('max', getPackInputs().length);

    // Optional: Show a final toast message
    const finalInputCount = getPackInputs().length; // Uses getPackInputs from src/domUtils.js
    if (finalInputCount > initialInputCount) {
        SWAL_TOAST(`Auto-load complete. Found ${finalInputCount - initialInputCount} additional packs. Total: ${finalInputCount}.`, 'success'); // Uses SWAL_TOAST from src/swalHelpers.js
    } else if (initialInputCount > 0) {
        SWAL_TOAST(`Auto-load finished. Found ${initialInputCount} packs initially. Total: ${finalInputCount}.`, 'info');
    } else {
        if ($('.pack-num-input').length === 0) { // Uses $ from cash-dom
             SWAL_TOAST('No pack inputs found on the page.', 'info');
        } else {
             SWAL_TOAST(`Auto-load finished. Found ${finalInputCount} packs.`, 'info');
        }
    }
}

// The function loadFullPageIfNeeded is made available to the main script's scope via @require.
