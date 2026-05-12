import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GRAMMAR_LESSONS } from '@/data/grammar-lessons';
import { grammarRepo } from '@/db/repositories/grammar';
import { sessionsRepo } from '@/db/repositories/sessions';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Trophy, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'scene' | 'examples' | 'guess' | 'reveal' | 'exercises' | 'done';

export function GrammarLesson() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const lesson = GRAMMAR_LESSONS.find((l) => l.id === lessonId);
  const [step, setStep] = useState<Step>('scene');
  const [exIdx, setExIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { value: string; correct: boolean }>>({});
  const [revealedAns, setRevealedAns] = useState<string | null>(null);

  useEffect(() => {
    setStep('scene');
    setExIdx(0);
    setAnswers({});
    setRevealedAns(null);
  }, [lessonId]);

  if (!lesson) {
    return (
      <div className="card text-center">
        课程不存在。
        <Link to="/grammar" className="btn-secondary ml-3">返回</Link>
      </div>
    );
  }

  const correctCount = Object.values(answers).filter((a) => a.correct).length;

  async function complete() {
    await grammarRepo.complete(lesson!.id, correctCount);
    const next = GRAMMAR_LESSONS.find((l) => l.index === lesson!.index + 1);
    if (next) await grammarRepo.unlock(next.id);
    await sessionsRepo.log({
      type: 'grammar',
      wordsCount: 1,
      correctCount,
      durationMs: 0,
    });
    setStep('done');
  }

  function submitEx(value: string) {
    const cur = lesson!.exercises[exIdx];
    const ok = value.trim().toLowerCase() === cur.answer.trim().toLowerCase();
    setRevealedAns(value);
    setAnswers((a) => ({ ...a, [exIdx]: { value, correct: ok } }));
  }

  function nextEx() {
    if (exIdx + 1 >= lesson!.exercises.length) {
      complete();
    } else {
      setExIdx((i) => i + 1);
      setRevealedAns(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/grammar" className="btn-ghost"><ArrowLeft size={16} /> 返回</Link>
        <div className="text-sm text-ink-500">
          L{lesson.index} · {lesson.title}
        </div>
      </div>

      {step === 'scene' && (
        <div className="card animate-fade-in">
          <div className="mb-1 flex items-center gap-2 text-sm text-warm-600">
            <BookOpen size={16} /> 场景导入
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{lesson.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{lesson.subtitle}</p>
          <div className="mt-5 rounded-2xl bg-cream-100 p-5 text-base leading-relaxed text-ink-700">
            {lesson.scene}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setStep('examples')} className="btn-primary">看例句 <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 'examples' && (
        <div className="card animate-fade-in">
          <div className="mb-2 text-sm text-warm-600">5 个例句</div>
          <ul className="space-y-3">
            {lesson.examples.map((ex, i) => (
              <li key={i} className="rounded-2xl bg-cream-50 p-4">
                <div className="text-lg font-semibold text-ink-800">{renderHighlight(ex.en, ex.highlight)}</div>
                <div className="mt-1 text-sm text-ink-500">{ex.zh}</div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('scene')} className="btn-secondary"><ArrowLeft size={16} /> 上一步</button>
            <button onClick={() => setStep('guess')} className="btn-primary">猜猜规律 <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 'guess' && (
        <div className="card animate-fade-in">
          <div className="mb-2 text-sm text-warm-600">猜猜规律</div>
          <div className="rounded-2xl bg-amber-50 p-5 text-base leading-relaxed text-amber-900">
            💡 {lesson.hint}
          </div>
          <p className="mt-3 text-xs text-ink-400">想好了再点"揭晓"——主动思考能记得更牢。</p>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('examples')} className="btn-secondary"><ArrowLeft size={16} /> 上一步</button>
            <button onClick={() => setStep('reveal')} className="btn-primary">揭晓答案 <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 'reveal' && (
        <div className="card animate-fade-in">
          <div className="mb-2 text-sm text-warm-600">规律 / 公式</div>
          <h3 className="text-xl font-bold text-ink-800">{lesson.formula.rule}</h3>
          <p className="mt-2 text-sm text-ink-600">{lesson.formula.detail}</p>
          {lesson.formula.table && (
            <table className="mt-5 w-full overflow-hidden rounded-2xl border border-cream-200 text-sm">
              <thead>
                <tr className="bg-cream-100">
                  {lesson.formula.table.head.map((h, i) => (
                    <th key={i} className="px-4 py-2 text-left font-semibold text-ink-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lesson.formula.table.rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-cream-200">
                    {r.map((c, ci) => (
                      <td key={ci} className="px-4 py-2 text-ink-700">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('guess')} className="btn-secondary"><ArrowLeft size={16} /> 上一步</button>
            <button onClick={() => setStep('exercises')} className="btn-primary">小试身手 <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 'exercises' && (
        <div className="card animate-fade-in">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-warm-600">练习 {exIdx + 1} / {lesson.exercises.length}</div>
            <div className="text-xs text-ink-400">答对 ≥4 即可通关</div>
          </div>
          <ExerciseView
            key={exIdx}
            exercise={lesson.exercises[exIdx]}
            revealed={revealedAns}
            onSubmit={submitEx}
          />
          {revealedAns !== null && (
            <div className="mt-4 flex justify-end">
              <button onClick={nextEx} className="btn-primary">
                {exIdx + 1 < lesson.exercises.length ? <>下一题 <ArrowRight size={16} /></> : <>完成 <Trophy size={16} /></>}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="card text-center animate-fade-in">
          <Trophy size={40} className={cn('mx-auto mb-2', correctCount >= 4 ? 'text-warm-500' : 'text-ink-400')} />
          <h2 className="text-2xl font-bold">
            {correctCount >= 4 ? '通关成功！🎉' : '差一点点 加油'}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            得分 <b className="text-warm-600">{correctCount}</b> / {lesson.exercises.length}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/grammar" className="btn-secondary">返回路线图</Link>
            {GRAMMAR_LESSONS.find((l) => l.index === lesson.index + 1) && correctCount >= 4 && (
              <button
                onClick={() => navigate(`/grammar/${GRAMMAR_LESSONS.find((l) => l.index === lesson.index + 1)!.id}`)}
                className="btn-primary"
              >
                下一节 <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderHighlight(text: string, highlights?: string[]) {
  if (!highlights || highlights.length === 0) return text;
  const pat = new RegExp(`(${highlights.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pat);
  return parts.map((p, i) =>
    highlights.some((h) => p.toLowerCase() === h.toLowerCase()) ? (
      <mark key={i} className="rounded bg-warm-200 px-1 text-ink-800">{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function ExerciseView(props: {
  exercise: typeof GRAMMAR_LESSONS[0]['exercises'][0];
  revealed: string | null;
  onSubmit: (v: string) => void;
}) {
  const { exercise, revealed, onSubmit } = props;
  const [text, setText] = useState('');
  return (
    <div>
      <div className="mb-4 text-lg font-medium text-ink-800">{exercise.question}</div>
      {exercise.type === 'choice' && exercise.options ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {exercise.options.map((opt) => {
            const isAnswer = opt === exercise.answer;
            const chosen = revealed === opt;
            return (
              <button
                key={opt}
                disabled={!!revealed}
                onClick={() => onSubmit(opt)}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all',
                  !revealed && 'border-ink-200 bg-white hover:border-warm-400 hover:bg-warm-50',
                  revealed && isAnswer && 'border-mint-400 bg-emerald-50 text-mint-500',
                  revealed && chosen && !isAnswer && 'border-red-300 bg-red-50 text-red-500'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{opt}</span>
                  {revealed && isAnswer && <CheckCircle2 size={16} />}
                  {revealed && chosen && !isAnswer && <XCircle size={16} />}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!revealed && text.trim()) onSubmit(text);
          }}
          className="flex gap-2"
        >
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!revealed}
            placeholder="输入答案"
            autoFocus
          />
          {!revealed && (
            <button type="submit" disabled={!text.trim()} className="btn-primary">
              提交
            </button>
          )}
        </form>
      )}
      {revealed !== null && (
        <div
          className={cn(
            'mt-3 rounded-xl px-4 py-2 text-sm',
            revealed.trim().toLowerCase() === exercise.answer.toLowerCase()
              ? 'bg-emerald-50 text-mint-500'
              : 'bg-red-50 text-red-500'
          )}
        >
          {revealed.trim().toLowerCase() === exercise.answer.toLowerCase()
            ? '✓ 正确！'
            : `✗ 正确答案：${exercise.answer}`}
        </div>
      )}
    </div>
  );
}
