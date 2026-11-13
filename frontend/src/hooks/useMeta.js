import { useEffect, useState } from 'react';
import { getMeta } from '../services/api.js';

/** Which optional backend services are configured: { ai, aiModel, speech, mail }. null while loading. */
export default function useMeta() {
    const [meta, setMeta] = useState(null);
    useEffect(() => {
        let alive = true;
        getMeta().then((m) => alive && setMeta(m));
        return () => {
            alive = false;
        };
    }, []);
    return meta;
}
