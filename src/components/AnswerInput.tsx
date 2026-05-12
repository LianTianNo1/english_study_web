import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { diffChars } from '@/lib/diff';
import { sfxChime, sfxThud, sfxTick } from '@/lib/sfx';

export interface AnswerInputProps {
  answer: string;
  /** 提交回调；revealed 状态由父级控制（便于复用既有的"答错等用户继续"流程） */
  onSubmit: (value: string, correct: boolean) => void;
  /** 父级传入揭晓状态；为 null 时是输入态 */
  revealed: { value: string; correct: boolean } | null;
  /** 错误时点击"继续 ↵" */
  onContinue?: () => void;
  /** 提示信息（例如翻译题的关键词） */
  hint?: string;
  /** 强制模式：cells 单词方格 / free 自由文本；缺省自动选择 */
  mode?: 'auto' | 'cells' | 'free';
  /** 提示用占位符（free 模式） */
  placeholder?: string;
  /** 大小：normal | compact */
  size?: 'normal' | 'compact';
  /** 自动聚焦 */
  autoFocus?: boolean;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.!?;,]+$/g, '').replace(/\s+/g, ' ');
}
function pickMode(answer: string, override: AnswerInputProps['mode']): 'cells' | 'free' {
  if (override === 'cells' || override === 'free') return override;
  if (answer.length <= 14 && !/\s/.test(answer)) return 'cells';
  return 'free';
}

export function AnswerInput(props: AnswerInputProps) {
  const mode = pickMode(props.answer, props.mode);
  return mode === 'cells' ? <CellsMode {...props} /> : <FreeMode {...props} />;
}

/* ============================================
   Cells Mode — 单词方格逐字符输入
   ============================================ */

function CellsMode({ answer, onSubmit, revealed, onContinue, hint, autoFocus = true }: AnswerInputProps) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellsRef = useRef<(HTMLDivElement | null)[]>([]);
  const len = answer.length;
  const correct = useMemo(() => normalize(text) === normalize(answer), [text, answer]);

  // 揭晓后的逐字符 diff
  const diff = useMemo(
    () => (revealed ? diffChars(revealed.value, answer) : []),
    [revealed, answer]
  );

  useEffect(() => {
    setText('');
    setActive(-1);
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30);
  }, [answer, autoFocus]);

  useEffect(() => {
    if (revealed) inputRef.current?.blur();
    else inputRef.current?.focus();
  }, [revealed]);

  // 答对/答错播放音效与庆祝
  const padRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!revealed) return;
    if (revealed.correct) {
      sfxChime();
      padRef.current?.classList.add('pad-celebrate');
      const t = setTimeout(() => padRef.current?.classList.remove('pad-celebrate'), 700);
      return () => clearTimeout(t);
    } else {
      sfxThud();
    }
  }, [revealed]);

  const handleChange = useCallback(
    (val: string) => {
      if (revealed) return;
      // 只截至 answer 长度
      const cleaned = val.slice(0, len);
      if (cleaned.length > text.length) sfxTick();
      setText(cleaned);
      setActive(cleaned.length - 1);
      // 抖动一下激活格触发涟漪：通过 active 变化 + key 重挂载实现
    },
    [revealed, len, text]
  );

  const handleSubmit = useCallback(() => {
    if (revealed) {
      if (!revealed.correct && onContinue) onContinue();
      return;
    }
    if (!text.trim()) return;
    const ok = normalize(text) === normalize(answer);
    onSubmit(text, ok);
  }, [revealed, text, answer, onSubmit, onContinue]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 全局回车继续（揭晓状态）—— 延迟挂载 + 忽略键盘自动重复，避免"长按 Enter 把错误信息跳过"
  useEffect(() => {
    if (!revealed || revealed.correct) return;
    let armed = false;
    const armTimer = setTimeout(() => { armed = true; }, 300);
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      if (e.repeat) return;   // 忽略 OS 自动重复
      if (!armed) return;      // 提交那一下的 Enter 不立刻生效
      e.preventDefault();
      onContinue?.();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(armTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [revealed, onContinue]);

  // 渲染每个字符方格
  const cells = Array.from({ length: len }, (_, i) => {
    const ch = text[i] ?? '';
    const ansCh = answer[i];
    const isSpace = ansCh === ' ' || ansCh === '-';
    const isActive = !revealed && i === text.length;
    const isFilled = !!ch;
    let revealClass = '';
    if (revealed) {
      if (revealed.correct) {
        revealClass = 'typing-cell--correct';
      } else {
        // 用 diff 标记错位（按 answer 的索引近似映射）
        const wrong = (text[i] ?? '').toLowerCase() !== ansCh.toLowerCase();
        revealClass = wrong ? 'typing-cell--wrong' : 'typing-cell--correct';
      }
    }
    return (
      <div
        key={i}
        ref={(el) => (cellsRef.current[i] = el)}
        className={cn(
          'typing-cell',
          isFilled && 'typing-cell--filled',
          isActive && 'typing-cell--active',
          isSpace && 'typing-cell--space',
          revealClass
        )}
        style={revealed?.correct ? { animationDelay: `${i * 40}ms` } : undefined}
      >
        {/* 涟漪只在最近一次激活的格子触发 */}
        {isActive && (
          <span
            key={text.length /* 每键击重挂载触发 CSS 动画 */}
            className="key-ripple"
          />
        )}
        {ch && (
          <span
            key={`${i}-${ch}`}
            style={{ animation: 'char-pop 0.32s cubic-bezier(0.2, 0.9, 0.2, 1.1) both' }}
          >
            {ch}
          </span>
        )}
        {/* 揭晓错误时，在格子下方落下正确字符 */}
        {revealed && !revealed.correct && (text[i] ?? '').toLowerCase() !== ansCh.toLowerCase() && !isSpace && (
          <span
            className="ghost-letter absolute -bottom-7 left-1/2 -translate-x-1/2 text-base"
            style={{ animationDelay: `${i * 40 + 200}ms` }}
          >
            {ansCh}
          </span>
        )}
      </div>
    );
  });

  return (
    <div ref={padRef}>
      {/* 输入区：仅 cells + 隐藏 input 共占一个相对定位容器，不再覆盖底部 */}
      <div
        className="relative"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKey}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={!!revealed}
          className={cn(
            'absolute inset-0 z-0 h-full w-full cursor-text opacity-0',
            revealed && 'pointer-events-none'
          )}
          aria-label="answer"
        />
        <div className="relative z-10 flex flex-wrap items-end justify-center gap-1.5 px-4 py-6">
          {cells}
          {revealed && revealed.correct && <div className="stamp">APPROVED</div>}
        </div>
      </div>

      {hint && (
        <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{hint}</div>
      )}

      <FooterControls
        canSubmit={text.trim().length > 0}
        revealed={revealed}
        onSubmit={handleSubmit}
        onContinue={onContinue}
        correctAnswer={answer}
      />
    </div>
  );
}

/* ============================================
   Free Mode — 自由长句输入
   ============================================ */

function FreeMode({ answer, onSubmit, revealed, onContinue, hint, placeholder, autoFocus = true }: AnswerInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText('');
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30);
  }, [answer, autoFocus]);

  useEffect(() => {
    if (!revealed) return;
    if (revealed.correct) {
      sfxChime();
      padRef.current?.classList.add('pad-celebrate');
      const t = setTimeout(() => padRef.current?.classList.remove('pad-celebrate'), 700);
      return () => clearTimeout(t);
    } else {
      sfxThud();
    }
  }, [revealed]);

  function emitSpark() {
    const root = sparkRef.current;
    const input = inputRef.current;
    if (!root || !input) return;
    const span = document.createElement('span');
    span.className = 'pad-keyspark';
    // 放在输入框右侧光标大致位置
    const rect = input.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const w = Math.min(input.scrollWidth, rect.width);
    const left = rect.left - rootRect.left + Math.min(w, getMeasuredWidth(input, text));
    span.style.left = `${left - 14}px`;
    span.style.top = `${rect.top - rootRect.top + rect.height / 2 - 14}px`;
    root.appendChild(span);
    setTimeout(() => span.remove(), 600);
  }

  const handleChange = (val: string) => {
    if (revealed) return;
    if (val.length > text.length) {
      sfxTick();
      emitSpark();
    }
    setText(val);
  };

  function submit() {
    if (revealed) {
      if (!revealed.correct && onContinue) onContinue();
      return;
    }
    if (!text.trim()) return;
    const ok = normalize(text) === normalize(answer);
    onSubmit(text, ok);
  }

  useEffect(() => {
    if (!revealed || revealed.correct) return;
    let armed = false;
    const armTimer = setTimeout(() => { armed = true; }, 300);
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      if (e.repeat) return;
      if (!armed) return;
      e.preventDefault();
      onContinue?.();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(armTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [revealed, onContinue]);

  return (
    <div ref={padRef} className="relative">
      {hint && (
        <div className="mb-3 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          <span className="rounded-sm bg-paper2 px-2 py-0.5 text-persimmon-700">hint</span>
          {hint}
        </div>
      )}
      <div ref={sparkRef} className="relative">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          disabled={!!revealed}
          placeholder={placeholder ?? 'type your answer'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={cn(
            'w-full bg-transparent text-center font-display text-2xl font-semibold tracking-tight text-ink outline-none transition-colors placeholder:text-muted placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:italic',
            'border-b-2 pb-3',
            revealed?.correct && 'border-moss text-moss-700',
            revealed && !revealed.correct && 'border-crimson text-crimson',
            !revealed && 'border-ink focus:border-persimmon'
          )}
        />
        {revealed && revealed.correct && <div className="stamp" style={{ top: '-1.5rem' }}>APPROVED</div>}
      </div>

      {/* 揭晓后 diff 高亮 */}
      {revealed && !revealed.correct && (
        <div className="mt-4 space-y-3 animate-fade-up">
          <div className="rounded-md border border-crimson bg-crimson-50 px-4 py-3 text-sm text-crimson">
            <div className="font-semibold">✗ 答案不对</div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-0.5 font-mono">
              {diffChars(revealed.value, answer).map((d, i) => (
                <span
                  key={i}
                  className={cn(
                    d.op === 'match' && 'text-ink2',
                    d.op === 'sub' && 'rounded bg-crimson px-0.5 text-paper',
                    d.op === 'ins' && 'rounded bg-persimmon px-0.5 text-paper',
                    d.op === 'del' && 'text-ink3 line-through opacity-60'
                  )}
                >
                  {d.char === ' ' ? ' ' : d.char}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-md border-l-4 border-persimmon bg-persimmon-50/60 p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-persimmon-700">正确答案 · correct</div>
            <div className="mt-1 font-display text-lg font-bold text-ink">{answer}</div>
          </div>
        </div>
      )}

      <FooterControls
        canSubmit={text.trim().length > 0}
        revealed={revealed}
        onSubmit={submit}
        onContinue={onContinue}
        correctAnswer={answer}
      />
    </div>
  );
}

/* ============================================
   公共底栏
   ============================================ */
function FooterControls({
  canSubmit,
  revealed,
  onSubmit,
  onContinue,
}: {
  canSubmit: boolean;
  revealed: { value: string; correct: boolean } | null;
  onSubmit: () => void;
  onContinue?: () => void;
  correctAnswer: string;
}) {
  if (!revealed) {
    return (
      <div className="mt-5 flex flex-col items-center gap-2">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="btn-accent min-w-32"
        >
          提交 <span className="font-mono text-[10px] opacity-70">↵</span>
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          ↵ submit · ⌫ backspace
        </p>
      </div>
    );
  }
  if (revealed.correct) {
    return (
      <div className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-moss-700">
        ✓ 正确！稍后自动前进…
      </div>
    );
  }
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <button onClick={onContinue} className="btn-accent min-w-32">
        继续 <span className="font-mono text-[10px] opacity-70">↵</span>
      </button>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
        ↵ next
      </p>
    </div>
  );
}

/** 粗略估算输入框中已输入文本的宽度（用于火花定位） */
function getMeasuredWidth(input: HTMLInputElement, text: string): number {
  const canvas = (getMeasuredWidth as any)._c ?? ((getMeasuredWidth as any)._c = document.createElement('canvas'));
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return 0;
  const cs = getComputedStyle(input);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText(text || input.placeholder || '').width;
}
