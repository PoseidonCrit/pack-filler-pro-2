// This file contains the code for the Web Worker as a string.
// It will be used by the main script to create a Blob URL for the worker.

// The worker code needs to be self-contained, including any necessary helper functions.

const workerCode = `
// This code runs inside the Web Worker.

// Helper to clamp a value within min/max bounds (local to worker)
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

// Basic Perlin Noise implementation (simplified for demonstration, local to worker)
function perlinNoise(x, seed) {
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

// Pattern calculation logic for the worker
const WorkerFillStrategies = {
     perlin: (index, total, config) => {
         const seed = config.noiseSeed === '' ? Date.now() : parseInt(config.noiseSeed, 10);
         const scale = config.patternScale || 100;
         const intensity = config.patternIntensity || 1.0;
         const MAX_QTY = 99; // Define MAX_QTY locally in the worker

         const noiseInput = (index / total) * scale;
         const noiseValue = perlinNoise(noiseInput, seed);

         const minQty = config.lastMinQty;
         const maxQty = config.lastMaxQty;
         const range = maxQty - minQty;

         const scaledNoise = noiseValue * (range / 2) * intensity;
         let quantity = minQty + range / 2 + scaledNoise;

         quantity = clamp(quantity, minQty, maxQty);
         quantity = clamp(Math.round(quantity), 0, MAX_QTY);

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
    // fillEmptyOnly is handled on the main thread when selecting inputsToActuallyFill

    // Select the appropriate strategy function
    const strategyFn = WorkerFillStrategies[strategy];

    if (!strategyFn) {
        // Use self.postMessage for logging from worker back to main thread
        self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Unknown strategy "${strategy}". Aborting.\`] });
        self.postMessage({ type: 'result', quantities: [] }); // Send empty array on error
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

    self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Calculation complete. Sending ${quantities.length} quantities.\`] });
    // Send the calculated quantities back to the main script
    self.postMessage({ type: 'result', quantities: quantities });
};

// Optional: Simple logging mechanism from worker to main thread
// This requires the main thread to listen for messages with type 'log'
/*
function GM_log(...args) {
    self.postMessage({ type: 'log', data: args });
}
*/
`;

// Export the worker code as a string
// This variable 'workerCode' will be available in the main script due to @require
// and can be used to create the worker via a Blob URL.
// Note: The name 'patternWorker_js' is derived from the filename by Tampermonkey/Violentmonkey
// when using @require. We will rely on this convention in the main script.

// We don't need an IIFE wrapper here anymore, just the string definition.

