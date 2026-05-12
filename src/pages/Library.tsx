import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LEVELS, type LevelId, type WordRecord } from '@/db/types';
import { wordsRepo } from '@/db/repositories/words';
import { Search, Volume2 } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';

export function Library() {
  const [level, setLevel] = useState<LevelId>('junior');
  const [words, setWords] = useState<WordRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WordRecord | null>(null);

  useEffect(() => {
    (async () => {
      setSelected(null);
      const cnt = await wordsRepo.countByLevel(level);
      setTotal(cnt);
      if (!query) {
        const list = await wordsRepo.byLevel(level, 500, 0);
        setWords(list);
      }
    })();
  }, [level]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim()) {
        const list = await wordsRepo.search(level, query.trim(), 200);
        setWords(list);
      } else {
        const list = await wordsRepo.byLevel(level, 500, 0);
        setWords(list);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, level]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: words.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevel(l.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              level === l.id ? 'bg-warm-500 text-white shadow-soft' : 'bg-white text-ink-600 hover:bg-cream-100'
            )}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_360px]">
        <div className="card p-0">
          <div className="flex items-center gap-2 border-b border-ink-100 p-3">
            <Search size={18} className="text-ink-400" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder={`在 ${LEVELS.find((l) => l.id === level)?.name} 词库中搜索 (${total.toLocaleString()} 词)`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div ref={parentRef} className="h-[60vh] overflow-auto">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const w = words[vi.index];
                return (
                  <button
                    key={vi.key}
                    onClick={() => setSelected(w)}
                    className={cn(
                      'absolute inset-x-0 flex items-center gap-3 border-b border-cream-100 px-4 text-left transition-colors',
                      selected?.id === w.id ? 'bg-warm-50' : 'hover:bg-cream-50'
                    )}
                    style={{
                      transform: `translateY(${vi.start}px)`,
                      height: `${vi.size}px`,
                    }}
                  >
                    <span className="w-10 shrink-0 text-xs text-ink-400">#{w.orderIndex + 1}</span>
                    <span className="w-40 shrink-0 truncate font-semibold text-ink-800">{w.word}</span>
                    <span className="flex-1 truncate text-sm text-ink-500">
                      {w.translations[0]?.translation}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="card">
          {selected ? (
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold tracking-tight">{selected.word}</h3>
                <button
                  onClick={() => speak(selected.word)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-cream-100 text-ink-600 hover:bg-warm-100 hover:text-warm-600"
                  title="朗读"
                >
                  <Volume2 size={16} />
                </button>
              </div>
              <div className="mt-3 space-y-1.5">
                {selected.translations.map((t, i) => (
                  <div key={i} className="text-sm">
                    <span className="tag mr-2">{t.type || '—'}</span>
                    <span className="text-ink-700">{t.translation}</span>
                  </div>
                ))}
              </div>
              {selected.phrases.length > 0 && (
                <div className="mt-5 border-t border-cream-200 pt-4">
                  <div className="label mb-2 text-xs uppercase tracking-wider text-ink-400">常用短语</div>
                  <ul className="space-y-2">
                    {selected.phrases.slice(0, 12).map((p, i) => (
                      <li key={i}>
                        <div className="text-sm font-medium text-ink-800">{p.phrase}</div>
                        <div className="text-xs text-ink-500">{p.translation}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="grid h-full place-items-center text-sm text-ink-400">
              ← 在左侧选一个单词
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
