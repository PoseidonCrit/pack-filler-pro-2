// This file provides the drag and snap functionality for the UI panel.
// It relies on the interactjs library (window.interact), which is assumed to be
// loaded via @require in the main script.
// Note: This module now accepts the 'config' object and calls updatePanelVisibility with it.

// It assumes 'panelElement' from the main script's scope,
// and 'updatePanelVisibility' from src/uiManager.js is available via @require.

/* --- Drag Functionality (Adapted) --- */
// Initializes drag and snap functionality for the panel header.
// Assumes panelEl is the main panel DOM element.
/**
 * Initializes drag and snap functionality for the panel header.
 * @param {object} config - The script's configuration object.
 * @param {HTMLElement} panelEl - The main panel DOM element.
 */
function initDrag(config, panelEl) { // Accept config here
    // Assumes window.interact is available via @require in main script
    if (typeof window.interact === 'undefined' || !panelEl) {
        GM_log("Pack Filler Pro: interactjs library not available or panel not found. Drag functionality disabled."); // Assumes GM_log is available
        return;
    }
    GM_log("Pack Filler Pro: Initializing drag functionality.");

    window.interact('.pfp-header').draggable({
        inertia: true,
        autoScroll: true,
        // Note: interactjs handles its own touch/pointer events and uses preventDefault
        // internally for drag behavior, so passive: true is not applicable here
        // without breaking the drag functionality.
        listeners: {
            move (event) {
                const target = panelEl;
                const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);

                // Clear position styles during drag to rely solely on transform
                target.style.right = 'auto';
                target.style.left = 'auto';
                target.style.top = 'auto';
                target.style.bottom = 'auto';
            },
            end (event) {
                const target = panelEl;
                const rect = target.getBoundingClientRect();
                const finalLeft = rect.left;
                const finalTop = rect.top;
                const finalBottom = window.innerHeight - rect.bottom;


                target.style.transform = 'none';
                target.removeAttribute('data-x');
                target.removeAttribute('data-y');

                // Snap logic: Snap to left/right, keep vertical position relative to nearest edge (top/bottom)
                const windowWidth = window.innerWidth;
                const panelWidth = target.offsetWidth;
                const snapThresholdX = windowWidth * 0.5; // Snap left/right based on horizontal center

                let snappedPos = {};

                // Snap left or right
                if (finalLeft + panelWidth / 2 > snapThresholdX) {
                    snappedPos.right = '16px';
                    snappedPos.left = 'auto';
                } else {
                    snappedPos.left = '16px';
                    snappedPos.right = 'auto';
                }

                // Snap top or bottom based on which edge is closer
                const snapThresholdY = window.innerHeight * 0.5; // Snap top/bottom based on vertical center
                const panelHeight = target.offsetHeight;

                if (finalTop + panelHeight / 2 > snapThresholdY) {
                     // Closer to the bottom edge
                     snappedPos.bottom = `${Math.max(16, finalBottom)}px`; // Snap to 16px from bottom, ensure >= 16
                     snappedPos.top = 'auto';
                } else {
                     // Closer to the top edge
                     snappedPos.top = `${Math.max(16, finalTop)}px`; // Snap to 16px from top, ensure >= 16
                     snappedPos.bottom = 'auto';
                }


                    updatePanelVisibility(config, config.panelVisible, snappedPos); // Pass config
                    GM_log(`Pack Filler Pro: Panel drag ended. Position: ${JSON.stringify(config.panelPos)}`);
                }
            }
        }).allowFrom('.pfp-header');
    }

// The function initDrag is made available to the main script's scope via @require.
