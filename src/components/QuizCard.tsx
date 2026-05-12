import { useEffect, useRef, useState } from 'react';
import { Volume2, CheckCircle2, XCircle, SkipForward, Star } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';
import { diffChars } from '@/lib/diff';
import type { Question } from '@/features/learn-session/session';
import type { MnemonicRecord } from '@/db/types';
import { MnemonicHint } from './MnemonicHint';

interface Props {
  question: Question;
  onSubmit: (answer: string, correct: boolean) => void;
  onSkip?: () => void;
  onToggleStar?: () => Promise<void> | void;
  starred?: boolean;
  mnemonic?: MnemonicRecord;
  /** 自动朗读：选择题题目出现时 / 拼写题答对后 */
  autoSpeak?: boolean;
}

const TYPE_LABEL: Record<Question['type'], string> = {
  meaning: 'EN → CN · 选释义',
  word: 'CN → EN · 选单词',
  spell: 'spelling · 拼写',
  phrase: 'collocation · 短语',
};

export function QuizCard({ question: q, onSubmit, onSkip, onToggleStar, starred, mnemonic, autoSpeak = true }: Props) {
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState<null | { correct: boolean; chosen: string }>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isChoice = q.type === 'meaning' || q.type === 'word';

  useEffect(() => {
    setAnswer('');
    setRevealed(null);
    setTimeout(() => inputRef.current?.focus(), 30);
    // 自动朗读：EN→CN 类型直接读题；拼写/CN→EN 不要朗读避免泄题
    if (autoSpeak && q.type === 'meaning' || (autoSpeak && q.type === 'phrase')) {
      const t = setTimeout(() => speak(q.word.word), 200);
      return () => clearTimeout(t);
    }
  }, [q, autoSpeak]);

  function check(value: string) {
    const ok = value.trim().toLowerCase() === q.answer.trim().toLowerCase();
    setRevealed({ correct: ok, chosen: value });
    if (autoSpeak && ok) setTimeout(() => speak(q.word.word), 80);
    // 答对自动前进，答错等用户主动 ↵ / 点击"继续"——给眼睛/大脑充足时间看正确答案
    if (ok) setTimeout(() => onSubmit(value, ok), 700);
  }

  function continueNext() {
    if (revealed) onSubmit(revealed.chosen, revealed.correct);
  }

  // 键盘快捷键
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 错误已揭示：Enter 继续
      if (revealed && !revealed.correct) {
        if (e.key === 'Enter') {
          e.preventDefault();
          continueNext();
        }
        return;
      }
      if (revealed) return;
      if (isChoice && q.options) {
        const n = Number(e.key);
        if (n >= 1 && n <= q.options.length) {
          e.preventDefault();
          check(q.options[n - 1]);
        }
      }
      if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        speak(q.word.word);
      }
      if (e.key === 'Escape' && onSkip) {
        e.preventDefault();
        onSkip();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, revealed, isChoice, onSkip]);

  return (
    <div className="paper-card mx-auto max-w-2xl animate-fade-up">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{TYPE_LABEL[q.type]}</span>
        <div className="flex items-center gap-1">
          {mnemonic && <MnemonicHint mnemonic={mnemonic} variant="floating" />}
          {onToggleStar && (
            <button
              onClick={onToggleStar}
              className={cn('btn-icon !h-8 !w-8', starred && 'border-persimmon text-persimmon')}
              title="标记为难词"
            >
              <Star size={14} className={cn(starred && 'fill-persimmon')} />
            </button>
          )}
          {q.type !== 'spell' && (
            <button onClick={() => speak(q.word.word)} className="btn-icon !h-8 !w-8" title="朗读 (Space)">
              <Volume2 size={14} />
            </button>
          )}
          {onSkip && !revealed && (
            <button onClick={onSkip} className="btn-icon !h-8 !w-8" title="跳过 (Esc)">
              <SkipForward size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="my-6 text-center">
        <div
          className={cn(
            'whitespace-pre-line font-display font-black tracking-tight text-ink',
            q.type === 'word' || q.type === 'spell' ? 'text-2xl md:text-3xl' : 'text-4xl md:text-5xl'
          )}
        >
          {q.prompt}
        </div>
      </div>

      {isChoice && q.options && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {q.options.map((opt, i) => {
            const isAnswer = opt === q.answer;
            const chosen = revealed?.chosen === opt;
            return (
              <button
                key={opt}
                disabled={!!revealed}
                onClick={() => check(opt)}
                className={cn(
                  'group flex items-center gap-3 rounded-md border px-4 py-3 text-left text-sm font-medium transition-all',
                  !revealed && 'border-paper3 bg-paper hover:-translate-y-0.5 hover:border-ink hover:bg-paper2',
                  // 答错时正确答案高亮为深墨 + 米色，最醒目
                  revealed && isAnswer && !revealed.correct && 'border-ink bg-ink text-paper animate-pop',
                  revealed && isAnswer && revealed.correct && 'border-moss bg-moss-50 text-moss-700',
                  revealed && chosen && !isAnswer && 'border-crimson bg-crimson-50 text-crimson line-through opacity-70',
                  revealed && !isAnswer && !chosen && 'border-paper3 bg-paper opacity-40'
                )}
              >
                <span className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded border font-mono text-[10px]',
                  revealed && isAnswer && !revealed.correct ? 'border-paper bg-paper text-ink' : 'border-paper3 bg-paper2 text-ink3 group-hover:border-ink'
                )}>
                  {i + 1}
                </span>
                <span className="flex-1">{opt}</span>
                {revealed && isAnswer && <CheckCircle2 size={16} className={revealed.correct ? 'text-moss' : 'text-paper'} />}
                {revealed && chosen && !isAnswer && <XCircle size={16} className="text-crimson" />}
              </button>
            );
          })}
        </div>
      )}

      {/* 答错后的继续按钮 + 醒目正确答案条 */}
      {revealed && !revealed.correct && isChoice && (
        <div className="mt-4 space-y-3 animate-fade-up">
          <div className="rounded-md border-l-4 border-persimmon bg-persimmon-50/60 p-3 text-sm">
            <div className="font-mono text-[10px] uppercase tracking-wider text-persimmon-700">正确答案 · correct</div>
            <div className="mt-1 font-display text-xl font-bold text-ink">{q.answer}</div>
          </div>
          <button onClick={continueNext} className="btn-accent w-full">
            继续 <span className="font-mono text-[10px] opacity-70">↵</span>
          </button>
        </div>
      )}

      {!isChoice && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!revealed) check(answer);
          }}
          className="space-y-3"
        >
          <input
            ref={inputRef}
            className="input text-center font-mono text-lg"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="type the english word"
            autoComplete="off"
            spellCheck={false}
            disabled={!!revealed}
          />
          {!revealed ? (
            <button type="submit" disabled={!answer.trim()} className="btn-accent w-full">
              提交 <span className="font-mono text-[10px] opacity-70">↵</span>
            </button>
          ) : revealed.correct ? (
            <div className="rounded-md border border-moss bg-moss-50 px-4 py-3 text-center text-sm text-moss-700">
              ✓ 正确！
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-crimson bg-crimson-50 px-4 py-3 text-sm text-crimson">
                <div className="font-semibold">✗ 拼写有误</div>
                <div className="mt-2 flex items-center justify-center gap-1 font-mono text-base">
                  {diffChars(revealed.chosen, q.answer).map((d, i) => (
                    <span
                      key={i}
                      className={cn(
                        d.op === 'match' && 'text-ink2',
                        d.op === 'sub' && 'rounded bg-crimson px-0.5 text-paper',
                        d.op === 'ins' && 'rounded bg-persimmon px-0.5 text-paper',
                        d.op === 'del' && 'text-ink3 line-through opacity-60'
                      )}
                    >
                      {d.char}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider opacity-60">
                  <span className="rounded bg-crimson px-1 text-paper">替换</span>{' '}
                  <span className="rounded bg-persimmon px-1 text-paper">缺失</span>{' '}
                  <span className="line-through">多余</span>
                </div>
              </div>
              <div className="rounded-md border-l-4 border-persimmon bg-persimmon-50/60 p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-persimmon-700">正确拼写 · correct</div>
                <div className="mt-1 font-mono text-xl font-bold text-ink tracking-wide">{q.answer}</div>
              </div>
              <button onClick={continueNext} className="btn-accent w-full">
                继续 <span className="font-mono text-[10px] opacity-70">↵</span>
              </button>
            </div>
          )}
          {!revealed && (
            <p className="text-center font-mono text-[10px] uppercase tracking-wider text-ink3">
              ↵ submit · space 朗读 · esc 跳过
            </p>
          )}
        </form>
      )}

      {isChoice && !revealed && (
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wider text-ink3">
          press 1–{q.options?.length} · space 朗读 · esc 跳过
        </p>
      )}
    </div>
  );
}
