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
import { ChevronRight, Sparkles, Trophy, Volume2 } from 'lucide-react';
import { speak } from '@/lib/tts';

type Stage = 'preview' | 'quiz' | 'done';

export function Learn() {
  const navigate = useNavigate();
  const { activeLevel, dailyNewWords, load, loaded } = useSettings();
  const [stage, setStage] = useState<Stage>('preview');
  const [newWords, setNewWords] = useState<WordRecord[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const learned = await progressRepo.learnedWordIds(activeLevel);
      // 按顺序取还没学过的前 N 个
      const candidates = await wordsRepo.byLevel(activeLevel, dailyNewWords * 4, 0);
      const remaining: WordRecord[] = [];
      for (const w of candidates) {
        if (w.id !== undefined && !learned.has(w.id)) remaining.push(w);
        if (remaining.length >= dailyNewWords) break;
      }
      // 若前 N*4 不够，继续顺延翻页
      if (remaining.length < dailyNewWords) {
        const more = await wordsRepo.byLevel(activeLevel, dailyNewWords * 8, dailyNewWords * 4);
        for (const w of more) {
          if (w.id !== undefined && !learned.has(w.id)) remaining.push(w);
          if (remaining.length >= dailyNewWords) break;
        }
      }
      setNewWords(remaining);
    })();
  }, [loaded, activeLevel, dailyNewWords]);

  const currentQuestion = useMemo(() => (session ? nextQuestion(session) : null), [session]);

  function startQuiz() {
    setSession(initSession(newWords));
    setStartTime(Date.now());
    setStage('quiz');
  }

  async function handleAnswer(answer: string, correct: boolean) {
    if (!session || !currentQuestion) return;
    const { next } = submitAnswer(session, currentQuestion, answer);
    if (next.queue.length === 0) {
      // 写入 SRS：成功通过的所有词进入复习池
      const now = Date.now();
      for (const w of newWords) {
        if (w.id === undefined) continue;
        const wrong = next.wrongIds.has(w.id);
        const q = wrong ? 3 : 4;
        const state = sm2(q, INITIAL_SRS);
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
      <div className="card mx-auto max-w-xl text-center">
        <Trophy size={36} className="mx-auto mb-3 text-warm-500" />
        <h2 className="text-xl font-bold">{LEVELS.find((l) => l.id === activeLevel)?.name} 词库已学完！</h2>
        <p className="mt-2 text-sm text-ink-500">去复习页巩固已学单词，或在设置里切换词库。</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => navigate('/review')} className="btn-primary">前往复习</button>
          <button onClick={() => navigate('/settings')} className="btn-secondary">切换词库</button>
        </div>
      </div>
    );
  }

  if (stage === 'preview') {
    const w = newWords[previewIdx];
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">预览今日新词</h2>
          <div className="text-sm text-ink-500">
            {previewIdx + 1} / {newWords.length}
          </div>
        </div>
        <div className="card animate-fade-in text-center">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-4xl font-extrabold tracking-tight text-ink-800">{w.word}</h3>
            <button
              onClick={() => speak(w.word)}
              className="grid h-9 w-9 place-items-center rounded-full bg-cream-100 text-ink-600 hover:bg-warm-100 hover:text-warm-600"
            >
              <Volume2 size={16} />
            </button>
          </div>
          <div className="mt-4 space-y-1.5 text-left">
            {w.translations.map((t, i) => (
              <div key={i} className="text-sm">
                <span className="tag mr-2">{t.type || '—'}</span>
                <span className="text-ink-700">{t.translation}</span>
              </div>
            ))}
          </div>
          {w.phrases.length > 0 && (
            <div className="mt-5 border-t border-cream-200 pt-4 text-left">
              <div className="label mb-2 text-xs uppercase tracking-wider text-ink-400">常用搭配</div>
              <ul className="space-y-1 text-sm">
                {w.phrases.slice(0, 3).map((p, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink-800">{p.phrase}</span>{' '}
                    <span className="text-ink-500">— {p.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
            disabled={previewIdx === 0}
            className="btn-secondary"
          >
            上一个
          </button>
          {previewIdx < newWords.length - 1 ? (
            <button onClick={() => setPreviewIdx((i) => i + 1)} className="btn-primary">
              下一个 <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={startQuiz} className="btn-primary">
              <Sparkles size={16} /> 开始练习
            </button>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'quiz' && currentQuestion) {
    return (
      <div className="space-y-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between text-sm text-ink-500">
          <span>已掌握 {session?.passed.length ?? 0} / {newWords.length}</span>
          <span>正确率 {session && session.totalAttempts > 0 ? Math.round((session.correctAttempts / session.totalAttempts) * 100) : 0}%</span>
        </div>
        <QuizCard question={currentQuestion} onSubmit={handleAnswer} />
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-xl text-center animate-fade-in">
      <Trophy size={40} className="mx-auto mb-3 text-warm-500" />
      <h2 className="text-2xl font-bold">今日学习完成！</h2>
      <p className="mt-2 text-sm text-ink-500">
        新学 <b className="text-warm-600">{newWords.length}</b> 词 · 正确率{' '}
        <b>{session && session.totalAttempts > 0 ? Math.round((session.correctAttempts / session.totalAttempts) * 100) : 0}%</b>
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={() => navigate('/')} className="btn-secondary">回首页</button>
        <button onClick={() => location.reload()} className="btn-primary">再来一组</button>
      </div>
    </div>
  );
}
