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
import { ArrowRight, Trophy, Volume2, Star, Clock, Lightbulb, Loader2, AlertCircle } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn, shuffle } from '@/lib/utils';
import { mnemonicsRepo } from '@/db/repositories/mnemonics';
import { batchGenerateMnemonics } from '@/lib/ai';
import { MnemonicHint } from '@/components/MnemonicHint';
import type { MnemonicRecord } from '@/db/types';

type Stage = 'preview' | 'quiz' | 'done';

export function Learn() {
  const navigate = useNavigate();
  const { activeLevel, dailyNewWords, learnOrder, ai, loaded } = useSettings();
  const [stage, setStage] = useState<Stage>('preview');
  const [newWords, setNewWords] = useState<WordRecord[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const startedAtRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [mnemonics, setMnemonics] = useState<Map<number, MnemonicRecord>>(new Map());
  const [aiBatching, setAiBatching] = useState(false);
  const [aiBatchError, setAiBatchError] = useState('');
  const [aiBatchProgress, setAiBatchProgress] = useState({ done: 0, total: 0 });

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

  // 词组确定后，加载已缓存的巧记
  useEffect(() => {
    if (newWords.length === 0) {
      setMnemonics(new Map());
      return;
    }
    const ids = newWords.map((w) => w.id!).filter((x) => x !== undefined);
    mnemonicsRepo.getMany(ids).then(setMnemonics);
  }, [newWords]);

  async function batchAiMnemonics() {
    if (aiBatching) return;
    if (!ai.enabled || !ai.apiKey) {
      setAiBatchError('请先在设置启用 AI 助手并填入 API Key');
      return;
    }
    setAiBatchError('');
    setAiBatching(true);
    try {
      // 只为还没有缓存的词生成
      const todo = newWords.filter((w) => w.id !== undefined && !mnemonics.has(w.id!));
      if (todo.length === 0) {
        setAiBatching(false);
        return;
      }
      const batchSize = Math.max(5, Math.min(50, ai.mnemonicBatchSize ?? 20));
      setAiBatchProgress({ done: 0, total: todo.length });
      const accum = new Map(mnemonics);
      for (let i = 0; i < todo.length; i += batchSize) {
        const chunk = todo.slice(i, i + batchSize);
        const items = await batchGenerateMnemonics(
          chunk.map((w) => ({
            word: w.word,
            translations: w.translations.map((t) => t.translation).join('；'),
          })),
          ai
        );
        // 按顺序匹配（AI 已被指示保持顺序）
        const now = Date.now();
        const recs: MnemonicRecord[] = [];
        chunk.forEach((w, idx) => {
          const m = items[idx];
          if (!m || !w.id) return;
          const rec: MnemonicRecord = {
            wordId: w.id,
            word: w.word,
            tip: m.tip,
            detail: m.detail,
            createdAt: now,
            model: ai.model,
          };
          recs.push(rec);
          accum.set(w.id, rec);
        });
        await mnemonicsRepo.putMany(recs);
        setMnemonics(new Map(accum));
        setAiBatchProgress({ done: Math.min(i + batchSize, todo.length), total: todo.length });
      }
    } catch (e) {
      setAiBatchError((e as Error).message);
    } finally {
      setAiBatching(false);
    }
  }

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
    // 注意：此时 progress 行尚未创建，wrongCount 写入会丢失。
    // 真正的错题累计在会话结束时根据 next.wrongIds 一次性写入。
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
          // ⭐ 关键修复：错题计数累加，从未学过的词起始为 0
          wrongCount: (prev?.wrongCount ?? 0) + (wrong ? 1 : 0),
          lastWrongAt: wrong ? now : (prev?.lastWrongAt ?? 0),
          starred: prev?.starred ?? false,
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
    const wordMnemonic = w.id !== undefined ? mnemonics.get(w.id) : undefined;
    const aiCoveredCount = newWords.filter((x) => x.id !== undefined && mnemonics.has(x.id)).length;
    const aiAvailable = ai.enabled && !!ai.apiKey;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Header chapter="01" en="Acquire" zh="新词预览" />
        <ProgressLine label={learnOrder === 'random' ? 'shuffle mode' : 'sequential'} sub={`${LEVELS.find((l) => l.id === activeLevel)?.name}`} pct={pct} index={previewIdx + 1} total={newWords.length} />

        {/* AI 巧记批量条 */}
        <div className={cn(
          'flex items-center gap-3 rounded-md border p-3',
          aiCoveredCount === newWords.length && aiCoveredCount > 0
            ? 'border-moss/30 bg-moss-50/40'
            : 'border-persimmon/30 bg-persimmon-50/30'
        )}>
          <div className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-md',
            aiCoveredCount === newWords.length && aiCoveredCount > 0
              ? 'bg-moss text-paper'
              : 'bg-persimmon text-paper'
          )}>
            <Lightbulb size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold text-ink">
              {aiCoveredCount === 0 ? 'AI 巧记预学' : aiCoveredCount === newWords.length ? '巧记已就绪 ✓' : `已生成 ${aiCoveredCount} / ${newWords.length}`}
            </div>
            <div className="mt-0.5 text-xs text-ink3">
              {aiCoveredCount === 0
                ? '为本组单词批量生成口诀和记忆方法，练习时可悬浮提示'
                : aiCoveredCount === newWords.length
                ? '练习时每张卡的右上角 💡 按钮即可唤出'
                : aiBatching
                ? `正在生成 ${aiBatchProgress.done}/${aiBatchProgress.total}…`
                : '点击右侧"补齐"为剩余单词生成'}
            </div>
            {aiBatching && (
              <div className="mt-2 meter-track !h-1">
                <div
                  className="meter-bar bg-persimmon"
                  style={{ width: `${aiBatchProgress.total === 0 ? 0 : (aiBatchProgress.done / aiBatchProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
          {aiCoveredCount < newWords.length && (
            <button
              onClick={batchAiMnemonics}
              disabled={aiBatching || !aiAvailable}
              className="btn-accent shrink-0"
              title={!aiAvailable ? '请先在设置启用 AI' : undefined}
            >
              {aiBatching ? <><Loader2 size={14} className="animate-spin" /> 生成中</> : aiCoveredCount === 0 ? <><Lightbulb size={14} /> 一键生成</> : <>补齐 {newWords.length - aiCoveredCount}</>}
            </button>
          )}
        </div>
        {aiBatchError && (
          <div className="flex items-start gap-2 rounded-md border border-crimson bg-crimson-50 p-3 text-sm text-crimson">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{aiBatchError}</span>
          </div>
        )}

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
          {wordMnemonic && (
            <div className="mt-5">
              <MnemonicHint mnemonic={wordMnemonic} variant="inline" />
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
          mnemonic={currentQuestion.word.id !== undefined ? mnemonics.get(currentQuestion.word.id) : undefined}
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
