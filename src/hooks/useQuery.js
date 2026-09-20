import { useEffect, useState } from 'react';
import { observe } from '../storage/provider.js';

/**
 * Subscribes to a storage query and re-runs it whenever the data it read
 * changes (ADR-0009). `data` is undefined until the first result, so a caller
 * supplies its own default. Nothing renders `loading` or `error` yet; they
 * exist for the project that adds a remote provider.
 */
export function useQuery(querier, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });

  useEffect(() => {
    let live = true;
    setState(current => ({ ...current, loading: true }));

    const subscription = observe(querier).subscribe({
      next: data => {
        if (live) setState({ data, loading: false, error: null });
      },
      error: error => {
        if (live) setState(current => ({ data: current.data, loading: false, error }));
      },
    });

    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, deps);

  return state;
}
