import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useSettings } from '@/stores/settingsStore';
import { Markdown } from './Markdown';
import { Link } from 'react-router-dom';

interface Props {
  label: string;
  run: () => Promise<string>;
  /** AI 未配置时的提示文案 */
  disabledHint?: string;
}

export function AIPanel({ label, run, disabledHint }: Props) {
  const ai = useSettings((s) => s.ai);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const ready = ai.enabled && !!ai.apiKey && !!ai.model;

  async function go() {
    setLoading(true);
    setError('');
    try {
      const out = await run();
      setContent(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-paper3 bg-paper2/40 p-4 text-xs text-ink3">
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles size={12} className="text-persimmon" />
          <b>AI 助手未启用</b>
        </div>
        <p className="mb-2">{disabledHint ?? '配置 API 后可一键生成更多解释、例句和题目。'}</p>
        <Link to="/settings" className="linky font-medium text-ink">前往设置 →</Link>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-paper3 bg-paper2/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-ink3">
          <Sparkles size={12} className="text-persimmon" />
          AI · {ai.model}
        </div>
        {!loading && (
          <button onClick={go} className="btn-ghost h-7 px-3 text-xs">
            {content ? '重新生成' : label}
          </button>
        )}
        {loading && <Loader2 size={16} className="animate-spin text-persimmon" />}
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-crimson-50 p-3 text-xs text-crimson">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {content && !loading && (
        <div className="mt-3 animate-fade-up">
          <Markdown text={content} />
        </div>
      )}
      {!content && !loading && !error && (
        <p className="mt-2 text-xs text-ink3">点击右上角"{label}"由 AI 生成。</p>
      )}
    </div>
  );
}
