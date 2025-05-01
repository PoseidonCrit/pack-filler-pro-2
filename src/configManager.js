// This file handles loading, saving, and managing the script's configuration.
// It relies on GM_getValue and GM_setValue from the UserScript API.

// Assumes 'DEFAULT_CONFIG', 'CONFIG_KEY' from constants.js,
// clamp function from domUtils.js, and GM_* functions are accessible
// via @require in the main script.


/* --- Configuration Management --- */

/**
 * Loads configuration from GM_getValue, merges with defaults, and handles migrations.
 * Assumes DEFAULT_CONFIG and CONFIG_KEY constants are available in scope.
 * Assumes GM_getValue and GM_log are available.
 * @returns {object} The loaded and merged configuration object. Returns DEFAULT_CONFIG if loading/parsing fails.
 */
function loadConfig() {
    GM_log("Pack Filler Pro: Entering loadConfig function.");
    let cfg = { ...DEFAULT_CONFIG }; // Start with a fresh copy of defaults

    try {
        // Check if GM_getValue is available
        if (typeof GM_getValue === 'undefined') {
             GM_log("Pack Filler Pro: GM_getValue not available. Cannot load config. Using defaults.");
             return cfg; // Return defaults if GM_getValue is missing
        }

        const raw = GM_getValue(CONFIG_KEY);
        GM_log("Pack Filler Pro: GM_getValue returned raw data:", raw);

        if (raw) {
            const parsed = JSON.parse(raw);
            GM_log("Pack Filler Pro: Parsed config data:", parsed);

            // Merge fields from saved config onto defaults.
            // This ensures new properties in DEFAULT_CONFIG are present,
            // while existing saved properties override defaults.
            cfg = { ...cfg, ...parsed };
             GM_log("Pack Filler Pro: Merged config with defaults before migration:", cfg);


            // Handle specific migrations if config version is old
            // Ensure migration logic is non-destructive and handles potentially missing properties
            if (parsed.version < DEFAULT_CONFIG.version) {
                GM_log(`Pack Filler Pro: Config migrating from v${parsed.version} to v${DEFAULT_CONFIG.version}.`);

                 // Migration for versions < 12 (Panel position change)
                 // If panelPos existed and had a bottom value (old format), reset it to new default top/right
                 // Also check if panelPos is actually an object before accessing properties
                 if (parsed.version < 12 && typeof cfg.panelPos === 'object' && cfg.panelPos !== null && cfg.panelPos.bottom !== 'auto') {
                      cfg.panelPos = { ...DEFAULT_CONFIG.panelPos };
                      GM_log("Pack Filler Pro: Migrated panel position to default top/right (v12 migration).");
                 }

                 // Migration for versions < 24 (New pattern and random clicker options)
                 if (parsed.version < 24) {
                      GM_log("Pack Filler Pro: Applying v24 migration (ensuring new properties).");
                      // No specific transformation needed for v24 as they are new properties,
                      // the initial merge handles adding them from DEFAULT_CONFIG.
                      // This block mainly serves as a marker for future migrations.
                 }
                 // Migration for versions < 25 (Added lastClear validation in validateFillConfig)
                 if (parsed.version < 25) {
                      GM_log("Pack Filler Pro: Applying v25 migration (ensuring lastClear).");
                      // No specific transformation needed, merge handles it.
                 }
                 // Migration for versions < 26 (Added FILL_RANDOM_BTN_ID to constants/DEFAULT_CONFIG)
                 if (parsed.version < 26) {
                      GM_log("Pack Filler Pro: Applying v26 migration (ensuring FILL_RANDOM_BTN_ID).");
                      // No specific transformation needed, merge handles it.
                 }

                 // After all migrations, ensure any properties still missing (e.g., from very old saves or errors)
                 // are populated from DEFAULT_CONFIG. This is a final safety net.
                 const has = Object.prototype.hasOwnProperty.call;
                 Object.keys(DEFAULT_CONFIG).forEach(key => {
                       if (!has(cfg, key)) {
                            cfg[key] = DEFAULT_CONFIG[key];
                            // GM_log(`Pack Filler Pro: Populated missing config key '${key}' with default value.`); // Too chatty
                       }
                 });

                 GM_log("Pack Filler Pro: Config after migration:", cfg); // Debugging log

            } else if (parsed.version > DEFAULT_CONFIG.version) {
                 // This case is less common: the saved config is from a *newer* version of the script.
                 // We'll use the saved config but update its version to the current script's version
                 // for the *next* save. This prevents potential issues if a user downgrades the script.
                 GM_log(`Pack Filler Pro: Saved config version (${parsed.version}) is newer than script version (${DEFAULT_CONFIG.version}). Using saved config.`);
                 // The initial merge {...cfg, ...parsed} already prioritizes saved values.
                 // No further action needed here for basic merging.
            }

        } else {
            // No saved config found, cfg is already initialized with DEFAULT_CONFIG
            GM_log("Pack Filler Pro: No saved config found. Using defaults.");
        }

    } catch (e) {
        GM_log("Pack Filler Pro: Error loading or parsing config. Using defaults.", e);
        // If any error occurs during loading or parsing, fall back to the default config
        cfg = { ...DEFAULT_CONFIG };
    }

    // Always set the version to the current script version for saving next time.
    cfg.version = DEFAULT_CONFIG.version;
    GM_log("Pack Filler Pro: Exiting loadConfig, returning:", cfg);
    return cfg; // Return the loaded and merged config object
}

/**
 * Saves the provided config object to GM_setValue.
 * Assumes DEFAULT_CONFIG, CONFIG_KEY constants, and GM_setValue, GM_log are available.
 * @param {object} configToSave - The config object to save.
 */
function saveConfig(configToSave) {
     // Defensive check: ensure configToSave is a valid object before attempting to save
     if (typeof configToSave !== 'object' || configToSave === null) {
          GM_log("Pack Filler Pro: saveConfig called with invalid or null config. Aborting save.");
          return;
     }
     // Check if GM_setValue is available
     if (typeof GM_setValue === 'undefined') {
          GM_log("Pack Filler Pro: GM_setValue not available. Cannot save config.");
          return; // Abort if GM_setValue is missing
     }


    // Ensure the version is the current script version before saving
    configToSave.version = DEFAULT_CONFIG.version;

    try {
        const configString = JSON.stringify(configToSave);
        // GM_log(`Pack Filler Pro: Attempting to save config. Key: ${CONFIG_KEY}, Data: ${configString}`); // Too chatty for debounced save
        GM_setValue(CONFIG_KEY, configString);
        // GM_log("Pack Filler Pro: Config saved successfully."); // Too chatty for debounced save
    } catch (e) {
        GM_log("Pack Filler Pro: Error saving Pack Filler Pro config.", e);
         // Consider showing a user-facing error if saving is critical and failing repeatedly
         // Requires SWAL_TOAST and config in scope.
         // if (typeof SWAL_TOAST !== 'undefined' && configToSave) SWAL_TOAST('Config Save Error', 'Failed to save settings.', 'error', configToSave);
    }
}

/**
 * Debounces saving of the provided config object.
 * Ensures saveConfig is not called too frequently during rapid UI changes.
 * Assumes saveConfig and GM_log are available.
 * @param {object} configToSave - The config object to save.
 */
const debouncedSaveConfig = (function() {
    let timer;
    const delay = 500; // milliseconds delay

    return function(configToSave) { // Accept config object here
        // Defensive check: ensure configToSave is valid before scheduling
        if (typeof configToSave !== 'object' || configToSave === null) {
             GM_log("Pack Filler Pro: debouncedSaveConfig called with invalid or null config. Not scheduling save.");
             return;
        }

        clearTimeout(timer);
        // GM_log(`Pack Filler Pro: Debounced save scheduled in ${delay}ms.`); // Too chatty
        timer = setTimeout(() => saveConfig(configToSave), delay); // Pass configToSave to saveConfig
    };
})();

/**
 * Validates key parts of the fill configuration to ensure quantities and pattern parameters are reasonable.
 * Logs warnings if values are outside expected ranges or types.
 * Assumes config object and GM_log are available.
 * Assumes MAX_QTY constant and clamp function from domUtils.js are available.
 * Assumes MainThreadFillStrategies from fillLogic.js is available.
 * @param {object} config - The script's configuration object to validate.
 * @throws {Error} Throws an error if a critical validation fails (e.g., clamp function missing).
 */
function validateFillConfig(config) {
    // Basic validation
    if (typeof config !== 'object' || config === null) {
        const errorMsg = "Validation failed: Invalid config object.";
        GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, config);
        throw new Error(errorMsg); // Critical error, abort validation
    }

    // Check critical dependencies
     if (typeof clamp !== 'function') {
          const errorMsg = "Validation failed: clamp function from domUtils.js not found.";
          GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
          throw new Error(errorMsg); // Critical error, abort validation
     }
     // MainThreadFillStrategies is needed to validate patternType
     if (typeof MainThreadFillStrategies === 'undefined') {
          GM_log("Pack Filler Pro: validateFillConfig: MainThreadFillStrategies object from fillLogic.js not found. Cannot fully validate patternType.");
          // Continue validation, but skip patternType check
     }


    const maxQty = typeof MAX_QTY !== 'undefined' ? MAX_QTY : 99; // Fallback MAX_QTY

    // Validate quantity ranges - clamp ensures they are numbers and within bounds
    config.lastMinQty = clamp(config.lastMinQty, 0, maxQty);
    config.lastMaxQty = clamp(config.lastMaxQty, 0, maxQty);
    config.lastFixedQty = clamp(config.lastFixedQty, 0, maxQty);
    config.maxTotalAmount = clamp(config.maxTotalAmount, 0, Infinity); // Max total can be very large or 0

    if (config.lastMinQty > config.lastMaxQty) {
        const warningMsg = `Validation warning: lastMinQty (${config.lastMinQty}) is greater than lastMaxQty (${config.lastMaxQty}). Setting lastMinQty = lastMaxQty.`;
        GM_log(`Pack Filler Pro: WARNING - ${warningMsg}`);
        config.lastMinQty = config.lastMaxQty; // Correct invalid range
    }

    // Validate pattern parameters (basic clamping/defaulting) - ensure they are numbers before clamping
    config.patternScale = parseInt(config.patternScale, 10);
    if (isNaN(config.patternScale) || config.patternScale < 1) {
        GM_log(`Pack Filler Pro: Validation warning: Invalid patternScale (${config.patternScale}). Setting to default ${DEFAULT_CONFIG.patternScale}.`);
        config.patternScale = DEFAULT_CONFIG.patternScale;
    } else {
        config.patternScale = Math.max(1, config.patternScale); // Ensure >= 1 after parsing
    }

     config.patternIntensity = parseFloat(config.patternIntensity);
     if (isNaN(config.patternIntensity) || config.patternIntensity < 0 || config.patternIntensity > 1) {
         // Intensity is stored 0-1 in config
          GM_log(`Pack Filler Pro: Validation warning: Invalid patternIntensity (${config.patternIntensity}). Setting to default ${DEFAULT_CONFIG.patternIntensity}.`);
          config.patternIntensity = DEFAULT_CONFIG.patternIntensity;
     } else {
          config.patternIntensity = clamp(config.patternIntensity, 0.0, 1.0); // Ensure it's between 0 and 1
     }

     // noiseSeed can be any string or empty, no specific validation needed beyond type check if desired
     if (typeof config.noiseSeed !== 'string') {
          GM_log(`Pack Filler Pro: Validation warning: Invalid noiseSeed type (${typeof config.noiseSeed}). Setting to empty string.`);
          config.noiseSeed = '';
     }


    // Validate patternType exists in main thread strategies (only if strategies object is available)
     if (typeof MainThreadFillStrategies === 'object' && !MainThreadFillStrategies[config.patternType]) {
         GM_log(`Pack Filler Pro: Validation warning: Unknown patternType "${config.patternType}". Setting to default "${DEFAULT_CONFIG.patternType}".`);
         config.patternType = DEFAULT_CONFIG.patternType;
     }

    // Validate boolean flags - ensure they are booleans
    if (typeof config.fillEmptyOnly !== 'boolean') {
         GM_log(`Pack Filler Pro: Validation warning: Invalid fillEmptyOnly value (${config.fillEmptyOnly}). Setting to default ${DEFAULT_CONFIG.fillEmptyOnly}.`);
         config.fillEmptyOnly = DEFAULT_CONFIG.fillEmptyOnly;
    }
      if (typeof config.lastClear !== 'boolean') { // Added lastClear validation
         GM_log(`Pack Filler Pro: Validation warning: Invalid lastClear value (${config.lastClear}). Setting to default ${DEFAULT_CONFIG.lastClear}.`);
         config.lastClear = DEFAULT_CONFIG.lastClear;
     }
     if (typeof config.panelVisible !== 'boolean') {
         GM_log(`Pack Filler Pro: Validation warning: Invalid panelVisible value (${config.panelVisible}). Setting to default ${DEFAULT_CONFIG.panelVisible}.`);
         config.panelVisible = DEFAULT_CONFIG.panelVisible;
     }
     if (typeof config.isDarkMode !== 'boolean') {
         GM_log(`Pack Filler Pro: Validation warning: Invalid isDarkMode value (${config.isDarkMode}). Setting to default ${DEFAULT_CONFIG.isDarkMode}.`);
         config.isDarkMode = DEFAULT_CONFIG.isDarkMode;
     }


    // Validate panelPos structure (basic check)
     if (typeof config.panelPos !== 'object' || config.panelPos === null || typeof config.panelPos.top === 'undefined' || typeof config.panelPos.right === 'undefined' || typeof config.panelPos.bottom === 'undefined' || typeof config.panelPos.left === 'undefined') {
         GM_log(`Pack Filler Pro: Validation warning: Invalid panelPos structure. Setting to default.`, config.panelPos);
         config.panelPos = { ...DEFAULT_CONFIG.panelPos };
     }

    // Validate clickPageRandomCount - ensure it's a number and >= 1
    config.clickPageRandomCount = parseInt(config.clickPageRandomCount, 10);
    if (isNaN(config.clickPageRandomCount) || config.clickPageRandomCount < 1) {
         GM_log(`Pack Filler Pro: Validation warning: Invalid clickPageRandomCount value (${config.clickPageRandomCount}). Setting to minimum 1.`);
         config.clickPageRandomCount = 1;
    }


    GM_log("Pack Filler Pro: Config validation complete.");
}


// The functions loadConfig, saveConfig, debouncedSaveConfig, and validateFillConfig are made available
// to the main script's scope via @require.
