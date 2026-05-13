import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgressRecord, WordRecord } from '@/db/types';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import { sessionsRepo } from '@/db/repositories/sessions';
import { QuizCard } from '@/components/QuizCard';
import { initSession, nextQuestion, submitAnswer, skipCurrent, type SessionState } from '@/features/learn-session/session';
import { INITIAL_SRS, scheduleNext, nextReviewAtFor } from '@/features/srs';
import { useSettings } from '@/stores/settingsStore';
import { ArrowRight, RotateCw, Star, Trophy, Volume2 } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';
import { LEVELS } from '@/db/types';

type Tab = 'wrong' | 'starred';
type Stage = 'list' | 'practice' | 'done';

interface Item {
  progress: ProgressRecord;
  word: WordRecord;
}

export function Mistakes() {
  const navigate = useNavigate();
  const reviewAlgorithm = useSettings((s) => s.reviewAlgorithm);
  const [tab, setTab] = useState<Tab>('wrong');
  const [items, setItems] = useState<Item[]>([]);
  const [stage, setStage] = useState<Stage>('list');
  const [session, setSession] = useState<SessionState | null>(null);
  const startedAt = useRef(0);

  async function reload(currentTab: Tab) {
    const recs = currentTab === 'wrong' ? await progressRepo.wrongWords(200) : await progressRepo.starredWords();
    const out: Item[] = [];
    for (const p of recs) {
      const w = await wordsRepo.getById(p.wordId);
      if (w) out.push({ progress: p, word: w });
    }
    setItems(out);
  }

  useEffect(() => {
    reload(tab);
  }, [tab]);

  const currentQuestion = useMemo(() => (session ? nextQuestion(session) : null), [session]);

  function startPractice() {
    if (items.length === 0) return;
    setSession(initSession(items.map((i) => i.word)));
    startedAt.current = Date.now();
    setStage('practice');
  }

  async function handleAnswer(_a: string, correct: boolean) {
    if (!session || !currentQuestion) return;
    if (!correct && currentQuestion.word.id !== undefined) {
      await progressRepo.markWrong(currentQuestion.word.id, currentQuestion.word.levelId);
    }
    const { next } = submitAnswer(session, currentQuestion, _a);
    if (next.queue.length === 0) {
      // 在错题本通过的词推进 SRS（视为复习成功）
      const now = Date.now();
      for (const it of items) {
        if (it.word.id === undefined) continue;
        const wrong = next.wrongIds.has(it.word.id);
        if (wrong) continue; // 错题本里再次答错的不算掌握，保留状态
        const prev = it.progress;
        const ns = scheduleNext(4, {
          repetitions: prev.repetitions,
          interval: prev.interval || 1,
          easeFactor: prev.easeFactor || INITIAL_SRS.easeFactor,
        }, reviewAlgorithm);
        await progressRepo.upsert({
          ...prev,
          interval: ns.interval,
          easeFactor: ns.easeFactor,
          repetitions: ns.repetitions,
          status: prev.status === 'mastered' ? 'mastered' : 'review',
          lastReviewAt: now,
          nextReviewAt: nextReviewAtFor(ns, reviewAlgorithm, now),
        });
      }
      await sessionsRepo.log({
        type: 'review',
        wordsCount: items.length,
        correctCount: next.correctAttempts,
        durationMs: Date.now() - startedAt.current,
      });
      setSession(next);
      setStage('done');
    } else {
      setSession(next);
    }
  }

  async function toggleStar(w: WordRecord) {
    if (w.id === undefined) return;
    await progressRepo.toggleStar(w.id);
    reload(tab);
  }

  if (stage === 'practice' && currentQuestion) {
    const passed = session?.passed.length ?? 0;
    const pct = (passed / items.length) * 100;
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-black tracking-tight">
          {tab === 'wrong' ? '错题重练' : '难词专攻'}
        </h1>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink3">
            <span>focus session</span>
            <span>{passed}/{items.length}</span>
          </div>
          <div className="meter-track">
            <div className="meter-bar bg-persimmon" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <QuizCard question={currentQuestion} onSubmit={handleAnswer} onSkip={() => session && setSession(skipCurrent(session))} />
      </div>
    );
  }

  if (stage === 'done') {
    const acc = session && session.totalAttempts > 0 ? Math.round((session.correctAttempts / session.totalAttempts) * 100) : 0;
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper-card text-center">
          <Trophy size={40} className="mx-auto mb-3 text-persimmon" />
          <h2 className="font-display text-3xl font-black">专攻完成</h2>
          <p className="mt-2 text-sm text-ink2">准确率 <b>{acc}%</b></p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => { setStage('list'); reload(tab); }} className="btn-ghost">返回列表</button>
            <button onClick={() => navigate('/')} className="btn-accent">回首页</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 02b · focus</div>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
          The <span className="italic text-crimson">Mistakes</span>
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-ink2">
          答错过的词和你主动收藏的难词，专门关进这一页。集中突破比泛泛复习更高效。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TabBtn active={tab === 'wrong'} onClick={() => setTab('wrong')} label="错题本" count={tab === 'wrong' ? items.length : null} />
        <TabBtn active={tab === 'starred'} onClick={() => setTab('starred')} label="难词收藏" count={tab === 'starred' ? items.length : null} />
        <div className="w-full sm:ml-auto sm:w-auto">
          {items.length > 0 && (
            <button onClick={startPractice} className="btn-accent w-full sm:w-auto">
              <RotateCw size={14} /> 开始专攻（{items.length}）
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="paper-card text-center">
          <p className="text-sm text-ink2">
            {tab === 'wrong' ? '还没有错题。在学习/复习页答错的词会出现在这里。' : '还没有收藏的难词。在学习页点 ★ 按钮即可加入。'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {items.map(({ progress, word }) => {
            const lvlName = LEVELS.find((l) => l.id === word.levelId)?.name;
            return (
              <li key={word.id} className="flex w-full items-center gap-2 overflow-hidden rounded-md border border-paper3 bg-paper p-3 sm:gap-4 sm:p-4">
                <button onClick={() => speak(word.word)} className="btn-icon !h-8 !w-8 shrink-0 sm:!h-9 sm:!w-9">
                  <Volume2 size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-display text-lg font-bold text-ink break-all sm:text-xl">{word.word}</span>
                    <span className="tag">{lvlName}</span>
                    {tab === 'wrong' && (
                      <span className="font-mono text-[10px] text-crimson sm:hidden">×{progress.wrongCount ?? 0}</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-ink3 sm:text-sm">
                    {word.translations.map((t) => `${t.type || '—'} ${t.translation}`).join(' · ')}
                  </div>
                </div>
                {tab === 'wrong' && (
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-ink3">wrong</div>
                    <div className="font-display text-lg font-bold text-crimson">{progress.wrongCount ?? 0}</div>
                  </div>
                )}
                <button
                  onClick={() => toggleStar(word)}
                  className={cn('btn-icon !h-8 !w-8 shrink-0 sm:!h-9 sm:!w-9', progress.starred && 'border-persimmon text-persimmon')}
                  title="收藏/取消"
                >
                  <Star size={14} className={cn(progress.starred && 'fill-persimmon')} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number | null }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-sm border px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition',
        active ? 'border-ink bg-ink text-paper' : 'border-paper3 text-ink2 hover:border-ink'
      )}
    >
      {label}{count !== null && ` · ${count}`}
    </button>
  );
}
