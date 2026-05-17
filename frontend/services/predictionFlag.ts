// Module-level flag — works across screens since React Native runs in one JS engine.
// Any screen that saves new data calls markPredictionStale().
// The home screen checks checkAndClearPredictionStale() on focus.

let _stale = false;

export const markPredictionStale = () => { _stale = true; };

export const checkAndClearPredictionStale = (): boolean => {
  const v = _stale;
  _stale = false;
  return v;
};
