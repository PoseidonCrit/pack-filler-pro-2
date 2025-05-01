// This file contains the HTML structure and CSS styles for the UI panel and toggle button.
// Styles are added using GM_addStyle.

// Assumes GM_addStyle and constants are accessible.

/* --- UI Panel HTML --- */
const panelHTML = `
      <div id="${PANEL_ID}" class="pfp-panel">
        <div class="pfp-header" title="Drag to move panel">
          <span class="pfp-title">Pack Filler Pro</span>
          <span class="pfp-close" title="Close Panel">×</span>
        </div>
        <div class="pfp-body" data-simplebar>

          <div class="pfp-form-group">
            <label for="pfp-legacy-mode" class="pfp-label">Fill Mode (Legacy):</label>
            <select id="pfp-legacy-mode" class="pfp-select">
              <option value="fixed">Fixed Count</option>
              <option value="max">Random Count (Range)</option>
              <option value="unlimited">All Visible Packs</option>
            </select>
          </div>

           <div class="pfp-form-group" id="pfp-count-group">
             <label for="pfp-count" class="pfp-label">Number of Packs to Fill:</label>
             <input type="number" id="pfp-count" min="0" list="pfp-count-list" class="pfp-input" placeholder="e.g., 10" />
           </div>

           <div class="pfp-options-divider">Quantity</div>

          <div class="pfp-form-group" id="pfp-fixed-group">
            <label for="pfp-fixed" class="pfp-label">Fixed Copies per Pack:</label>
            <input type="number" id="pfp-fixed" min="0" max="${MAX_QTY}" list="pfp-fixed-list" class="pfp-input" placeholder="e.g., 1 or 3" />
          </div>

          <div id="pfp-range-inputs">
              <div class="pfp-form-group pfp-range-group">
               <label for="pfp-min" class="pfp-label">Min Copies (Range):</label>
               <input type="number" id="pfp-min" min="0" max="${MAX_QTY}" list="pfp-range-list" class="pfp-input" placeholder="e.g., 1" />
             </div>
              <div class="pfp-form-group pfp-range-group">
               <label for="pfp-max" class="pfp-label">Max Copies (Range):</label>
               <input type="number" id="pfp-max" min="0" max="${MAX_QTY}" list="pfp-range-list" class="pfp-input" placeholder="e.g., 5" />
             </div>
             <div class="pfp-form-group pfp-range-group" id="pfp-max-total-group">
               <label for="${MAX_TOTAL_INPUT_ID}" class="pfp-label">Max Total Copies (0 to disable):</label>
               <input type="number" id="${MAX_TOTAL_INPUT_ID}" min="0" class="pfp-input" placeholder="e.g., 100" />
             </div>
          </div>

          <div class="pfp-options-divider">Fill Pattern / Type</div>

            <div class="pfp-form-group">
                <label for="${PATTERN_TYPE_SELECT_ID}" class="pfp-label">Pattern / Fill Type:</label>
                <select id="${PATTERN_TYPE_SELECT_ID}" class="pfp-select">
                    <option value="fixed">Fixed Quantity (Uses Above)</option>
                    <option value="random">Random Quantity (Uses Range)</option>
                    <option value="simplex">Simplex Noise (Uses Range)</option>
                    <option value="gradient">Gradient (Uses Range)</option>
                    <option value="alternating">Alternating (Uses Range)</option>
                    <option value="unlimited">All Visible (Uses Fixed Qty)</option>
                 </select>
            </div>

            <div id="${PATTERN_PARAMS_DIV_ID}" class="pfp-pattern-options">
                 <div class="pfp-form-group pfp-param-noise-seed">
                    <label for="${NOISE_SEED_INPUT_ID}" class="pfp-label">Noise Seed (empty for random):</label>
                    <input type="text" id="${NOISE_SEED_INPUT_ID}" class="pfp-input" placeholder="e.g., 12345 or text" />
                 </div>
                 <div class="pfp-form-group pfp-param-scale">
                    <label for="${PATTERN_SCALE_INPUT_ID}" class="pfp-label">Pattern Scale:</label>
                    <input type="range" id="${PATTERN_SCALE_INPUT_ID}" min="10" max="1000" step="10" class="pfp-input" />
                    <span id="pfp-pattern-scale-value" class="pfp-range-value">100</span>
                 </div>
                  <div class="pfp-form-group pfp-param-intensity">
                    <label for="${PATTERN_INTENSITY_INPUT_ID}" class="pfp-label">Pattern Intensity:</label>
                    <input type="range" id="${PATTERN_INTENSITY_INPUT_ID}" min="0" max="100" step="1" class="pfp-input" />
                    <span id="pfp-pattern-intensity-value" class="pfp-range-value">1.0</span>
                 </div>
            </div>

            <div class="pfp-options-divider">Options</div>

          <div class="pfp-form-check">
            <input type="checkbox" id="pfp-clear" class="pfp-checkbox" />
            <label for="pfp-clear" class="pfp-label pfp-label-inline">Clear inputs before filling</label>
          </div>
         <div class="pfp-form-check">
            <input type="checkbox" id="${FILL_EMPTY_ONLY_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${FILL_EMPTY_ONLY_CHECKBOX_ID}" class="pfp-label pfp-label-inline" title="Only fill quantities for inputs that are currently empty or 0.">Fill empty inputs only</label>
          </div>
          <div class="pfp-form-check">
            <input type="checkbox" id="${FULL_PAGE_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${FULL_PAGE_CHECKBOX_ID}" class="pfp-label pfp-label-inline" title="Automatically scrolls to the end of the page on load to reveal all packs.">Auto-load all packs on page entry</label>
          </div>
         <div class="pfp-form-check">
            <input type="checkbox" id="${AUTO_FILL_LOADED_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${AUTO_FILL_LOADED_CHECKBOX_ID}" class="pfp-label pfp-label-inline" title="Automatically fills quantities for new packs loaded by 'Auto-load all packs'. Uses current settings.">Auto-fill newly loaded packs</label>
          </div>
         <div class="pfp-form-check">
            <input type="checkbox" id="${SCROLL_TO_BOTTOM_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${SCROLL_TO_BOTTOM_CHECKBOX_ID}" class="pfp-label pfp-label-inline" title="Automatically scrolls to the bottom of the page after all packs have finished loading.">Scroll to bottom after load</label>
          </div>
          <div class="pfp-form-check">
            <input type="checkbox" id="${DARK_MODE_CHECKBOX_ID}" class="pfp-checkbox" />
            <label for="${DARK_MODE_CHECKBOX_ID}" class="pfp-label pfp-label-inline">Enable Dark Mode</label>
          </div>

          <div class="pfp-form-actions">
            <button id="pfp-run" class="pfp-button pfp-button-primary" title="Fill pack inputs based on current settings">Fill Packs</button>
            <button id="pfp-clear-btn" class="pfp-button pfp-button-secondary" title="Set all pack inputs to zero">Clear All</button>
           </div>

          <datalist id="pfp-count-list">
            <option value="1"><option value="5"><option value="10"><option value="24"><option value="50">
          </datalist>
          <datalist id="pfp-fixed-list">
            <option value="0"><option value="1"><option value="3"><option value="5"><option value="10"><option value="20"><option value="99">
          </datalist>
          <datalist id="pfp-range-list">
            <option value="0"><option value="1"><option value="2"><option value="3"><option value="5"><option value="10">
          </datalist>
        </div>
        <div class="pfp-footer">
          <span class="pfp-version">v${GM_info.script.version}</span>
        </div>
      </div>
    `;

const panelToggleHTML = `
     <button id="${TOGGLE_BUTTON_ID}" class="pfp-toggle-button" title="Toggle Pack Filler Pro Panel">
         🎴
     </button>
`;

/* --- UI Panel CSS --- */
// This function adds the necessary CSS styles to the page.
// It uses GM_addStyle from the UserScript API.
function addPanelCSS() {
    // Keep existing CSS from original uiCss.js, but add styles for new param classes
    GM_addStyle(`
        /* --- mini.css base ... --- */
        button.mini { display: inline-block; font-weight: 400; text-align: center; vertical-align: middle; user-select: none; border: 1px solid transparent; padding: .375rem .75rem; font-size: 1rem; line-height: 1.5; border-radius: .25rem; transition: color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out; text-decoration: none; }
        button.mini:hover { text-decoration: none; }
        button.mini.primary { color: #fff; background-color: #007bff; border-color: #007bff; }
        button.mini.primary:hover { background-color: #0056b3; border-color: #004099; }
        button.mini.secondary { color: #fff; background-color: #6c757d; border-color: #6c757d; }
        button.mini.secondary:hover { background-color: #545b62; border-color: #4a5258; }

        /* --- CSS Variables --- */
        :root {
            --pfp-bg-color: rgba(255, 255, 255, 0.95);
            --pfp-border-color: rgba(0, 0, 0, 0.1);
            --pfp-shadow-color: rgba(0, 0, 0, 0.25);
            --pfp-text-color: #333;
            --pfp-label-color: #555;
            --pfp-primary-color: #007bff;
            --pfp-primary-hover: #0056b3;
            --pfp-secondary-color: #6c757d;
            --pfp-secondary-hover: #545b62;
            --pfp-secondary-text: #fff;
            --pfp-panel-width: 340px;
            --pfp-border-radius: 8px;
            --pfp-focus-color: #007bff;
            --pfp-focus-shadow: rgba(0, 123, 255, 0.25);
            --pfp-input-bg: rgba(255, 255, 255, 0.85);
            --pfp-input-border: rgba(0, 0, 0, 0.15);
            --pfp-header-bg: var(--pfp-primary-color);
            --pfp-header-text: #fff;
            --pfp-close-color: #fff;
            --pfp-close-hover-bg: rgba(255, 255, 255, 0.1);
            --pfp-divider-color: rgba(0, 0, 0, 0.1);
            --pfp-checkbox-border: rgba(0, 0, 0, 0.25);
            --pfp-checkbox-checked-bg: var(--pfp-primary-color);
            --pfp-checkbox-checked-border: var(--pfp-primary-color);
            --pfp-checkbox-checked-check: #fff;
            --pfp-range-border: rgba(0, 0, 0, 0.1);
            --pfp-range-bg: rgba(0, 0, 0, 0.03);
            --pfp-swal-button-primary-color: var(--pfp-primary-color);
            --pfp-swal-button-primary-hover: var(--pfp-primary-hover);
            --pfp-swal-button-secondary-color: var(--pfp-secondary-color);
            --pfp-swal-button-secondary-hover: var(--pfp-secondary-hover);
            --pfp-swal-button-text: var(--pfp-header-text);
            --pfp-swal-button-secondary-text: var(--pfp-secondary-text);
            --pfp-range-value-color: #666;
         }

         /* --- Dark Mode Variables --- */
        .pfp-panel.dark-mode, .pfp-swal-popup.dark-mode, .pfp-swal-toast-popup.dark-mode {
            --pfp-bg-color: rgba(40, 44, 52, 0.9);
            --pfp-border-color: rgba(255, 255, 255, 0.15);
            --pfp-shadow-color: rgba(0, 0, 0, 0.6);
            --pfp-text-color: #e0e0e0;
            --pfp-label-color: #b0b0b0;
            --pfp-primary-color: #bb86fc;
            --pfp-primary-hover: #985eff;
            --pfp-secondary-color: #03dac6;
            --pfp-secondary-hover: #018786;
            --pfp-secondary-text: #000;
            --pfp-focus-color: var(--pfp-secondary-color);
            --pfp-focus-shadow: rgba(3, 218, 198, 0.35);
            --pfp-input-bg: rgba(60, 65, 75, 0.85);
            --pfp-input-border: rgba(255, 255, 255, 0.2);
            --pfp-header-bg: var(--pfp-primary-color);
            --pfp-header-text: #000;
            --pfp-close-color: #000;
            --pfp-close-hover-bg: rgba(0, 0, 0, 0.1);
            --pfp-divider-color: rgba(255, 255, 255, 0.15);
            --pfp-checkbox-border: rgba(255, 255, 255, 0.4);
            --pfp-checkbox-checked-bg: var(--pfp-secondary-color);
            --pfp-checkbox-checked-border: var(--pfp-secondary-color);
            --pfp-checkbox-checked-check: #000;
            --pfp-range-border: rgba(255, 255, 255, 0.1);
            --pfp-range-bg: rgba(0, 0, 0, 0.05);
            --pfp-swal-button-primary-color: var(--pfp-primary-color);
            --pfp-swal-button-primary-hover: var(--pfp-primary-hover);
            --pfp-swal-button-secondary-color: var(--pfp-secondary-color);
            --pfp-swal-button-secondary-hover: var(--pfp-secondary-hover);
            --pfp-swal-button-text: var(--pfp-header-text);
            --pfp-swal-button-secondary-text: var(--pfp-secondary-text);
            --pfp-range-value-color: #b0b0b0;
        }

        /* --- Panel --- */
        .pfp-panel { position: fixed; width: var(--pfp-panel-width); background: var(--pfp-bg-color); border-radius: var(--pfp-border-radius); box-shadow: 0 10px 30px var(--pfp-shadow-color), 0 0 0 1px var(--pfp-border-color); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; color: var(--pfp-text-color); z-index: 1000001; transition: transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--pfp-border-color); overflow: hidden; box-sizing: border-box; top: var(--pfp-panel-top, 120px); right: var(--pfp-panel-right, 30px); left: auto; bottom: auto; }
        .pfp-panel.hidden { transform: translateX(110%) scale(0.95); opacity: 0; pointer-events: none; }
        .pfp-panel.pos-left { left: 16px; right: auto; }
        .pfp-panel.pos-right { right: 16px; left: auto; }
        .pfp-panel.pos-bottom { bottom: 16px; top: auto; }
        .pfp-panel.pos-top { top: 16px; bottom: auto; }

        /* --- Header --- */
        .pfp-header { background: var(--pfp-header-bg); color: var(--pfp-header-text); padding: 14px 20px; cursor: grab; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 0, 0, 0.1); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); border-top-left-radius: var(--pfp-border-radius); border-top-right-radius: var(--pfp-border-radius); touch-action: none; }
        .pfp-header:active { cursor: grabbing; }
        .pfp-panel.dark-mode .pfp-header { border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); }
        .pfp-title { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: 0.5px; }
        .pfp-close { cursor: pointer; color: var(--pfp-close-color); font-size: 24px; font-weight: bold; line-height: 1; transition: transform 0.2s ease, color 0.2s ease; opacity: 0.8; padding: 0 5px; border-radius: 50%; }
        .pfp-close:hover { transform: scale(1.2) rotate(90deg); opacity: 1; background-color: var(--pfp-close-hover-bg); }

        /* --- Body & Scrollbar --- */
        .pfp-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; max-height: calc(100vh - 160px); /* Adjusted slightly */ overflow-y: auto; }
        .pfp-body.simplebar-container .simplebar-track.simplebar-vertical { width: 8px; }
        .pfp-body.simplebar-container .simplebar-scrollbar::before { background: var(--pfp-border-color); border-radius: 4px; width: 8px; opacity: 0.5; transition: opacity 0.2s ease; }
        .pfp-body.simplebar-container .simplebar-scrollbar::before:hover { opacity: 0.8; }

        /* --- Form Elements --- */
        .pfp-form-group { margin-bottom: 0; }
        .pfp-label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; color: var(--pfp-label-color); }
        .pfp-label-inline { display: inline-block; margin-bottom: 0; vertical-align: middle; flex-grow: 1; cursor: pointer; }
        .pfp-input, .pfp-select { width: 100%; padding: 10px 12px; border: 1px solid var(--pfp-input-border); border-radius: 6px; box-sizing: border-box; font-size: 14px; transition: border-color 0.2s ease, box-shadow 0.2s ease; background-color: var(--pfp-input-bg); color: var(--pfp-text-color); box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05); }
        .pfp-panel.dark-mode .pfp-input, .pfp-panel.dark-mode .pfp-select { box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2); }
        .pfp-input::placeholder { color: #999; }
        .pfp-panel.dark-mode .pfp-input::placeholder { color: #777; }
        .pfp-input:hover, .pfp-select:hover { border-color: rgba(0, 0, 0, 0.2); }
        .pfp-panel.dark-mode .pfp-input:hover, .pfp-panel.dark-mode .pfp-select:hover { border-color: rgba(255, 255, 255, 0.2); }
        .pfp-input:focus, .pfp-select:focus { outline: none; border-color: var(--pfp-focus-color); box-shadow: 0 0 0 3px var(--pfp-focus-shadow); }
        .pfp-select { appearance: none; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23555'%3e%3cpath fill-rule='evenodd' d='M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z' clip-rule='evenodd'/%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 10px center; background-size: 16px 16px; padding-right: 35px; cursor: pointer; }
        .pfp-panel.dark-mode .pfp-select { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23b0b0b0'%3e%3cpath fill-rule='evenodd' d='M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z' clip-rule='evenodd'/%3e%3c/svg%3e"); }
        .pfp-select:focus { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='var(--pfp-focus-color)'%3e%3cpath fill-rule='evenodd' d='M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z' clip-rule='evenodd'/%3e%3c/svg%3e"); }

         /* --- Pattern Options --- */
        .pfp-pattern-options { display: flex; flex-direction: column; gap: 10px; }
        .pfp-pattern-options .pfp-form-group { margin-bottom: 0; }
        .pfp-range-value { display: block; margin-top: 4px; font-size: 12px; color: var(--pfp-range-value-color); text-align: right; }

        /* --- Options --- */
        .pfp-options-divider { margin: 16px 0; border-top: 1px solid var(--pfp-divider-color); padding-top: 16px; font-size: 14px; font-weight: 600; color: var(--pfp-label-color); }
        .pfp-form-check { display: flex; align-items: center; margin-bottom: 10px; cursor: pointer; }
        .pfp-form-check:last-child { margin-bottom: 0; }
        .pfp-checkbox { margin-right: 8px; flex-shrink: 0; appearance: none; width: 18px; height: 18px; border: 1px solid var(--pfp-checkbox-border); border-radius: 3px; vertical-align: middle; transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; background-color: var(--pfp-input-bg); cursor: pointer; }
        .pfp-checkbox:checked { background-color: var(--pfp-checkbox-checked-bg); border-color: var(--pfp-checkbox-checked-border); background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M6 10l3 3l6-6'/%3e%3csvg%3e"); background-size: 100% 100%; background-repeat: no-repeat; }
        .pfp-panel.dark-mode .pfp-checkbox:checked { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23000' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M6 10l3 3l6-6'/%3e%3csvg%3e"); }
        .pfp-checkbox:focus { outline: 0; box-shadow: 0 0 0 3px var(--pfp-focus-shadow); }

        /* --- Actions & Footer --- */
        .pfp-form-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 20px; }
        .pfp-button { flex-grow: 1; padding: 10px 15px; font-size: 15px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease; text-align: center; border: 1px solid; white-space: nowrap; text-decoration: none; }
        .pfp-button-primary { background-color: var(--pfp-primary-color); border-color: var(--pfp-primary-color); color: var(--pfp-header-text); }
        .pfp-button-primary:hover { background-color: var(--pfp-primary-hover); border-color: var(--pfp-primary-hover); opacity: 1; }
        .pfp-button-secondary { background-color: var(--pfp-secondary-color); border-color: var(--pfp-secondary-color); color: var(--pfp-secondary-text); }
        .pfp-button-secondary:hover { background-color: var(--pfp-secondary-hover); border-color: var(--pfp-secondary-hover); opacity: 1; }
        .pfp-footer { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--pfp-divider-color); text-align: center; font-size: 12px; color: var(--pfp-label-color); }
        .pfp-footer .pfp-version { font-weight: bold; }

        /* --- Toggle Button --- */
        .pfp-toggle-button { position: fixed; top: 20px; right: 20px; width: 45px; height: 45px; background: var(--pfp-primary-color); color: var(--pfp-header-text); border: none; border-radius: 50%; box-shadow: 0 4px 15px var(--pfp-shadow-color); cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; z-index: 1000000; transition: background-color 0.2s ease, transform 0.2s ease; bottom: auto; }
        .pfp-toggle-button.hidden { display: none; }
        .pfp-toggle-button:hover { background-color: var(--pfp-primary-hover); transform: scale(1.05); }
        .pfp-toggle-button:active { transform: scale(0.95); }
        .pfp-panel.dark-mode + .pfp-toggle-button { background: var(--pfp-primary-color); color: var(--pfp-header-text); }
        .pfp-panel.dark-mode + .pfp-toggle-button:hover { background-color: var(--pfp-primary-hover); }

        /* --- Mobile Adjustments --- */
        @media (max-width: 420px) {
             .pfp-panel { width: 95vw; left: 2.5vw !important; right: auto !important; bottom: auto !important; top: 16px !important; transform: translateX(0) !important; }
             .pfp-panel.hidden { transform: translateY(-110%) !important; left: 2.5vw !important; right: auto !important; bottom: auto !important; }
             .pfp-toggle-button { top: 16px !important; right: 16px !important; left: auto !important; bottom: auto !important; transform: none !important; }
        }

        /* --- SweetAlert2 Custom Styling --- */
        .pfp-swal-popup { background: var(--pfp-bg-color) !important; color: var(--pfp-text-color) !important; border-radius: var(--pfp-border-radius) !important; box-shadow: 0 10px 30px var(--pfp-shadow-color), 0 0 0 1px var(--pfp-border-color) !important; backdrop-filter: blur(8px) !important; -webkit-backdrop-filter: blur(8px) !important; border: 1px solid var(--pfp-border-color) !important; overflow: hidden !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif !important; z-index: 10000000 !important; }
        .pfp-swal-title { color: var(--pfp-text-color) !important; font-size: 18px !important; font-weight: 600 !important; margin-bottom: 10px !important; }
        .pfp-swal-html { color: var(--pfp-text-color) !important; text-align: left !important; padding: 0 10px !important; margin-bottom: 15px !important; font-size: 14px !important; }
        .pfp-swal-html p { margin: 5px 0; line-height: 1.5; }
        .pfp-swal-html strong { font-weight: 600; }
        .swal2-actions button.mini { display: inline-block; font-weight: 400; text-align: center; vertical-align: middle; user-select: none; border: 1px solid transparent; padding: .375rem .75rem; font-size: 1rem; line-height: 1.5; border-radius: .25rem; transition: color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out; margin: 0 5px !important; cursor: pointer; font-size: 14px !important; padding: 8px 15px !important; border-radius: 6px !important; }
        .swal2-actions button.mini.primary { background-color: var(--pfp-swal-button-primary-color) !important; border-color: var(--pfp-swal-button-primary-color) !important; color: var(--pfp-swal-button-text) !important; }
        .swal2-actions button.mini.primary:hover { background-color: var(--pfp-swal-button-primary-hover) !important; border-color: var(--pfp-swal-button-primary-hover) !important; }
        .swal2-actions button.mini.secondary { background-color: var(--pfp-swal-button-secondary-color) !important; border-color: var(--pfp-swal-button-secondary-color) !important; color: var(--pfp-secondary-text) !important; }
        .swal2-actions button.mini.secondary:hover { background-color: var(--pfp-secondary-hover) !important; border-color: var(--pfp-secondary-hover) !important; }

        /* --- Toast Specific Styling --- */
        .pfp-swal-toast-popup { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important; padding: 12px 18px !important; font-size: 14px !important; line-height: 1.5 !important; border-radius: 8px !important; background: var(--pfp-bg-color) !important; color: var(--pfp-text-color) !important; border: 1px solid var(--pfp-border-color) !important; backdrop-filter: blur(6px) !important; -webkit-backdrop-filter: blur(6px) !important; z-index: 10000002 !important; display: flex !important; align-items: center !important; }
        .pfp-swal-toast-popup .swal2-title { margin: 0 !important; font-size: 14px !important; font-weight: normal !important; text-align: left !important; flex-grow: 1; }
        .pfp-swal-toast-popup .swal2-icon { margin-right: 12px !important; margin-left: 0 !important; width: 28px !important; height: 28px !important; flex-shrink: 0; }
        .pfp-swal-toast-popup .swal2-icon .swal2-icon-content { font-size: 20px !important; }
        .pfp-swal-toast-popup .swal2-close { position: static !important; margin-left: 10px !important; padding: 4px !important; transition: opacity 0.2s ease; opacity: 0.7; }
        .pfp-swal-toast-popup .swal2-close:hover { opacity: 1; }
    `);
}
