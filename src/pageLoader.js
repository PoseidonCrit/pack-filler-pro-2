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
 * Uses IntersectionObserver if a '.load-more-btn' is found, falls back to polling otherwise.
 * @param {object} config - The script's configuration object.
 */
async function loadFullPageIfNeeded(config) {
    GM_log("Pack Filler Pro: loadFullPageIfNeeded function entered.");

    // Check if auto-load is enabled in the configuration
    if (!config || !config.loadFullPage) {
         GM_log("Pack Filler Pro: Auto-load full page is disabled in config or config is invalid.");
         // Ensure max count for input is updated based on initially visible if not auto-loading
         $('#pfp-count').attr('max', getPackInputs().length);
         return;
    }

    GM_log("Pack Filler Pro: Auto-load full page is enabled. Starting load process...");

    const loadMoreButton = document.querySelector('.load-more-btn');
    const initialInputCount = getPackInputs().length; // Get initial count before loading

    if (loadMoreButton) {
        GM_log("Pack Filler Pro: Found Load More button. Using IntersectionObserver.");
        await loadWithIntersectionObserver(config, loadMoreButton);
    } else {
        GM_log("Pack Filler Pro: Load More button not found. Falling back to scroll polling.");
        await loadWithScrollPolling(config);
    }

    // --- Actions after loading (either method) finishes ---
    GM_log("Pack Filler Pro: Full page auto-load process finished.");

    // Optional: Scroll to the very bottom after loading is finished
    if (config.scrollToBottomAfterLoad) {
         GM_log("Pack Filler Pro: Scrolling to bottom after load.");
         window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }

     // Final update to max count on the UI panel
     const finalInputCount = getPackInputs().length;
     $('#pfp-count').attr('max', finalInputCount);
     GM_log(`Pack Filler Pro: Final visible input count after load: ${finalInputCount}.`);


    // Optional: Show a final toast message summarizing the load process
    if (finalInputCount > initialInputCount) {
        SWAL_TOAST(`Auto-load complete. Found ${finalInputCount - initialInputCount} additional packs. Total: ${finalInputCount}.`, 'success', config);
    } else if (initialInputCount > 0) {
        SWAL_TOAST(`Auto-load finished. Found ${initialInputCount} packs initially. Total: ${finalInputCount}.`, 'info', config);
    } else {
        // This case might happen if no inputs are found at all
        if ($('.pack-num-input').length === 0) {
             SWAL_TOAST('No pack inputs found on the page.', 'info', config);
        } else {
             SWAL_TOAST(`Auto-load finished. Found ${finalInputCount} packs.`, 'info', config);
        }
    }
}

/**
 * Loads the full page using IntersectionObserver to detect a "load more" button.
 * @param {object} config - The script's configuration object.
 * @param {HTMLElement} loadMoreButton - The button element to observe.
 * @returns {Promise<void>} A promise that resolves when loading is deemed complete.
 */
async function loadWithIntersectionObserver(config, loadMoreButton) {
    return new Promise(resolve => {
        let scrollAttempts = 0;
        const maxAttempts = 200; // Safety break for excessive scrolling
        const safetyTimeoutDuration = 30000; // 30 seconds safety timeout

        // Create the IntersectionObserver
        const observer = new IntersectionObserver((entries, observerInstance) => {
            const buttonEntry = entries.find(entry => entry.target === loadMoreButton);

            // Check if the observed button element is currently in the DOM
            if (!document.body.contains(loadMoreButton)) {
                 GM_log("Pack Filler Pro: Load More button removed from DOM. Assuming end of content. Disconnecting observer.");
                 resolve(); // Resolve the promise to signal completion
                 return; // Exit callback
            }

            if (buttonEntry && buttonEntry.isIntersecting) {
                 // Check if button is visible and not disabled
                 const isButtonVisibleAndEnabled = loadMoreButton.offsetParent !== null && !loadMoreButton.disabled;

                if (isButtonVisibleAndEnabled) {
                    GM_log(`Pack Filler Pro: Load More button intersected. Scrolling (${scrollAttempts + 1}/${maxAttempts}).`);
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    scrollAttempts++;

                    if (scrollAttempts >= maxAttempts) {
                         GM_log(`Pack Filler Pro: Reached max scroll attempts (${maxAttempts}) with IntersectionObserver. Disconnecting observer.`);
                         resolve(); // Resolve the promise to signal completion
                    }

                    // Reset safety timeout on successful scroll/intersection
                    resetSafetyTimeout();

                } else {
                     // Button is intersecting but not visible or is disabled - likely end of content
                     GM_log("Pack Filler Pro: Load More button is intersecting but not visible or is disabled. Assuming end of content. Disconnecting observer.");
                     resolve(); // Resolve the promise
                }
            }
            // If not intersecting, do nothing and wait for the next intersection
        }, {
            // Options for the observer
            root: null, // Observe relative to the viewport
            rootMargin: '0px',
            threshold: 0.1 // Trigger when 10% of the button is visible
        });

        // Start observing the button
        observer.observe(loadMoreButton);
        GM_log("Pack Filler Pro: IntersectionObserver started observing the Load More button.");


        // Add a safety timeout in case the observer never triggers or the button state never changes
        let safetyTimeoutId;
        const resetSafetyTimeout = () => {
             clearTimeout(safetyTimeoutId);
             safetyTimeoutId = setTimeout(() => {
                  GM_log(`Pack Filler Pro: IntersectionObserver safety timeout (${safetyTimeoutDuration}ms) reached. Disconnecting observer.`);
                  resolve(); // Resolve the promise
             }, safetyTimeoutDuration);
        };

        // Start the initial safety timeout
        resetSafetyTimeout();
        GM_log(`Pack Filler Pro: IntersectionObserver safety timeout started (${safetyTimeoutDuration}ms).`);


        // Override the resolve function to ensure the observer and timeout are cleaned up
        const originalResolve = resolve;
        resolve = () => {
             clearTimeout(safetyTimeoutId);
             if (observer) {
                 observer.disconnect();
                 GM_log("Pack Filler Pro: IntersectionObserver disconnected.");
             }
             // Trigger auto-fill if enabled AFTER loading is complete
             const finalInputCount = getPackInputs().length;
             const initialInputCount = parseInt($('#pfp-count').attr('max'), 10) || 0; // Get initial count from UI max attr
             if (config.autoFillLoaded && finalInputCount > initialInputCount) {
                  GM_log(`Pack Filler Pro: IntersectionObserver finished, new inputs loaded (${finalInputCount - initialInputCount}). Triggering final auto-fill.`);
                  // Small delay before filling to ensure inputs are fully rendered/interactive
                  setTimeout(() => {
                      fillPacks(config, true); // Pass config and isAutoFill=true
                  }, 100);
             } else if (config.autoFillLoaded && finalInputCount === initialInputCount && finalInputCount > 0) {
                   // If auto-fill is enabled but no *new* inputs loaded, maybe fill the initial ones if they weren't?
                   // Or assume auto-fill loaded only applies to newly loaded? Let's stick to newly loaded for now.
                   GM_log("Pack Filler Pro: IntersectionObserver finished, no new inputs loaded. Auto-fill skipped.");
             }


             originalResolve(); // Call the original resolve
        };

        // Update the observer callback to use the new resolved function
        const originalObserverCallback = observer.callback;
         observer.callback = (entries, observerInstance) => {
              // Pass the modified resolve function to the original callback if needed
              // Or handle all logic directly here before calling originalResolve
              // Let's handle the logic directly here for clarity
              const buttonEntry = entries.find(entry => entry.target === loadMoreButton);

              if (!document.body.contains(loadMoreButton)) {
                   GM_log("Pack Filler Pro: Load More button removed from DOM. Assuming end of content. Disconnecting observer.");
                   resolve(); // Use the modified resolve
                   return;
              }

              if (buttonEntry && buttonEntry.isIntersecting) {
                   const isButtonVisibleAndEnabled = loadMoreButton.offsetParent !== null && !loadMoreButton.disabled;
                   if (isButtonVisibleAndEnabled) {
                        GM_log(`Pack Filler Pro: Load More button intersected. Scrolling (${scrollAttempts + 1}/${maxAttempts}).`);
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        scrollAttempts++;
                        if (scrollAttempts >= maxAttempts) {
                             GM_log(`Pack Filler Pro: Reached max scroll attempts (${maxAttempts}) with IntersectionObserver. Disconnecting observer.`);
                             resolve(); // Use the modified resolve
                        }
                        resetSafetyTimeout();
                   } else {
                        GM_log("Pack Filler Pro: Load More button is intersecting but not visible or is disabled. Assuming end of content. Disconnecting observer.");
                        resolve(); // Use the modified resolve
                   }
              }
         };

    });
}

/**
 * Loads the full page using programmatic scrolling and polling for height/input changes (fallback).
 * @param {object} config - The script's configuration object.
 * @returns {Promise<void>} A promise that resolves when loading is deemed complete.
 */
async function loadWithScrollPolling(config) {
     GM_log("Pack Filler Pro: Using scroll polling fallback.");
     const scrollDelay = 300; // ms to wait after each scroll
     const scrollCheckIterations = 20; // Number of times to check for height/input change after a scroll
     const scrollCheckInterval = 100; // ms between height/input checks
     const maxScrollAttempts = 200; // Safety break for excessive scrolling

     let lastHeight = 0;
     let currentHeight = document.body.scrollHeight;
     let lastInputCount = 0; // Track input count to detect loading
     let currentInputCount = getPackInputs().length;
     let scrollAttempts = 0;
     const initialInputCount = currentInputCount; // Capture initial count for auto-fill check

     // Initial short wait for page elements to render
     await new Promise(resolve => setTimeout(resolve, 500));
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
                 GM_log(`Pack Filler Pro: Polling detected content increase (Height: ${currentHeight - lastHeight}, Inputs: ${currentInputCount - lastInputCount}) in scroll attempt ${scrollAttempts}.`);
                 break; // Content increased, likely loaded more, break inner loop and check again
             }
         }

         scrollAttempts++;

         // Break if neither height nor input count increased after checks
         if (!contentIncreased) {
             GM_log(`Pack Filler Pro: Polling: Page height and input count did not increase after ${scrollCheckIterations} checks in scroll attempt ${scrollAttempts}. Final height: ${currentHeight}, Final Inputs: ${currentInputCount}. Stopping scroll.`);
             break;
         }

         // Check for a Load More button as an alternative end condition, even in polling
         const loadMoreButton = document.querySelector('.load-more-btn');
         if (loadMoreButton && (!loadMoreButton.offsetParent || loadMoreButton.disabled)) {
              GM_log("Pack Filler Pro: Polling detected Load More button is now hidden or disabled. Assuming end of content.");
              break;
         }

         // Add a general delay between scrolls if content did increase
         await new Promise(resolve => setTimeout(resolve, scrollDelay));
     }

     if (scrollAttempts >= maxScrollAttempts) {
         GM_log(`Pack Filler Pro: Polling reached max scroll attempts (${maxScrollAttempts}). Stopping auto-load.`);
     }

     // Trigger auto-fill if enabled AFTER loading is complete
     const finalInputCount = getPackInputs().length;
     if (config.autoFillLoaded && finalInputCount > initialInputCount) {
         GM_log(`Pack Filler Pro: Polling finished, new inputs loaded (${finalInputCount - initialInputCount}). Triggering final auto-fill.`);
         // Small delay before filling to ensure inputs are fully rendered/interactive
         setTimeout(() => {
             fillPacks(config, true); // Pass config and isAutoFill=true
         }, 100);
     } else if (config.autoFillLoaded && finalInputCount === initialInputCount && finalInputCount > 0) {
         // If auto-fill is enabled but no *new* inputs loaded, maybe fill the initial ones if they weren't?
         // Let's stick to filling only newly loaded inputs when autoFillLoaded is true.
         GM_log("Pack Filler Pro: Polling finished, no new inputs loaded. Auto-fill skipped.");
     }

     // The promise resolves implicitly when the async function finishes.
}


// The function loadFullPageIfNeeded is made available to the main script's scope via @require.
// loadWithIntersectionObserver and loadWithScrollPolling are internal helpers.

