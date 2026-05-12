import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS, type WordRecord } from '@/db/types';
import { useSettings } from '@/stores/settingsStore';
import { wordsRepo } from '@/db/repositories/words';
import { progressRepo } from '@/db/repositories/progress';
import { sessionsRepo } from '@/db/repositories/sessions';
import { initSession, nextQuestion, submitAnswer, skipCurrent, type SessionState } from '@/features/learn-session/session';
import { QuizCard } from '@/components/QuizCard';
import { INITIAL_SRS, nextReviewAt, sm2 } from '@/features/srs/sm2';
import { ArrowRight, Trophy, Volume2, Star, Clock } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn, shuffle } from '@/lib/utils';

type Stage = 'preview' | 'quiz' | 'done';

export function Learn() {
  const navigate = useNavigate();
  const { activeLevel, dailyNewWords, learnOrder, loaded } = useSettings();
  const [stage, setStage] = useState<Stage>('preview');
  const [newWords, setNewWords] = useState<WordRecord[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const startedAtRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const learned = await progressRepo.learnedWordIds(activeLevel);
      if (learnOrder === 'random') {
        const picks: WordRecord[] = [];
        const seen = new Set<number>();
        const total = await wordsRepo.countByLevel(activeLevel);
        const maxTries = Math.min(dailyNewWords * 50, total);
        for (let i = 0; i < maxTries && picks.length < dailyNewWords; i++) {
          const idx = Math.floor(Math.random() * total);
          if (seen.has(idx)) continue;
          seen.add(idx);
          const arr = await wordsRepo.byLevel(activeLevel, 1, idx);
          const w = arr[0];
          if (w?.id !== undefined && !learned.has(w.id)) picks.push(w);
        }
        setNewWords(shuffle(picks));
      } else {
        const candidates = await wordsRepo.byLevel(activeLevel, dailyNewWords * 4, 0);
        const remaining: WordRecord[] = [];
        for (const w of candidates) {
          if (w.id !== undefined && !learned.has(w.id)) remaining.push(w);
          if (remaining.length >= dailyNewWords) break;
        }
        if (remaining.length < dailyNewWords) {
          const more = await wordsRepo.byLevel(activeLevel, dailyNewWords * 8, dailyNewWords * 4);
          for (const w of more) {
            if (w.id !== undefined && !learned.has(w.id)) remaining.push(w);
            if (remaining.length >= dailyNewWords) break;
          }
        }
        setNewWords(remaining);
      }
    })();
  }, [loaded, activeLevel, dailyNewWords, learnOrder]);

  // 预览自动朗读
  useEffect(() => {
    if (stage !== 'preview' || newWords.length === 0) return;
    const t = setTimeout(() => speak(newWords[previewIdx].word), 250);
    return () => clearTimeout(t);
  }, [stage, previewIdx, newWords]);

  // 预览键盘
  useEffect(() => {
    if (stage !== 'preview') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (previewIdx < newWords.length - 1) setPreviewIdx((i) => i + 1);
        else startQuiz();
      } else if (e.key === 'ArrowLeft') {
        setPreviewIdx((i) => Math.max(0, i - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        speak(newWords[previewIdx].word);
      } else if (e.key.toLowerCase() === 's') {
        toggleStar(newWords[previewIdx]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, previewIdx, newWords]);

  // 计时
  useEffect(() => {
    if (stage !== 'quiz') return;
    if (startedAtRef.current === 0) startedAtRef.current = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 1000);
    return () => clearInterval(t);
  }, [stage]);

  const currentQuestion = useMemo(() => (session ? nextQuestion(session) : null), [session]);

  function startQuiz() {
    setSession(initSession(newWords));
    startedAtRef.current = Date.now();
    setStage('quiz');
  }

  async function toggleStar(w: WordRecord) {
    if (w.id === undefined) return;
    // 先确保 progress 行存在
    let r = await progressRepo.getByWordId(w.id);
    if (!r) {
      await progressRepo.upsert({
        wordId: w.id,
        levelId: w.levelId,
        status: 'new',
        interval: 0,
        easeFactor: INITIAL_SRS.easeFactor,
        repetitions: 0,
        lastReviewAt: 0,
        nextReviewAt: 0,
      });
    }
    const next = await progressRepo.toggleStar(w.id);
    const set = new Set(starredIds);
    if (next) set.add(w.id);
    else set.delete(w.id);
    setStarredIds(set);
  }

  async function handleAnswer(_answer: string, correct: boolean) {
    if (!session || !currentQuestion) return;
    // 答错立即写错题计数（用于错题本）
    if (!correct && currentQuestion.word.id !== undefined) {
      await progressRepo.markWrong(currentQuestion.word.id, currentQuestion.word.levelId);
    }
    const { next } = submitAnswer(session, currentQuestion, _answer);
    if (next.queue.length === 0) {
      const now = Date.now();
      for (const w of newWords) {
        if (w.id === undefined) continue;
        const wrong = next.wrongIds.has(w.id);
        const state = sm2(wrong ? 3 : 4, INITIAL_SRS);
        const prev = await progressRepo.getByWordId(w.id);
        await progressRepo.upsert({
          ...(prev ?? {}),
          wordId: w.id,
          levelId: w.levelId,
          status: 'learning',
          interval: state.interval,
          easeFactor: state.easeFactor,
          repetitions: state.repetitions,
          lastReviewAt: now,
          nextReviewAt: nextReviewAt(state, now),
        });
      }
      await sessionsRepo.log({
        type: 'learn',
        wordsCount: newWords.length,
        correctCount: next.correctAttempts,
        durationMs: Date.now() - startedAtRef.current,
      });
      setSession(next);
      setStage('done');
    } else {
      setSession(next);
    }
  }

  function handleSkip() {
    if (!session) return;
    setSession(skipCurrent(session));
  }

  async function handleStarCurrent() {
    if (!currentQuestion) return;
    await toggleStar(currentQuestion.word);
  }

  if (!loaded) return null;

  if (newWords.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper-card text-center">
          <Trophy size={36} className="mx-auto mb-3 text-persimmon" />
          <h2 className="font-display text-2xl font-black">{LEVELS.find((l) => l.id === activeLevel)?.name} 词库已学完</h2>
          <p className="mt-2 text-sm text-ink2">去复习页巩固，或在设置切换词库 / 改为乱序模式。</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => navigate('/review')} className="btn-accent">前往复习</button>
            <button onClick={() => navigate('/settings')} className="btn-ghost">设置</button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'preview') {
    const w = newWords[previewIdx];
    const pct = ((previewIdx + 1) / newWords.length) * 100;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Header chapter="01" en="Acquire" zh="新词预览" />
        <ProgressLine label={learnOrder === 'random' ? 'shuffle mode' : 'sequential'} sub={`${LEVELS.find((l) => l.id === activeLevel)?.name}`} pct={pct} index={previewIdx + 1} total={newWords.length} />

        <div className="paper-card animate-fade-up">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h3 className="font-display text-5xl font-black tracking-tight text-ink">{w.word}</h3>
              <button onClick={() => speak(w.word)} className="btn-icon" title="朗读 (Space)">
                <Volume2 size={14} />
              </button>
            </div>
            <button
              onClick={() => toggleStar(w)}
              className={cn('btn-icon', w.id !== undefined && starredIds.has(w.id) && 'border-persimmon text-persimmon')}
              title="标记难词 (S)"
            >
              <Star size={14} className={cn(w.id !== undefined && starredIds.has(w.id) && 'fill-persimmon')} />
            </button>
          </div>
          <div className="mt-5 space-y-2 border-t border-paper3 pt-4">
            {w.translations.map((t, i) => (
              <div key={i} className="flex items-baseline gap-2 text-base">
                <span className="tag">{t.type || '—'}</span>
                <span className="text-ink">{t.translation}</span>
              </div>
            ))}
          </div>
          {w.phrases.length > 0 && (
            <div className="mt-5">
              <div className="divider !my-3">phrases</div>
              <ul className="space-y-1.5 text-sm">
                {w.phrases.slice(0, 3).map((p, i) => (
                  <li key={i}>
                    <span className="font-mono font-semibold text-ink">{p.phrase}</span>
                    <span className="text-ink3"> — {p.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))} disabled={previewIdx === 0} className="btn-ghost">
            ← 上一个
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">
            ← → 翻页 · space 朗读 · s 收藏 · ↵ 下一个/开始
          </span>
          {previewIdx < newWords.length - 1 ? (
            <button onClick={() => setPreviewIdx((i) => i + 1)} className="btn-primary">
              下一个 →
            </button>
          ) : (
            <button onClick={startQuiz} className="btn-accent">
              开始练习 <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'quiz' && currentQuestion) {
    const total = newWords.length;
    const passed = session?.passed.length ?? 0;
    const pct = (passed / total) * 100;
    const isStarred = currentQuestion.word.id !== undefined && starredIds.has(currentQuestion.word.id);
    return (
      <div className="space-y-5">
        <Header chapter="01" en="Quiz" zh="练习" />
        <ProgressLine
          label={`accuracy ${session && session.totalAttempts > 0 ? Math.round((session.correctAttempts / session.totalAttempts) * 100) : 0}%`}
          sub={`${fmtElapsed(elapsed)}`}
          pct={pct}
          index={passed}
          total={total}
          icon={<Clock size={11} />}
        />
        <QuizCard
          question={currentQuestion}
          onSubmit={handleAnswer}
          onSkip={handleSkip}
          onToggleStar={handleStarCurrent}
          starred={isStarred}
        />
      </div>
    );
  }

  // done
  const accuracy = session && session.totalAttempts > 0 ? Math.round((session.correctAttempts / session.totalAttempts) * 100) : 0;
  const wrongCount = session?.wrongIds.size ?? 0;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="paper-card text-center">
        <Trophy size={40} className="mx-auto mb-3 text-persimmon" />
        <h2 className="font-display text-3xl font-black tracking-tight">今天的功课完成了。</h2>
        <p className="mt-2 text-sm text-ink2">
          新学 <b className="text-persimmon">{newWords.length}</b> 词 · 准确率 <b>{accuracy}%</b> · 用时 <b className="font-mono">{fmtElapsed(elapsed)}</b>
        </p>
        {wrongCount > 0 && (
          <div className="mx-auto mt-4 max-w-md rounded-md border border-crimson/40 bg-crimson-50/40 p-3 text-sm text-crimson">
            其中 <b>{wrongCount}</b> 个词曾答错。
            <button onClick={() => navigate('/mistakes')} className="linky ml-1 font-semibold">去错题本重练 →</button>
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => navigate('/')} className="btn-ghost">回首页</button>
          <button onClick={() => location.reload()} className="btn-accent">再来一组</button>
        </div>
      </div>
    </div>
  );
}

function Header({ chapter, en, zh }: { chapter: string; en: string; zh: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter {chapter} · {en}</div>
      <h1 className="mt-1 font-display text-3xl font-black tracking-tight md:text-4xl">{zh}</h1>
    </div>
  );
}

function ProgressLine({ label, sub, pct, index, total, icon }: { label: string; sub: string; pct: number; index: number; total: number; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink3">
        <span>{label}</span>
        <span className="flex items-center gap-1">{icon}{sub} · {index}/{total}</span>
      </div>
      <div className="meter-track">
        <div className="meter-bar bg-persimmon" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
