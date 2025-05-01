// This file contains the code for the Web Worker as a string.
// It will be used by the main script to create a Blob URL for the worker.
// NOTE: Removed the 'export default' line.

const workerCode = `
'use strict';
// This code runs inside the Web Worker.

/**
 * @preserve
 * Helper functions from TSTL
 * Copyright (c) typestack
 */
 function __values(o) {var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;if (m) return m.call(o);if (o && typeof o.length === "number") return { next: function () { if (o && i >= o.length) o = void 0; return { value: o && o[i++], done: !o }; } }; throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined."); }
 function __read(o, n) {var m = typeof Symbol === "function" && o[Symbol.iterator];if (!m) return o; var i = m.call(o), r, ar = [], e; try { while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value); } catch (error) { e = { error: error }; } finally { try { if (r && !r.done && (m = i["return"])) m.call(i); } finally { if (e) throw e.error; } } return ar; }
 function __spreadArray(to, from, pack) { if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) { if (ar || !(i in from)) { if (!ar) ar = Array.prototype.slice.call(from, 0, i); ar[i] = from[i]; } } return to.concat(ar || Array.prototype.slice.call(from)); }

/**
 * @preserve
 * OpenSimplex Noise in Javascript.
 * Ported by @KdotJPG from Kurt Spencer's java implementation
 * https://gist.github.com/KdotJPG/b1270127455a94ac5d19
 *
 * Modifications by @buildbreakdo:
 * - Typescript port
 * - Use of TSTL helpers
 * - Seeded random number generator
 * - Removed 4D noise and Planar methods
 */
var OpenSimplexNoise = (function () {
    var STRETCH_CONSTANT_2D = -0.211324865405187; //(1/Math.sqrt(2+1)-1)/2;
    var SQUISH_CONSTANT_2D = 0.366025403784439; //(Math.sqrt(2+1)-1)/2;
    var STRETCH_CONSTANT_3D = -1.0 / 6; //(1/Math.sqrt(3+1)-1)/3;
    var SQUISH_CONSTANT_3D = 1.0 / 3; //(Math.sqrt(3+1)-1)/3;
    var NORM_CONSTANT_2D = 47;
    var NORM_CONSTANT_3D = 103;
    var DefaultOpenSimplexNoise = (function () {
        function DefaultOpenSimplexNoise(clientSeed) {
            var _this = this;
            this.gradients2D = [
                5, 2, 2, 5,
                -5, 2, -2, 5,
                5, -2, 2, -5,
                -5, -2, -2, -5,
            ];
            this.gradients3D = [
                -11, 4, 4, -4, 11, 4, -4, 4, 11,
                11, 4, 4, 4, 11, 4, 4, 4, 11,
                -11, -4, 4, -4, -11, 4, -4, -4, 11,
                11, -4, 4, 4, -11, 4, 4, -4, 11,
                -11, 4, -4, -4, 11, -4, -4, 4, -11,
                11, 4, -4, 4, 11, -4, 4, 4, -11,
                -11, -4, -4, -4, -11, -4, -4, -4, -11,
                11, -4, -4, 4, -11, -4, 4, -4, -11,
            ];
            this.p = new Uint8Array(256);
            this.perm = new Uint8Array(512);
            this.permGradIndex3D = new Uint8Array(512);
            var random = this.createLegacyPRNG(clientSeed);
            var source = new Uint8Array(256);
            for (var i = 0; i < 256; i++) {
                source[i] = i;
            }
            for (var i = 255; i >= 0; i--) {
                var r = random.int();
                var r = (r > 0 ? r : -r) % (i + 1);
                this.p[i] = source[r];
                source[r] = source[i];
            }
            this.perm = new Uint8Array(512);
            this.permGradIndex3D = new Uint8Array(512);
            for (var i = 0; i < 512; i++) {
                var v = this.p[i & 255];
                _this.perm[i] = v;
                _this.permGradIndex3D[i] = ((v % (this.gradients3D.length / 3)) * 3);
            }
            this.seed = clientSeed; // Store the seed used
        }
        DefaultOpenSimplexNoise.prototype.createLegacyPRNG = function (clientSeed) {
            var seed = clientSeed;
            return {
                int: function () { return (seed = (seed * 214013 + 2531011) & 0x7fffffff); }
            };
        };
        DefaultOpenSimplexNoise.prototype.extrapolate2d = function (xsb, ysb, dx, dy) {
            var index = this.perm[(this.perm[xsb & 0xFF] + ysb) & 0xFF] & 0x0E;
            return this.gradients2D[index] * dx + this.gradients2D[index + 1] * dy;
        };
        DefaultOpenSimplexNoise.prototype.extrapolate3d = function (xsb, ysb, zsb, dx, dy, dz) {
            var index = this.permGradIndex3D[(this.perm[(this.perm[xsb & 0xFF] + ysb) & 0xFF] + zsb) & 0xFF];
            return this.gradients3D[index] * dx
                + this.gradients3D[index + 1] * dy
                + this.gradients3D[index + 2] * dz;
        };
        DefaultOpenSimplexNoise.prototype.noise2D = function (x, y) {
            var stretchOffset = (x + y) * STRETCH_CONSTANT_2D;
            var xs = x + stretchOffset;
            var ys = y + stretchOffset;
            var xsb = Math.floor(xs);
            var ysb = Math.floor(ys);
            var squishOffset = (xsb + ysb) * SQUISH_CONSTANT_2D;
            var dx0 = x - (xsb + squishOffset);
            var dy0 = y - (ysb + squishOffset);
            var xins = xs - xsb;
            var yins = ys - ysb;
            var inSum = xins + yins;
            var hash = (xins - yins + 1) * 702395077 + (inSum + 2) * 915488749 + (xins + yins * 2 + 3) * 411191265;
            var dx1, dy1, dx2, dy2;
            var value = 0;
            var attn0 = 2 - dx0 * dx0 - dy0 * dy0;
            if (attn0 > 0) {
                attn0 *= attn0;
                value += attn0 * attn0 * this.extrapolate2d(xsb, ysb, dx0, dy0);
            }
            var attn1 = 2 - (dx1 = dx0 - 1 - 2 * SQUISH_CONSTANT_2D) * dx1 - (dy1 = dy0 - 0 - 2 * SQUISH_CONSTANT_2D) * dy1;
            if (attn1 > 0) {
                attn1 *= attn1;
                value += attn1 * attn1 * this.extrapolate2d(xsb + 1, ysb + 0, dx1, dy1);
            }
            var attn2 = 2 - (dx2 = dx0 - 0 - 2 * SQUISH_CONSTANT_2D) * dx2 - (dy2 = dy0 - 1 - 2 * SQUISH_CONSTANT_2D) * dy2;
            if (attn2 > 0) {
                attn2 *= attn2;
                value += attn2 * attn2 * this.extrapolate2d(xsb + 0, ysb + 1, dx2, dy2);
            }
            if (inSum <= 1) { // We're inside the triangle stretching towards (1,0) and (0,1)
                var zins = 1 - inSum;
                if (zins > xins || zins > yins) { // (0,0) is one of the closest two triangular vertices
                    if (xins > yins) {
                        var xsv_ext = xsb + 1;
                        var ysv_ext = ysb - 1;
                        dx0 = dx0 - 1;
                        dy0 = dy0 + 1;
                    }
                    else {
                        var xsv_ext = xsb - 1;
                        var ysv_ext = ysb + 1;
                        dx0 = dx0 + 1;
                        dy0 = dy0 - 1;
                    }
                }
                else { // (1,0) and (0,1) are the closest two vertices.
                    var xsv_ext = xsb + 1;
                    var ysv_ext = ysb + 1;
                    dx0 = dx0 - 1 - 2 * SQUISH_CONSTANT_2D;
                    dy0 = dy0 - 1 - 2 * SQUISH_CONSTANT_2D;
                }
            }
            else { // We're inside the triangle stretching towards (1,1)
                var zins = 2 - inSum;
                if (zins < xins || zins < yins) { // (0,0) is one of the closest two triangular vertices
                    if (xins > yins) {
                        var xsv_ext = xsb + 2;
                        var ysv_ext = ysb + 0;
                        dx0 = dx0 - 2 - 2 * SQUISH_CONSTANT_2D;
                        dy0 = dy0 - 0 - 2 * SQUISH_CONSTANT_2D;
                    }
                    else {
                        var xsv_ext = xsb + 0;
                        var ysv_ext = ysb + 2;
                        dx0 = dx0 - 0 - 2 * SQUISH_CONSTANT_2D;
                        dy0 = dy0 - 2 - 2 * SQUISH_CONSTANT_2D;
                    }
                }
                else { // (1,1) is the closest vertex.
                    dx0 = dx0;
                    dy0 = dy0;
                    var xsv_ext = xsb;
                    var ysv_ext = ysb;
                }
                xsb += 1;
                ysb += 1;
                dx1 = dx0 - 1 - 2 * SQUISH_CONSTANT_2D;
                dy1 = dy0 - 1 - 2 * SQUISH_CONSTANT_2D;
            }
            var attn_ext = 2 - dx0 * dx0 - dy0 * dy0;
            if (attn_ext > 0) {
                attn_ext *= attn_ext;
                value += attn_ext * attn_ext * this.extrapolate2d(xsv_ext, ysv_ext, dx0, dy0);
            }
            var attn1 = 2 - dx1 * dx1 - dy1 * dy1;
            if (attn1 > 0) {
                attn1 *= attn1;
                value += attn1 * attn1 * this.extrapolate2d(xsb, ysb, dx1, dy1);
            }
            return value / NORM_CONSTANT_2D;
        };
        DefaultOpenSimplexNoise.prototype.noise3D = function (x, y, z) {
            var stretchOffset = (x + y + z) * STRETCH_CONSTANT_3D;
            var xs = x + stretchOffset;
            var ys = y + stretchOffset;
            var zs = z + stretchOffset;
            var xsb = Math.floor(xs);
            var ysb = Math.floor(ys);
            var zsb = Math.floor(zs);
            var squishOffset = (xsb + ysb + zsb) * SQUISH_CONSTANT_3D;
            var dx0 = x - (xsb + squishOffset);
            var dy0 = y - (ysb + squishOffset);
            var dz0 = z - (zsb + squishOffset);
            var xins = xs - xsb;
            var yins = ys - ysb;
            var zins = zs - zsb;
            var inSum = xins + yins + zins;
            var hash = (xins - yins + 1) * 702395077
                + (yins - zins + 2) * 915488749
                + (zins - xins + 3) * 411191265;
            var value = 0;
            var dx1, dy1, dz1, dx2, dy2, dz2;
            var attn0 = 2 - dx0 * dx0 - dy0 * dy0 - dz0 * dz0;
            if (attn0 > 0) {
                attn0 *= attn0;
                value += attn0 * attn0 * this.extrapolate3d(xsb, ysb, zsb, dx0, dy0, dz0);
            }
            var attn1 = 2 - (dx1 = dx0 - 1 - 3 * SQUISH_CONSTANT_3D) * dx1 - (dy1 = dy0 - 0 - 3 * SQUISH_CONSTANT_3D) * dy1 - (dz1 = dz0 - 0 - 3 * SQUISH_CONSTANT_3D) * dz1;
            if (attn1 > 0) {
                attn1 *= attn1;
                value += attn1 * attn1 * this.extrapolate3d(xsb + 1, ysb + 0, zsb + 0, dx1, dy1, dz1);
            }
            var attn2 = 2 - (dx1 = dx0 - 0 - 3 * SQUISH_CONSTANT_3D) * dx1 - (dy1 = dy0 - 1 - 3 * SQUISH_CONSTANT_3D) * dy1 - (dz1 = dz0 - 0 - 3 * SQUISH_CONSTANT_3D) * dz1;
            if (attn2 > 0) {
                attn2 *= attn2;
                value += attn2 * attn2 * this.extrapolate3d(xsb + 0, ysb + 1, zsb + 0, dx1, dy1, dz1);
            }
            var attn3 = 2 - (dx1 = dx0 - 0 - 3 * SQUISH_CONSTANT_3D) * dx1 - (dy1 = dy0 - 0 - 3 * SQUISH_CONSTANT_3D) * dy1 - (dz1 = dz0 - 1 - 3 * SQUISH_CONSTANT_3D) * dz1;
            if (attn3 > 0) {
                attn3 *= attn3;
                value += attn3 * attn3 * this.extrapolate3d(xsb + 0, ysb + 0, zsb + 1, dx1, dy1, dz1);
            }
            var xsv_ext1, ysv_ext1, zsv_ext1, xsv_ext2, ysv_ext2, zsv_ext2;
            var dx_ext1, dy_ext1, dz_ext1, dx_ext2, dy_ext2, dz_ext2;
            if (inSum <= 1) { // We're inside the tetrahedron (3-Simplex) at (0,0,0)
                var aScore = xins;
                var bScore = yins;
                var cScore = zins;
                var aPoint = 0x01;
                var bPoint = 0x02;
                var cPoint = 0x04;
                if (aScore >= bScore && aScore >= cScore) {
                    var wins = aPoint;
                }
                else if (bScore >= aScore && bScore >= cScore) {
                    var wins = bPoint;
                }
                else {
                    var wins = cPoint;
                }
                // Set second winner
                if (wins === aPoint ? (bScore >= cScore) : (wins === bPoint ? (aScore >= cScore) : (aScore >= bScore))) {
                    var second = wins === aPoint ? bPoint : (wins === bPoint ? aPoint : bPoint); // b or a or b
                }
                else {
                    var second = cPoint; // c or c or c
                }
                if ((wins | second) === 0x03) {
                    xsv_ext1 = xsb + 1;
                    ysv_ext1 = ysb + 1;
                    zsv_ext1 = zsb + 0;
                    dx_ext1 = dx0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dy_ext1 = dy0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dz_ext1 = dz0 - 0 - 2 * SQUISH_CONSTANT_3D;
                    xsv_ext2 = xsb + 1;
                    ysv_ext2 = ysb + 0;
                    zsv_ext2 = zsb + 1;
                    dx_ext2 = dx0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dy_ext2 = dy0 - 0 - 2 * SQUISH_CONSTANT_3D;
                    dz_ext2 = dz0 - 1 - 2 * SQUISH_CONSTANT_3D;
                }
                else if ((wins | second) === 0x05) {
                    xsv_ext1 = xsb + 1;
                    ysv_ext1 = ysb + 0;
                    zsv_ext1 = zsb + 1;
                    dx_ext1 = dx0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dy_ext1 = dy0 - 0 - 2 * SQUISH_CONSTANT_3D;
                    dz_ext1 = dz0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    xsv_ext2 = xsb + 0;
                    ysv_ext2 = ysb + 1;
                    zsv_ext2 = zsb + 1;
                    dx_ext2 = dx0 - 0 - 2 * SQUISH_CONSTANT_3D;
                    dy_ext2 = dy0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dz_ext2 = dz0 - 1 - 2 * SQUISH_CONSTANT_3D;
                }
                else { // (wins | second) === 0x06
                    xsv_ext1 = xsb + 0;
                    ysv_ext1 = ysb + 1;
                    zsv_ext1 = zsb + 1;
                    dx_ext1 = dx0 - 0 - 2 * SQUISH_CONSTANT_3D;
                    dy_ext1 = dy0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dz_ext1 = dz0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    xsv_ext2 = xsb + 1;
                    ysv_ext2 = ysb + 1;
                    zsv_ext2 = zsb + 0;
                    dx_ext2 = dx0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dy_ext2 = dy0 - 1 - 2 * SQUISH_CONSTANT_3D;
                    dz_ext2 = dz0 - 0 - 2 * SQUISH_CONSTANT_3D;
                }
            }
            else { // We're inside the tetrahedron (3-Simplex) at (1,1,1)
                var aScore = 1 - xins;
                var bScore = 1 - yins;
                var cScore = 1 - zins;
                var aPoint = 0x01;
                var bPoint = 0x02;
                var cPoint = 0x04;
                if (aScore >= bScore && aScore >= cScore) {
                    var wins = aPoint;
                }
                else if (bScore >= aScore && bScore >= cScore) {
                    var wins = bPoint;
                }
                else {
                    var wins = cPoint;
                }
                // Set second winner
                if (wins === aPoint ? (bScore >= cScore) : (wins === bPoint ? (aScore >= cScore) : (aScore >= bScore))) {
                    var second = wins === aPoint ? bPoint : (wins === bPoint ? aPoint : bPoint); // b or a or b
                }
                else {
                    var second = cPoint; // c or c or c
                }
                if ((wins | second) === 0x03) {
                    xsv_ext1 = xsb + 1;
                    ysv_ext1 = ysb + 1;
                    zsv_ext1 = zsb + 0;
                    dx_ext1 = dx0 - 1 - SQUISH_CONSTANT_3D;
                    dy_ext1 = dy0 - 1 - SQUISH_CONSTANT_3D;
                    dz_ext1 = dz0 - 0 - SQUISH_CONSTANT_3D;
                    xsv_ext2 = xsb + 1;
                    ysv_ext2 = ysb + 0;
                    zsv_ext2 = zsb + 1;
                    dx_ext2 = dx0 - 1 - SQUISH_CONSTANT_3D;
                    dy_ext2 = dy0 - 0 - SQUISH_CONSTANT_3D;
                    dz_ext2 = dz0 - 1 - SQUISH_CONSTANT_3D;
                }
                else if ((wins | second) === 0x05) {
                    xsv_ext1 = xsb + 1;
                    ysv_ext1 = ysb + 0;
                    zsv_ext1 = zsb + 1;
                    dx_ext1 = dx0 - 1 - SQUISH_CONSTANT_3D;
                    dy_ext1 = dy0 - 0 - SQUISH_CONSTANT_3D;
                    dz_ext1 = dz0 - 1 - SQUISH_CONSTANT_3D;
                    xsv_ext2 = xsb + 0;
                    ysv_ext2 = ysb + 1;
                    zsv_ext2 = zsb + 1;
                    dx_ext2 = dx0 - 0 - SQUISH_CONSTANT_3D;
                    dy_ext2 = dy0 - 1 - SQUISH_CONSTANT_3D;
                    dz_ext2 = dz0 - 1 - SQUISH_CONSTANT_3D;
                }
                else { // (wins | second) === 0x06
                    xsv_ext1 = xsb + 0;
                    ysv_ext1 = ysb + 1;
                    zsv_ext1 = zsb + 1;
                    dx_ext1 = dx0 - 0 - SQUISH_CONSTANT_3D;
                    dy_ext1 = dy0 - 1 - SQUISH_CONSTANT_3D;
                    dz_ext1 = dz0 - 1 - SQUISH_CONSTANT_3D;
                    xsv_ext2 = xsb + 1;
                    ysv_ext2 = ysb + 1;
                    zsv_ext2 = zsb + 0;
                    dx_ext2 = dx0 - 1 - SQUISH_CONSTANT_3D;
                    dy_ext2 = dy0 - 1 - SQUISH_CONSTANT_3D;
                    dz_ext2 = dz0 - 0 - SQUISH_CONSTANT_3D;
                }
            }
            var attn_ext1 = 2 - dx_ext1 * dx_ext1 - dy_ext1 * dy_ext1 - dz_ext1 * dz_ext1;
            if (attn_ext1 > 0) {
                attn_ext1 *= attn_ext1;
                value += attn_ext1 * attn_ext1 * this.extrapolate3d(xsv_ext1, ysv_ext1, zsv_ext1, dx_ext1, dy_ext1, dz_ext1);
            }
            var attn_ext2 = 2 - dx_ext2 * dx_ext2 - dy_ext2 * dy_ext2 - dz_ext2 * dz_ext2;
            if (attn_ext2 > 0) {
                attn_ext2 *= attn_ext2;
                value += attn_ext2 * attn_ext2 * this.extrapolate3d(xsv_ext2, ysv_ext2, zsv_ext2, dx_ext2, dy_ext2, dz_ext2);
            }
            return value / NORM_CONSTANT_3D;
        };
        return DefaultOpenSimplexNoise;
    }());
    return DefaultOpenSimplexNoise;
})();

// Helper to clamp a value within min/max bounds (local to worker)
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

// Strategy registry for worker-based calculations
const WorkerStrategies = {
    /**
     * Generates quantity based on OpenSimplex noise.
     * Noise value ranges roughly from -1 to 1.
     * We scale this to the min/max quantity range.
     */
    simplex: (index, total, config, noiseInstance) => {
        // Use 2D noise; Y coordinate can be fixed or varied slightly for different results
        const yCoord = 0.5; // Fixed Y coordinate for 1D noise along the index
        const scale = (config.patternScale || 100) / 1000; // Normalize scale
        const intensity = config.patternIntensity || 1.0;
        const noiseVal = noiseInstance.noise2D(index * scale, yCoord); // Output is roughly -1 to 1

        const minQty = config.lastMinQty;
        const maxQty = config.lastMaxQty;
        const range = maxQty - minQty;

        // Map noise from [-1, 1] to [minQty, maxQty] and apply intensity
        // noiseVal * 0.5 + 0.5 maps [-1, 1] to [0, 1]
        const baseValue = minQty + (noiseVal * 0.5 + 0.5) * range;
        // Apply intensity relative to the midpoint of the range
        const midPoint = minQty + range / 2;
        const finalValue = midPoint + (baseValue - midPoint) * intensity;

        // No need to clamp here, as the final clamping happens in the main loop
        return Math.round(finalValue);
    },

    /**
     * Generates quantity based on a linear gradient.
     */
    gradient: (index, total, config, noiseInstance) => {
        // Intensity affects how close the gradient approaches the min/max bounds
        const intensity = config.patternIntensity || 1.0;
        const minQty = config.lastMinQty;
        const maxQty = config.lastMaxQty;
        const range = maxQty - minQty;

        // Calculate base progress (0 to 1)
        const progress = total <= 1 ? 0.5 : index / (total - 1); // Avoid division by zero if total=1

        // Calculate base quantity along the gradient
        const baseValue = minQty + progress * range;
        // Apply intensity relative to the midpoint
        const midPoint = minQty + range / 2;
        const finalValue = midPoint + (baseValue - midPoint) * intensity;

        // No need to clamp here, as the final clamping happens in the main loop
        return Math.round(finalValue);
    }
    // Add other worker-suitable strategies here if needed
};


// Basic config validation within the worker
const validateConfig = (config) => {
    const errors = [];
    if (typeof config.lastMinQty !== 'number' || config.lastMinQty < 0) errors.push('Invalid min quantity');
    if (typeof config.lastMaxQty !== 'number' || config.lastMaxQty < config.lastMinQty) errors.push('Invalid max quantity');
    if (typeof config.patternScale !== 'number' || config.patternScale < 10) errors.push('Invalid pattern scale');
    if (typeof config.patternIntensity !== 'number' || config.patternIntensity < 0 || config.patternIntensity > 1) errors.push('Invalid pattern intensity');
    if (config.noiseSeed && typeof config.noiseSeed !== 'string' && typeof config.noiseSeed !== 'number') errors.push('Invalid noise seed type');
    if (typeof config.maxTotalAmount !== 'number' || config.maxTotalAmount < 0) errors.push('Invalid max total amount');
    if (typeof config.maxQtyOverride !== 'number' || config.maxQtyOverride < 0) errors.push('Invalid max quantity override');

    if (errors.length) {
        // Use self.postMessage for logging error details back if needed before throwing
        self.postMessage({ type: 'log', data: ['Worker config validation failed:', ...errors] });
        throw new Error(\`Config validation failed: \${errors.join(', ')}\`);
    }
};

// Listener for messages from the main script
self.onmessage = (e) => {
    const { requestId, strategy, count, config } = e.data;

    try {
        // Validate inputs
        if (!requestId) throw new Error('Missing requestId');
        if (typeof count !== 'number' || count <= 0) throw new Error('Invalid count');
        if (!WorkerStrategies[strategy]) throw new Error(\`Unknown worker strategy: \${strategy}\`);
        validateConfig(config); // Validate the received config subset

        const quantities = new Array(count);
        let currentTotal = 0;
        const minQty = config.lastMinQty;
        const maxQty = config.lastMaxQty;
        const maxTotalAmount = config.maxTotalAmount;
        const useMaxTotal = maxTotalAmount > 0;
        const absoluteMaxQty = config.maxQtyOverride || 99; // Absolute upper limit per input

        let noiseInstance;
        let seedUsed = null;

        // Initialize noise generator if needed
        if (strategy === 'simplex') {
            const seedInput = config.noiseSeed;
            // Attempt to parse seed as integer if it's a non-empty string, otherwise use timestamp
            const seed = (typeof seedInput === 'number') ? seedInput :
                         (typeof seedInput === 'string' && seedInput.trim() !== '' && !isNaN(parseInt(seedInput, 10))) ? parseInt(seedInput, 10) :
                         Date.now();
            noiseInstance = new OpenSimplexNoise(seed);
            seedUsed = noiseInstance.seed; // Store the actual seed used
        }

        // Select the strategy function
        const strategyFn = WorkerStrategies[strategy];

        // Compute quantities
        for (let i = 0; i < count; i++) {
            // Calculate raw quantity using the strategy
            let qty = strategyFn(i, count, config, noiseInstance);

            // Clamp quantity: ensure it's within [minQty, maxQty] AND not above absoluteMaxQty
            qty = clamp(qty, minQty, Math.min(maxQty, absoluteMaxQty));

            // Apply Max Total Limit if active
            if (useMaxTotal) {
                const remaining = maxTotalAmount - currentTotal;
                if (remaining <= 0) {
                    // Max total reached, fill the rest with 0
                    quantities.fill(0, i);
                    break; // Stop calculation loop
                }
                // Ensure quantity doesn't exceed remaining budget
                qty = Math.min(qty, remaining);
            }

            quantities[i] = qty;
            currentTotal += qty;
        }

        // Send the result back to the main script
        self.postMessage({
            type: 'result',
            requestId: requestId, // Include requestId in response
            quantities: quantities,
            metadata: {
                actualTotal: currentTotal,
                seedUsed: seedUsed // Include seed used, null if not applicable
            }
        });

    } catch (error) {
         // Use self.postMessage for logging from worker back to main thread
         self.postMessage({ type: 'log', data: ['Worker error occurred:', error.message, error.stack] });
         // Send an error message back
         self.postMessage({
             type: 'error',
             requestId: requestId, // Include requestId in response
             message: error.message,
             stack: error.stack // Optional: include stack for debugging
         });
    }
};

// Optional: Simple logging mechanism from worker to main thread
function log(...args) {
     self.postMessage({ type: 'log', data: args });
}
log('Worker initialized.'); // Log when worker starts

`; // End of workerCode template literal
