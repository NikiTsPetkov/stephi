import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useCallback,
} from 'react';
import { BG_WORDS } from './words-bg';

const BG_ALPHABET = [
  'А',
  'Б',
  'В',
  'Г',
  'Д',
  'Е',
  'Ж',
  'З',
  'И',
  'Й',
  'К',
  'Л',
  'М',
  'Н',
  'О',
  'П',
  'Р',
  'С',
  'Т',
  'У',
  'Ф',
  'Х',
  'Ц',
  'Ч',
  'Ш',
  'Щ',
  'Ъ',
  'Ь',
  'Ю',
  'Я',
];

const STEPS_COUNT = 10;

function HangmanSVG({ wrong }) {
  const w = 240,
    h = 240;
  const pole = '#f59fc6';
  const man = '#ffe6f4';
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 240 240"
      role="img"
      aria-label={`Грешни опити: ${wrong}`}
    >
      {wrong > 0 && (
        <line
          x1="10"
          y1="230"
          x2="180"
          y2="230"
          stroke={pole}
          strokeWidth="6"
        />
      )}
      {wrong > 1 && (
        <line x1="40" y1="230" x2="40" y2="30" stroke={pole} strokeWidth="6" />
      )}
      {wrong > 2 && (
        <line x1="40" y1="30" x2="140" y2="30" stroke={pole} strokeWidth="6" />
      )}
      {wrong > 3 && (
        <line x1="40" y1="70" x2="80" y2="30" stroke={pole} strokeWidth="6" />
      )}
      {wrong > 4 && (
        <line
          x1="140"
          y1="30"
          x2="140"
          y2="60"
          stroke="#f7b7d5"
          strokeWidth="4"
        />
      )}
      {wrong > 5 && (
        <circle
          cx="140"
          cy="78"
          r="18"
          stroke={man}
          strokeWidth="4"
          fill="none"
        />
      )}
      {wrong > 6 && (
        <line x1="140" y1="96" x2="140" y2="145" stroke={man} strokeWidth="4" />
      )}
      {wrong > 7 && (
        <line
          x1="140"
          y1="110"
          x2="118"
          y2="126"
          stroke={man}
          strokeWidth="4"
        />
      )}
      {wrong > 8 && (
        <line
          x1="140"
          y1="110"
          x2="162"
          y2="126"
          stroke={man}
          strokeWidth="4"
        />
      )}
      {wrong > 9 && (
        <line
          x1="140"
          y1="145"
          x2="122"
          y2="175"
          stroke={man}
          strokeWidth="4"
        />
      )}
    </svg>
  );
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Validation ---
function normalizeAndValidate(raw) {
  if (!raw) return { ok: false, reason: 'Празна дума' };
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.length < 3) return { ok: false, reason: 'Минимум 3 букви' };
  const valid = [...trimmed].every((ch) => BG_ALPHABET.includes(ch));
  if (!valid)
    return {
      ok: false,
      reason: 'Само български букви (А-Я, включително Ъ, Ь, Ю, Я)',
    };
  return { ok: true, word: trimmed };
}

// ----- Reducer (atomic, idempotent per action) -----
const initial = () => ({
  status: 'setup', // 'setup' | 'playing' | 'won' | 'lost'
  word: '',
  guessed: new Set(),
  wrong: 0,
  lastGuess: null,
  revealedIdx: new Set(),
});

function cloneSet(s) {
  const n = new Set();
  s.forEach((v) => n.add(v));
  return n;
}

function reducer(state, action) {
  switch (action.type) {
    case 'NEW_SETUP': {
      return initial();
    }
    case 'START_RANDOM': {
      return {
        ...initial(),
        status: 'playing',
        word: sample(BG_WORDS).toUpperCase(),
      };
    }
    case 'START_CUSTOM': {
      return { ...initial(), status: 'playing', word: action.word };
    }
    case 'GUESS': {
      if (state.status !== 'playing') return state;
      const letter = action.letter;
      if (!BG_ALPHABET.includes(letter)) return state;
      if (state.guessed.has(letter)) return state; // idempotent guard inside reducer

      const guessed = cloneSet(state.guessed);
      guessed.add(letter);

      if (!state.word.includes(letter)) {
        const wrong = state.wrong + 1; // wrong +1 exactly once
        return {
          ...state,
          guessed,
          wrong,
          lastGuess: letter,
          revealedIdx: new Set(),
          status: wrong >= STEPS_COUNT ? 'lost' : state.status,
        };
      } else {
        const rev = new Set();
        state.word.split('').forEach((ch, idx) => {
          if (ch === letter) rev.add(idx);
        });
        const allRevealed = state.word.split('').every((ch) => guessed.has(ch));
        return {
          ...state,
          guessed,
          lastGuess: letter,
          revealedIdx: rev,
          status: allRevealed ? 'won' : state.status,
        };
      }
    }
    case 'CLEAR_REVEAL': {
      if (state.revealedIdx.size === 0) return state;
      return { ...state, revealedIdx: new Set() };
    }
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const { status, word, guessed, wrong, lastGuess, revealedIdx } = state;

  // Setup UI state
  const [useCustom, setUseCustom] = useState(true);
  const [customWord, setCustomWord] = useState('');
  const [error, setError] = useState('');

  // timer to clear highlight
  const timerRef = useRef(null);
  useEffect(() => {
    if (revealedIdx.size > 0) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => dispatch({ type: 'CLEAR_REVEAL' }),
        600
      );
    }
    return () => clearTimeout(timerRef.current);
  }, [revealedIdx]);

  // unified guess (pointer + keyboard) — dispatch to reducer
  const doGuess = (letter) => dispatch({ type: 'GUESS', letter });

  // keyboard (ignore repeats)
  useEffect(() => {
    const onKey = (e) => {
      if (state.status !== 'playing') return;
      if (e.repeat) return;
      const letter = (e.key || '').toUpperCase();
      if (BG_ALPHABET.includes(letter)) {
        e.preventDefault();
        doGuess(letter);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status]);

  const masked = useMemo(
    () =>
      word
        ? word
            .split('')
            .map((ch) => (guessed.has(ch) ? ch : '•'))
            .join(' ')
        : '—',
    [word, guessed]
  );

  const remaining = Math.max(0, STEPS_COUNT - wrong);
  const isDisabled = state.status !== 'playing';

  const handlePointer = (e, letter) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerId && e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
    doGuess(letter);
  };

  const newGame = () => dispatch({ type: 'NEW_SETUP' });

  const submitSetup = useCallback(
    (e) => {
      e?.preventDefault?.();
      setError('');
      if (useCustom) {
        const res = normalizeAndValidate(customWord);
        if (!res.ok) {
          setError(res.reason);
          return;
        }
        dispatch({ type: 'START_CUSTOM', word: res.word });
      } else {
        dispatch({ type: 'START_RANDOM' });
      }
    },
    [useCustom, customWord]
  );

  const revealOne = () => {
    if (state.status !== 'playing') return;
    const missing = word.split('').filter((ch) => !guessed.has(ch));
    if (missing.length === 0) return;
    doGuess(sample(missing));
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Бесеница — Стефи</h1>
        <div className="controls">
          <button
            className="secondary"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              revealOne();
            }}
            disabled={isDisabled}
          >
            Подсказка
          </button>
          <button
            className="primary"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              newGame();
            }}
          >
            Нова игра
          </button>
        </div>
      </header>

      {/* Setup overlay */}
      {status === 'setup' && (
        <div className="overlay">
          <form className="setup" onSubmit={submitSetup}>
            <h2>Нова игра</h2>
            <div className="toggle">
              <button
                type="button"
                className={useCustom ? 'tab active' : 'tab'}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setUseCustom(true);
                }}
              >
                СВОЯ ДУМА
              </button>
              <button
                type="button"
                className={!useCustom ? 'tab active' : 'tab'}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setUseCustom(false);
                }}
              >
                СЛУЧАЙНА ДУМА
              </button>
            </div>

            {useCustom ? (
              <div className="field">
                <label htmlFor="w">
                  Въведете дума (само български букви, минимум 3):
                </label>
                <input
                  id="w"
                  autoFocus
                  placeholder="например: СНЕЖИНКА"
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                />
                {error && <div className="error">{error}</div>}
              </div>
            ) : (
              <div className="field muted">
                Ще бъде избрана случайна дума от списъка ({BG_WORDS.length}).
              </div>
            )}

            <div className="setup-actions">
              <button className="primary" type="submit">
                Започни
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="main-card" aria-hidden={status === 'setup'}>
        <div className="info-row">
          <span className="info-chip">Думи: {BG_WORDS.length}</span>
          <span className="info-chip">
            Опити: {wrong} / {STEPS_COUNT}
          </span>
          <span className="info-chip">Остават: {remaining}</span>
          {state.status === 'won' && (
            <span className="info-chip" style={{ color: '#bcf7db' }}>
              Победа! 🎉
            </span>
          )}
          {state.status === 'lost' && (
            <span className="info-chip" style={{ color: '#ffd0d6' }}>
              Край на играта ☠️
            </span>
          )}
        </div>

        <div className="word-area">
          <div className="canvas" aria-hidden="true">
            <HangmanSVG wrong={wrong} />
          </div>

          <div className="word">
            <div className="mask" aria-live="polite" aria-atomic="true">
              {word ? (
                word.split('').map((ch, idx) => {
                  const isRevealed = guessed.has(ch);
                  const animateReveal = revealedIdx.has(idx);
                  return (
                    <span
                      key={idx}
                      className={[
                        'mask-cell',
                        isRevealed ? 'revealed' : 'hidden',
                        animateReveal ? 'just-revealed' : '',
                      ].join(' ')}
                      style={{ minWidth: '0.7em', textAlign: 'center' }}
                    >
                      {isRevealed ? ch : '•'}
                    </span>
                  );
                })
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="hint">
              {state.status === 'playing' &&
                'Познайте буквите, за да откриете думата.'}
              {state.status === 'won' && 'Браво! Искате ли нова дума?'}
              {state.status === 'lost' && (
                <>
                  Думата беше: <b>{word}</b>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="keyboard" aria-label="Клавиатура с български букви">
          <div className="grid">
            {BG_ALPHABET.map((letter) => {
              const used = guessed.has(letter) || state.status !== 'playing';
              const correct = guessed.has(letter) && word.includes(letter);
              const wrongLetter = guessed.has(letter) && !word.includes(letter);
              const isLast = lastGuess === letter;
              return (
                <button
                  key={letter}
                  className={[
                    'key',
                    correct ? 'correct' : '',
                    wrongLetter ? 'wrong' : '',
                    isLast
                      ? correct
                        ? 'pulse-correct'
                        : wrongLetter
                        ? 'shake-wrong'
                        : ''
                      : '',
                  ].join(' ')}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.pointerId && e.currentTarget.releasePointerCapture) {
                      try {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      } catch {}
                    }
                    doGuess(letter);
                  }}
                  disabled={used}
                  aria-label={`Буква ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="footer">
        Оптимизирано за мобилни устройства (≥44px цели за докосване, 100svh,
        safe-area).
      </footer>
    </div>
  );
}
