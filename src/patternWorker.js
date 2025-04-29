// This is a Web Worker script for performing heavy pattern calculations off the main thread.
// It should be loaded via a separate @require directive in the main UserScript file.

// Assumes clamp and perlinNoise functions are available or implemented here.
// Since this is a separate file, we need to include necessary helper functions or import them.
// For simplicity, let's include a basic perlinNoise implementation here.

// Basic Perlin Noise implementation (needs to be self-contained in the worker)
function perlinNoise(x, seed) {
    // Simple deterministic hash for seeding
    const hash = (n) => {
        let i = (n * 0x1357) ^ seed;
        return (i * i * 0x8295) >>> 0;
    };

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const grad = (hash, x) => {
        const h = hash & 15;
        const grad = 1 + (h & 7);
        if (h & 8) return -grad * x;
        return grad * x;
    };

    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const t = x - x0;
    const t_faded = fade(t);

    const hash0 = hash(x0);
    const hash1 = hash(x1);

    const grad0 = grad(hash0, t);
    const grad1 = grad(hash1, t - 1);

    return lerp(grad0, grad1, t_faded);
}

// Helper to clamp a value within min/max bounds (also needed in worker)
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));


// Pattern calculation logic for the worker
const WorkerFillStrategies = {
     // Perlin Noise based strategy (replicated from fillLogic)
     perlin: (index, total, config) => {
         const seed = config.noiseSeed === '' ? Date.now() : parseInt(config.noiseSeed, 10);
         const scale = config.patternScale || 100;
         const intensity = config.patternIntensity || 1.0;

         const noiseInput = (index / total) * scale;
         const noiseValue = perlinNoise(noiseInput, seed);

         const minQty = config.lastMinQty;
         const maxQty = config.lastMaxQty;
         const range = maxQty - minQty;

         const scaledNoise = noiseValue * (range / 2) * intensity;
         let quantity = minQty + range / 2 + scaledNoise;

         quantity = clamp(quantity, minQty, maxQty);
         quantity = clamp(Math.round(quantity), 0, 99); // Clamp to MAX_QTY (99)

         return quantity;
     },
     // Add other heavy strategies here if needed in the future
};


// Listener for messages from the main script
self.onmessage = (e) => {
    const { strategy, count, config } = e.data;
    const quantities = new Array(count);
    let currentTotal = 0;
    const useMaxTotal = config.maxTotalAmount > 0;
    const maxTotalAmount = config.maxTotalAmount;
    const fillEmptyOnly = config.fillEmptyOnly; // Worker needs to know this, but filtering happens on main thread

    GM_log(`Pack Filler Pro Worker: Received message to calculate pattern "${strategy}" for ${count} packs.`);

    // Select the appropriate strategy function
    const strategyFn = WorkerFillStrategies[strategy];

    if (!strategyFn) {
        GM_log(`Pack Filler Pro Worker: Unknown strategy "${strategy}". Aborting.`);
        self.postMessage([]); // Send empty array on error
        return;
    }

    // Compute pattern quantities
    for (let i = 0; i < count; i++) {
        let qty = strategyFn(i, count, config);

        // Apply Max Total Limit if active (worker can pre-calculate this)
        if (useMaxTotal) {
             const remaining = maxTotalAmount - currentTotal;
             qty = Math.min(qty, Math.max(0, remaining)); // Ensure non-negative quantity
        }

        quantities[i] = qty;
        currentTotal += qty;

        // If max total is hit, fill the rest with 0
        if (useMaxTotal && currentTotal >= maxTotalAmount) {
             for (let j = i + 1; j < count; j++) {
                  quantities[j] = 0;
             }
             break; // Stop calculation
        }
    }

    GM_log(`Pack Filler Pro Worker: Calculation complete. Sending ${quantities.length} quantities.`);
    // Send the calculated quantities back to the main script
    self.postMessage(quantities);
};

// Add GM_log polyfill for worker context if needed (optional, depends on Tampermonkey/Violentmonkey)
// In some environments, GM_log might not be available in workers.
// If logs from the worker are needed, a simple postMessage logging mechanism could be implemented.
// Example:
/*
function GM_log(...args) {
    self.postMessage({ type: 'log', data: args });
}
*/

