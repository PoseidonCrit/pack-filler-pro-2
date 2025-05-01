// This file handles loading, saving, and managing the script's configuration.
// It relies on GM_getValue and GM_setValue from the UserScript API.

// Assumes 'DEFAULT_CONFIG', 'CONFIG_KEY' from constants.js,
// clamp function from domUtils.js, and GM_* functions are accessible
// via @require in the main script.


/* --- Configuration Management --- */

/**
 * Loads configuration from GM_getValue, merges with defaults.
 * Assumes DEFAULT_CONFIG and CONFIG_KEY constants are available in scope.
 * Assumes GM_getValue and GM_log are available.
 * @returns {object} The loaded and merged configuration object. Returns DEFAULT_CONFIG if loading/parsing fails.
 */
function loadConfig() {
    // GM_log("Pack Filler Pro: Entering loadConfig function."); // Minimal logging
    let cfg = { ...DEFAULT_CONFIG }; // Start with a fresh copy of defaults

    try {
        // Check if GM_getValue is available
        if (typeof GM_getValue === 'undefined') {
             // GM_log("Pack Filler Pro: GM_getValue not available. Cannot load config. Using defaults."); // Minimal logging
             return cfg; // Return defaults if GM_getValue is missing
        }

        const raw = GM_getValue(CONFIG_KEY);
        // GM_log("Pack Filler Pro: GM_getValue returned raw data:", raw); // Minimal logging

        if (raw) {
            const parsed = JSON.parse(raw);
            // GM_log("Pack Filler Pro: Parsed config data:", parsed); // Minimal logging

            // Merge fields from saved config onto defaults.
            // This handles adding new default properties and overriding with saved values.
            cfg = { ...cfg, ...parsed };
             // GM_log("Pack Filler Pro: Merged config with defaults:", cfg); // Minimal logging

            // Basic migration: if saved version is older, just use the merged config.
            // If saved version is newer, still use the merged config but log a warning.
            if (parsed.version < DEFAULT_CONFIG.version) {
                 // GM_log(`Pack Filler Pro: Config is from an older version (v${parsed.version}). Merged with defaults.`); // Minimal logging
            } else if (parsed.version > DEFAULT_CONFIG.version) {
                 // GM_log(`Pack Filler Pro: Saved config version (${parsed.version}) is newer than script version (${DEFAULT_CONFIG.version}). Using saved config.`); // Minimal logging
            }

        } else {
            // No saved config found, cfg is already initialized with DEFAULT_CONFIG
            // GM_log("Pack Filler Pro: No saved config found. Using defaults."); // Minimal logging
        }

    } catch (e) {
        // GM_log("Pack Filler Pro: Error loading or parsing config. Using defaults.", e); // Minimal logging
        // If any error occurs during loading or parsing, fall back to the default config
        cfg = { ...DEFAULT_CONFIG };
    }

    // Always set the version to the current script version for saving next time.
    cfg.version = DEFAULT_CONFIG.version;
    // GM_log("Pack Filler Pro: Exiting loadConfig, returning:", cfg); // Minimal logging
    return cfg; // Return the loaded and merged config object
}

/**
 * Saves the provided config object to GM_setValue.
 * Assumes DEFAULT_CONFIG, CONFIG_KEY constants, and GM_setValue are available.
 * @param {object} configToSave - The config object to save.
 */
function saveConfig(configToSave) {
     // Defensive check: ensure configToSave is a valid object before attempting to save
     if (typeof configToSave !== 'object' || configToSave === null) {
          // GM_log("Pack Filler Pro: saveConfig called with invalid or null config. Aborting save."); // Minimal logging
          return;
     }
     // Check if GM_setValue is available
     if (typeof GM_setValue === 'undefined') {
          // GM_log("Pack Filler Pro: GM_setValue not available. Cannot save config."); // Minimal logging
          return; // Abort if GM_setValue is missing
     }


    // Ensure the version is the current script version before saving
    configToSave.version = DEFAULT_CONFIG.version;

    try {
        const configString = JSON.stringify(configToSave);
        GM_setValue(CONFIG_KEY, configString);
        // GM_log("Pack Filler Pro: Config saved successfully."); // Minimal logging
    } catch (e) {
        // GM_log("Pack Filler Pro: Error saving Pack Filler Pro config.", e); // Minimal logging
    }
}

/**
 * Debounces saving of the provided config object.
 * Ensures saveConfig is not called too frequently during rapid UI changes.
 * Assumes saveConfig is available.
 * @param {object} configToSave - The config object to save.
 */
const debouncedSaveConfig = (function() {
    let timer;
    const delay = 500; // milliseconds delay

    return function(configToSave) { // Accept config object here
        // Defensive check: ensure configToSave is valid before scheduling
        if (typeof configToSave !== 'object' || configToSave === null) {
             // GM_log("Pack Filler Pro: debouncedSaveConfig called with invalid or null config. Not scheduling save."); // Minimal logging
             return;
        }

        clearTimeout(timer);
        timer = setTimeout(() => saveConfig(configToSave), delay); // Pass configToSave to saveConfig
    };
})();


// The functions loadConfig, saveConfig, and debouncedSaveConfig are made available
// to the main script's scope via @require.
