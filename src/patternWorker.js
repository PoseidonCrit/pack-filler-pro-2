/*
// This file is NOT USED in the main-thread-only version of the script.
// All calculation logic has been moved to fillLogic.js.

// Keeping this file here just as a marker that it was part of the original
// worker-based implementation. It will not be @require'd in the main script header.

// const workerCode = `...`; // Worker code string removed
// export const workerCode = workerCode; // Export removed



// This file contains the code for the Web Worker as a string.
// It will be used by the main script to create a Blob URL for the worker.

// The worker code needs to be self-contained, including any necessary helper functions.

const workerCode = `
// This code runs inside the Web Worker.
// It does not have access to GM_ functions or the DOM.

// Helper to clamp a value within min/max bounds (local to worker)
const clamp = (val, min, max) => {
    const numVal = parseFloat(val); // Use parseFloat for potential float quantities
    if (isNaN(numVal)) return 0;
    return Math.min(max, Math.max(min, numVal));
};

// Basic 1D Perlin Noise implementation (simplified for demonstration, local to worker)
// Based on Ken Perlin's original Java implementation.
// Note: This is a 1D noise function suitable for a linear list of packs.
// Seed is used to make the noise repeatable.
function perlinNoise(x, seed) {
    // Simple hashing function using bitwise operations and a seed.
    // Needs to be deterministic based on input (x) and seed.
    // Using prime multipliers and XOR with seed for mixing.
    const hash = (n, s) => {
        let i = ((n * 0x1357) ^ s) >>> 0; // Multiply, XOR with seed, ensure positive 32-bit int
        i = ((i * 0x4593) ^ (i >>> 16)) >>> 0; // More mixing
        i = ((i * 0x8295) ^ (i >>> 16)) >>> 0; // Final mixing
        return i;
    };

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10); // Smooth interpolation curve (6t^5 - 15t^4 + 10t^3)
    const lerp = (a, b, t) => a + t * (b - a); // Linear interpolation

    // Gradient function for 1D noise
    // Determines the influence of the random gradient at an integer coordinate.
    const grad = (hashValue, xDistance) => {
        // Get the last bit of the hash to determine gradient direction (-1 or 1)
        const h = hashValue & 1; // Use just one bit for 1D gradient direction
        const gradient = (h === 0) ? xDistance : -xDistance; // If bit is 0, gradient is positive; otherwise negative
        return gradient;
    };

    const x0 = Math.floor(x); // Integer part
    const x1 = x0 + 1; // Next integer part
    const t = x - x0; // Fractional part (0 to 1)
    const t_faded = fade(t); // Smooth the fractional part

    // Calculate gradients at the integer coordinates based on their hash and the seed
    const hash0 = hash(x0, seed);
    const hash1 = hash(x1, seed);

    const grad0 = grad(hash0, t); // Gradient at x0, influenced by distance t
    const grad1 = grad(hash1, t - 1); // Gradient at x1, influenced by distance t-1

    // Interpolate between the gradients
    return lerp(grad0, grad1, t_faded); // Result is typically between -1 and 1
}

// Simple linear interpolation helper (local to worker)
const lerp = (a, b, t) => a + t * (b - a);

// Generates a random seed if none is provided or if seed is an empty string
function generateSeed(seedInput) {
    // If seedInput is provided and is a non-empty string, try to parse it as an integer.
    // Otherwise, generate a random seed.
    if (seedInput && typeof seedInput === 'string' && seedInput.trim() !== '') {
        const parsedSeed = parseInt(seedInput, 10);
        // Use the parsed seed if it's a valid number, otherwise generate random
        if (!isNaN(parsedSeed)) {
             self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Using provided seed: \${parsedSeed}\`] });
             return parsedSeed;
        } else {
             self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Invalid seed input '\${seedInput}'. Generating random seed.\`] });
        }
    }
    // Generate a random seed (a large integer)
    const randomSeed = Math.floor(Math.random() * 2**32); // Use a large range for the seed
    self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Generating random seed: \${randomSeed}\`] });
    return randomSeed;
}

// Calculates quantities based on the Perlin Noise pattern
function calculatePerlinQuantities(count, config) {
    const quantities = [];
    const minQty = config.lastMinQty;
    const maxQty = config.lastMaxQty;
    const scale = config.patternScale || 100; // Default scale
    const intensity = config.patternIntensity || 1.0; // Default intensity (0.0 to 1.0)
    const range = maxQty - minQty; // The range of possible quantities

    // Generate or parse seed
    const actualSeed = generateSeed(config.noiseSeed);

    // Ensure scale is at least 1 to avoid division by zero or infinite loop
    const safeScale = Math.max(1, scale);

    for (let i = 0; i < count; i++) {
        // Map index (0 to count-1) to a position in the noise space, influenced by scale.
        // Dividing by safeScale determines how 'zoomed in' the noise is.
        const noiseInput = i / safeScale;

        // Get noise value (typically -1 to 1)
        const noiseValue = perlinNoise(noiseInput, actualSeed);

        // Map noise value (-1 to 1) to a quantity range (minQty to maxQty)
        // Normalize noise from [-1, 1] to [0, 1]
        const normalizedNoise = (noiseValue + 1) / 2; // Now 0 to 1

        // Interpolate between minQty and maxQty based on normalized noise and intensity.
        // Intensity controls how much the noise affects the final quantity.
        // If intensity is 1, quantity ranges fully from minQty to maxQty based on noise.
        // If intensity is 0, quantity is always the midpoint (minQty + range/2).
        // We interpolate between the midpoint and the quantity determined purely by noise.
        const midpoint = minQty + range / 2;
        const quantityFromNoise = minQty + normalizedNoise * range;
        let finalQuantityFloat = lerp(midpoint, quantityFromNoise, intensity);

        // Clamp the final quantity to the allowed range [0, MAX_QTY] and round to nearest integer.
        const finalQuantity = clamp(Math.round(finalQuantityFloat), 0, 99); // Use 99 as MAX_QTY constant isn't directly here

        quantities.push(finalQuantity);
    }

    return { quantities, metadata: { seedUsed: actualSeed } }; // Return seed used for feedback
}

// Calculates quantities based on the Gradient pattern
function calculateGradientQuantities(count, config) {
    const quantities = [];
    const minQty = config.lastMinQty;
    const maxQty = config.lastMaxQty;
    const intensity = config.patternIntensity || 1.0; // Default intensity (0.0 to 1.0)
    const scale = config.patternScale || 100; // Default scale (affects gradient steepness over the count)
    const range = maxQty - minQty; // The range of possible quantities

    self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Calculating Gradient with scale: \${scale}, intensity: \${intensity}\`] });

    // Ensure count is at least 1 to avoid division by zero in index mapping
    const safeCount = Math.max(1, count);
    // Ensure scale is at least 1 for mapping index to position factor
    const safeScale = Math.max(1, scale);


    for (let i = 0; i < count; i++) {
         // Calculate position factor (0 to 1) based on index and scale.
         // Dividing by safeScale determines how quickly the gradient progresses.
         // Clamp to 1 to ensure the factor doesn't exceed 1 even if index > scale.
         const positionFactor = clamp(i / (safeScale -1), 0, 1); // Factor goes from 0 to ~1 as index approaches scale

        // Calculate a base quantity based on position in the list (linear gradient from minQty to maxQty)
        const baseQty = minQty + positionFactor * range;

        // Apply intensity to shift the quantity towards minQty or the linear gradient value.
        // If intensity is 1, quantity follows the linear gradient (min to max).
        // If intensity is 0, quantity is always minQty (the starting point).
        let finalQuantityFloat = lerp(minQty, baseQty, intensity);


        // Clamp the final quantity to the allowed range [0, MAX_QTY] and round to nearest integer.
        const finalQuantity = clamp(Math.round(finalQuantityFloat), 0, 99); // Use 99 as MAX_QTY constant isn't directly here

        quantities.push(finalQuantity);
    }
     return { quantities, metadata: {} }; // No specific metadata for gradient
}

// Listener for messages from the main script
self.onmessage = function(e) {
    const { type, strategy, count, config, requestId } = e.data; // Include requestId

    if (type === 'calculate') {
        self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Received calculation request (ID: ${requestId}) for strategy: ${strategy}, count: ${count}\`] });

        let quantities = [];
        let metadata = {}; // Metadata to send back (e.g., seed used)
        let error = null;

        try {
            // Validate input count
            const numCount = parseInt(count, 10);
            if (isNaN(numCount) || numCount < 0) {
                 throw new Error(`Invalid count received: ${count}`);
            }

            // Validate config object structure (basic check)
            if (typeof config !== 'object' || config === null) {
                 throw new Error("Invalid configuration object received.");
            }
            // Basic validation of quantity bounds from config
            const minQty = clamp(config.lastMinQty, 0, 99);
            const maxQty = clamp(config.lastMaxQty, 0, 99);
             if (minQty > maxQty) {
                  throw new Error(`Invalid quantity range in config: min ${config.lastMinQty} > max ${config.lastMaxQty}`);
             }


            if (strategy === 'perlin') {
                const perlinResult = calculatePerlinQuantities(numCount, config); // config includes noiseSeed
                quantities = perlinResult.quantities;
                metadata = perlinResult.metadata;
            } else if (strategy === 'gradient') {
                 const gradientResult = calculateGradientQuantities(numCount, config);
                 quantities = gradientResult.quantities;
                 metadata = gradientResult.metadata;
            } else {
                // This case should ideally not be reached if the main thread filters strategies correctly.
                self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Unknown strategy '\${strategy}'. Aborting calculation.\`] });
                throw new Error(`Unknown calculation strategy: ${strategy}`);
            }

            // Ensure the number of quantities matches the requested count
            if (quantities.length !== numCount) {
                 throw new Error(`Calculation mismatch: Expected ${numCount} quantities, but got ${quantities.length}.`);
            }


            // Apply Max Total Amount constraint *after* individual quantities are calculated by the pattern.
            // This ensures the *distribution* follows the pattern as much as possible within the total limit.
            // If maxTotalAmount > 0, adjust quantities to sum up to at most maxTotalAmount.
            const maxTotalAmount = clamp(config.maxTotalAmount, 0, Infinity); // Use clamp for safety, max is effectively infinite here
            if (maxTotalAmount > 0) {
                 let currentTotal = quantities.reduce((sum, qty) => sum + qty, 0);
                 self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Applying Max Total Amount constraint (\${maxTotalAmount}). Current calculated total: \${currentTotal}.\`] });

                 if (currentTotal > maxTotalAmount) {
                      // Scale down quantities proportionally or apply a cap
                      // Simple cap approach: fill up to the max total, then set remaining to 0
                      let cumulativeTotal = 0;
                      for (let i = 0; i < quantities.length; i++) {
                           const qty = quantities[i];
                           const remaining = maxTotalAmount - cumulativeTotal;
                           // Cap the quantity, ensure non-negative and integer
                           const cappedQty = Math.max(0, Math.min(Math.round(qty), remaining));
                           quantities[i] = cappedQty;
                           cumulativeTotal += cappedQty;
                           if (cumulativeTotal >= maxTotalAmount) {
                                // If total is reached or exceeded, set remaining quantities to 0
                                for (let j = i + 1; j < quantities.length; j++) {
                                     quantities[j] = 0;
                                }
                                break; // Stop processing quantities
                           }
                      }
                       self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Quantities adjusted to meet Max Total Amount (\${maxTotalAmount}). New total: \${cumulativeTotal}.\`] });
                 }
            }


            // Send the calculated quantities and metadata back to the main script
            self.postMessage({ type: 'result', requestId: requestId, quantities: quantities, metadata: metadata });

        } catch (e) {
            error = { message: e.message, stack: e.stack };
            self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Calculation error: \${error.message}\`, error] });
            // Send an error response back to the main script


*/
            self.postMessage({ type: 'error', requestId: requestId, error: error });
        }
    } else {
         // Handle unexpected message types received by the worker
         self.postMessage({ type: 'log', data: [\`Pack Filler Pro Worker: Received unexpected message type: \${type}\`, e.data] });
    }
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
// Note: The name 'workerCode' should be consistent with how it's referenced in the main script.

// No need for an IIFE wrapper in this file, just the constant definition.
