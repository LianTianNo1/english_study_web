import { useState } from 'react';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { evaluateUserSentence } from '@/lib/ai';
import { useSettings } from '@/stores/settingsStore';
import { userSentencesRepo } from '@/db/repositories/userSentences';
import { cn } from '@/lib/utils';

interface Props {
  word: string;
  wordId?: number;
  onDone?: () => void;
}

/** 主动回忆：让用户用刚学/复习的词造句，AI 即时点评（无 AI 则只保存） */
export function ActiveRecallSentence({ word, wordId, onDone }: Props) {
  const ai = useSettings((s) => s.ai);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; feedback: string } | null>(null);
  const [error, setError] = useState('');

  const aiAvailable = ai.enabled && !!ai.apiKey;

  async function submit() {
    const sentence = text.trim();
    if (!sentence) return;
    // 必须包含目标词的某种形式（宽松校验：词干前 4 字符）
    const lower = sentence.toLowerCase();
    const stem = word.toLowerCase().slice(0, Math.min(4, word.length));
    if (!lower.includes(stem)) {
      setError(`句子需要包含 "${word}"（或其变形）`);
      return;
    }
    setError('');
    if (aiAvailable) {
      setLoading(true);
      try {
        const r = await evaluateUserSentence(word, sentence, ai);
        setResult(r);
        if (wordId !== undefined) {
          await userSentencesRepo.add({ wordId, word, sentence, score: r.score, feedback: r.feedback, createdAt: Date.now() });
        }
      } catch (e) {
        setError((e as Error).message || 'AI 点评失败');
      } finally {
        setLoading(false);
      }
    } else {
      // 无 AI：直接保存
      if (wordId !== undefined) {
        await userSentencesRepo.add({ wordId, word, sentence, createdAt: Date.now() });
      }
      setResult({ score: -1, feedback: '已保存。启用 AI 后可获得点评。' });
    }
  }

  const done = !!result;
  const score = result?.score ?? -1;
  const tone =
    score >= 4 ? 'border-moss bg-moss-50/60 text-moss-700' :
    score >= 2 ? 'border-persimmon-300 bg-persimmon-50/40 text-persimmon-700' :
    score >= 0 ? 'border-crimson bg-crimson-50/60 text-crimson' :
                 'border-paper3 bg-paper2';

  return (
    <div className="rounded-md border border-persimmon/30 bg-persimmon-50/20 p-3 sm:p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-persimmon-700">
        <Sparkles size={11} /> active recall · 用 <b className="font-display text-ink">{word}</b> 造一句
      </div>
      {!done && (
        <>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            placeholder={`type a sentence using "${word}"…`}
            rows={2}
            disabled={loading}
            className="mt-2 w-full resize-none rounded-md border border-paper3 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-ink focus:shadow-focus"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
          {error && <div className="mt-1 text-xs text-crimson">{error}</div>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink3">
              {aiAvailable ? '✦ AI 即时点评' : '★ 仅保存（启用 AI 可点评）'}
            </span>
            <div className="flex gap-2">
              <button onClick={onDone} className="btn-ghost text-xs">跳过</button>
              <button onClick={submit} disabled={loading || !text.trim()} className="btn-accent text-xs">
                {loading ? <><Loader2 size={12} className="animate-spin" /> 点评中</> : '提交'}
              </button>
            </div>
          </div>
        </>
      )}
      {done && (
        <div className={cn('mt-2 rounded-md border p-3', tone)}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {score >= 4 ? <><Check size={11} className="inline" /> excellent</> :
               score >= 2 ? `score · ${score}/5` :
               score >= 0 ? <><X size={11} className="inline" /> needs work · {score}/5</> :
               'saved'}
            </span>
            <button onClick={onDone} className="font-mono text-[10px] uppercase tracking-wider text-ink3 hover:text-ink">
              continue →
            </button>
          </div>
          <div className="mt-1.5 text-sm italic text-ink">"{text}"</div>
          {result?.feedback && <div className="mt-2 text-xs leading-relaxed text-ink2">{result.feedback}</div>}
        </div>
      )}
    </div>
  );
}
