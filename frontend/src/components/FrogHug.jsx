/**
 * Large frog illustration for the auth screens (from the design: the frog
 * peeks over and "hugs" the form card). Drawn in SVG so it stays sharp at
 * any size. Pieces are layered by AuthLayout: head → card → hands.
 */
const INK = '#1f3a1c';
const SKIN = '#bfe063';
const SKIN_DARK = '#a9cf4c';

export function FrogHead({ mood = 'happy' }) {
    return (
        <svg className="frog-head" viewBox="0 0 520 270" aria-hidden="true">
            {/* outline pass, then fill pass → one merged silhouette */}
            <g stroke={INK} strokeWidth="14" fill={INK}>
                <circle cx="135" cy="105" r="80" />
                <circle cx="385" cy="105" r="80" />
                <ellipse cx="260" cy="185" rx="250" ry="125" />
            </g>
            <g fill={SKIN}>
                <circle cx="135" cy="105" r="80" />
                <circle cx="385" cy="105" r="80" />
                <ellipse cx="260" cy="185" rx="250" ry="125" />
            </g>
            {/* soft shading under the eye domes */}
            <ellipse cx="260" cy="235" rx="200" ry="40" fill={SKIN_DARK} opacity="0.35" />

            {/* headband with red star + knot tails */}
            <path d="M182 74 Q260 14 338 74 L330 102 Q260 50 190 102 Z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
            <path
                d="m260 46 5.6 11.4 12.6 1.8-9.1 8.9 2.2 12.5L260 74.7l-11.3 5.9 2.2-12.5-9.1-8.9 12.6-1.8z"
                fill="#e23b2e"
            />
            <path d="M332 80 L392 34 L398 66 Z M334 86 L418 62 L404 90 Z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" />

            {mood === 'happy' ? (
                <g fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round">
                    <path d="M98 128 Q135 92 172 128" />
                    <path d="M348 128 Q385 92 422 128" />
                </g>
            ) : (
                <g>
                    <circle cx="135" cy="118" r="34" fill={INK} />
                    <circle cx="385" cy="118" r="34" fill={INK} />
                    <circle cx="146" cy="106" r="9" fill="#fff" />
                    <circle cx="396" cy="106" r="9" fill="#fff" />
                </g>
            )}

            {/* cheeks */}
            <ellipse cx="96" cy="196" rx="34" ry="28" fill="#f3e86a" opacity="0.95" />
            <ellipse cx="424" cy="196" rx="34" ry="28" fill="#f3e86a" opacity="0.95" />

            {/* nostrils + mouth */}
            <circle cx="248" cy="160" r="4" fill={INK} />
            <circle cx="272" cy="160" r="4" fill={INK} />
            {mood === 'happy' ? (
                <g>
                    <path d="M222 182 Q260 236 298 182 Z" fill="#3b1410" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
                    <ellipse cx="260" cy="206" rx="15" ry="9" fill="#ef7f8c" />
                </g>
            ) : (
                <path d="M244 192 Q260 202 276 192" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
            )}
        </svg>
    );
}

export function FrogHand({ side = 'left' }) {
    return (
        <svg className={`frog-hand frog-hand--${side}`} viewBox="0 0 120 90" aria-hidden="true">
            <path
                d="M14 58 C4 30 30 8 62 10 C92 12 114 30 108 52 C104 70 84 78 62 76 C40 80 20 76 14 58 Z"
                fill={SKIN}
                stroke={INK}
                strokeWidth="6"
                strokeLinejoin="round"
            />
            <path d="M44 74 Q46 58 40 46 M68 76 Q70 60 66 46 M90 70 Q92 56 88 44" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        </svg>
    );
}

/** Sky decoration: clouds, sparkle marks, bushes and daisies. */
export function AuthScenery() {
    const Cloud = ({ className }) => (
        <svg className={`sky-cloud ${className}`} viewBox="0 0 200 80" aria-hidden="true">
            <path d="M30 70 C8 70 6 44 28 42 C30 22 58 16 70 32 C80 10 120 10 126 36 C146 26 172 36 168 56 C188 58 186 72 170 72 Z" fill="#fff" />
        </svg>
    );
    const Bush = ({ className }) => (
        <svg className={`bush ${className}`} viewBox="0 0 260 220" aria-hidden="true">
            <g fill="#2f7d3a">
                <path d="M40 220 C10 150 30 90 70 60 C60 120 80 170 100 220 Z" />
                <path d="M120 220 C110 140 140 70 200 40 C170 110 165 170 170 220 Z" />
            </g>
            <g fill="#4ea24a">
                <path d="M0 220 C0 160 40 130 90 140 C130 120 180 140 190 180 C230 170 260 190 260 220 Z" />
                <path d="M70 220 C40 170 50 110 80 90 C90 140 110 180 130 220 Z" />
            </g>
            <g fill="#3f8f3f">
                <ellipse cx="200" cy="210" rx="70" ry="34" />
            </g>
            {[
                [150, 120],
                [60, 175],
                [215, 150],
            ].map(([x, y]) => (
                <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                    {[0, 72, 144, 216, 288].map((a) => (
                        <ellipse key={a} cx="0" cy="-11" rx="7" ry="11" fill="#fff" transform={`rotate(${a})`} />
                    ))}
                    <circle r="6" fill="#f6c431" />
                </g>
            ))}
        </svg>
    );
    return (
        <div className="auth2__scenery" aria-hidden="true">
            <Cloud className="sky-cloud--1" />
            <Cloud className="sky-cloud--2" />
            <Cloud className="sky-cloud--3" />
            <Bush className="bush--left" />
            <Bush className="bush--right" />
        </div>
    );
}
