import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LEVELS, type LevelId, type WordRecord } from '@/db/types';
import { wordsRepo } from '@/db/repositories/words';
import { ArrowLeft, Search, Volume2 } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';
import { AIPanel } from '@/components/AIPanel';
import { MnemonicHint } from '@/components/MnemonicHint';
import { useSettings } from '@/stores/settingsStore';
import { explainWord } from '@/lib/ai';
import { mnemonicsRepo } from '@/db/repositories/mnemonics';
import type { MnemonicRecord } from '@/db/types';

export function Library() {
  const [level, setLevel] = useState<LevelId>('junior');
  const [words, setWords] = useState<WordRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WordRecord | null>(null);
  const [mnemonic, setMnemonic] = useState<MnemonicRecord | undefined>();
  const aiCfg = useSettings((s) => s.ai);

  useEffect(() => {
    if (selected?.id !== undefined) mnemonicsRepo.get(selected.id).then(setMnemonic);
    else setMnemonic(undefined);
  }, [selected]);

  useEffect(() => {
    (async () => {
      setSelected(null);
      const cnt = await wordsRepo.countByLevel(level);
      setTotal(cnt);
      if (!query) setWords(await wordsRepo.byLevel(level, 500, 0));
    })();
  }, [level]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim()) setWords(await wordsRepo.search(level, query.trim(), 200));
      else setWords(await wordsRepo.byLevel(level, 500, 0));
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
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 04</div>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight md:text-5xl">
          The <span className="italic text-persimmon">Lexicon</span>
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevel(l.id)}
            className={cn(
              'rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
              level === l.id ? 'border-ink bg-ink text-paper' : 'border-paper3 bg-paper text-ink2 hover:border-ink'
            )}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_380px]">
        <div className={cn('paper-card !p-0', selected && 'hidden md:block')}>
          <div className="flex items-center gap-2 border-b border-paper3 px-4 py-3">
            <Search size={16} className="text-ink3" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              placeholder={`在 ${LEVELS.find((l) => l.id === level)?.name} 词库中检索（${total.toLocaleString()}）`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div ref={parentRef} className="h-[62vh] overflow-auto">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const w = words[vi.index];
                return (
                  <button
                    key={vi.key}
                    onClick={() => setSelected(w)}
                    className={cn(
                      'absolute inset-x-0 flex items-baseline gap-4 border-b border-paper3/60 px-5 text-left transition-colors',
                      selected?.id === w.id ? 'bg-paper2' : 'hover:bg-paper2/50'
                    )}
                    style={{ transform: `translateY(${vi.start}px)`, height: `${vi.size}px` }}
                  >
                    <span className="w-10 shrink-0 font-mono text-[10px] text-ink3">{String(w.orderIndex + 1).padStart(4, '0')}</span>
                    <span className="w-44 shrink-0 truncate font-display text-base font-semibold text-ink">{w.word}</span>
                    <span className="flex-1 truncate text-sm text-ink3">{w.translations[0]?.translation}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside
          className={cn(
            'paper-card overflow-y-auto',
            !selected && 'hidden md:block'
          )}
          style={{ maxHeight: 'calc(62vh + 56px)' }}
        >
          {selected ? (
            <div>
              <button
                onClick={() => setSelected(null)}
                className="mb-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3 hover:text-ink md:hidden"
              >
                <ArrowLeft size={12} /> back to list
              </button>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
                entry · {String(selected.orderIndex + 1).padStart(4, '0')} / {LEVELS.find((l) => l.id === selected.levelId)?.name}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <h3 className="font-display text-4xl font-black tracking-tight text-ink">{selected.word}</h3>
                <button onClick={() => speak(selected.word)} className="btn-icon !h-8 !w-8" title="朗读">
                  <Volume2 size={14} />
                </button>
                {mnemonic?.ipa && (
                  <code className="ml-1 font-mono text-sm text-ink2">{mnemonic.ipa}</code>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {selected.translations.map((t, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="tag shrink-0">{t.type || '—'}</span>
                    <span className="text-ink">{t.translation}</span>
                  </div>
                ))}
              </div>
              {selected.phrases.length > 0 && (
                <div className="mt-5">
                  <div className="divider !my-3">collocations</div>
                  <ul className="space-y-2">
                    {selected.phrases.slice(0, 8).map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <button
                          onClick={() => speak(p.phrase)}
                          className="btn-icon !h-7 !w-7 shrink-0"
                          title="朗读词组"
                        >
                          <Volume2 size={11} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm font-semibold text-ink">{p.phrase}</div>
                          <div className="text-xs text-ink3">{p.translation}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {mnemonic && (
                <div className="mt-5">
                  <MnemonicHint mnemonic={mnemonic} variant="inline" />
                </div>
              )}
              <AIPanel
                label="AI 精讲"
                run={() => explainWord(selected.word, selected.translations.map((t) => t.translation).join('；'), aiCfg)}
                disabledHint="启用 AI 后可生成词根、记忆法、例句和易混词。"
              />
            </div>
          ) : (
            <div className="grid h-full place-items-center font-mono text-xs uppercase tracking-[0.25em] text-ink3">
              ← select an entry
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
