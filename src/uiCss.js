// This file contains the HTML structure and CSS styles for the UI panel and toggle button.
// It defines constants for HTML strings and a function to add CSS styles using GM_addStyle.

// Assumes GM_addStyle is granted in the main script header.
// Assumes constants like MAX_QTY, PANEL_ID, TOGGLE_BUTTON_ID, etc. are accessible.
// Assumes GM_info.script.version is accessible for version display.


/* --- UI Panel HTML --- */
// Define the HTML structure for the UI panel using template literals and constants.
// This string will be inserted into the DOM by the main script.
const panelHTML = `
      <div id="${PANEL_ID}" class="pfp-panel">
        <div class="pfp-header" title="Drag to move panel">
          <span class="pfp-title">Pack Filler Pro</span>
          <span class="pfp-close" title="Close Panel">×</span>
        </div>
        <div class="pfp-body" data-simplebar>
          <div class="pfp-form-group">
            <label for="${MODE_SELECT_ID}" class="pfp-label">Fill Mode:</label>
            <select id="${MODE_SELECT_ID}" class="pfp-select">
              <option value="fixed">Fixed Count</option>
              <option value="max">Random Count (Range)</option>
              <option value="unlimited">All Visible Packs</option>
            </select>
          </div>

          <div class="pfp-form-group" id="pfp-count-group">
            <label for="${COUNT_INPUT_ID}" class="pfp-label">Number of Packs to Fill:</label>
            <input type="number" id="${COUNT_INPUT_ID}" min="0" list="pfp-count-list" class="pfp-input" placeholder="e.g., 10" />
            <datalist id="pfp-count-list">
                <option value="1"><option value="5"><option value="10"><option value="24"><option value="50"><option value="100"><option value="250"><option value="500">
            </datalist>
          </div>

          <div class="pfp-form-group" id="pfp-fixed-group">
            <label for="${FIXED_INPUT_ID}" class="pfp-label">Copies per Pack:</label>
            <input type="number" id="${FIXED_INPUT_ID}" min="0" max="${MAX_QTY}" list="pfp-fixed-list" class="pfp-input" placeholder="e.g., 1 or 3" />
            <datalist id="pfp-fixed-list">
                <option value="0"><option value="1"><option value="3"><option value="5"><option value="10"><option value="20"><option value="50"><option value="99">
            </datalist>
          </div>

          <div id="pfp-range-inputs">
             <div class="pfp-form-group pfp-range-group">
               <label for="${MIN_INPUT_ID}" class="pfp-label">Min Copies (Random):</label>
               <input type="number" id="${MIN_INPUT_ID}" min="0" max="${MAX_QTY}" list="pfp-range-list" class="pfp-input" placeholder="e.g., 1" />
               <datalist id="pfp-range-list">
                    <option value="0"><option value="1"><option value="2"><option value="3"><option value="5"><option value="10"><option value="20"><option value="50">
                </datalist>
             </div>
             <div class="pfp-form-group pfp-range-group">
               <label for="${MAX_INPUT_ID}" class="pfp-label">Max Copies (Random):</label>
               <input type="number" id="${MAX_INPUT_ID}" min="0" max="${MAX_QTY}" list="pfp-range-list" class="pfp-input" placeholder="e.g., 5" />
             </div>
             <div class="pfp-form-group pfp-range-group" id="pfp-max-total-group">
               <label for="${MAX_TOTAL_INPUT_ID}" class="pfp-label">Max Total Copies (0 to disable):</label>
               <input type="number" id="${MAX_TOTAL_INPUT_ID}" min="0" class="pfp-input" placeholder="e.g., 100" />
             </div>
          </div>

          <div class="pfp-options-divider">Pattern & Single Fill</div>

             <div class="pfp-form-group">
                 <label for="${PATTERN_TYPE_SELECT_ID}" class="pfp-label">Fill Pattern:</label>
                 <select id="${PATTERN_TYPE_SELECT_ID}" class="pfp-select">
                     <option value="random">Random</option>
                     <option value="fixed">Fixed</option>
                     <option value="gradient">Gradient</option>
                     <option value="perlin">Perlin Noise</option>
                      <option value="alternating">Alternating Min/Max</option>
                 </select>
             </div>

            <div id="${PATTERN_PARAMS_DIV_ID}">
                 <div class="pfp-form-group">
                     <label for="${NOISE_SEED_INPUT_ID}" class="pfp-label">Noise Seed (leave empty for random):</label>
                     <input type="text" id="${NOISE_SEED_INPUT_ID}" class="pfp-input" placeholder="e.g., 12345" />
                 </div>
                 <div class="pfp-form-group">
                     <label for="${PATTERN_SCALE_INPUT_ID}" class="pfp-label">Pattern Scale (<span id="pfp-pattern-scale-value"></span>):</label>
                     <input type="range" id="${PATTERN_SCALE_INPUT_ID}" class="pfp-input pfp-range" min="10" max="1000" step="1" />
                 </div>
                 <div class="pfp-form-group">
                     <label for="${PATTERN_INTENSITY_INPUT_ID}" class="pfp-label">Pattern Intensity (<span id="pfp-pattern-intensity-value"></span>):</label>
                     <input type="range" id="${PATTERN_INTENSITY_INPUT_ID}" class="pfp-input pfp-range" min="0" max="100" step="1" />
                 </div>
            </div>

             <div class="pfp-form-actions">
                 <button id="${FILL_RANDOM_BTN_ID}" class="pfp-button pfp-button-secondary" title="Fill a single random pack with a quantity based on settings">Fill 1 Random Pack</button>
             </div>

             <div class="pfp-options-divider">General Options</div>

          <div class="pfp-form-check">
            <input type="checkbox" id="${CLEAR_INPUTS_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${CLEAR_INPUTS_CHECKBOX_ID}" class="pfp-label pfp-label-inline">Clear inputs before filling</label>
          </div>
         <div class="pfp-form-check">
            <input type="checkbox" id="${FILL_EMPTY_ONLY_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${FILL_EMPTY_ONLY_CHECKBOX_ID}" class="pfp-label pfp-label-inline" title="Only fill quantities for inputs that are currently empty or 0.">Fill empty inputs only</label>
          </div>

             <div class="pfp-form-check">
            <input type="checkbox" id="${DARK_MODE_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${DARK_MODE_CHECKBOX_ID}" class="pfp-label pfp-label-inline">Enable Dark Mode</label>
          </div>

          <div class="pfp-form-actions">
            <button id="${FILL_PACKS_BTN_ID}" class="pfp-button pfp-button-primary" title="Fill pack inputs based on current settings">Fill Packs</button>
            <button id="${CLEAR_ALL_BTN_ID}" class="pfp-button pfp-button-secondary" title="Set all pack inputs to zero">Clear All</button>
          </div>

        </div>
        <div class="pfp-footer">
          <span class="pfp-version">v${typeof GM_info !== 'undefined' && GM_info.script ? GM_info.script.version : 'N/A'}</span>
        </div>
      </div>
    `;

// Define the HTML for the toggle button
// This string will be inserted into the DOM by the main script.
const panelToggleHTML = `
         <button id="${TOGGLE_BUTTON_ID}" class="pfp-toggle-button" title="Toggle Pack Filler Pro Panel">
             🎴
         </button>
    `;


/* --- UI Panel CSS --- */
// Defines the CSS styles for the UI panel and toggle button.
// Uses CSS variables for theming, especially dark mode.
// Assumes GM_addStyle is granted and constants are accessible.
function addPanelCSS() {
    // Check if GM_addStyle is available before attempting to use it
    if (typeof GM_addStyle === 'undefined') {
        GM_log("Pack Filler Pro: GM_addStyle function not available. Cannot inject CSS.");
        return; // Abort if GM_addStyle is missing
    }

    GM_addStyle(`
        /* --- mini.css base (subset used for Swal buttons) --- */
        /* Adding a basic reset to ensure mini.css buttons look consistent */
        button.mini, .pfp-button {
             box-sizing: border-box;
             font-family: inherit; /* Inherit font from page */
             font-size: 1rem; /* Keep consistent font size */
             line-height: 1.5;
             margin: 0; /* Reset default margin */
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


        button.mini.primary, .pfp-button-primary { color: var(--pfp-primary-text, #fff); background-color: var(--pfp-primary-color); border-color: var(--pfp-primary-color); }
        button.mini.primary:hover, .pfp-button-primary:hover { background-color: var(--pfp-primary-hover); border-color: var(--pfp-primary-hover); }

        button.mini.secondary, .pfp-button-secondary { color: var(--pfp-secondary-text); background-color: var(--pfp-secondary-color); border-color: var(--pfp-secondary-color); }
        button.mini.secondary:hover, .pfp-button-secondary:hover { background-color: var(--pfp-secondary-hover); border-color: var(--pfp-secondary-hover); }


        /* --- Pack Filler Pro Panel Styles --- */
        :root { /* CSS Variables for theming */
            --pfp-bg-color: rgba(255, 255, 255, 0.95);
            --pfp-border-color: rgba(0, 0, 0, 0.1);
            --pfp-shadow-color: rgba(0, 0, 0, 0.25);
            --pfp-text-color: #333;
            --pfp-label-color: #555;
            --pfp-primary-color: #007bff;
             --pfp-primary-text: #fff; /* Explicitly defined */
            --pfp-primary-hover: #0056b3;
            --pfp-secondary-color: #6c757d;
            --pfp-secondary-hover: #545b62;
            --pfp-secondary-text: #fff; /* Explicitly defined */
            --pfp-panel-width: 360px; /* Slightly wider */
            --pfp-border-radius: 8px;
            --pfp-focus-color: #007bff;
            --pfp-focus-shadow: rgba(0, 123, 255, 0.25);
            --pfp-input-bg: rgba(255, 255, 255, 0.85);
            --pfp-input-border: rgba(0, 0, 0, 0.15);
            --pfp-header-bg: var(--pfp-primary-color);
            --pfp-header-text: #fff;
            --pfp-close-color: #fff;
            --pfp-close-hover-bg: rgba(255, 255, 255, 0.1);
            --pfp-divider-color: rgba(0, 0, 0, 0.2); /* Darker divider */
            --pfp-checkbox-border: rgba(0, 0, 0, 0.25);
            --pfp-checkbox-checked-bg: var(--pfp-primary-color);
            --pfp-checkbox-checked-border: var(--pfp-primary-color);

             /* Dark Mode Variables */
             --pfp-dark-bg-color: rgba(45, 45, 50, 0.95);
             --pfp-dark-border-color: rgba(255, 255, 255, 0.1);
             --pfp-dark-shadow-color: rgba(0, 0, 0, 0.5);
             --pfp-dark-text-color: #eee;
             --pfp-dark-label-color: #bbb;
             --pfp-dark-primary-color: #5a9bff; /* Lighter primary for dark mode */
             --pfp-dark-primary-hover: #3a8be2;
             --pfp-dark-secondary-color: #888; /* Lighter secondary for dark mode */
             --pfp-dark-secondary-hover: #666;
             --pfp-dark-secondary-text: #fff;
             --pfp-dark-input-bg: rgba(60, 60, 65, 0.85);
             --pfp-dark-input-border: rgba(255, 255, 255, 0.2);
             --pfp-dark-header-bg: var(--pfp-dark-primary-color);
             --pfp-dark-header-text: #fff;
             --pfp-dark-close-color: #fff;
             --pfp-dark-close-hover-bg: rgba(0, 0, 0, 0.1);
             --pfp-dark-divider-color: rgba(255, 255, 255, 0.2);
             --pfp-dark-checkbox-border: rgba(255, 255, 255, 0.35);
             --pfp-dark-checkbox-checked-bg: var(--pfp-dark-primary-color);
             --pfp-dark-checkbox-checked-border: var(--pfp-dark-primary-color);
         }


        .pfp-panel {
            position: fixed;
            width: var(--pfp-panel-width);
            background-color: var(--pfp-bg-color);
            border: 1px solid var(--pfp-border-color);
            box-shadow: 0 4px 8px var(--pfp-shadow-color);
            border-radius: var(--pfp-border-radius);
            z-index: 9999; /* Ensure it's above page content */
            overflow: hidden; /* Keep contents within bounds */
            color: var(--pfp-text-color); /* Default text color */
             display: flex; /* Use flexbox for layout */
             flex-direction: column; /* Stack header, body, footer */
             max-height: 90vh; /* Limit max height to viewport height */
             resize: both; /* Allow resizing */
             min-width: 250px; /* Minimum width */
             min-height: 150px; /* Minimum height */
        }

         /* Dark Mode for Panel */
         .pfp-panel.dark-mode {
             background-color: var(--pfp-dark-bg-color);
             border-color: var(--pfp-dark-border-color);
             box-shadow: 0 4px 8px var(--pfp-dark-shadow-color);
             color: var(--pfp-dark-text-color);
         }


        .pfp-header {
            background-color: var(--pfp-header-bg);
            color: var(--pfp-header-text);
            padding: 10px 15px;
            font-weight: bold;
            cursor: grab; /* Indicate draggable area */
            display: flex; /* Arrange title and close button */
            justify-content: space-between; /* Space between title and close */
            align-items: center; /* Vertically align */
             flex-shrink: 0; /* Prevent header from shrinking */
        }

         /* Dark Mode for Header */
         .pfp-panel.dark-mode .pfp-header {
             background-color: var(--pfp-dark-header-bg);
             color: var(--pfp-dark-header-text);
         }


        .pfp-title {
            flex-grow: 1; /* Allow title to take space */
        }

        .pfp-close {
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            color: var(--pfp-close-color);
            margin-left: 10px;
            padding: 0 5px; /* Add padding for easier clicking */
            border-radius: 4px; /* Slight rounded corners */
            transition: background-color 0.2s ease;
             flex-shrink: 0; /* Prevent close button from shrinking */
        }
        .pfp-close:hover {
            background-color: var(--pfp-close-hover-bg);
        }

         /* Dark Mode for Close Button */
         .pfp-panel.dark-mode .pfp-close {
             color: var(--pfp-dark-close-color);
         }
          .pfp-panel.dark-mode .pfp-close:hover {
             background-color: var(--pfp-dark-close-hover-bg);
         }


        .pfp-body {
            padding: 15px;
            overflow-y: auto; /* Enable vertical scrolling if content overflows */
             flex-grow: 1; /* Allow body to take remaining height */
             /* Ensure SimpleBar styles work correctly or fallback to native */
        }


        .pfp-footer {
            padding: 8px 15px;
            font-size: 0.8em;
            text-align: right;
            color: var(--pfp-label-color); /* Use a lighter color for footer text */
             flex-shrink: 0; /* Prevent footer from shrinking */
        }

         /* Dark Mode for Footer */
         .pfp-panel.dark-mode .pfp-footer {
             color: var(--pfp-dark-label-color);
         }


        .pfp-form-group {
            margin-bottom: 15px; /* Space below each form group */
            display: flex; /* Arrange label and input/select */
            flex-direction: column; /* Stack label above input */
        }

         .pfp-form-group.pfp-inline-group {
             flex-direction: row; /* Place label and input/button in a row */
             align-items: center; /* Vertically align items in the row */
             flex-wrap: wrap; /* Allow items to wrap on smaller screens */
         }
         .pfp-form-group.pfp-inline-group .pfp-label {
              margin-bottom: 0; /* Remove bottom margin for inline labels */
              margin-right: 10px; /* Add space to the right of the label */
              flex-shrink: 0; /* Prevent label from shrinking */
         }
         .pfp-form-group.pfp-inline-group .pfp-input.pfp-inline-input {
              flex-grow: 1; /* Allow the input to take up available space */
              margin-right: 10px; /* Space between input and button */
              min-width: 50px; /* Ensure input has a minimum width */
         }
         .pfp-form-group.pfp-inline-group .pfp-button.pfp-inline-button {
              flex-shrink: 0; /* Prevent the button from shrinking */
         }


        .pfp-label {
            display: block; /* Ensure label is on its own line (in column layout) */
            margin-bottom: 5px; /* Space between label and input */
            font-weight: normal; /* Less bold than title */
            color: var(--pfp-label-color);
            font-size: 0.9em; /* Slightly smaller font size */
        }

         /* Dark Mode for Labels */
         .pfp-panel.dark-mode .pfp-label {
             color: var(--pfp-dark-label-color);
         }


        .pfp-input, .pfp-select {
            width: 100%; /* Full width within the form group */
            padding: 8px 12px;
            border: 1px solid var(--pfp-input-border);
            border-radius: 4px;
            background-color: var(--pfp-input-bg);
            color: var(--pfp-text-color); /* Text color for inputs */
            font-size: 1em;
            transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
            box-sizing: border-box; /* Include padding and border in the element's total width and height */
        }

         /* Dark Mode for Inputs and Selects */
         .pfp-panel.dark-mode .pfp-input,
         .pfp-panel.dark-mode .pfp-select {
             background-color: var(--pfp-dark-input-bg);
             border-color: var(--pfp-dark-input-border);
             color: var(--pfp-dark-text-color);
         }


        .pfp-input:focus, .pfp-select:focus {
            border-color: var(--pfp-focus-color);
            outline: 0;
            box-shadow: 0 0 0 0.2rem var(--pfp-focus-shadow);
        }

         /* Style for range inputs */
         .pfp-input.pfp-range {
              padding: 0; /* Remove padding for range inputs */
              box-shadow: none; /* Remove focus shadow on range inputs */
              border: none; /* Remove border on range inputs */
              background: none; /* Remove background on range inputs */
              /* Further styling for thumb and track can be added */
         }


        .pfp-options-divider {
            margin: 20px 0;
            text-align: center;
            border-bottom: 1px solid var(--pfp-divider-color);
            line-height: 0.1em;
            font-size: 0.9em;
            color: var(--pfp-label-color);
            text-transform: uppercase; /* Make divider text uppercase */
            font-weight: bold; /* Make divider text bold */
        }

        .pfp-options-divider span {
            background: var(--pfp-bg-color);
            padding: 0 10px;
            display: inline-block; /* Ensure padding works */
        }
         /* Dark Mode for Divider */
         .pfp-panel.dark-mode .pfp-options-divider {
             border-bottom-color: var(--pfp-dark-divider-color);
             color: var(--pfp-dark-label-color);
         }
         .pfp-panel.dark-mode .pfp-options-divider span {
              background: var(--pfp-dark-bg-color);
         }


        .pfp-form-check {
            margin-bottom: 10px;
            display: flex; /* Align checkbox and label */
            align-items: center; /* Vertically align */
        }

        .pfp-checkbox {
            margin-right: 8px; /* Space between checkbox and label */
            /* Basic custom checkbox styling (optional, depends on browser defaults) */
            width: 16px;
            height: 16px;
            border: 1px solid var(--pfp-checkbox-border);
            border-radius: 3px;
            appearance: none; /* Hide default checkbox */
            cursor: pointer;
            position: relative; /* For custom checkmark */
            flex-shrink: 0; /* Prevent checkbox from shrinking */
             background-color: var(--pfp-input-bg); /* Match input background */
        }
         /* Dark Mode for Checkbox */
         .pfp-panel.dark-mode .pfp-checkbox {
             border-color: var(--pfp-dark-checkbox-border);
              background-color: var(--pfp-dark-input-bg);
         }


        .pfp-checkbox:checked {
            background-color: var(--pfp-checkbox-checked-bg);
            border-color: var(--pfp-checkbox-checked-border);
        }
         /* Dark Mode for Checked Checkbox */
         .pfp-panel.dark-mode .pfp-checkbox:checked {
             background-color: var(--pfp-dark-checkbox-checked-bg);
             border-color: var(--pfp-dark-checkbox-checked-border);
         }


        .pfp-checkbox:checked::after {
            content: '✔'; /* Custom checkmark */
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white; /* Checkmark color */
            font-size: 10px; /* Adjusted size */
             line-height: 1; /* Ensure vertical alignment */
        }

        .pfp-label-inline {
            margin-bottom: 0; /* Remove bottom margin for inline labels */
            cursor: pointer; /* Indicate it's clickable with the checkbox */
            flex-grow: 1; /* Allow the label to take available space */
        }


        .pfp-form-actions {
            margin-top: 20px;
            text-align: center;
             display: flex; /* Use flexbox for button layout */
             justify-content: center; /* Center buttons */
             flex-wrap: wrap; /* Allow buttons to wrap */
        }

        .pfp-button {
            /* Inherits base styles from mini.css subset at the top */
            margin: 5px; /* Add margin around buttons for spacing */
             min-width: 120px; /* Ensure buttons have a minimum width */
        }

         /* Remove specific first/last child margins if using general margin */
        /* .pfp-button:first-child { margin-left: 0; } */
        /* .pfp-button:last-child { margin-right: 0; } */


        .pfp-toggle-button {
            position: fixed;
            top: 10px; /* Position it fixed */
            right: 10px;
            z-index: 9998; /* Below the main panel */
            background-color: var(--pfp-primary-color);
            color: var(--pfp-primary-text, #fff);
            border: 1px solid var(--pfp-primary-color);
            border-radius: 4px;
            padding: 5px 10px;
            font-size: 1.2em;
            cursor: pointer;
            box-shadow: 0 2px 4px var(--pfp-shadow-color);
            transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .pfp-toggle-button:hover {
            background-color: var(--pfp-primary-hover);
            border-color: var(--pfp-primary-hover);
            box-shadow: 0 3px 6px var(--pfp-shadow-color);
        }

         /* Dark Mode for Toggle Button */
         .pfp-toggle-button.dark-mode {
             background-color: var(--pfp-dark-primary-color);
             color: var(--pfp-dark-header-text); /* Use header text color for consistency */
             border-color: var(--pfp-dark-primary-color);
              box-shadow: 0 2px 4px var(--pfp-dark-shadow-color);
         }
         .pfp-toggle-button.dark-mode:hover {
              background-color: var(--pfp-dark-primary-hover);
              border-color: var(--pfp-dark-primary-hover);
              box-shadow: 0 3px 6px var(--pfp-dark-shadow-color);
         }


        .hidden {
            display: none !important; /* Use !important to override potential flex/grid/block defaults */
        }


        /* SweetAlert2 Custom Styles - Applied dynamically via MutationObserver in uiManager.js */
        /* These styles ensure consistency and dark mode compatibility for Swal popups */

        .pfp-swal-popup {
            background-color: var(--pfp-bg-color) !important;
            color: var(--pfp-text-color) !important;
            border-radius: var(--pfp-border-radius) !important;
            box-shadow: 0 4px 8px var(--pfp-shadow-color) !important;
        }
         /* Dark Mode for Swal Popup */
         .pfp-swal-popup.dark-mode {
              background-color: var(--pfp-dark-bg-color) !important;
              color: var(--pfp-dark-text-color) !important;
              box-shadow: 0 4px 8px var(--pfp-dark-shadow-color) !important;
              border-color: var(--pfp-dark-border-color) !important; /* Add border for definition in dark mode */
              border-width: 1px !important;
              border-style: solid !important;
         }


        .pfp-swal-title {
            color: var(--pfp-text-color) !important;
        }
          /* Dark Mode for Swal Title (Swal adds swal2-title class) */
          .pfp-swal-popup.dark-mode .swal2-title {
              color: var(--pfp-dark-text-color) !important;
          }


        .pfp-swal-html {
            color: var(--pfp-label-color) !important;
            text-align: left !important; /* Align summary text left */
        }
          /* Dark Mode for Swal HTML (Swal adds swal2-html-container class) */
          .pfp-swal-popup.dark-mode .swal2-html-container {
              color: var(--pfp-dark-label-color) !important;
          }


        .pfp-swal-toast-popup {
            background-color: var(--pfp-bg-color) !important;
            color: var(--pfp-text-color) !important;
            box-shadow: 0 2px 4px var(--pfp-shadow-color) !important;
            padding: 10px 15px !important; /* Adjust padding for toasts */
        }
         /* Dark Mode for Swal Toast Popup */
         .pfp-swal-toast-popup.dark-mode {
             background-color: var(--pfp-dark-bg-color) !important;
             color: var(--pfp-dark-text-color) !important;
             box-shadow: 0 2px 4px var(--pfp-dark-shadow-color) !important;
              border-color: var(--pfp-dark-border-color) !important; /* Add border for definition in dark mode */
              border-width: 1px !important;
              border-style: solid !important;
         }

        .pfp-swal-toast-popup .swal2-header {
            display: flex !important; /* Use flexbox for header */
            align-items: center !important; /* Vertically align items */
            padding: 0 !important; /* Remove default padding */
        }

        .pfp-swal-toast-popup .swal2-title {
            margin: 0 !important;
            font-size: 14px !important; /* Keep title font size consistent with body */
            font-weight: normal !important;
            text-align: left !important; /* Align text left */
             flex-grow: 1; /* Allow title to take available space */
            padding: 0 0.6em !important; /* Add horizontal padding */
        }
        .pfp-swal-toast-popup .swal2-icon {
            margin-right: 12px !important; /* Increased space after icon */
            margin-left: 0 !important;
            width: 28px !important; /* Slightly larger icon */
            height: 28px !important;
             flex-shrink: 0; /* Prevent icon from shrinking */
            position: static !important; /* Remove absolute positioning */
        }
         .pfp-swal-toast-popup .swal2-close {
             position: static !important; /* Remove absolute positioning */
              margin-left: 10px !important; /* Space before close button */
              align-self: flex-start; /* Align close button to top */
              font-size: 1.5em !important; /* Larger close button */
         }
         .pfp-swal-toast-popup .swal2-html-container {
             margin: 0.5em 0 0 !important; /* Add space above HTML content */
             padding: 0 !important;
             text-align: left !important;
         }

         /* SimpleBar custom scrollbar styles (uncomment and customize if using SimpleBar) */
         /*
         .simplebar-wrapper { ... }
         .simplebar-height-auto-observer { ... }
         .simplebar-content-wrapper { ... }
         .simplebar-content { ... }
         .simplebar-track { ... }
         .simplebar-scrollbar { ... }
         */

         /* Hide SimpleBar scrollbar if not in use */
         .pfp-body:not([data-simplebar]) {
              overflow-y: auto; /* Fallback to native scroll */
         }
         /* Add specific overrides if SimpleBar is causing issues */
         /*
         .simplebar-track.simplebar-vertical { right: 0; width: 11px; }
         .simplebar-scrollbar:before { background-color: rgba(0, 0, 0, 0.2); border-radius: 7px; }
         */


         /* Ensure the panel is draggable */
         .pfp-panel .pfp-header {
             cursor: grab;
         }
         .pfp-panel.dragging .pfp-header {
             cursor: grabbing;
         }

         /* Ensure elements needed for UI management are present */
         /* Add styles for showing/hiding pattern parameters */
         #${PATTERN_PARAMS_DIV_ID} {
             /* Default state - will be controlled by JS */
         }

         /* Style for range value displays */
         .pfp-label span {
             font-weight: bold;
             color: var(--pfp-text-color);
         }
         .pfp-panel.dark-mode .pfp-label span {
             color: var(--pfp-dark-text-color);
         }


         /* Media query for smaller screens */
         @media (max-width: 600px) {
             .pfp-panel {
                 width: 95vw; /* Use almost full viewport width */
                 max-width: none; /* Remove max-width constraint */
                 right: 2.5vw !important; /* Center horizontally */
                 left: 2.5vw !important;
                 top: 10px !important; /* Position from top */
                 bottom: auto !important; /* Remove bottom constraint */
             }
              .pfp-toggle-button {
                 right: 5px; /* Adjust toggle button position */
                 top: 5px;
              }
             .pfp-form-group.pfp-inline-group {
                  flex-direction: column; /* Stack items vertically on small screens */
                  align-items: flex-start; /* Align items to the start */
             }
              .pfp-form-group.pfp-inline-group .pfp-label {
                   margin-bottom: 5px; /* Add back bottom margin */
                   margin-right: 0; /* Remove right margin */
              }
              .pfp-form-group.pfp-inline-group .pfp-input.pfp-inline-input {
                   margin-right: 0; /* Remove right margin */
                   width: 100%; /* Make input full width */
              }
              .pfp-form-group.pfp-inline-group .pfp-button.pfp-inline-button {
                   margin-top: 10px; /* Add space above the button */
                   width: 100%; /* Make button full width */
              }
         }

    `);
    GM_log("Pack Filler Pro: UI CSS added.");
}


// The constants panelHTML, panelToggleHTML and the function addPanelCSS are made available
// to the main script's scope via @require.
