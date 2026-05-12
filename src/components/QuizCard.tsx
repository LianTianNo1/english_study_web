import { useEffect, useRef, useState } from 'react';
import { Volume2, CheckCircle2, XCircle } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';
import type { Question } from '@/features/learn-session/session';

interface Props {
  question: Question;
  onSubmit: (answer: string, correct: boolean) => void;
}

const TYPE_LABEL: Record<Question['type'], string> = {
  meaning: 'EN → CN · 选释义',
  word: 'CN → EN · 选单词',
  spell: 'spelling · 拼写',
  phrase: 'collocation · 短语',
};

export function QuizCard({ question: q, onSubmit }: Props) {
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState<null | { correct: boolean; chosen: string }>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAnswer('');
    setRevealed(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [q]);

  function check(value: string) {
    const ok = value.trim().toLowerCase() === q.answer.trim().toLowerCase();
    setRevealed({ correct: ok, chosen: value });
    setTimeout(() => onSubmit(value, ok), 700);
  }

  const isChoice = q.type === 'meaning' || q.type === 'word';

  return (
    <div className="paper-card mx-auto max-w-2xl animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{TYPE_LABEL[q.type]}</span>
        {q.type !== 'spell' && (
          <button onClick={() => speak(q.word.word)} className="btn-icon !h-8 !w-8">
            <Volume2 size={14} />
          </button>
        )}
      </div>

      <div className="my-6 text-center">
        <div className={cn('whitespace-pre-line font-display font-black tracking-tight text-ink', q.type === 'word' || q.type === 'spell' ? 'text-2xl md:text-3xl' : 'text-4xl md:text-5xl')}>
          {q.prompt}
        </div>
      </div>

      {isChoice && q.options && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {q.options.map((opt) => {
            const isAnswer = opt === q.answer;
            const chosen = revealed?.chosen === opt;
            return (
              <button
                key={opt}
                disabled={!!revealed}
                onClick={() => check(opt)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md border px-4 py-3 text-left text-sm font-medium transition-all',
                  !revealed && 'border-paper3 bg-paper hover:-translate-y-0.5 hover:border-ink hover:bg-paper2',
                  revealed && isAnswer && 'border-moss bg-moss-50 text-moss-700',
                  revealed && chosen && !isAnswer && 'border-crimson bg-crimson-50 text-crimson'
                )}
              >
                <span>{opt}</span>
                {revealed && isAnswer && <CheckCircle2 size={16} className="text-moss" />}
                {revealed && chosen && !isAnswer && <XCircle size={16} className="text-crimson" />}
              </button>
            );
          })}
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
              提交
            </button>
          ) : (
            <div
              className={cn(
                'rounded-md border px-4 py-3 text-center text-sm',
                revealed.correct ? 'border-moss bg-moss-50 text-moss-700' : 'border-crimson bg-crimson-50 text-crimson'
              )}
            >
              {revealed.correct ? '✓ 正确！' : (
                <span>✗ 正确答案：<b className="font-mono">{q.answer}</b></span>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
