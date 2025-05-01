// This file contains the HTML structure and CSS styles for the UI panel and toggle button.
// It defines constants for HTML strings and a function to add CSS styles using GM_addStyle.

// Assumes GM_addStyle is granted in the main script header.
// Assumes constants like MAX_QTY, PANEL_ID, TOGGLE_BUTTON_ID, etc. are accessible.
// Assumes GM_info.script.version is accessible for version display.


/* --- UI Panel HTML --- */
// Define the minimal HTML structure for the UI panel.
const panelHTML = `
      <div id="${PANEL_ID}" class="pfp-panel">
        <div class="pfp-header" title="Drag to move panel">
          <span class="pfp-title">Pack Filler Pro</span>
          <span class="pfp-close" title="Close Panel">×</span>
        </div>
        <div class="pfp-body">
          <div class="pfp-form-group">
            <label for="${MODE_SELECT_ID}" class="pfp-label">Fill Mode:</label>
            <select id="${MODE_SELECT_ID}" class="pfp-select">
              <option value="fixed">Fixed Count</option>
              <option value="random">Random Count</option>
              <option value="unlimited">All Visible Packs</option>
            </select>
          </div>

          <div class="pfp-form-group" id="pfp-count-group">
            <label for="${COUNT_INPUT_ID}" class="pfp-label">Number of Packs:</label>
            <input type="number" id="${COUNT_INPUT_ID}" min="0" class="pfp-input" placeholder="e.g., 10" />
          </div>

          <div class="pfp-form-group" id="pfp-fixed-group">
            <label for="${FIXED_INPUT_ID}" class="pfp-label">Copies per Pack:</label>
            <input type="number" id="${FIXED_INPUT_ID}" min="0" max="${MAX_QTY}" class="pfp-input" placeholder="e.g., 1" />
          </div>

          <div id="pfp-range-inputs">
             <div class="pfp-form-group pfp-range-group">
               <label for="${MIN_INPUT_ID}" class="pfp-label">Min Copies (Random):</label>
               <input type="number" id="${MIN_INPUT_ID}" min="0" max="${MAX_QTY}" class="pfp-input" placeholder="e.g., 1" />
             </div>
             <div class="pfp-form-group pfp-range-group">
               <label for="${MAX_INPUT_ID}" class="pfp-label">Max Copies (Random):</label>
               <input type="number" id="${MAX_INPUT_ID}" min="0" max="${MAX_QTY}" class="pfp-input" placeholder="e.g., 5" />
             </div>
          </div>

          <div class="pfp-form-check">
            <input type="checkbox" id="${CLEAR_INPUTS_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${CLEAR_INPUTS_CHECKBOX_ID}" class="pfp-label pfp-label-inline">Clear inputs before filling</label>
          </div>

             <div class="pfp-form-check">
            <input type="checkbox" id="${DARK_MODE_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${DARK_MODE_CHECKBOX_ID}" class="pfp-label pfp-label-inline">Enable Dark Mode</label>
          </div>


          <div class="pfp-form-actions">
            <button id="${FILL_PACKS_BTN_ID}" class="pfp-button pfp-button-primary">Fill Packs</button>
            <button id="${CLEAR_ALL_BTN_ID}" class="pfp-button pfp-button-secondary">Clear All</button>
          </div>

        </div>
        <div class="pfp-footer">
          <span class="pfp-version">v${typeof GM_info !== 'undefined' && GM_info.script ? GM_info.script.version : 'N/A'}</span>
        </div>
      </div>
    `;

// Define the HTML for the toggle button
const panelToggleHTML = `
         <button id="${TOGGLE_BUTTON_ID}" class="pfp-toggle-button" title="Toggle Pack Filler Pro Panel">
             🎴
         </button>
    `;


/* --- UI Panel CSS --- */
// Defines the minimal CSS styles.
function addPanelCSS() {
    // Check if GM_addStyle is available before attempting to use it
    if (typeof GM_addStyle === 'undefined') {
        // GM_log("Pack Filler Pro: GM_addStyle function not available. Cannot inject CSS."); // Minimal logging
        return; // Abort if GM_addStyle is missing
    }

    GM_addStyle(`
        /* --- Minimal mini.css base for buttons --- */
        button.mini, .pfp-button {
             box-sizing: border-box;
             font-family: inherit;
             font-size: 1rem;
             line-height: 1.5;
             margin: 5px; /* Add margin around buttons */
             padding: .375rem .75rem;
             cursor: pointer;
             text-decoration: none;
             display: inline-block;
             font-weight: 400;
             text-align: center;
             vertical-align: middle;
             user-select: none;
             border: 1px solid transparent;
             border-radius: .25rem;
             transition: color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;
        }
         button.mini:hover, .pfp-button:hover { text-decoration: none; }


        button.mini.primary, .pfp-button-primary { color: #fff; background-color: #007bff; border-color: #007bff; }
        button.mini.primary:hover, .pfp-button-primary:hover { background-color: #0056b3; border-color: #0056b3; }

        button.mini.secondary, .pfp-button-secondary { color: #fff; background-color: #6c757d; border-color: #6c757d; }
        button.mini.secondary:hover, .pfp-button-secondary:hover { background-color: #545b62; border-color: #545b62; }


        /* --- Pack Filler Pro Panel Minimal Styles --- */
        .pfp-panel {
            position: fixed;
            width: 300px; /* Minimal width */
            background-color: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(0, 0, 0, 0.1);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
            border-radius: 8px;
            z-index: 9999; /* Ensure it's above page content */
            overflow: hidden; /* Keep contents within bounds */
            color: #333; /* Default text color */
             display: flex;
             flex-direction: column;
             max-height: 90vh;
        }

         /* Minimal Dark Mode for Panel */
         .pfp-panel.dark-mode {
             background-color: rgba(45, 45, 50, 0.95);
             border-color: rgba(255, 255, 255, 0.1);
             box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
             color: #eee;
         }


        .pfp-header {
            background-color: #007bff;
            color: #fff;
            padding: 10px 15px;
            font-weight: bold;
            cursor: grab;
            display: flex;
            justify-content: space-between;
            align-items: center;
             flex-shrink: 0;
        }

         /* Minimal Dark Mode for Header */
         .pfp-panel.dark-mode .pfp-header {
             background-color: #5a9bff; /* Lighter primary for dark mode */
             color: #fff;
         }


        .pfp-title {
            flex-grow: 1;
        }

        .pfp-close {
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            color: #fff;
            margin-left: 10px;
            padding: 0 5px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
             flex-shrink: 0;
        }
        .pfp-close:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }

         /* Minimal Dark Mode for Close Button */
         .pfp-panel.dark-mode .pfp-close {
             color: #fff;
         }
          .pfp-panel.dark-mode .pfp-close:hover {
             background-color: rgba(0, 0, 0, 0.1);
         }


        .pfp-body {
            padding: 15px;
            overflow-y: auto;
             flex-grow: 1;
        }


        .pfp-footer {
            padding: 8px 15px;
            font-size: 0.8em;
            text-align: right;
            color: #555;
             flex-shrink: 0;
        }

         /* Minimal Dark Mode for Footer */
         .pfp-panel.dark-mode .pfp-footer {
             color: #bbb;
         }


        .pfp-form-group {
            margin-bottom: 15px;
            display: flex;
            flex-direction: column;
        }


        .pfp-label {
            display: block;
            margin-bottom: 5px;
            font-weight: normal;
            color: #555;
            font-size: 0.9em;
        }

         /* Minimal Dark Mode for Labels */
         .pfp-panel.dark-mode .pfp-label {
             color: #bbb;
         }


        .pfp-input, .pfp-select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid rgba(0, 0, 0, 0.15);
            border-radius: 4px;
            background-color: rgba(255, 255, 255, 0.85);
            color: #333;
            font-size: 1em;
            transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
            box-sizing: border-box;
        }

         /* Minimal Dark Mode for Inputs and Selects */
         .pfp-panel.dark-mode .pfp-input,
         .pfp-panel.dark-mode .pfp-select {
             background-color: rgba(60, 60, 65, 0.85);
             border-color: rgba(255, 255, 255, 0.2);
             color: #eee;
         }


        .pfp-input:focus, .pfp-select:focus {
            border-color: #007bff;
            outline: 0;
            box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }


        .pfp-form-check {
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }

        .pfp-checkbox {
            margin-right: 8px;
            width: 16px;
            height: 16px;
            border: 1px solid rgba(0, 0, 0, 0.25);
            border-radius: 3px;
            appearance: none;
            cursor: pointer;
            position: relative;
            flex-shrink: 0;
             background-color: rgba(255, 255, 255, 0.85);
        }
         /* Minimal Dark Mode for Checkbox */
         .pfp-panel.dark-mode .pfp-checkbox {
             border-color: rgba(255, 255, 255, 0.35);
              background-color: rgba(60, 60, 65, 0.85);
         }


        .pfp-checkbox:checked {
            background-color: #007bff;
            border-color: #007bff;
        }
         /* Minimal Dark Mode for Checked Checkbox */
         .pfp-panel.dark-mode .pfp-checkbox:checked {
             background-color: #5a9bff;
             border-color: #5a9bff;
         }


        .pfp-checkbox:checked::after {
            content: '✔';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 10px;
             line-height: 1;
        }

        .pfp-label-inline {
            margin-bottom: 0;
            cursor: pointer;
            flex-grow: 1;
        }


        .pfp-form-actions {
            margin-top: 20px;
            text-align: center;
             display: flex;
             justify-content: center;
             flex-wrap: wrap;
        }

        .pfp-button {
            /* Inherits base styles from mini.css subset at the top */
            margin: 5px;
             min-width: 100px; /* Smaller min-width for minimal */
        }


        .pfp-toggle-button {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9998;
            background-color: #007bff;
            color: #fff;
            border: 1px solid #007bff;
            border-radius: 4px;
            padding: 5px 10px;
            font-size: 1.2em;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
            transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .pfp-toggle-button:hover {
            background-color: #0056b3;
            border-color: #0056b3;
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
        }

         /* Minimal Dark Mode for Toggle Button */
         .pfp-toggle-button.dark-mode {
             background-color: #5a9bff;
             color: #fff;
             border-color: #5a9bff;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
         }
         .pfp-toggle-button.dark-mode:hover {
              background-color: #3a8be2;
              border-color: #3a8be2;
              box-shadow: 0 3px 6px rgba(0, 0, 0, 0.5);
         }


        .hidden {
            display: none !important;
        }


        /* Minimal SweetAlert2 Custom Styles */
        /* These styles ensure consistency and dark mode compatibility for Swal popups */

        .pfp-swal-popup {
            background-color: rgba(255, 255, 255, 0.95) !important;
            color: #333 !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25) !important;
        }
         /* Minimal Dark Mode for Swal Popup */
         .pfp-swal-popup.dark-mode {
              background-color: rgba(45, 45, 50, 0.95) !important;
              color: #eee !important;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5) !important;
              border-color: rgba(255, 255, 255, 0.1) !important;
              border-width: 1px !important;
              border-style: solid !important;
         }


        .pfp-swal-title {
            color: #333 !important;
        }
          /* Minimal Dark Mode for Swal Title (Swal adds swal2-title class) */
          .pfp-swal-popup.dark-mode .swal2-title {
              color: #eee !important;
          }


        .pfp-swal-html {
            color: #555 !important;
            text-align: left !important;
        }
          /* Minimal Dark Mode for Swal HTML (Swal adds swal2-html-container class) */
          .pfp-swal-popup.dark-mode .swal2-html-container {
              color: #bbb !important;
          }


        .pfp-swal-toast-popup {
            background-color: rgba(255, 255, 255, 0.95) !important;
            color: #333 !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25) !important;
            padding: 10px 15px !important;
        }
         /* Minimal Dark Mode for Swal Toast Popup */
         .pfp-swal-toast-popup.dark-mode {
             background-color: rgba(45, 45, 50, 0.95) !important;
             color: #eee !important;
             box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5) !important;
              border-color: rgba(255, 255, 255, 0.1) !important;
              border-width: 1px !important;
              border-style: solid !important;
         }

        .pfp-swal-toast-popup .swal2-header {
            display: flex !important;
            align-items: center !important;
            padding: 0 !important;
        }

        .pfp-swal-toast-popup .swal2-title {
            margin: 0 !important;
            font-size: 14px !important;
            font-weight: normal !important;
            text-align: left !important;
             flex-grow: 1;
            padding: 0 0.6em !important;
        }
        .pfp-swal-toast-popup .swal2-icon {
            margin-right: 12px !important;
            margin-left: 0 !important;
            width: 28px !important;
            height: 28px !important;
             flex-shrink: 0;
            position: static !important;
        }
         .pfp-swal-toast-popup .swal2-close {
             position: static !important;
              margin-left: 10px !important;
              align-self: flex-start;
              font-size: 1.5em !important;
         }
         .pfp-swal-toast-popup .swal2-html-container {
             margin: 0.5em 0 0 !important;
             padding: 0 !important;
             text-align: left !important;
         }

         /* Ensure the panel is draggable */
         .pfp-panel .pfp-header {
             cursor: grab;
         }
         .pfp-panel.dragging .pfp-header {
             cursor: grabbing;
         }

         /* Hide elements not needed for minimal version */
         #pfp-pattern-params, #${FILL_RANDOM_BTN_ID} {
             display: none !important;
         }


         /* Media query for smaller screens */
         @media (max-width: 600px) {
             .pfp-panel {
                 width: 95vw;
                 max-width: none;
                 right: 2.5vw !important;
                 left: 2.5vw !important;
                 top: 10px !important;
                 bottom: auto !important;
             }
              .pfp-toggle-button {
                 right: 5px;
                 top: 5px;
              }
              .pfp-button {
                   width: 100%; /* Make buttons full width on small screens */
              }
         }

    `);
    // GM_log("Pack Filler Pro: UI CSS added."); // Minimal logging
}


// The constants panelHTML, panelToggleHTML and the function addPanelCSS are made available
// to the main script's scope via @require.
