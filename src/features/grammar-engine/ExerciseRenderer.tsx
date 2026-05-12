import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { cn, shuffle } from '@/lib/utils';
import type { GrammarExercise } from '@/data/grammar-lessons';

interface Props {
  exercise: GrammarExercise;
  revealed: { value: string; correct: boolean } | null;
  onSubmit: (value: string, correct: boolean) => void;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.!?;,]+$/g, '').replace(/\s+/g, ' ');
}

function check(answer: string, correct: string) {
  return normalize(answer) === normalize(correct);
}

export function ExerciseRenderer({ exercise, revealed, onSubmit }: Props) {
  switch (exercise.type) {
    case 'choice':
      return <ChoiceView exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
    case 'fillblank':
      return <FillBlankView exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
    case 'reorder':
      return <ReorderView exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
    case 'translate':
      return <TranslateView exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
    case 'correction':
      return <CorrectionView exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
  }
}

/* ---------- 选择题 ---------- */
function ChoiceView({ exercise, revealed, onSubmit }: Props) {
  return (
    <div>
      <Question text={exercise.question} />
      <div className="grid gap-2 sm:grid-cols-2">
        {exercise.options?.map((opt) => {
          const isAnswer = opt === exercise.answer;
          const chosen = revealed?.value === opt;
          return (
            <button
              key={opt}
              disabled={!!revealed}
              onClick={() => onSubmit(opt, check(opt, exercise.answer))}
              className={cn(
                'group flex items-center justify-between gap-2 rounded-md border px-4 py-3 text-left text-sm font-medium transition-all',
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
      <Feedback exercise={exercise} revealed={revealed} />
    </div>
  );
}

/* ---------- 填空 ---------- */
function FillBlankView({ exercise, revealed, onSubmit }: Props) {
  const [text, setText] = useState('');
  return (
    <div>
      <Question text={exercise.question} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!revealed && text.trim()) onSubmit(text, check(text, exercise.answer));
        }}
        className="flex gap-2"
      >
        <input className="input font-mono" value={text} onChange={(e) => setText(e.target.value)} disabled={!!revealed} autoFocus placeholder="输入答案" />
        {!revealed && (
          <button type="submit" disabled={!text.trim()} className="btn-accent">提交</button>
        )}
      </form>
      <Feedback exercise={exercise} revealed={revealed} />
    </div>
  );
}

/* ---------- 语序重排：拖动 / 点选词块拼句 ---------- */
function ReorderView({ exercise, revealed, onSubmit }: Props) {
  const tokens = exercise.options ?? [];
  const [pool, setPool] = useState<string[]>(() => shuffle(tokens.slice()));
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    setPool(shuffle(tokens.slice()));
    setPicked([]);
  }, [exercise]);

  function pick(i: number) {
    if (revealed) return;
    const tok = pool[i];
    setPool(pool.filter((_, idx) => idx !== i));
    setPicked([...picked, tok]);
  }
  function unpick(i: number) {
    if (revealed) return;
    const tok = picked[i];
    setPicked(picked.filter((_, idx) => idx !== i));
    setPool([...pool, tok]);
  }
  function submit() {
    if (revealed) return;
    const ans = picked.join(' ');
    onSubmit(ans, check(ans, exercise.answer));
  }

  return (
    <div>
      <Question text={exercise.question || '把词块拼成正确的句子：'} />
      {/* 已选区域 */}
      <div
        className={cn(
          'mb-3 min-h-[64px] rounded-md border-2 border-dashed bg-paper2/40 p-3 transition-colors',
          revealed?.correct === false && 'border-crimson',
          revealed?.correct === true && 'border-moss',
          !revealed && 'border-paper3'
        )}
      >
        {picked.length === 0 ? (
          <p className="text-xs text-muted">点击下方词块组成句子</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((t, i) => (
              <button
                key={i + t}
                disabled={!!revealed}
                onClick={() => unpick(i)}
                className="rounded border border-ink bg-ink px-2.5 py-1 font-mono text-sm text-paper hover:bg-ink2"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* 词块池 */}
      {pool.length > 0 && !revealed && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {pool.map((t, i) => (
            <button
              key={i + t}
              onClick={() => pick(i)}
              className="rounded border border-paper3 bg-paper px-2.5 py-1 font-mono text-sm text-ink hover:border-ink"
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {!revealed && (
        <button disabled={picked.length === 0} onClick={submit} className="btn-accent">提交</button>
      )}
      <Feedback exercise={exercise} revealed={revealed} />
    </div>
  );
}

/* ---------- 中→英翻译 ---------- */
function TranslateView({ exercise, revealed, onSubmit }: Props) {
  const [text, setText] = useState('');
  return (
    <div>
      <Question text={exercise.question} />
      {exercise.hint && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md bg-paper2 px-3 py-2 text-xs text-ink3">
          <Lightbulb size={12} className="text-persimmon" />
          关键词：<code className="font-mono">{exercise.hint}</code>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!revealed && text.trim()) onSubmit(text, check(text, exercise.answer));
        }}
        className="flex gap-2"
      >
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="用英文写出整句" disabled={!!revealed} autoFocus />
        {!revealed && <button type="submit" disabled={!text.trim()} className="btn-accent">提交</button>}
      </form>
      <Feedback exercise={exercise} revealed={revealed} />
    </div>
  );
}

/* ---------- 改错 ---------- */
function CorrectionView({ exercise, revealed, onSubmit }: Props) {
  const [text, setText] = useState(() => exercise.question.replace(/^.*?(?=[A-Za-z])/, ''));
  useEffect(() => {
    setText(exercise.question.replace(/^.*?(?=[A-Za-z])/, '').replace(/\s*（[^）]*）\s*$/, ''));
  }, [exercise]);
  return (
    <div>
      <Question text="找出并改正错误（修改后输入完整正确句子）：" />
      <div className="mb-3 rounded-md border border-crimson/40 bg-crimson-50/40 p-3 font-mono text-sm text-crimson">
        {extractWrongSentence(exercise.question)}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!revealed && text.trim()) onSubmit(text, check(text, exercise.answer));
        }}
        className="flex gap-2"
      >
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} disabled={!!revealed} autoFocus />
        {!revealed && <button type="submit" disabled={!text.trim()} className="btn-accent">提交</button>}
      </form>
      <Feedback exercise={exercise} revealed={revealed} />
    </div>
  );
}

function extractWrongSentence(q: string) {
  return q.replace(/（[^）]*）\s*$/, '').replace(/^找出并改正错误[：:\s]*/, '').trim();
}

/* ---------- 公共 ---------- */
function Question({ text }: { text: string }) {
  return <div className="mb-4 whitespace-pre-line text-lg font-medium text-ink">{text}</div>;
}

function Feedback({ exercise, revealed }: { exercise: GrammarExercise; revealed: Props['revealed'] }) {
  if (!revealed) return null;
  return (
    <div
      className={cn(
        'mt-3 rounded-md border px-3 py-2 text-sm',
        revealed.correct ? 'border-moss bg-moss-50 text-moss-700' : 'border-crimson bg-crimson-50 text-crimson'
      )}
    >
      <div className="font-semibold">
        {revealed.correct ? '✓ 正确！' : '✗ '}
        {!revealed.correct && <span>正确答案：{exercise.answer}</span>}
      </div>
      {exercise.explain && (
        <div className="mt-1 text-xs opacity-80">解析：{exercise.explain}</div>
      )}
    </div>
  );
}
