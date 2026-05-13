import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RotateCw, Trophy, Volume2 } from 'lucide-react';
import type { WordRecord } from '@/db/types';
import { wordsRepo } from '@/db/repositories/words';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';

interface Props {
  /** 本组涉及到的所有词 */
  words: WordRecord[];
  /** 本组中至少错过一次的 wordId 集合 */
  wrongIds: Set<number>;
  accuracy: number;
  elapsedLabel?: string;
  title?: string;       // 大标题
  subtitle?: string;
  /** 用户点"立即重练错的 N 个"时的回调；不传则不显示该按钮 */
  onRetryWrong?: (wrongWords: WordRecord[]) => void;
  /** 自定义底部按钮：通常是"回首页 / 再来一组" */
  children?: React.ReactNode;
}

/**
 * 通用"会话即时小报"——挂在 Learn done / Review done / Listening done 之后：
 *  - KPI（准确率 / 用时 / 错词数）
 *  - 错词列表（含朗读 + 翻译）
 *  - "立即重练这 N 个" 按钮（比绕到错题本门槛低）
 *  - 自定义底部 actions
 */
export function SessionWrap({ words, wrongIds, accuracy, elapsedLabel, title = '本组完成', subtitle, onRetryWrong, children }: Props) {
  const wrongWords = words.filter((w) => w.id !== undefined && wrongIds.has(w.id));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="paper-card text-center">
        <Trophy size={40} className="mx-auto mb-3 text-persimmon" />
        <h2 className="font-display text-3xl font-black tracking-tight">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-ink2">{subtitle}</p>}
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-paper3 bg-paper3">
          <Kpi label="words" v={words.length} />
          <Kpi label="accuracy" v={`${accuracy}%`} tone={accuracy >= 80 ? 'mint' : accuracy >= 60 ? 'amber' : 'red'} />
          <Kpi label="missed" v={wrongWords.length} tone={wrongWords.length === 0 ? 'mint' : 'red'} />
        </div>
        {elapsedLabel && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-ink3">
            用时 · <b className="font-display text-ink">{elapsedLabel}</b>
          </p>
        )}
      </div>

      {wrongWords.length > 0 && (
        <div className="paper-card">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-crimson">
            <AlertCircle size={12} /> missed · 本组没记牢的 {wrongWords.length} 个词
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {wrongWords.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-md border border-paper3 bg-paper p-2.5">
                <button onClick={() => speak(w.word)} className="btn-icon !h-8 !w-8 shrink-0" title="朗读">
                  <Volume2 size={12} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold text-ink truncate">{w.word}</div>
                  <div className="truncate text-xs text-ink3">{w.translations[0]?.translation}</div>
                </div>
              </li>
            ))}
          </ul>
          {onRetryWrong && (
            <button
              onClick={() => onRetryWrong(wrongWords)}
              className="btn-accent mt-4 w-full justify-center sm:w-auto"
            >
              <RotateCw size={14} /> 立即重练这 {wrongWords.length} 个
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {children}
      </div>
    </div>
  );
}

function Kpi({ label, v, tone }: { label: string; v: string | number; tone?: 'mint' | 'amber' | 'red' }) {
  const cls = tone === 'mint' ? 'text-moss-700' : tone === 'red' ? 'text-crimson' : tone === 'amber' ? 'text-persimmon-700' : 'text-ink';
  return (
    <div className="bg-paper p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink3">{label}</div>
      <div className={cn('mt-1 font-display text-2xl font-black tracking-tight', cls)}>{v}</div>
    </div>
  );
}
