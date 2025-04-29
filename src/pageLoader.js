// This file handles the logic for automatically scrolling the page to load all packs.
// It uses the 'config' object (now passed as a parameter)
// and relies on browser window/document properties.
// It assumes 'getPackInputs' from src/domUtils.js,
// 'fillPacks' from src/fillLogic.js,
// 'SWAL_TOAST' from src/swalHelpers.js,
// and '$' from cash-dom are available via @require.

/* --- Full Page Load Functionality (Programmatic Scrolling) --- */
/**
 * Scrolls the page to load all packs if enabled in the config.
 * @param {object} config - The script's configuration object.
 */
async function loadFullPageIfNeeded(config) { // Accept config as a parameter
    // Uses 'config' passed as a parameter. Add a check for config validity.
    if (!config || !config.loadFullPage) { // Check if config is valid and auto-load is enabled
         GM_log("Pack Filler Pro: Auto-load full page is disabled in config or config is invalid."); // Assumes GM_log is available
         // Ensure max count for input is updated based on initially visible if not auto-loading
         // Uses $ from cash-dom and getPackInputs from src/domUtils.js
         $('#pfp-count').attr('max', getPackInputs().length);
         return;
    }

    GM_log("Pack Filler Pro: Auto-load full page is enabled. Starting scroll process...");
    const scrollDelay = 300; // ms to wait after each scroll
    const scrollCheckIterations = 15; // Number of times to check for height change after a scroll
    const scrollCheckInterval = 100; // ms between height checks
    const maxScrollAttempts = 150; // Safety break

    let lastHeight = 0;
    let currentHeight = document.body.scrollHeight;
    let scrollAttempts = 0;
    const initialInputCount = getPackInputs().length; // Uses getPackInputs from src/domUtils.js


    // Initial short wait for page elements to render
    await new Promise(resolve => setTimeout(resolve, 500));
    currentHeight = document.body.scrollHeight; // Update height after initial wait

    while (scrollAttempts < maxScrollAttempts) {
         lastHeight = currentHeight;

         // Scroll to the bottom of the page
         window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

         let heightIncreased = false;
         // Wait and check height multiple times as new content might load in chunks
         for(let i = 0; i < scrollCheckIterations; i++) {
             await new Promise(resolve => setTimeout(resolve, scrollCheckInterval));
             currentHeight = document.body.scrollHeight;
             if (currentHeight > lastHeight) {
                 heightIncreased = true;
                 break; // Height increased, likely loaded more, break inner loop and check again
             }
         }

         scrollAttempts++;

         // Break if height hasn't increased after checks
         if (!heightIncreased) {
             GM_log(`Pack Filler Pro: Page height did not increase after ${scrollCheckIterations} checks in scroll attempt ${scrollAttempts}. Final height: ${currentHeight}. Stopping scroll.`);
             break;
         }

        // Optional: Call fillPacks with isAutoFill=true if auto-fill is enabled
        // Uses fillPacks from src/fillLogic.js
        if (config.autoFillLoaded) { // Access config from the parameter
             setTimeout(() => {
                 fillPacks(true);
             }, 50);
        }

        // Check for a Load More button as an alternative end condition
         const loadMoreButton = document.querySelector('.load-more-btn');
         if (loadMoreButton && (!loadMoreButton.offsetParent || loadMoreButton.disabled)) {
             GM_log("Pack Filler Pro: Load More button is now hidden or disabled. Assuming end of content.");
             break;
         }

         // Add a general delay between scrolls if height did increase
         await new Promise(resolve => setTimeout(resolve, scrollDelay));
    }

    if (scrollAttempts >= maxScrollAttempts) {
        GM_log("Pack Filler Pro: Reached max scroll attempts.");
    }

    GM_log("Pack Filler Pro: Full page auto-load process finished.");
     // Final update to max count
     // Uses $ from cash-dom and getPackInputs from src/domUtils.js
     $('#pfp-count').attr('max', getPackInputs().length);

    // Optional: Show a final toast message
    const finalInputCount = getPackInputs().length; // Uses getPackInputs from src/domUtils.js
    if (finalInputCount > initialInputCount) {
        SWAL_TOAST(`Auto-load complete. Found ${finalInputCount - initialInputCount} additional packs.`, 'success'); // Uses SWAL_TOAST from src/swalHelpers.js
    } else if (initialInputCount > 0) {
        SWAL_TOAST(`Auto-load finished. Found ${initialInputCount} packs initially.`, 'info');
    } else {
        if ($('.pack-num-input').length === 0) { // Uses $ from cash-dom
             SWAL_TOAST('No pack inputs found on the page.', 'info');
        } else {
             SWAL_TOAST("Auto-load finished. Found packs.", 'info');
        }
    }
}

// Note: No IIFE wrapper needed in this file if the main script uses one,
// as the functions defined here will be added to the main script's scope.
