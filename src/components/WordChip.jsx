import { useState } from 'react';

/**
    * Floating vocabulary chip from the hero.
    * Front: Mường word + "chạm để học". Back: Vietnamese meaning.
    */
export default function WordChip({ word, meaning, className = '', style }) {
    const [flipped, setFlipped] = useState(false);
    return (
        <button
            type="button"
            className={`word-chip ${flipped ? 'is-flipped' : ''} ${className}`}
            style={style}
            onClick={() => setFlipped((v) => !v)}
            aria-pressed={flipped}
            aria-label={flipped ? `${word} nghĩa là ${meaning}` : `Từ ${word}, chạm để xem nghĩa`}
        >
            <span className="word-chip__inner">
                <span className="word-chip__face word-chip__front">
                    <strong>{word}</strong>
                    <small>chạm để học</small>
                </span>
                <span className="word-chip__face word-chip__back">
                    <strong>{word}</strong>
                    <small>= {meaning}</small>
                </span>
            </span>
        </button>
    );
}
