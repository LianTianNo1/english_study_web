import { useEffect, useRef, useState } from 'react';
import { Volume2, CheckCircle2, XCircle } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';
import type { Question } from '@/features/learn-session/session';

interface Props {
  question: Question;
  onSubmit: (answer: string, correct: boolean) => void;
}

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
    setTimeout(() => onSubmit(value, ok), 750);
  }

  const isChoice = q.type === 'meaning' || q.type === 'word';

  return (
    <div className="card mx-auto max-w-2xl animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <span className="tag">{typeLabel(q.type)}</span>
        {q.type !== 'spell' && (
          <button
            onClick={() => speak(q.word.word)}
            className="grid h-8 w-8 place-items-center rounded-full bg-cream-100 text-ink-600 hover:bg-warm-100 hover:text-warm-600"
            title="朗读"
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>

      <div className="my-4 text-center">
        <div className={cn('whitespace-pre-line text-2xl font-bold tracking-tight text-ink-800', q.type === 'word' ? 'text-warm-600' : '')}>
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
                  'rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all',
                  !revealed && 'border-ink-200 bg-white hover:border-warm-400 hover:bg-warm-50',
                  revealed && isAnswer && 'border-mint-400 bg-emerald-50 text-mint-500',
                  revealed && chosen && !isAnswer && 'border-red-300 bg-red-50 text-red-500'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{opt}</span>
                  {revealed && isAnswer && <CheckCircle2 size={18} />}
                  {revealed && chosen && !isAnswer && <XCircle size={18} />}
                </div>
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
            className="input text-center text-lg"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="输入英文单词"
            autoComplete="off"
            spellCheck={false}
            disabled={!!revealed}
          />
          {!revealed ? (
            <button type="submit" disabled={!answer.trim()} className="btn-primary w-full">
              提交
            </button>
          ) : (
            <div
              className={cn(
                'rounded-2xl px-4 py-3 text-center text-sm font-medium',
                revealed.correct ? 'bg-emerald-50 text-mint-500' : 'bg-red-50 text-red-500'
              )}
            >
              {revealed.correct ? '✓ 正确！' : `✗ 正确答案：${q.answer}`}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function typeLabel(t: Question['type']) {
  return { meaning: '选释义', word: '选单词', spell: '拼写', phrase: '短语填空' }[t];
}
