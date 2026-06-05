import { useState, useEffect } from 'react';

/**
 * Custom hook that handles async data fetching without triggering
 * React Compiler's setState-in-effect warning.
 *
 * @param {Function} asyncFn - The async function to call
 * @param {Array} deps - Dependency array for the effect
 * @returns {[*, boolean, Error|null]} - [data, loading, error]
 */
export function useAsyncEffect(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    asyncFn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err });
      });
    return () => { cancelled = true; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return [state.data, state.loading, state.error];
}