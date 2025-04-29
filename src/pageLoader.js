// This block handles the logic for automatically scrolling the page to load all packs.
// It uses the 'config' and relies on browser window/document properties.
// In a modular setup, this could be a 'pageLoader.js' module.

// Assumes 'config', 'getPackInputs', 'fillPacks', and 'SWAL_TOAST' are accessible.

/* --- Full Page Load Functionality (Programmatic Scrolling) --- */
async function loadFullPageIfNeeded() {
    if (!config.loadFullPage) {
         GM_log("Pack Filler Pro: Auto-load full page is disabled in config.");
         // Ensure max count for input is updated based on initially visible if not auto-loading
         // Assumes '$' is accessible
         $('#pfp-count').attr('max', getPackInputs().length); // Assumes getPackInputs is accessible
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
    const initialInputCount = getPackInputs().length; // Assumes getPackInputs is accessible


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
        if (config.autoFillLoaded) {
             setTimeout(() => {
                 fillPacks(true); // Assumes fillPacks is accessible
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
     $('#pfp-count').attr('max', getPackInputs().length); // Assumes '$' and getPackInputs are accessible

    // Optional: Show a final toast message
    const finalInputCount = getPackInputs().length; // Assumes getPackInputs is accessible
    if (finalInputCount > initialInputCount) {
        SWAL_TOAST(`Auto-load complete. Found ${finalInputCount - initialInputCount} additional packs.`, 'success'); // Assumes SWAL_TOAST is accessible
    } else if (initialInputCount > 0) {
        SWAL_TOAST(`Auto-load finished. Found ${initialInputCount} packs initially.`, 'info'); // Assumes SWAL_TOAST is accessible
    } else {
        if ($('.pack-num-input').length === 0) { // Assumes '$' is accessible
             SWAL_TOAST('No pack inputs found on the page.', 'info'); // Assumes SWAL_TOAST is accessible
        } else {
             SWAL_TOAST("Auto-load finished. Found packs.", 'info'); // Assumes SWAL_TOAST is accessible
        }
    }
}

// Assumes this function will be called during initialization if the config option is enabled.
