import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GRAMMAR_LESSONS, type GrammarExercise } from '@/data/grammar-lessons';
import { grammarRepo } from '@/db/repositories/grammar';
import { sessionsRepo } from '@/db/repositories/sessions';
import { ArrowLeft, ArrowRight, Sparkles, Trophy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExerciseRenderer } from '@/features/grammar-engine/ExerciseRenderer';
import { useSettings } from '@/stores/settingsStore';
import { explainWrongAnswer, generateGrammarExercises } from '@/lib/ai';

type Step = 'scene' | 'examples' | 'guess' | 'reveal' | 'exercises' | 'done';

export function GrammarLesson() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const lesson = GRAMMAR_LESSONS.find((l) => l.id === lessonId);
  const ai = useSettings((s) => s.ai);

  const [step, setStep] = useState<Step>('scene');
  const [exercises, setExercises] = useState<GrammarExercise[]>([]);
  const [exIdx, setExIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { value: string; correct: boolean }>>({});
  const [revealed, setRevealed] = useState<{ value: string; correct: boolean } | null>(null);
  const [aiAdding, setAiAdding] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiExplain, setAiExplain] = useState('');
  const [aiExplaining, setAiExplaining] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    setStep('scene');
    setExercises(lesson.exercises.slice());
    setExIdx(0);
    setAnswers({});
    setRevealed(null);
    setAiError('');
    setAiExplain('');
  }, [lessonId]);

  if (!lesson) {
    return (
      <div className="paper-card text-center">
        课程不存在。<Link to="/grammar" className="linky ml-3 text-ink">返回</Link>
      </div>
    );
  }

  const correctCount = Object.values(answers).filter((a) => a.correct).length;

  async function complete() {
    await grammarRepo.complete(lesson!.id, correctCount);
    const next = GRAMMAR_LESSONS.find((l) => l.index === lesson!.index + 1);
    if (next) await grammarRepo.unlock(next.id);
    await sessionsRepo.log({ type: 'grammar', wordsCount: 1, correctCount, durationMs: 0 });
    setStep('done');
  }

  function submit(value: string, correct: boolean) {
    setRevealed({ value, correct });
    setAnswers((a) => ({ ...a, [exIdx]: { value, correct } }));
    setAiExplain('');
  }

  function nextEx() {
    if (exIdx + 1 >= exercises.length) complete();
    else {
      setExIdx((i) => i + 1);
      setRevealed(null);
      setAiExplain('');
    }
  }

  async function addAIExercises() {
    if (aiAdding) return;
    setAiAdding(true);
    setAiError('');
    try {
      const count = Math.max(1, Math.min(10, ai.exerciseCount ?? 3));
      const list = await generateGrammarExercises(lesson!.title, lesson!.formula.rule, ai, count);
      const adapted: GrammarExercise[] = list.map((q) => ({
        type: 'choice',
        question: q.question,
        options: q.options,
        answer: q.answer,
        explain: q.explain,
      }));
      setExercises((arr) => [...arr, ...adapted]);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiAdding(false);
    }
  }

  async function aiExplainWrong() {
    if (!revealed || revealed.correct || aiExplaining) return;
    setAiExplaining(true);
    setAiError('');
    try {
      const out = await explainWrongAnswer(
        exercises[exIdx].question,
        revealed.value,
        exercises[exIdx].answer,
        ai
      );
      setAiExplain(out);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiExplaining(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/grammar" className="btn-ghost">
          <ArrowLeft size={14} /> 路线图
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          lesson {String(lesson.index).padStart(2, '0')} / 25
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div className="chapter-num text-7xl">{String(lesson.index).padStart(2, '0')}</div>
        <div>
          <h1 className="font-display text-4xl font-black leading-none tracking-tight text-ink">
            {lesson.title}
          </h1>
          <p className="mt-1 text-sm italic text-ink3">{lesson.subtitle}</p>
        </div>
      </div>

      {step === 'scene' && (
        <div className="paper-card animate-fade-up">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">scene · 场景导入</div>
          <p className="mt-3 dropcap text-pretty text-base leading-relaxed text-ink">{lesson.scene}</p>
          <Footer onNext={() => setStep('examples')} nextLabel="看例句" />
        </div>
      )}

      {step === 'examples' && (
        <div className="paper-card animate-fade-up">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">examples · 5 sentences</div>
          <ul className="mt-4 space-y-4">
            {lesson.examples.map((ex, i) => (
              <li key={i} className="border-l-2 border-persimmon pl-4">
                <div className="font-display text-xl font-semibold text-ink">{renderHighlight(ex.en, ex.highlight)}</div>
                <div className="mt-0.5 text-sm text-ink3">{ex.zh}</div>
              </li>
            ))}
          </ul>
          <Footer onPrev={() => setStep('scene')} onNext={() => setStep('guess')} nextLabel="猜规律" />
        </div>
      )}

      {step === 'guess' && (
        <div className="paper-card animate-fade-up">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">guess · 自己想一想</div>
          <div className="mt-4 rounded-md border-l-4 border-persimmon bg-persimmon-50/40 p-5 text-base leading-relaxed text-ink">
            💡 {lesson.hint}
          </div>
          <p className="mt-3 text-xs text-ink3">想好答案再点"揭晓"——主动思考能记得更牢。</p>
          <Footer onPrev={() => setStep('examples')} onNext={() => setStep('reveal')} nextLabel="揭晓" />
        </div>
      )}

      {step === 'reveal' && (
        <div className="paper-card animate-fade-up">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">rule · 规律</div>
          <h3 className="mt-3 font-display text-2xl font-bold text-ink text-balance">{lesson.formula.rule}</h3>
          <p className="mt-2 text-sm text-ink2">{lesson.formula.detail}</p>
          {lesson.formula.table && (
            <table className="editorial-table mt-5">
              <thead>
                <tr>
                  {lesson.formula.table.head.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lesson.formula.table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci} className={ci === 0 ? 'font-display font-semibold text-ink' : 'font-mono text-persimmon'}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Footer onPrev={() => setStep('guess')} onNext={() => setStep('exercises')} nextLabel="小试身手" />
        </div>
      )}

      {step === 'exercises' && (
        <div className="paper-card animate-fade-up">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
            <span>exercise {exIdx + 1} / {exercises.length}</span>
            <span>{TYPE_LABEL[exercises[exIdx].type]} · pass ≥ {Math.ceil(exercises.length * 0.8)}/{exercises.length}</span>
          </div>
          <ExerciseRenderer key={exIdx} exercise={exercises[exIdx]} revealed={revealed} onSubmit={submit} />

          {revealed && !revealed.correct && ai.enabled && ai.apiKey && (
            <div className="mt-3">
              {!aiExplain ? (
                <button onClick={aiExplainWrong} disabled={aiExplaining} className="btn-ghost text-xs">
                  {aiExplaining ? <><Loader2 size={12} className="animate-spin" /> AI 正在思考</> : <><Sparkles size={12} className="text-persimmon" /> 让 AI 解释下为什么</>}
                </button>
              ) : (
                <div className="rounded-md border border-paper3 bg-paper2/40 p-3 text-sm text-ink2 animate-fade-up">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-persimmon">ai · 解释</span>
                  <p className="mt-1">{aiExplain}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <button onClick={addAIExercises} disabled={aiAdding} className="btn-ghost text-xs">
              {aiAdding ? <><Loader2 size={12} className="animate-spin" /> 生成中…</> : <><Sparkles size={12} className="text-persimmon" /> AI 加 {ai.exerciseCount ?? 3} 道题</>}
            </button>
            {revealed && (
              <button onClick={nextEx} className="btn-accent">
                {exIdx + 1 < exercises.length ? <>下一题 <ArrowRight size={16} /></> : <>完成 <Trophy size={16} /></>}
              </button>
            )}
          </div>
          {aiError && <div className="mt-2 font-mono text-[10px] text-crimson">{aiError}</div>}
        </div>
      )}

      {step === 'done' && (
        <div className="paper-card text-center animate-fade-up">
          <Trophy size={40} className={cn('mx-auto mb-2', correctCount >= Math.ceil(exercises.length * 0.8) ? 'text-persimmon' : 'text-ink3')} />
          <h2 className="font-display text-3xl font-black">
            {correctCount >= Math.ceil(exercises.length * 0.8) ? '通关成功' : '差一点，再来一次？'}
          </h2>
          <p className="mt-1 text-sm text-ink2">
            得分 <b className="text-persimmon">{correctCount}</b> / {exercises.length}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/grammar" className="btn-ghost">返回路线图</Link>
            {GRAMMAR_LESSONS.find((l) => l.index === lesson.index + 1) && correctCount >= Math.ceil(exercises.length * 0.8) && (
              <button
                onClick={() => navigate(`/grammar/${GRAMMAR_LESSONS.find((l) => l.index === lesson.index + 1)!.id}`)}
                className="btn-accent"
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

const TYPE_LABEL: Record<GrammarExercise['type'], string> = {
  choice: '选择题',
  fillblank: '填空题',
  reorder: '语序重排',
  translate: '汉译英',
  correction: '改错题',
};

function Footer({ onPrev, onNext, nextLabel }: { onPrev?: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="mt-6 flex items-center justify-between">
      {onPrev ? (
        <button onClick={onPrev} className="btn-ghost"><ArrowLeft size={14} /> 上一步</button>
      ) : <span />}
      <button onClick={onNext} className="btn-accent">{nextLabel} <ArrowRight size={16} /></button>
    </div>
  );
}

function renderHighlight(text: string, highlights?: string[]) {
  if (!highlights || highlights.length === 0) return text;
  const pat = new RegExp(`(${highlights.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pat);
  return parts.map((p, i) =>
    highlights.some((h) => p.toLowerCase() === h.toLowerCase()) ? (
      <span key={i} className="bg-persimmon-100 px-1 italic text-persimmon-700">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
