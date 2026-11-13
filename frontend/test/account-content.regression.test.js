import test from 'node:test';
import assert from 'node:assert/strict';
import { hookHarness, nodes, textOf } from './helpers/hooks.js';

const meta = { supportEmail: 'configured@example.invalid', passwordReset: false };
const mocks = {
    'react-router-dom': { Link: 'Link', useNavigate: () => () => {}, useLocation: () => ({ pathname: '/' }), NavLink: 'NavLink', Outlet: 'Outlet' },
    '../components/ui.jsx': { Button: 'Button', Logo: 'Logo' },
    '../data/contact.js': { CONTACT_EMAIL: 'old@example.invalid' },
    '../hooks/useMeta.js': { __esModule: true, default: () => meta },
};

test('both legal pages use configured support contact', () => {
    const h = hookHarness('../../src/pages/Legal.jsx', mocks);
    for (const name of ['Terms', 'Privacy']) {
        const tree = h.render({}, name);
        const mail = nodes(tree, (n) => n.props.href?.startsWith('mailto:'));
        assert.equal(mail[0].props.href, 'mailto:configured@example.invalid');
        assert.doesNotMatch(textOf(tree), /old@example/);
    }
});

test('forgot password uses configured contact when mail delivery is unavailable', () => {
    const h = hookHarness('../../src/pages/auth/ForgotPassword.jsx', {
        'react-router-dom': mocks['react-router-dom'],
        '../../components/ui.jsx': { Button: 'Button', TextField: 'TextField' },
        '../../components/Icon.jsx': { __esModule: true, default: 'Icon' },
        '../../services/api.js': { auth: {} },
        '../../hooks/useMeta.js': { __esModule: true, default: () => meta },
        '../../data/contact.js': { CONTACT_EMAIL: 'old@example.invalid' },
        './shared.jsx': { FormAlert: 'FormAlert', isEmail: () => true },
    });
    assert.match(textOf(h.render({})), /configured@example.invalid/);
});

test('cross-tab session change drops tab session/chat and reloads learner state', () => {
    const storage = new Map([['muonglab.session', 'old'], ['muonglab.chat', 'old chat'], ['unrelated', 'keep']]);
    let reloaded = 0;
    const window = new EventTarget();
    window.location = { reload: () => { reloaded++; } };
    const localStorage = {};
    const h = hookHarness('../../src/context/AuthContext.jsx', {
        'react-router-dom': mocks['react-router-dom'],
        '../services/api.js': {
            SESSION_KEY: 'muonglab.session', CHAT_KEY: 'muonglab.chat', UNAUTHORIZED_EVENT: 'unauthorized',
            auth: { currentSession: () => null },
        },
    }, { window, localStorage, sessionStorage: { removeItem: (key) => storage.delete(key) } });
    h.render({ children: 'learner' }, 'AuthProvider');
    const event = new Event('storage');
    Object.assign(event, { key: 'muonglab.session', storageArea: localStorage, oldValue: 'account-A', newValue: 'account-B' });
    window.dispatchEvent(event);
    assert.equal(reloaded, 1);
    assert.equal(storage.has('muonglab.session'), false);
    assert.equal(storage.has('muonglab.chat'), false);
    assert.equal(storage.get('unrelated'), 'keep');
    h.unmount();
    window.dispatchEvent(event);
    assert.equal(reloaded, 1);
});
