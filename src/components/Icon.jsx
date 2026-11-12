// A single, consistent stroke icon set (24px grid, 1.75 stroke, round joins)
// matching the outline icons used in the Figma file.
const paths = {
    home: (
        <>
            <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
        </>
    ),
    book: (
        <>
            <path d="M3 5.5c2.7-1.6 6-1.6 9 .5 3-2.1 6.3-2.1 9-.5V19c-2.7-1.4-6-1.4-9 .6-3-2-6.3-2-9-.6z" />
            <path d="M12 6v13.6" />
        </>
    ),
    target: (
        <>
            <path d="M12 3a9 9 0 1 0 9 9" />
            <path d="M12 7a5 5 0 1 0 5 5" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" />
            <path d="m12 12 4.5-4.5" />
            <path d="M16.5 7.5 17 4l3 3-3.5.5z" />
        </>
    ),
    notebook: (
        <>
            <rect x="5" y="3" width="15" height="18" rx="1.5" />
            <path d="M15 3v18M3 7.5h3M3 12h3M3 16.5h3" />
        </>
    ),
    guide: (
        <>
            <path d="M19 17V4.5A1.5 1.5 0 0 0 17.5 3h-11A1.5 1.5 0 0 0 5 4.5v14" />
            <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19v5H7.5A2.5 2.5 0 0 1 5 18.5z" />
            <circle cx="12" cy="9" r="3.2" />
            <path d="M12 8.4v2" />
        </>
    ),
    dashboard: (
        <>
            <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
            <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
            <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
            <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
        </>
    ),
    'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
    'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
    'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
    'chevron-down': <path d="m6 9 6 6 6-6" />,
    'chevron-right': <path d="m9 6 6 6-6 6" />,
    mail: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3.5 6.5 8.5 6 8.5-6" />
        </>
    ),
    lock: (
        <>
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </>
    ),
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
        </>
    ),
    eye: (
        <>
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    'eye-off': (
        <>
            <path d="M3 3l18 18" />
            <path d="M10.6 5.6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.4 3.2M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.5-1.2" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
    ),
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    'check-circle': (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12.5 2.8 2.8L16.5 9.5" />
        </>
    ),
    alert: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5" />
            <circle cx="12" cy="16.3" r=".6" fill="currentColor" />
        </>
    ),
    x: <path d="M6 6l12 12M18 6 6 18" />,
    bars: (
        <>
            <path d="M7 16v-3M12 16V9.5M17 16V7" strokeWidth="3" />
        </>
    ),
    flame: (
        <path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-3.4-2.3-5.5-4-7.2-.8-.8-1.6-1.9-2-3.3-2.8 1.5-4 4.3-3.8 6.9-.7-.4-1.4-1-2-1.8-1.1 1.4-1.7 3.2-1.7 5.4A6.5 6.5 0 0 0 12 21z" />
    ),
    star: (
        <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />
    ),
    trophy: (
        <>
            <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
            <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
        </>
    ),
    bell: (
        <>
            <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z" />
            <path d="M10 20.5a2 2 0 0 0 4 0" />
        </>
    ),
    logout: (
        <>
            <path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" />
            <path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
        </>
    ),
    play: <path d="M8 5.5v13l10.5-6.5z" />,
    volume: (
        <>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
            <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        </>
    ),
    refresh: (
        <>
            <path d="M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5" />
            <path d="M5 3v4h4M19 21v-4h-4" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h10" />,
    'lock-small': (
        <>
            <rect x="6" y="11" width="12" height="9" rx="2" />
            <path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" />
        </>
    ),
    bookmark: <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />,
    shuffle: (
        <>
            <path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.2 3.4-2.8M13.1 9.8c.8-1.6 1.8-2.8 3.4-2.8H20" />
            <path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5" />
        </>
    ),
    tap: (
        <>
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11l.1-1.4a1.5 1.5 0 0 1 3 .2l-.1 1.7.1-.9a1.5 1.5 0 0 1 3 .3V15a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4-2L5 15.2a1.5 1.5 0 0 1 2.3-1.9L9 15" />
            <path d="M5.5 5.5 4 4M15 4l1.2-1.4M4 9H2.5" />
        </>
    ),
    flag: (
        <>
            <path d="M5 21V4" />
            <path d="M5 4.5h11l-2 4 2 4H5" />
        </>
    ),
};

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.75, title, ...rest }) {
    const body = paths[name];
    if (!body) return null;
    return (
        <svg
            className={`icon icon--${name} ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden={title ? undefined : true}
            role={title ? 'img' : undefined}
            {...rest}
        >
            {title && <title>{title}</title>}
            {body}
        </svg>
    );
}
