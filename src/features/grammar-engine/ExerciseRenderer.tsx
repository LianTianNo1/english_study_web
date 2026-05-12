import { Fragment, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn, shuffle } from '@/lib/utils';
import type { GrammarExercise } from '@/data/grammar-lessons';
import { AnswerInput } from '@/components/AnswerInput';

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
  const options = exercise.options ?? [];

  // 键盘 1-N 选择
  useEffect(() => {
    if (revealed || options.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        e.preventDefault();
        const opt = options[n - 1];
        onSubmit(opt, check(opt, exercise.answer));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, options, exercise.answer, onSubmit]);

  return (
    <div>
      <Question text={exercise.question} />
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt, i) => {
          const isAnswer = opt === exercise.answer;
          const chosen = revealed?.value === opt;
          return (
            <button
              key={opt}
              disabled={!!revealed}
              onClick={() => onSubmit(opt, check(opt, exercise.answer))}
              className={cn(
                'group flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-sm font-medium transition-all',
                !revealed && 'border-paper3 bg-paper hover:-translate-y-0.5 hover:border-ink hover:bg-paper2',
                revealed && isAnswer && !revealed.correct && 'border-ink bg-ink text-paper animate-pop',
                revealed && isAnswer && revealed.correct && 'border-moss bg-moss-50 text-moss-700',
                revealed && chosen && !isAnswer && 'border-crimson bg-crimson-50 text-crimson line-through opacity-70',
                revealed && !isAnswer && !chosen && 'border-paper3 bg-paper opacity-40'
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded border font-mono text-[10px]',
                  revealed && isAnswer && !revealed.correct ? 'border-paper bg-paper text-ink' : 'border-paper3 bg-paper2 text-ink3 group-hover:border-ink'
                )}>
                  {i + 1}
                </span>
                <span>{opt}</span>
              </div>
              {revealed && isAnswer && <CheckCircle2 size={16} className={revealed.correct ? 'text-moss' : 'text-paper'} />}
              {revealed && chosen && !isAnswer && <XCircle size={16} className="text-crimson" />}
            </button>
          );
        })}
      </div>
      {!revealed && (
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink3">
          press 1–{options.length} · enter to advance
        </p>
      )}
      <Feedback exercise={exercise} revealed={revealed} />
    </div>
  );
}

/* ---------- 填空 ---------- */
function FillBlankView({ exercise, revealed, onSubmit }: Props) {
  return (
    <div>
      <Question text={exercise.question} />
      <AnswerInput
        answer={exercise.answer}
        revealed={revealed}
        onSubmit={(v, ok) => onSubmit(v, ok)}
        autoFocus
      />
      {exercise.explain && revealed && (
        <div className="mt-3 rounded-md border border-paper3 bg-paper2/40 p-3 text-xs text-ink3">
          <b className="text-ink2">解析：</b>{exercise.explain}
        </div>
      )}
    </div>
  );
}

/* ---------- 语序重排：点选 + 拖拽（pool ↔ picked 双向 / picked 内重排序）---------- */
type DragSource = { area: 'pool' | 'picked'; index: number } | null;

function ReorderView({ exercise, revealed, onSubmit }: Props) {
  const tokens = exercise.options ?? [];
  const [pool, setPool] = useState<string[]>(() => shuffle(tokens.slice()));
  const [picked, setPicked] = useState<string[]>([]);
  const [dragging, setDragging] = useState<DragSource>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null); // picked 中拖入位置预览

  useEffect(() => {
    setPool(shuffle(tokens.slice()));
    setPicked([]);
    setDragging(null);
    setHoverIdx(null);
  }, [exercise]);

  // ---- 数据操作 ----
  function pickFromPool(i: number, insertAt?: number) {
    if (revealed) return;
    const tok = pool[i];
    const np = pool.filter((_, idx) => idx !== i);
    const nq = picked.slice();
    if (insertAt === undefined || insertAt > nq.length) nq.push(tok);
    else nq.splice(insertAt, 0, tok);
    setPool(np);
    setPicked(nq);
  }
  function returnToPool(i: number) {
    if (revealed) return;
    const tok = picked[i];
    setPicked(picked.filter((_, idx) => idx !== i));
    setPool([...pool, tok]);
  }
  function reorderInPicked(from: number, to: number) {
    if (revealed) return;
    if (from === to || to < 0) return;
    const nq = picked.slice();
    const [tok] = nq.splice(from, 1);
    const insertAt = to > from ? to - 1 : to;
    nq.splice(insertAt, 0, tok);
    setPicked(nq);
  }

  // ---- 键盘：数字键从 pool 选词；Backspace 撤销最后一个 picked；Enter 提交 ----
  useEffect(() => {
    if (revealed) return;
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter' && picked.length > 0) {
        e.preventDefault();
        const ans = picked.join(' ');
        onSubmit(ans, check(ans, exercise.answer));
        return;
      }
      if (e.key === 'Backspace' && picked.length > 0) {
        e.preventDefault();
        returnToPool(picked.length - 1);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= pool.length) {
        e.preventDefault();
        pickFromPool(n - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, pool, picked, exercise.answer, onSubmit]);

  // ---- 拖拽 ----
  function startDrag(area: 'pool' | 'picked', index: number, e: React.DragEvent) {
    if (revealed) return;
    setDragging({ area, index });
    e.dataTransfer.effectAllowed = 'move';
    // Firefox 需要 setData 才能开始拖
    e.dataTransfer.setData('text/plain', String(index));
  }
  function endDrag() {
    setDragging(null);
    setHoverIdx(null);
  }
  function dropOnPicked(insertAt: number) {
    if (!dragging || revealed) return;
    if (dragging.area === 'pool') {
      pickFromPool(dragging.index, insertAt);
    } else {
      reorderInPicked(dragging.index, insertAt);
    }
    endDrag();
  }
  function dropOnPool() {
    if (!dragging || revealed) return;
    if (dragging.area === 'picked') {
      returnToPool(dragging.index);
    }
    endDrag();
  }

  return (
    <div>
      <Question text={exercise.question || '把词块拼成正确的句子（可点击 / 拖拽）：'} />

      {/* 已选区域 */}
      <div
        onDragOver={(e) => {
          if (revealed) return;
          e.preventDefault();
          if (picked.length === 0) setHoverIdx(0);
        }}
        onDragLeave={(e) => {
          if ((e.target as HTMLElement) === e.currentTarget) setHoverIdx(null);
        }}
        onDrop={() => dropOnPicked(hoverIdx ?? picked.length)}
        className={cn(
          'mb-3 min-h-[68px] rounded-md border-2 border-dashed bg-paper2/40 p-3 transition-colors',
          revealed?.correct === false && 'border-crimson',
          revealed?.correct === true && 'border-moss',
          !revealed && (dragging ? 'border-persimmon bg-persimmon-50/40' : 'border-paper3')
        )}
      >
        {picked.length === 0 ? (
          <p className="text-xs text-muted">点击下方词块 · 数字键 1-9 · 或拖拽到此处</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {picked.map((t, i) => (
              <Fragment key={`${i}-${t}`}>
                {/* 拖拽时显示插入指示线 */}
                {dragging && hoverIdx === i && (
                  <span className="h-7 w-0.5 animate-pulse rounded-full bg-persimmon" />
                )}
                <button
                  draggable={!revealed}
                  onDragStart={(e) => startDrag('picked', i, e)}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    if (revealed) return;
                    e.preventDefault();
                    // 根据鼠标在词块的左/右半区决定插入到前 or 后
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const isLeft = e.clientX < rect.left + rect.width / 2;
                    setHoverIdx(isLeft ? i : i + 1);
                  }}
                  onClick={() => returnToPool(i)}
                  disabled={!!revealed}
                  className={cn(
                    'group relative cursor-grab rounded border bg-ink px-2.5 py-1 font-mono text-sm text-paper transition-all hover:bg-ink2 active:cursor-grabbing',
                    dragging?.area === 'picked' && dragging.index === i && 'opacity-40'
                  )}
                  title="点击退回 · 拖动调换顺序"
                >
                  <span className="absolute -left-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-persimmon font-mono text-[8px] font-bold text-paper opacity-0 transition-opacity group-hover:opacity-100">
                    ×
                  </span>
                  {t}
                </button>
              </Fragment>
            ))}
            {/* 尾部插入指示 */}
            {dragging && hoverIdx === picked.length && (
              <span className="h-7 w-0.5 animate-pulse rounded-full bg-persimmon" />
            )}
          </div>
        )}
      </div>

      {/* 词块池 */}
      {pool.length > 0 && !revealed && (
        <div
          onDragOver={(e) => {
            if (dragging?.area === 'picked') e.preventDefault();
          }}
          onDrop={dropOnPool}
          className={cn(
            'mb-3 flex flex-wrap gap-1.5 rounded-md p-2 transition-colors',
            dragging?.area === 'picked' && 'bg-paper2/60 ring-1 ring-persimmon/40'
          )}
        >
          {pool.map((t, i) => (
            <button
              key={`${i}-${t}`}
              draggable
              onDragStart={(e) => startDrag('pool', i, e)}
              onDragEnd={endDrag}
              onClick={() => pickFromPool(i)}
              className={cn(
                'group relative cursor-grab rounded border border-paper3 bg-paper px-2.5 py-1 font-mono text-sm text-ink transition-all hover:-translate-y-0.5 hover:border-ink active:cursor-grabbing',
                dragging?.area === 'pool' && dragging.index === i && 'opacity-40'
              )}
              title={`点击/拖拽添加 · 数字 ${i + 1}`}
            >
              <span className="mr-1 font-mono text-[9px] text-ink3">{i + 1}</span>
              {t}
            </button>
          ))}
        </div>
      )}

      {!revealed && (
        <button
          disabled={picked.length === 0}
          onClick={() => {
            const ans = picked.join(' ');
            onSubmit(ans, check(ans, exercise.answer));
          }}
          className="btn-accent"
        >
          提交 <span className="font-mono text-[10px] opacity-70">↵</span>
        </button>
      )}
      {!revealed && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink3">
          ↵ submit · ⌫ undo · 1-9 pick · drag to reorder
        </p>
      )}
      <Feedback exercise={exercise} revealed={revealed} />
    </div>
  );
}

/* ---------- 中→英翻译 ---------- */
function TranslateView({ exercise, revealed, onSubmit }: Props) {
  return (
    <div>
      <Question text={exercise.question} />
      <AnswerInput
        answer={exercise.answer}
        revealed={revealed}
        hint={exercise.hint}
        mode="free"
        placeholder="用英文写出整句"
        onSubmit={(v, ok) => onSubmit(v, ok)}
        autoFocus
      />
      {exercise.explain && revealed && (
        <div className="mt-3 rounded-md border border-paper3 bg-paper2/40 p-3 text-xs text-ink3">
          <b className="text-ink2">解析：</b>{exercise.explain}
        </div>
      )}
    </div>
  );
}

/* ---------- 改错 ---------- */
function CorrectionView({ exercise, revealed, onSubmit }: Props) {
  return (
    <div>
      <Question text="找出并改正错误（修改后输入完整正确句子）：" />
      <div className="mb-4 rounded-md border border-crimson/40 bg-crimson-50/40 p-3 font-mono text-sm text-crimson">
        {extractWrongSentence(exercise.question)}
      </div>
      <AnswerInput
        answer={exercise.answer}
        revealed={revealed}
        mode="free"
        placeholder="输入修改后的完整句子"
        onSubmit={(v, ok) => onSubmit(v, ok)}
        autoFocus
      />
      {exercise.explain && revealed && (
        <div className="mt-3 rounded-md border border-paper3 bg-paper2/40 p-3 text-xs text-ink3">
          <b className="text-ink2">解析：</b>{exercise.explain}
        </div>
      )}
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
