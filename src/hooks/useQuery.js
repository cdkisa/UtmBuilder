import { useEffect, useState } from 'react';
import { observe } from '../storage/provider.js';

/**
 * Subscribes to a storage query and re-runs it whenever the data it read
 * changes (ADR-0009). `data` is undefined until the first result, so a caller
 * supplies its own default. `collections` names the collections the querier
 * reads, passed through to `observe` for a provider that needs to be told
 * when to re-run it. `deps` controls when the subscription is torn down and
 * re-created, the same as an effect's dependency array.
 */
export function useQuery(querier, collections, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });

  useEffect(() => {
    let live = true;
    setState(current => ({ ...current, loading: true, error: null }));

    const subscription = observe(querier, collections).subscribe({
      next: data => {
        if (live) setState({ data, loading: false, error: null });
      },
      error: error => {
        console.error('storage query failed', error);
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
