// This file handles loading, saving, and managing the script's configuration.
// It relies on GM_getValue and GM_setValue from the UserScript API.
// Wrapped in an IIFE and attaches functions to window.pfpMinimal.

(function() {
    'use strict';

    // Ensure the global namespace object exists and get references to shared dependencies
    window.pfpMinimal = window.pfpMinimal || {};
    const DEFAULT_CONFIG = window.pfpMinimal.DEFAULT_CONFIG; // Get default config from namespace
    const CONFIG_KEY = window.pfpMinimal.CONFIG_KEY; // Get config key from namespace
    const clamp = window.pfpMinimal.clamp; // Get clamp from namespace (defined in domUtils.js)
    const GM_getValue = window.GM_getValue; // Get GM_getValue from window (granted in main script)
    const GM_setValue = window.GM_setValue; // Get GM_setValue from window (granted in main script)
    const GM_log = window.GM_log; // Get GM_log from window (granted in main script)


    /* --- Configuration Management --- */

    /**
     * Loads configuration from GM_getValue, merges with defaults.
     * Assumes DEFAULT_CONFIG and CONFIG_KEY are available via window.pfpMinimal.
     * Assumes GM_getValue and GM_log are available via window.
     * @returns {object} The loaded and merged configuration object. Returns DEFAULT_CONFIG if loading/parsing fails.
     */
    function loadConfig() {
        // GM_log("Pack Filler Pro: Entering loadConfig function."); // Minimal logging
        let cfg = { ...DEFAULT_CONFIG };

        try {
            if (typeof GM_getValue === 'undefined') {
                 if (typeof GM_log === 'function') GM_log("Pack Filler Pro: GM_getValue not available. Cannot load config. Using defaults.");
                 return cfg;
            }

            const raw = GM_getValue(CONFIG_KEY);
            // GM_log("Pack Filler Pro: GM_getValue returned raw data:", raw); // Minimal logging

            if (raw) {
                const parsed = JSON.parse(raw);
                // GM_log("Pack Filler Pro: Parsed config data:", parsed); // Minimal logging

                cfg = { ...cfg, ...parsed };

                if (parsed.version < DEFAULT_CONFIG.version) {
                     if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Config is from an older version (v${parsed.version}). Merged with defaults.`);
                } else if (parsed.version > DEFAULT_CONFIG.version) {
                     if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Saved config version (${parsed.version}) is newer than script version (${DEFAULT_CONFIG.version}). Using saved config.`);
                }

            } else {
                // GM_log("Pack Filler Pro: No saved config found. Using defaults."); // Minimal logging
            }

        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error loading or parsing config. Using defaults.", e);
            cfg = { ...DEFAULT_CONFIG };
        }

        cfg.version = DEFAULT_CONFIG.version;
        // GM_log("Pack Filler Pro: Exiting loadConfig, returning:", cfg); // Minimal logging
        return cfg;
    }

    /**
     * Saves the provided config object to GM_setValue.
     * Assumes DEFAULT_CONFIG, CONFIG_KEY are available via window.pfpMinimal.
     * Assumes GM_setValue and GM_log are available via window.
     * @param {object} configToSave - The config object to save.
     */
    function saveConfig(configToSave) {
         if (typeof configToSave !== 'object' || configToSave === null) {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: saveConfig called with invalid or null config. Aborting save.");
              return;
         }
         if (typeof GM_setValue === 'undefined') {
              if (typeof GM_log === 'function') GM_log("Pack Filler Pro: GM_setValue not available. Cannot save config.");
              return;
         }

        configToSave.version = DEFAULT_CONFIG.version;

        try {
            const configString = JSON.stringify(configToSave);
            GM_setValue(CONFIG_KEY, configString);
            // GM_log("Pack Filler Pro: Config saved successfully."); // Minimal logging
        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error saving Pack Filler Pro config.", e);
        }
    }

    /**
     * Debounces saving of the provided config object.
     * Ensures saveConfig is not called too frequently during rapid UI changes.
     * Assumes saveConfig is available in this IIFE's scope.
     * @param {object} configToSave - The config object to save.
     */
    const debouncedSaveConfig = (function() {
        let timer;
        const delay = 500;

        return function(configToSave) {
            if (typeof configToSave !== 'object' || configToSave === null) {
                 if (typeof GM_log === 'function') GM_log("Pack Filler Pro: debouncedSaveConfig called with invalid or null config. Not scheduling save.");
                 return;
            }

            clearTimeout(timer);
            timer = setTimeout(() => saveConfig(configToSave), delay);
        };
    })();

    // Minimal validation function (can be expanded later)
    // Assumes clamp is available via window.pfpMinimal
    function validateFillConfig(config) {
         if (typeof config !== 'object' || config === null) {
             const errorMsg = "Validation failed: Invalid config object.";
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: ERROR - ${errorMsg}`, config);
             throw new Error(errorMsg);
         }
         if (typeof clamp !== 'function') {
              const errorMsg = "Validation failed: clamp function not found in namespace.";
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: FATAL ERROR - ${errorMsg}`);
              throw new Error(errorMsg);
         }
         const maxQty = typeof window.pfpMinimal.MAX_QTY !== 'undefined' ? window.pfpMinimal.MAX_QTY : 99;

         config.lastMinQty = clamp(parseInt(config.lastMinQty, 10) || 0, 0, maxQty);
         config.lastMaxQty = clamp(parseInt(config.lastMaxQty, 10) || 0, 0, maxQty);
         config.lastFixedQty = clamp(parseInt(config.lastFixedQty, 10) || 0, 0, maxQty);
         config.lastCount = clamp(parseInt(config.lastCount, 10) || 0, 0, Infinity);

         if (config.lastMinQty > config.lastMaxQty) {
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Validation warning: lastMinQty (${config.lastMinQty}) is greater than lastMaxQty (${config.lastMaxQty}). Setting lastMinQty = lastMaxQty.`);
             config.lastMinQty = config.lastMaxQty;
         }

          if (typeof config.lastClear !== 'boolean') {
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Validation warning: Invalid lastClear value (${config.lastClear}). Setting to default ${DEFAULT_CONFIG.lastClear}.`);
              config.lastClear = DEFAULT_CONFIG.lastClear;
          }
          if (typeof config.isDarkMode !== 'boolean') {
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Validation warning: Invalid isDarkMode value (${config.isDarkMode}). Setting to default ${DEFAULT_CONFIG.isDarkMode}.`);
              config.isDarkMode = DEFAULT_CONFIG.isDarkMode;
          }

          if (typeof config.panelVisible !== 'boolean') {
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Validation warning: Invalid panelVisible value (${config.panelVisible}). Setting to default ${DEFAULT_CONFIG.panelVisible}.`);
              config.panelVisible = DEFAULT_CONFIG.panelVisible;
          }

          if (typeof config.panelPos !== 'object' || config.panelPos === null || typeof config.panelPos.top === 'undefined' || typeof config.panelPos.right === 'undefined' || typeof config.panelPos.bottom === 'undefined' || typeof config.panelPos.left === 'undefined') {
              if (typeof GM_log === 'function') GM_log(`Pack Filler Pro: Validation warning: Invalid panelPos structure. Setting to default.`, config.panelPos);
              config.panelPos = { ...DEFAULT_CONFIG.panelPos };
          }

         // Minimal version doesn't validate patternType or specific pattern params here.
    }


    // Attach functions to the global namespace object
    window.pfpMinimal.loadConfig = loadConfig;
    window.pfpMinimal.saveConfig = saveConfig;
    window.pfpMinimal.debouncedSaveConfig = debouncedSaveConfig;
    window.pfpMinimal.validateFillConfig = validateFillConfig; // Add validation function

})(); // End of IIFE
