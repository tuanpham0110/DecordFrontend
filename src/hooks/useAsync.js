import { useCallback, useEffect, useState } from 'react';

/** Runs an async loader and exposes { data, error, loading, reload }. */
export default function useAsync(loader, deps = []) {
    const [state, setState] = useState({ data: null, error: null, loading: true });
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: null }));
        loader()
            .then((data) => alive && setState({ data, error: null, loading: false }))
            .catch((error) => alive && setState({ data: null, error, loading: false }));
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, tick]);

    const reload = useCallback(() => setTick((t) => t + 1), []);
    return { ...state, reload };
}
