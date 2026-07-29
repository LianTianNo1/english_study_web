import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GRAMMAR_LESSONS, type GrammarExercise } from '@/data/grammar-lessons';
import { grammarRepo } from '@/db/repositories/grammar';
import { sessionsRepo } from '@/db/repositories/sessions';
import { ArrowLeft, ArrowRight, Sparkles, Trophy, Loader2, AlertTriangle, BookOpen, RotateCw, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExerciseRenderer } from '@/features/grammar-engine/ExerciseRenderer';
import { useSettings } from '@/stores/settingsStore';
import { explainWrongAnswer, generateGrammarExercises } from '@/lib/ai';

type Step = 'scene' | 'examples' | 'guess' | 'reveal' | 'mistakes' | 'usage' | 'exercises' | 'advanced' | 'retry' | 'done';

interface LessonResult {
  firstAttemptScore: number;
  basicTotal: number;
  advancedScore: number;
  advancedTotal: number;
  retryRounds: number;
}

export function GrammarLesson() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const lesson = GRAMMAR_LESSONS.find((l) => l.id === lessonId);
  const ai = useSettings((s) => s.ai);

  const [step, setStep] = useState<Step>('scene');
  const [exercises, setExercises] = useState<GrammarExercise[]>([]);
  const [advExercises, setAdvExercises] = useState<GrammarExercise[]>([]);
  const [retryExercises, setRetryExercises] = useState<GrammarExercise[]>([]);
  const [exIdx, setExIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { value: string; correct: boolean }>>({});
  const [revealed, setRevealed] = useState<{ value: string; correct: boolean } | null>(null);
  const [aiAdding, setAiAdding] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiExplain, setAiExplain] = useState('');
  const [aiExplaining, setAiExplaining] = useState(false);
  const [phase, setPhase] = useState<'basic' | 'advanced' | 'retry'>('basic');
  const [firstAttemptScore, setFirstAttemptScore] = useState<number | null>(null);
  const [retryRounds, setRetryRounds] = useState(0);
  const [result, setResult] = useState<LessonResult | null>(null);
  const lessonStartedAt = useRef(Date.now());

  useEffect(() => {
    if (!lesson) return;
    setStep('scene');
    setExercises(lesson.exercises.slice());
    setAdvExercises(lesson.advancedExercises?.slice() ?? []);
    setRetryExercises([]);
    setExIdx(0);
    setAnswers({});
    setRevealed(null);
    setAiError('');
    setAiExplain('');
    setPhase('basic');
    setFirstAttemptScore(null);
    setRetryRounds(0);
    setResult(null);
    lessonStartedAt.current = Date.now();
  }, [lessonId]);

  if (!lesson) {
    return (
      <div className="paper-card text-center">
        课程不存在。<Link to="/grammar" className="linky ml-3 text-ink">返回</Link>
      </div>
    );
  }

  const activeExercises = phase === 'basic' ? exercises : phase === 'advanced' ? advExercises : retryExercises;
  const correctCount = Object.values(answers).filter((a) => a.correct).length;
  const passingScore = Math.ceil(exercises.length * 0.8);

  async function complete(finalScore: number, advancedScore = 0) {
    // 只有基础错题全部订正后才会走到这里，避免零基础学习者带着知识漏洞继续下一节。
    await grammarRepo.complete(lesson!.id, finalScore);
    const next = GRAMMAR_LESSONS.find((l) => l.index === lesson!.index + 1);
    if (next) await grammarRepo.unlock(next.id);
    await sessionsRepo.log({
      type: 'grammar',
      wordsCount: 1,
      correctCount: finalScore,
      durationMs: Date.now() - lessonStartedAt.current,
    });
    setResult({
      firstAttemptScore: finalScore,
      basicTotal: exercises.length,
      advancedScore,
      advancedTotal: advExercises.length,
      retryRounds,
    });
    setStep('done');
  }

  function submit(value: string, correct: boolean) {
    setRevealed({ value, correct });
    setAnswers((a) => ({ ...a, [exIdx]: { value, correct } }));
    setAiExplain('');
  }

  function nextEx() {
    setRevealed(null);
    setAiExplain('');
    if (exIdx + 1 < activeExercises.length) {
      setExIdx((i) => i + 1);
      return;
    }
    // 当前阶段做完
    if (phase === 'basic') {
      // 收集本阶段错题
      const wrong = exercises
        .map((ex, i) => ({ ex, a: answers[i] }))
        .filter((x) => x.a && !x.a.correct)
        .map((x) => x.ex);
      setFirstAttemptScore(correctCount);
      // 基础没通过 → 进入"错题回练"
      // 基础题无论是否达到 80%，答错的知识点都必须再做对一次才算掌握。
      if (wrong.length > 0) {
        setRetryExercises(wrong);
        setExIdx(0);
        setAnswers({});
        setPhase('retry');
        setStep('retry');
        setRetryRounds(1);
        return;
      }
      // 基础通过 → 是否有进阶题
      if (advExercises.length > 0) {
        setExIdx(0);
        setAnswers({});
        setPhase('advanced');
        setStep('advanced');
        return;
      }
      complete(correctCount);
    } else if (phase === 'advanced') {
      complete(firstAttemptScore ?? exercises.length, correctCount);
    } else if (phase === 'retry') {
      const wrong = retryExercises
        .map((ex, i) => ({ ex, answer: answers[i] }))
        .filter((item) => item.answer && !item.answer.correct)
        .map((item) => item.ex);
      // 回练仍答错时只保留未掌握题继续练，不能直接完成或解锁下一节。
      if (wrong.length > 0) {
        setRetryExercises(wrong);
        setExIdx(0);
        setAnswers({});
        setRetryRounds((round) => round + 1);
        return;
      }
      // 回练完成，进入完成或进阶
      if (advExercises.length > 0) {
        setExIdx(0);
        setAnswers({});
        setPhase('advanced');
        setStep('advanced');
      } else {
        complete(firstAttemptScore ?? exercises.length);
      }
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
      // 加到当前阶段
      if (phase === 'basic') setExercises((arr) => [...arr, ...adapted]);
      else if (phase === 'advanced') setAdvExercises((arr) => [...arr, ...adapted]);
      else if (phase === 'retry') setRetryExercises((arr) => [...arr, ...adapted]);
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
      const out = await explainWrongAnswer(activeExercises[exIdx].question, revealed.value, activeExercises[exIdx].answer, ai);
      setAiExplain(out);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiExplaining(false);
    }
  }

  // 全局键盘流转：Enter 下一步 / 左右切换
  useEffect(() => {
    let armed = false;
    const armTimer = setTimeout(() => { armed = true; }, 250);
    function onKey(e: KeyboardEvent) {
      if (e.repeat || !armed) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const stages = stagesOrder(lesson!, retryRounds > 0);
      const curI = stages.indexOf(step);
      const isExerciseStep = step === 'exercises' || step === 'advanced' || step === 'retry';
      if (e.key === 'Enter') {
        // 练习阶段必须先提交答案，不能用 Enter 或方向键跳过题目与掌握门槛。
        if (isExerciseStep) {
          e.preventDefault();
          if (revealed) nextEx();
          return;
        }
        if (curI >= 0 && curI < stages.length - 1) {
          e.preventDefault();
          setStep(stages[curI + 1]);
        }
      } else if (!isExerciseStep && e.key === 'ArrowLeft' && curI > 0) {
        e.preventDefault();
        setStep(stages[curI - 1]);
      } else if (!isExerciseStep && e.key === 'ArrowRight' && curI >= 0 && curI < stages.length - 1) {
        e.preventDefault();
        setStep(stages[curI + 1]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(armTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [step, revealed, lesson, exIdx, activeExercises.length, retryRounds]);

  const stages = stagesOrder(lesson, retryRounds > 0);
  const stageIdx = stages.indexOf(step);

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

      <div className="flex items-end gap-3 sm:gap-4">
        <div className="chapter-num text-5xl sm:text-7xl">{String(lesson.index).padStart(2, '0')}</div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-4xl font-black leading-none tracking-tight text-ink break-words">{lesson.title}</h1>
          <p className="mt-1 text-sm italic text-ink3">{lesson.subtitle}</p>
        </div>
      </div>

      {/* 进度条 */}
      <StepperBar stages={stages} current={stageIdx} />

      {step === 'scene' && (
        <div className="paper-card animate-fade-up">
          <StepHeader icon={<BookOpen size={14} />} en="scene · 场景导入" />
          <p className="mt-3 dropcap text-pretty text-base leading-relaxed text-ink">{lesson.scene}</p>
          <Footer onNext={() => setStep('examples')} nextLabel="看例句" />
        </div>
      )}

      {step === 'examples' && (
        <div className="paper-card animate-fade-up">
          <StepHeader en={`examples · ${lesson.examples.length} sentences`} />
          <ul className="mt-4 space-y-3">
            {lesson.examples.map((ex, i) => (
              <li key={i} className="border-l-2 border-persimmon pl-4">
                <div className="font-display text-lg font-semibold text-ink">{renderHighlight(ex.en, ex.highlight)}</div>
                <div className="mt-0.5 text-sm text-ink3">{ex.zh}</div>
              </li>
            ))}
          </ul>
          <Footer onPrev={() => setStep('scene')} onNext={() => setStep('guess')} nextLabel="猜规律" />
        </div>
      )}

      {step === 'guess' && (
        <div className="paper-card animate-fade-up">
          <StepHeader icon={<Lightbulb size={14} />} en="guess · 自己想一想" />
          <div className="mt-4 rounded-md border-l-4 border-persimmon bg-persimmon-50/40 p-5 text-base leading-relaxed text-ink">
            💡 {lesson.hint}
          </div>
          <p className="mt-3 text-xs text-ink3">想好答案再点"揭晓"——主动思考能记得更牢。</p>
          <Footer onPrev={() => setStep('examples')} onNext={() => setStep('reveal')} nextLabel="揭晓" />
        </div>
      )}

      {step === 'reveal' && (
        <div className="paper-card animate-fade-up">
          <StepHeader en="rule · 规律" />
          <h3 className="mt-3 font-display text-2xl font-bold text-ink text-balance">{lesson.formula.rule}</h3>
          <p className="mt-2 text-sm text-ink2">{lesson.formula.detail}</p>
          {lesson.formula.table && (
            <table className="editorial-table mt-5">
              <thead>
                <tr>
                  {lesson.formula.table.head.map((h, i) => <th key={i}>{h}</th>)}
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
          <Footer
            onPrev={() => setStep('guess')}
            onNext={() => setStep(lesson.mistakes?.length ? 'mistakes' : lesson.usageNotes?.length ? 'usage' : 'exercises')}
            nextLabel={lesson.mistakes?.length ? '常见错误' : lesson.usageNotes?.length ? '用法说明' : '小试身手'}
          />
        </div>
      )}

      {step === 'mistakes' && lesson.mistakes && (
        <div className="paper-card animate-fade-up">
          <StepHeader icon={<AlertTriangle size={14} />} en="common mistakes · 易错对比" />
          <p className="mt-2 text-sm text-ink2">这些错误初学者最容易犯，先看清楚：</p>
          <ul className="mt-4 space-y-3">
            {lesson.mistakes.map((m, i) => (
              <li key={i} className="rounded-md border border-paper3 bg-paper2/40 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="rounded-md border border-crimson/50 bg-crimson-50/60 px-3 py-2 font-mono text-sm text-crimson line-through">
                    {m.wrong}
                  </div>
                  <ArrowRight size={16} className="hidden text-ink3 sm:block" />
                  <div className="rounded-md border border-moss/50 bg-moss-50/60 px-3 py-2 font-mono text-sm text-moss-700">
                    {m.right}
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink3">→ {m.reason}</p>
              </li>
            ))}
          </ul>
          <Footer
            onPrev={() => setStep('reveal')}
            onNext={() => setStep(lesson.usageNotes?.length ? 'usage' : 'exercises')}
            nextLabel={lesson.usageNotes?.length ? '用法说明' : '小试身手'}
          />
        </div>
      )}

      {step === 'usage' && lesson.usageNotes && (
        <div className="paper-card animate-fade-up">
          <StepHeader en="usage · 用法说明" />
          <div className="mt-4 space-y-4">
            {lesson.usageNotes.map((n, i) => (
              <div key={i}>
                <div className="font-display text-base font-bold text-ink">{n.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink2">{n.body}</p>
              </div>
            ))}
          </div>
          <Footer onPrev={() => setStep(lesson.mistakes?.length ? 'mistakes' : 'reveal')} onNext={() => setStep('exercises')} nextLabel="小试身手" />
        </div>
      )}

      {(step === 'exercises' || step === 'advanced' || step === 'retry') && activeExercises.length > 0 && (
        <div className="paper-card animate-fade-up">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
            <span>{phaseLabel(phase)} · {exIdx + 1} / {activeExercises.length}</span>
            <span>{TYPE_LABEL[activeExercises[exIdx].type]} {phase === 'basic' && <>· 首轮目标 ≥ {passingScore}/{exercises.length}</>}</span>
          </div>
          <ExerciseRenderer
            key={`${phase}-${exIdx}`}
            exercise={activeExercises[exIdx]}
            revealed={revealed}
            fallbackExplain={lesson.formula.rule}
            onSubmit={submit}
          />

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
                {exIdx + 1 < activeExercises.length
                  ? <>下一题 <ArrowRight size={16} /></>
                  : phase === 'basic'
                    ? <>查看结果 <ArrowRight size={16} /></>
                    : phase === 'retry'
                      ? <>检查掌握 <CheckCircle2 size={16} /></>
                      : <>完成本节 <Trophy size={16} /></>}
              </button>
            )}
          </div>
          {aiError && <div className="mt-2 font-mono text-[10px] text-crimson">{aiError}</div>}
        </div>
      )}

      {/* 阶段开场提示 */}
      {step === 'retry' && exIdx === 0 && retryExercises.length > 0 && (
        <div className="rounded-md border-l-4 border-crimson bg-crimson-50/40 p-3 text-sm text-crimson animate-fade-up">
          <b>错题回练</b>：上一轮答错了 {retryExercises.length} 题，先把它们再做一遍 ↓
        </div>
      )}
      {step === 'advanced' && exIdx === 0 && advExercises.length > 0 && (
        <div className="rounded-md border-l-4 border-indigo2 bg-indigo2-50/60 p-3 text-sm text-indigo2-700 animate-fade-up">
          <b>进阶应用</b>：基础已掌握，挑战一下综合应用题（含翻译/改错/排序）↓
        </div>
      )}

      {step === 'done' && (
        <div className="paper-card text-center animate-fade-up">
          <Trophy size={40} className="mx-auto mb-2 text-persimmon" />
          <h2 className="font-display text-3xl font-black">本节已掌握</h2>
          {result && (
            <div className="mt-2 space-y-1 text-sm text-ink2">
              <p>基础题首轮 <b className="text-persimmon">{result.firstAttemptScore}/{result.basicTotal}</b></p>
              {result.retryRounds > 0 && <p className="text-moss-700">错题已完成 {result.retryRounds} 轮订正</p>}
              {result.advancedTotal > 0 && <p>进阶题 {result.advancedScore}/{result.advancedTotal}</p>}
            </div>
          )}

          {/* 推荐相关课程 */}
          {lesson.relatedLessons && lesson.relatedLessons.length > 0 && (
            <div className="mt-5 text-left">
              <div className="divider !my-3">related lessons · 相关课程</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {lesson.relatedLessons.map((rid) => {
                  const r = GRAMMAR_LESSONS.find((l) => l.id === rid);
                  if (!r) return null;
                  return (
                    <Link key={rid} to={`/grammar/${rid}`} className="flex items-center gap-3 rounded-md border border-paper3 bg-paper p-3 hover:border-ink">
                      <span className="chapter-num text-3xl">{String(r.index).padStart(2, '0')}</span>
                      <div>
                        <div className="font-display text-base font-bold text-ink">{r.title}</div>
                        <div className="text-xs text-ink3">{r.subtitle}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-center gap-2">
            <Link to="/grammar" className="btn-ghost">返回路线图</Link>
            <button onClick={() => location.reload()} className="btn-ghost">
              <RotateCw size={14} /> 再做一次
            </button>
            {GRAMMAR_LESSONS.find((l) => l.index === lesson.index + 1) && (
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

/* ---------- 辅助 ---------- */
function stagesOrder(lesson: typeof GRAMMAR_LESSONS[0], includeRetry = false): Step[] {
  const list: Step[] = ['scene', 'examples', 'guess', 'reveal'];
  if (lesson.mistakes?.length) list.push('mistakes');
  if (lesson.usageNotes?.length) list.push('usage');
  list.push('exercises');
  if (includeRetry) list.push('retry');
  if (lesson.advancedExercises?.length) list.push('advanced');
  list.push('done');
  return list;
}

function phaseLabel(p: 'basic' | 'advanced' | 'retry') {
  if (p === 'basic') return 'basic exercise · 基础题';
  if (p === 'advanced') return 'advanced · 进阶题';
  return 'retry · 错题回练';
}

const STAGE_LABEL: Record<Step, string> = {
  scene: '场景',
  examples: '例句',
  guess: '猜规律',
  reveal: '公式',
  mistakes: '易错',
  usage: '用法',
  exercises: '基础测验',
  advanced: '进阶',
  retry: '回练',
  done: '完成',
};

function StepperBar({ stages, current }: { stages: Step[]; current: number }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = activeRef.current;
    if (!node) return;
    // 平滑居中
    node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [current]);

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar fade-x flex items-center gap-1.5 overflow-x-auto pb-2"
    >
      {stages.map((s, i) => (
        <Fragment key={s}>
          <div
            ref={i === current ? activeRef : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition',
              i < current && 'border-moss bg-moss-50 text-moss-700',
              i === current && 'border-ink bg-ink text-paper',
              i > current && 'border-paper3 bg-paper text-ink3'
            )}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            <span>{STAGE_LABEL[s]}</span>
            {i < current && <CheckCircle2 size={10} />}
          </div>
          {i < stages.length - 1 && (
            <div className={cn('h-px w-3 shrink-0', i < current ? 'bg-moss' : 'bg-paper3')} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function StepHeader({ icon, en }: { icon?: React.ReactNode; en: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
      {icon}<span>{en}</span>
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
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        {onPrev ? (
          <button onClick={onPrev} className="btn-ghost"><ArrowLeft size={14} /> 上一步</button>
        ) : <span />}
        <button onClick={onNext} className="btn-accent">{nextLabel} <ArrowRight size={16} /></button>
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-paper3/60 pt-3 font-mono text-xs uppercase tracking-[0.2em] text-ink3">
        <kbd className="kbd">←</kbd>
        <kbd className="kbd">→</kbd>
        <span className="text-ink3/70">翻页</span>
        <span className="text-paper3">·</span>
        <kbd className="kbd">↵</kbd>
        <span className="text-ink3/70">下一步</span>
      </div>
    </div>
  );
}

function renderHighlight(text: string, highlights?: string[]) {
  if (!highlights || highlights.length === 0) return text;
  const escaped = highlights.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // 使用 \b 单词边界，避免把 "want" 里的 "a" 也高亮
  const pat = new RegExp(`(\\b(?:${escaped.join('|')})\\b)`, 'gi');
  const parts = text.split(pat);
  return parts.map((p, i) =>
    highlights.some((h) => p.toLowerCase() === h.toLowerCase()) ? (
      <span key={i} className="bg-persimmon-100 px-1 italic text-persimmon-700">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
