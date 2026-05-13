import { useEffect, useState } from 'react';
import { GitBranch, Loader2, Sparkles, Volume2 } from 'lucide-react';
import type { WordRecord, WordRootRecord } from '@/db/types';
import { wordRootsRepo } from '@/db/repositories/wordRoots';
import { generateWordRoot } from '@/lib/ai';
import { useSettings } from '@/stores/settingsStore';
import { speak } from '@/lib/tts';

interface Props {
  word: WordRecord;
  /** 只读模式：无缓存时返回 null，不渲染"提取词根"按钮（Learn 页用，避免与顶部"一键增强"重复入口） */
  readOnly?: boolean;
}

/** 词根 / 词缀关联面板：优先读缓存，未生成则按需触发 AI */
export function WordRootsPanel({ word, readOnly = false }: Props) {
  const ai = useSettings((s) => s.ai);
  const [rec, setRec] = useState<WordRootRecord | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRec(undefined);
    setError('');
    if (word.id === undefined) return;
    wordRootsRepo.get(word.id).then(setRec);
  }, [word.id]);

  const aiAvailable = ai.enabled && !!ai.apiKey;

  async function generate() {
    if (word.id === undefined) return;
    if (!aiAvailable) { setError('请先在设置启用 AI'); return; }
    setLoading(true);
    setError('');
    try {
      const r = await generateWordRoot(
        word.word,
        word.translations.map((t) => t.translation).join('；'),
        ai
      );
      const next: WordRootRecord = {
        wordId: word.id,
        word: word.word,
        root: r.root,
        meaning: r.meaning,
        family: r.family,
        createdAt: Date.now(),
        model: ai.model,
      };
      await wordRootsRepo.put(next);
      setRec(next);
    } catch (e) {
      setError((e as Error).message || '生成失败');
    } finally {
      setLoading(false);
    }
  }

  if (!rec) {
    if (readOnly) return null;
    return (
      <div className="rounded-md border border-indigo2/20 bg-indigo2-50/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-indigo2-500">
            <GitBranch size={11} /> word roots · 词根关联
          </div>
          <button
            onClick={generate}
            disabled={loading || !aiAvailable}
            className="inline-flex items-center gap-1 rounded-md border border-indigo2/40 bg-paper px-2.5 py-1 text-xs font-semibold text-indigo2-500 transition hover:border-indigo2-500 disabled:opacity-50"
            title={!aiAvailable ? '请先在设置启用 AI' : undefined}
          >
            {loading ? <><Loader2 size={11} className="animate-spin" /> 生成中</> : <><Sparkles size={11} /> 提取词根</>}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-ink3">提取本词词根 / 词缀，并展示 5-8 个同源词。结果永久缓存，下次免费。</p>
        {error && <div className="mt-1.5 text-xs text-crimson">{error}</div>}
      </div>
    );
  }

  if (rec.root === '—' || rec.family.length === 0) {
    if (readOnly) return null;
    return (
      <div className="rounded-md border border-paper3 bg-paper2 p-3 font-mono text-[10px] uppercase tracking-wider text-ink3">
        <GitBranch size={11} className="mr-1 inline" /> 该词无明显词根（外来语 / 拟声）
      </div>
    );
  }

  return (
    <div className="rounded-md border border-indigo2/30 bg-indigo2-50/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-indigo2-500 flex items-center gap-1">
            <GitBranch size={11} /> root
          </span>
          <span className="font-display text-lg font-bold text-indigo2-500">{rec.root}</span>
          <span className="text-xs text-ink2 italic">— {rec.meaning}</span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink3">{rec.family.length} family</span>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {rec.family.map((f, i) => (
          <li key={i} className="flex items-center gap-2 rounded-sm bg-paper px-2 py-1.5">
            <button onClick={() => speak(f.word)} className="btn-icon !h-6 !w-6 shrink-0" title="朗读">
              <Volume2 size={10} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold text-ink truncate">{f.word}</div>
              <div className="text-[11px] text-ink3 truncate">{f.gloss}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
