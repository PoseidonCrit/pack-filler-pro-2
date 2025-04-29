// This block handles loading, saving, and managing the script's configuration.
// It relies on GM_getValue and GM_setValue from the UserScript API.
// In a modular setup, this could be a 'configManager.js' module.

// Assumes 'config', 'DEFAULT_CONFIG', 'CONFIG_KEY', and GM_* functions are accessible
// (either globally or imported).

/* --- Configuration Management --- */
function loadConfig() {
    const raw = GM_getValue(CONFIG_KEY);
    let cfg = { ...DEFAULT_CONFIG }; // Start with defaults
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            // Merge fields from saved config onto defaults
            cfg = { ...cfg, ...parsed };

            // Handle specific migrations if config version is old
            if (parsed.version < DEFAULT_CONFIG.version) {
                GM_log(`Pack Filler Pro: Config migrating from v${parsed.version} to v${DEFAULT_CONFIG.version}.`);
                // Migration logic if needed in future versions
                 if (parsed.version < 12 && cfg.panelPos && cfg.panelPos.bottom !== 'auto') {
                     cfg.panelPos = { ...DEFAULT_CONFIG.panelPos };
                     GM_log("Pack Filler Pro: Migrated panel position to default top/right.");
                 }
            } else if (parsed.version > DEFAULT_CONFIG.version) {
                 GM_log(`Pack Filler Pro: Saved config version (${parsed.version}) is newer than script version (${DEFAULT_CONFIG.version}). Using default config.`);
                 cfg = { ...DEFAULT_CONFIG }; // Use defaults if saved is newer
            }

             // Ensure defaults for potentially missing values (from old versions or bad saves)
             const has = Object.prototype.hasOwnProperty.call;
             Object.keys(DEFAULT_CONFIG).forEach(key => {
                  if (!has(cfg, key)) {
                       cfg[key] = DEFAULT_CONFIG[key];
                  }
             });

        } catch (e) {
            GM_log("Error loading Pack Filler Pro config, using defaults.", e);
             cfg = { ...DEFAULT_CONFIG }; // Use defaults on parse error
        }
    }
     // Always set the version to the current script version for saving
     cfg.version = DEFAULT_CONFIG.version;
     return cfg;
}

function saveConfig() {
    // Ensure version is always saved correctly
    config.version = DEFAULT_CONFIG.version;
    try {
        GM_setValue(CONFIG_KEY, JSON.stringify(config));
        // GM_log("Pack Filler Pro config saved."); // Too chatty for every change
    } catch (e) {
        GM_log("Error saving Pack Filler Pro config.", e);
    }
}

// Debounce saving to avoid excessive writes on input changes
const debouncedSaveConfig = (function() {
    let timer;
    return function() {
        clearTimeout(timer);
        timer = setTimeout(saveConfig, 500); // Save after 500ms of no changes
    };
})();

// Assumes 'config' is updated elsewhere before calling debouncedSaveConfig.
