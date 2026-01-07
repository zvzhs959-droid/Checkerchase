/**
 * Determinism helpers: dual seeded RNG streams + stable time sources for lockstep.
 * - fx RNG: safe for UI / render-only randomness (may diverge per device)
 * - game RNG: used for simulation; only advanced during deterministic sim steps
 */
(function(){
  window.flux = window.flux || {};

  function makeRNG(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  window.flux._gameSeed = 123456789;
  window.flux._fxSeed = (window.flux._gameSeed ^ 0x9E3779B9) >>> 0;

  window.flux._gameRng = makeRNG(window.flux._gameSeed);
  window.flux._fxRng = makeRNG(window.flux._fxSeed);
  window.flux._rngActive = 'fx';

  window.flux.setSeed = function(seed){
    const s = (seed >>> 0) || 1;
    window.flux._gameSeed = s;
    window.flux._fxSeed = (s ^ 0x9E3779B9) >>> 0;
    window.flux._gameRng = makeRNG(window.flux._gameSeed);
    window.flux._fxRng = makeRNG(window.flux._fxSeed);
  };

  window.flux.useGameRng = function(){ window.flux._rngActive = 'game'; };
  window.flux.useFxRng = function(){ window.flux._rngActive = 'fx'; };

  // Global replacement target: all old Math.random() calls are now window.flux.rand()
  window.flux.rand = function(){
    return (window.flux._rngActive === 'game') ? window.flux._gameRng() : window.flux._fxRng();
  };
})();
