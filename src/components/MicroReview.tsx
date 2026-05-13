import { useEffect, useRef, useState } from 'react';
import type { WordRecord } from '@/db/types';
import { QuizCard } from './QuizCard';
import { initSession, nextQuestion, submitAnswer, skipCurrent, type SessionState } from '@/features/learn-session/session';
import { CheckCircle2, Clock, Zap } from 'lucide-react';

interface Props {
  words: WordRecord[];
  /** 倒计时秒数，默认 300 (5min) */
  durationSec?: number;
  onComplete?: () => void;
  onSkip?: () => void;
}

/**
 * 5 分钟微复习：把刚学的词扔进一个限时快闪 session。
 * 艾宾浩斯曲线第一拐点（5min ~ 30min 内）做一次回顾，留存率显著拉高。
 */
export function MicroReview({ words, durationSec = 300, onComplete, onSkip }: Props) {
  const [session, setSession] = useState<SessionState>(() => initSession(words));
  const [remain, setRemain] = useState(durationSec);
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, durationSec - Math.floor((Date.now() - startRef.current) / 1000));
      setRemain(left);
      if (left === 0) { setDone(true); window.clearInterval(id); }
    }, 250);
    return () => window.clearInterval(id);
  }, [durationSec, done]);

  const current = nextQuestion(session);

  if (done || !current || session.queue.length === 0) {
    const passed = session.passed.length;
    const total = words.length;
    return (
      <div className="paper-card animate-fade-up text-center">
        <CheckCircle2 size={36} className="mx-auto mb-3 text-moss" />
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">micro review · complete</div>
        <h3 className="mt-2 font-display text-2xl font-black tracking-tight">5 分钟微复习完成</h3>
        <p className="mt-2 text-sm text-ink2">
          过了 <b className="text-moss-700">{passed}</b> / {total} 词 · 这一遍能显著提升明天的留存率
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={onComplete} className="btn-accent">完成</button>
        </div>
      </div>
    );
  }

  function handleAnswer(value: string, _correct: boolean) {
    const { next } = submitAnswer(session, current!, value);
    if (next.queue.length === 0) {
      setDone(true);
    } else {
      setSession(next);
    }
  }

  function handleSkip() {
    setSession(skipCurrent(session));
  }

  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');
  const pct = (session.passed.length / words.length) * 100;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="rounded-md border border-persimmon/30 bg-persimmon-50/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-persimmon-700">
            <Zap size={12} /> micro review · 5min flash · 艾宾浩斯第一拐点
          </div>
          <div className="flex items-center gap-1 font-mono text-sm font-bold text-persimmon-700">
            <Clock size={12} /> {mm}:{ss}
          </div>
        </div>
        <div className="mt-2 meter-track !h-1">
          <div className="meter-bar bg-persimmon" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-ink3">
          <span>{session.passed.length}/{words.length} passed</span>
          <button onClick={onSkip} className="hover:text-ink">skip ×</button>
        </div>
      </div>
      <QuizCard question={current} onSubmit={handleAnswer} onSkip={handleSkip} />
    </div>
  );
}
