import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

// Runs the real component/hook with deterministic React and browser test doubles.
// No DOM, server, microphone or network is used by this harness.
export function hookHarness(file, mocks = {}, globals = {}) {
    let cursor = 0;
    const slots = [];
    const effects = [];
    const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
    const react = {
        createContext(initial) { return { Provider: 'Provider', initial }; },
        useState(initial) {
            const i = cursor++;
            slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
            return [slots[i].value, (value) => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
        },
        useRef(initial) {
            const i = cursor++;
            slots[i] ??= { current: initial };
            return slots[i];
        },
        useEffect(fn, deps) {
            const i = cursor++;
            if (changed(slots[i]?.deps, deps)) effects.push(() => {
                slots[i]?.cleanup?.();
                slots[i] = { deps, cleanup: fn() };
            });
        },
        useMemo(fn, deps) {
            const i = cursor++;
            if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
            return slots[i].value;
        },
    };
    react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
    const element = (type, props, key) => ({ type, props: props ?? {}, key });
    const mod = { exports: {} };
    const context = vm.createContext({
        module: mod, exports: mod.exports, console, Blob, URL,
        setTimeout, clearTimeout, setInterval, clearInterval,
        requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
        window: new EventTarget(),
        require: (name) => {
            if (name === 'react') return react;
            if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'Fragment' };
            if (name in mocks) return mocks[name];
            throw new Error(`Missing test dependency: ${name}`);
        },
        ...globals,
    });
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    vm.runInContext(transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code, context);
    return {
        render(props, exportName = 'default') {
            cursor = 0;
            const result = mod.exports[exportName](props);
            while (effects.length) effects.shift()();
            return result;
        },
        unmount() { for (const slot of slots) slot?.cleanup?.(); },
    };
}

export function nodes(tree, predicate) {
    const found = [];
    const visit = (node) => {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!node || typeof node !== 'object') return;
        if (predicate(node)) found.push(node);
        visit(node.props?.children);
    };
    visit(tree);
    return found;
}

export function textOf(tree) {
    if (Array.isArray(tree)) return tree.map(textOf).join('');
    if (tree == null || typeof tree === 'boolean') return '';
    if (typeof tree !== 'object') return String(tree);
    return textOf(tree.props?.children);
}
