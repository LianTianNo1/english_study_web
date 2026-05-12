import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS, type WordRecord } from '@/db/types';
import { useSettings } from '@/stores/settingsStore';
import { wordsRepo } from '@/db/repositories/words';
import { progressRepo } from '@/db/repositories/progress';
import { sessionsRepo } from '@/db/repositories/sessions';
import { initSession, nextQuestion, submitAnswer, type SessionState } from '@/features/learn-session/session';
import { QuizCard } from '@/components/QuizCard';
import { INITIAL_SRS, nextReviewAt, sm2 } from '@/features/srs/sm2';
import { ArrowRight, Trophy, Volume2 } from 'lucide-react';
import { speak } from '@/lib/tts';
import { shuffle } from '@/lib/utils';

type Stage = 'preview' | 'quiz' | 'done';

export function Learn() {
  const navigate = useNavigate();
  const { activeLevel, dailyNewWords, learnOrder, loaded } = useSettings();
  const [stage, setStage] = useState<Stage>('preview');
  const [newWords, setNewWords] = useState<WordRecord[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const learned = await progressRepo.learnedWordIds(activeLevel);
      if (learnOrder === 'random') {
        // 随机模式：从全词库随机抽取未学过的词
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
        // 顺序模式：按 orderIndex
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

  const currentQuestion = useMemo(() => (session ? nextQuestion(session) : null), [session]);

  function startQuiz() {
    setSession(initSession(newWords));
    setStartTime(Date.now());
    setStage('quiz');
  }

  async function handleAnswer(answer: string) {
    if (!session || !currentQuestion) return;
    const { next } = submitAnswer(session, currentQuestion, answer);
    if (next.queue.length === 0) {
      const now = Date.now();
      for (const w of newWords) {
        if (w.id === undefined) continue;
        const wrong = next.wrongIds.has(w.id);
        const state = sm2(wrong ? 3 : 4, INITIAL_SRS);
        await progressRepo.upsert({
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
        durationMs: Date.now() - startTime,
      });
      setSession(next);
      setStage('done');
    } else {
      setSession(next);
    }
  }

  if (!loaded) return null;

  if (newWords.length === 0) {
    return (
      <Empty
        title={`${LEVELS.find((l) => l.id === activeLevel)?.name} 词库已学完`}
        sub="去复习页巩固，或在设置中切换其他词库 / 改为乱序模式抽测掌握程度。"
        actions={[
          { label: '前往复习', to: '/review', primary: true },
          { label: '设置', to: '/settings' },
        ]}
      />
    );
  }

  if (stage === 'preview') {
    const w = newWords[previewIdx];
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Header chapter="01" en="Acquire" zh="新词预览" />
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          <span>{learnOrder === 'random' ? 'shuffle mode' : 'sequential'} · {LEVELS.find((l) => l.id === activeLevel)?.name}</span>
          <span>{previewIdx + 1} / {newWords.length}</span>
        </div>

        <div className="paper-card animate-fade-up">
          <div className="flex items-baseline gap-3">
            <h3 className="font-display text-5xl font-black tracking-tight text-ink">{w.word}</h3>
            <button onClick={() => speak(w.word)} className="btn-icon">
              <Volume2 size={14} />
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
            上一个
          </button>
          {previewIdx < newWords.length - 1 ? (
            <button onClick={() => setPreviewIdx((i) => i + 1)} className="btn-primary">
              下一个 <ArrowRight size={16} />
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
    return (
      <div className="space-y-5">
        <Header chapter="01" en="Quiz" zh="练习" />
        <div className="mx-auto flex max-w-2xl items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          <span>passed · {session?.passed.length ?? 0} / {newWords.length}</span>
          <span>accuracy · {session && session.totalAttempts > 0 ? Math.round((session.correctAttempts / session.totalAttempts) * 100) : 0}%</span>
        </div>
        <QuizCard question={currentQuestion} onSubmit={handleAnswer} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="paper-card text-center">
        <Trophy size={40} className="mx-auto mb-3 text-persimmon" />
        <h2 className="font-display text-3xl font-black tracking-tight">今天的功课完成了。</h2>
        <p className="mt-2 text-sm text-ink2">
          新学 <b className="text-persimmon">{newWords.length}</b> 词 · 准确率{' '}
          <b>{session && session.totalAttempts > 0 ? Math.round((session.correctAttempts / session.totalAttempts) * 100) : 0}%</b>
        </p>
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

function Empty({ title, sub, actions }: { title: string; sub: string; actions: { label: string; to: string; primary?: boolean }[] }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl">
      <div className="paper-card text-center">
        <Trophy size={36} className="mx-auto mb-3 text-persimmon" />
        <h2 className="font-display text-2xl font-black">{title}</h2>
        <p className="mt-2 text-sm text-ink2">{sub}</p>
        <div className="mt-5 flex justify-center gap-2">
          {actions.map((a) => (
            <button key={a.to} onClick={() => navigate(a.to)} className={a.primary ? 'btn-accent' : 'btn-ghost'}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
