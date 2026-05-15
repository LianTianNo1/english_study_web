import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, CheckCircle2, RotateCcw, ChevronRight, Shuffle, BookOpen, Dumbbell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { speak } from '@/lib/tts';
import { MobileSheet } from '@/components/MobileSheet';
import { PHONEME_GROUPS, ALL_PHONEMES, type PhonemeData, type PhonemeGroup } from '@/data/phonics-data';
import { usePhonicsProgress } from '@/hooks/usePhonicsProgress';

const TOTAL = ALL_PHONEMES.length;

// ─── shuffle util ───────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── CategoryBadge ────────────────────────────────────────────────────────────
function CategoryBadge({ group }: { group: PhonemeGroup }) {
  const colorMap: Record<string, string> = {
    'bg-persimmon': 'bg-persimmon/15 text-persimmon-600',
    'bg-indigo2': 'bg-indigo2-50 text-indigo2',
    'bg-moss': 'bg-moss-50 text-moss-700',
    'bg-ink2': 'bg-paper3 text-ink2',
  };
  return (
    <span className={cn('tag text-[10px]', colorMap[group.colorClass] ?? 'bg-paper3 text-ink2')}>
      {group.code}
    </span>
  );
}

// ─── PhonemeCard (browse mode) ───────────────────────────────────────────────
interface PhonemeCardProps {
  phoneme: PhonemeData;
  group: PhonemeGroup;
  isMastered: boolean;
  onSelect: (p: PhonemeData) => void;
  onPlay: (p: PhonemeData) => void;
  playing: boolean;
}

function PhonemeCard({ phoneme, group, isMastered, onSelect, onPlay, playing }: PhonemeCardProps) {
  const accentBg: Record<string, string> = {
    'bg-persimmon': 'bg-persimmon/10 group-hover:bg-persimmon/20',
    'bg-indigo2': 'bg-indigo2-50 group-hover:bg-indigo2-50/80',
    'bg-moss': 'bg-moss-50 group-hover:bg-moss-50/80',
    'bg-ink2': 'bg-paper2 group-hover:bg-paper3',
  };
  const accentText: Record<string, string> = {
    'bg-persimmon': 'text-persimmon',
    'bg-indigo2': 'text-indigo2',
    'bg-moss': 'text-moss-700',
    'bg-ink2': 'text-ink',
  };

  return (
    <button
      onClick={() => onSelect(phoneme)}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 rounded-xl border border-paper3 bg-paper p-3',
        'min-h-[88px] text-center transition-all duration-150',
        'hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-paper active:scale-95',
        isMastered && 'border-moss/40 bg-moss-50/30',
      )}
    >
      {/* mastered badge */}
      {isMastered && (
        <span className="absolute right-1.5 top-1.5">
          <CheckCircle2 size={12} className="text-moss" />
        </span>
      )}

      {/* emoji */}
      <span className="text-xl leading-none">{phoneme.emoji}</span>

      {/* IPA symbol */}
      <span
        className={cn(
          'font-display text-xl font-black leading-none tracking-tight',
          accentText[group.colorClass] ?? 'text-ink',
        )}
      >
        {phoneme.symbol}
      </span>

      {/* name */}
      <span className="max-w-full truncate font-mono text-[10px] uppercase tracking-wider text-ink3">
        {phoneme.nameCn}
      </span>

      {/* play button */}
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(phoneme); }}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full border border-paper3 bg-paper transition-all',
          'hover:border-ink/30 hover:bg-paper2 active:scale-90',
          playing && 'animate-pop border-persimmon bg-persimmon/10',
          accentBg[group.colorClass],
        )}
        aria-label={`播放 ${phoneme.ttsWord}`}
      >
        <Volume2 size={11} className={playing ? 'text-persimmon' : 'text-ink3'} />
      </button>
    </button>
  );
}

// ─── PhonemeDetailSheet ───────────────────────────────────────────────────────
interface DetailSheetProps {
  phoneme: PhonemeData | null;
  group: PhonemeGroup | null;
  isMastered: boolean;
  onToggleMastered: () => void;
  onClose: () => void;
  onPlay: (p: PhonemeData) => void;
}

function PhonemeDetailSheet({ phoneme, group, isMastered, onToggleMastered, onClose, onPlay }: DetailSheetProps) {
  if (!phoneme || !group) return null;

  const symbolColor: Record<string, string> = {
    'bg-persimmon': 'text-persimmon',
    'bg-indigo2': 'text-indigo2',
    'bg-moss': 'text-moss-700',
    'bg-ink2': 'text-ink',
  };

  return (
    <MobileSheet open={!!phoneme} side="bottom" title="" onClose={onClose}>
      <div className="space-y-5 px-1 pb-2">
        {/* header */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl leading-none">{phoneme.emoji}</span>
            <CategoryBadge group={group} />
          </div>
          <div className="flex-1">
            <div className={cn('font-display text-5xl font-black leading-none', symbolColor[group.colorClass] ?? 'text-ink')}>
              {phoneme.symbol}
            </div>
            <div className="mt-1 font-display text-base font-bold text-ink">{phoneme.name}</div>
            <div className="text-sm text-ink2">{phoneme.nameCn}</div>
          </div>
          <button
            onClick={() => onPlay(phoneme)}
            className="btn-icon mt-1 !h-10 !w-10 border-paper3"
            aria-label="播放"
          >
            <Volume2 size={18} />
          </button>
        </div>

        {/* example words */}
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink3">示例词</div>
          <div className="flex flex-wrap gap-2">
            {phoneme.exampleWords.map(({ word }) => (
              <button
                key={word}
                onClick={() => speak(word)}
                className="flex items-center gap-1.5 rounded-lg border border-paper3 bg-paper px-3 py-1.5 font-display font-bold text-ink hover:border-ink/20 hover:bg-paper2 active:scale-95"
              >
                <Volume2 size={12} className="text-ink3" />
                {word}
              </button>
            ))}
          </div>
        </div>

        {/* mnemonic */}
        <div className="rounded-xl border border-paper3 bg-paper2 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base">💡</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink3">趣味巧记</span>
          </div>
          <p className="text-sm leading-relaxed text-ink2">{phoneme.mnemonic}</p>
        </div>

        {/* tip */}
        <div className="rounded-xl border border-paper3 bg-paper p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base">📌</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink3">发音要点</span>
          </div>
          <p className="text-sm leading-relaxed text-ink3">{phoneme.tip}</p>
        </div>

        {/* mastered toggle */}
        <button
          onClick={onToggleMastered}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-display font-bold transition-all active:scale-95',
            isMastered
              ? 'border-moss/50 bg-moss-50 text-moss-700 hover:bg-moss-50/60'
              : 'border-paper3 bg-paper text-ink hover:border-ink/30 hover:bg-paper2',
          )}
        >
          <CheckCircle2 size={16} className={isMastered ? 'text-moss fill-moss/20' : 'text-ink3'} />
          {isMastered ? '已标记掌握 · 点击取消' : '标记为已掌握'}
        </button>
      </div>
    </MobileSheet>
  );
}

// ─── BrowseMode ───────────────────────────────────────────────────────────────
interface BrowseModeProps {
  isMastered: (id: string) => boolean;
  onToggleMastered: (id: string) => void;
}

function BrowseMode({ isMastered, onToggleMastered }: BrowseModeProps) {
  const [activeGroupId, setActiveGroupId] = useState(PHONEME_GROUPS[0].id);
  const [selectedPhoneme, setSelectedPhoneme] = useState<PhonemeData | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const activeGroup = PHONEME_GROUPS.find((g) => g.id === activeGroupId) ?? PHONEME_GROUPS[0];
  const selectedGroup = selectedPhoneme
    ? PHONEME_GROUPS.find((g) => g.phonemes.some((p) => p.id === selectedPhoneme.id)) ?? null
    : null;

  const handlePlay = useCallback((phoneme: PhonemeData) => {
    setPlayingId(phoneme.id);
    speak(phoneme.ttsWord);
    setTimeout(() => setPlayingId(null), 1200);
  }, []);

  const groupTabColors: Record<string, string> = {
    'bg-persimmon': 'data-[active=true]:bg-persimmon data-[active=true]:text-paper data-[active=true]:border-persimmon',
    'bg-indigo2': 'data-[active=true]:bg-indigo2 data-[active=true]:text-paper data-[active=true]:border-indigo2',
    'bg-moss': 'data-[active=true]:bg-moss data-[active=true]:text-paper data-[active=true]:border-moss',
    'bg-ink2': 'data-[active=true]:bg-ink data-[active=true]:text-paper data-[active=true]:border-ink',
  };

  return (
    <>
      {/* group tabs */}
      <div className="relative">
        <div
          ref={tabsRef}
          className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
        >
          {PHONEME_GROUPS.map((g) => (
            <button
              key={g.id}
              data-active={g.id === activeGroupId}
              onClick={() => setActiveGroupId(g.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg border border-paper3 bg-paper px-3 py-1.5 transition-all',
                'font-mono text-[11px] uppercase tracking-wider text-ink3',
                'hover:border-ink/20 hover:bg-paper2 active:scale-95',
                groupTabColors[g.colorClass],
              )}
            >
              <span className="font-bold">{g.code}</span>
              <span className="hidden sm:inline">{g.label}</span>
            </button>
          ))}
        </div>
        {/* fade-x hint */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent" />
      </div>

      {/* group header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-2xl font-black text-ink">{activeGroup.label}</h2>
          <p className="text-sm text-ink3">{activeGroup.labelEn} · {activeGroup.phonemes.length} sounds</p>
        </div>
        <span className="font-mono text-xs text-ink3">
          {activeGroup.phonemes.filter((p) => isMastered(p.id)).length}/{activeGroup.phonemes.length} mastered
        </span>
      </div>

      {/* phoneme grid */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {activeGroup.phonemes.map((phoneme) => (
          <PhonemeCard
            key={phoneme.id}
            phoneme={phoneme}
            group={activeGroup}
            isMastered={isMastered(phoneme.id)}
            onSelect={setSelectedPhoneme}
            onPlay={handlePlay}
            playing={playingId === phoneme.id}
          />
        ))}
      </div>

      {/* detail sheet */}
      <PhonemeDetailSheet
        phoneme={selectedPhoneme}
        group={selectedGroup}
        isMastered={selectedPhoneme ? isMastered(selectedPhoneme.id) : false}
        onToggleMastered={() => selectedPhoneme && onToggleMastered(selectedPhoneme.id)}
        onClose={() => setSelectedPhoneme(null)}
        onPlay={handlePlay}
      />
    </>
  );
}

// ─── FlipCard ─────────────────────────────────────────────────────────────────
interface FlipCardProps {
  phoneme: PhonemeData;
  group: PhonemeGroup;
  isFlipped: boolean;
  onPlay: (p: PhonemeData) => void;
}

function FlipCard({ phoneme, group, isFlipped, onPlay }: FlipCardProps) {
  const symbolColor: Record<string, string> = {
    'bg-persimmon': 'text-persimmon',
    'bg-indigo2': 'text-indigo2',
    'bg-moss': 'text-moss-700',
    'bg-ink2': 'text-ink',
  };

  return (
    <div className="perspective-[1200px]" style={{ perspective: '1200px' }}>
      <div
        className="relative h-64 w-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transitionTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        }}
      >
        {/* Front: IPA symbol */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-paper3 bg-paper p-6"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <CategoryBadge group={group} />
          <span className="text-6xl leading-none">{phoneme.emoji}</span>
          <span className={cn('font-display text-7xl font-black leading-none', symbolColor[group.colorClass] ?? 'text-ink')}>
            {phoneme.symbol}
          </span>
          <p className="font-mono text-xs uppercase tracking-widest text-ink3">tap an option below</p>
        </div>

        {/* Back: mnemonic + examples */}
        <div
          className="absolute inset-0 flex flex-col gap-4 overflow-y-auto rounded-2xl border-2 border-paper3 bg-paper2 p-5"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{phoneme.emoji}</span>
            <div>
              <div className={cn('font-display text-3xl font-black', symbolColor[group.colorClass] ?? 'text-ink')}>
                {phoneme.symbol}
              </div>
              <div className="text-sm text-ink2">{phoneme.nameCn}</div>
            </div>
          </div>

          <div className="rounded-xl border border-paper3 bg-paper p-3">
            <p className="text-sm leading-relaxed text-ink2">{phoneme.mnemonic}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {phoneme.exampleWords.slice(0, 3).map(({ word }) => (
              <button
                key={word}
                onClick={() => speak(word)}
                className="flex items-center gap-1 rounded-lg border border-paper3 bg-paper px-2.5 py-1 font-display text-sm font-bold text-ink hover:bg-paper2 active:scale-95"
              >
                <Volume2 size={11} className="text-ink3" />
                {word}
              </button>
            ))}
            <button
              onClick={() => onPlay(phoneme)}
              className="flex items-center gap-1 rounded-lg border border-persimmon/30 bg-persimmon/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-persimmon hover:bg-persimmon/20 active:scale-95"
            >
              <Volume2 size={11} />
              Listen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PracticeMode ─────────────────────────────────────────────────────────────
type PracticePhase = 'quiz' | 'reveal' | 'done';

interface PracticeResult {
  phonemeId: string;
  correct: boolean;
}

interface PracticeModeProps {
  isMastered: (id: string) => boolean;
  onMarkPracticed: (id: string) => void;
  onToggleMastered: (id: string) => void;
  masteredCount: number;
}

function PracticeMode({ isMastered, onMarkPracticed, onToggleMastered, masteredCount }: PracticeModeProps) {
  const unmastered = ALL_PHONEMES.filter((p) => !isMastered(p.id));
  const queue = unmastered.length > 0 ? unmastered : ALL_PHONEMES;

  const [shuffled] = useState(() => shuffle(queue));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<PracticePhase>('quiz');
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [options, setOptions] = useState<PhonemeData[]>([]);
  const [newlyMastered, setNewlyMastered] = useState(0);

  const current = shuffled[idx];

  const getGroup = (p: PhonemeData) =>
    PHONEME_GROUPS.find((g) => g.phonemes.some((x) => x.id === p.id)) ?? PHONEME_GROUPS[0];

  // build options for current phoneme
  useEffect(() => {
    if (!current) return;
    const pool = ALL_PHONEMES.filter((p) => p.id !== current.id);
    const distractors = shuffle(
      (current.confusesWith ?? [])
        .map((id) => ALL_PHONEMES.find((p) => p.id === id))
        .filter(Boolean) as PhonemeData[],
    ).slice(0, 2);
    const extra = shuffle(pool.filter((p) => !distractors.some((d) => d.id === p.id))).slice(0, 3 - distractors.length);
    setOptions(shuffle([current, ...distractors, ...extra]).slice(0, 4));
    setSelectedOption(null);
  }, [current?.id]);

  function handleSelect(option: PhonemeData) {
    if (phase !== 'quiz') return;
    const correct = option.id === current.id;
    setSelectedOption(option.id);
    onMarkPracticed(current.id);

    setTimeout(() => {
      if (correct) speak(current.ttsWord);
      setResults((r) => [...r, { phonemeId: current.id, correct }]);
      setTimeout(() => setPhase('reveal'), correct ? 600 : 1000);
    }, 150);
  }

  function handleNext(mastered: boolean) {
    if (mastered && !isMastered(current.id)) {
      onToggleMastered(current.id);
      setNewlyMastered((n) => n + 1);
    }
    if (idx + 1 >= shuffled.length) {
      setPhase('done');
    } else {
      setIdx((i) => i + 1);
      setPhase('quiz');
    }
  }

  function handleRestart() {
    setIdx(0);
    setPhase('quiz');
    setResults([]);
    setNewlyMastered(0);
  }

  if (!current || phase === 'done') {
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-8 py-8 text-center animate-fade-up">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-moss-50 opacity-60" />
          <CheckCircle2 size={56} className="relative text-moss" />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">round complete</div>
          <h2 className="mt-2 font-display text-4xl font-black text-ink">练习完成！</h2>
        </div>
        <div className="grid w-full grid-cols-3 gap-px overflow-hidden rounded-xl border border-paper3 bg-paper3">
          {[
            { label: 'correct', zh: '正确', value: correct },
            { label: 'practiced', zh: '练习', value: results.length },
            { label: 'mastered', zh: '新掌握', value: newlyMastered },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 bg-paper py-4">
              <span className="font-display text-3xl font-black text-ink">{s.value}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">{s.zh}</span>
            </div>
          ))}
        </div>
        <div className="text-sm text-ink3">
          总进度：{masteredCount + newlyMastered} / {TOTAL} 已掌握
        </div>
        <div className="flex gap-3">
          <button onClick={handleRestart} className="btn btn-ghost gap-2">
            <RotateCcw size={14} /> 再练一轮
          </button>
        </div>
      </div>
    );
  }

  const currentGroup = getGroup(current);
  const isFlipped = phase === 'reveal';

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 meter-track !h-1.5">
          <div
            className="meter-bar bg-persimmon transition-all duration-300"
            style={{ width: `${((idx) / shuffled.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-ink3">{idx + 1}/{shuffled.length}</span>
      </div>

      {/* flip card */}
      <FlipCard
        phoneme={current}
        group={currentGroup}
        isFlipped={isFlipped}
        onPlay={(p) => speak(p.ttsWord)}
      />

      {/* options or reveal actions */}
      {phase === 'quiz' && (
        <div className="grid grid-cols-2 gap-2.5">
          {options.map((opt) => {
            const isCorrect = opt.id === current.id;
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt)}
                disabled={!!selectedOption}
                className={cn(
                  'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all active:scale-95',
                  'font-display',
                  !selectedOption && 'border-paper3 bg-paper hover:border-ink/20 hover:bg-paper2',
                  isSelected && isCorrect && 'border-moss bg-moss-50',
                  isSelected && !isCorrect && 'border-crimson bg-crimson-50',
                  selectedOption && !isSelected && isCorrect && 'border-moss/50 bg-moss-50/50',
                  selectedOption && !isSelected && !isCorrect && 'opacity-40',
                )}
              >
                <span className="text-lg">{opt.emoji}</span>
                <span className="font-bold text-ink">{opt.ttsWord}</span>
                <span className="text-xs text-ink3">{opt.nameCn}</span>
              </button>
            );
          })}
        </div>
      )}

      {phase === 'reveal' && (
        <div className="flex gap-3">
          <button
            onClick={() => handleNext(false)}
            className="flex-1 btn btn-ghost gap-2"
          >
            <RotateCcw size={14} /> 再练一次
          </button>
          <button
            onClick={() => handleNext(true)}
            className="flex-[2] btn btn-accent gap-2"
          >
            <CheckCircle2 size={14} /> 记住了！
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Phonics (root page) ──────────────────────────────────────────────────────
type Tab = 'browse' | 'practice';

export function Phonics() {
  const [tab, setTab] = useState<Tab>('browse');
  const { progress, markPracticed, toggleMastered, isMastered, masteredCount } = usePhonicsProgress();
  const pct = Math.round((masteredCount / TOTAL) * 100);

  return (
    <div className="space-y-8">
      {/* header */}
      <section className="border-b border-paper3 pb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">
          chapter 03p · phonics
        </div>
        <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl md:text-6xl">
          The{' '}
          <span className="doodle-underline italic text-persimmon">Sounds</span>
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-ink2">
          44 个音标，每一个都有趣味记忆法——用联想、梗和口诀让发音刻进脑子里。
        </p>

        {/* progress bar */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 meter-track !h-2">
            <div
              className="meter-bar bg-persimmon transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl font-black leading-none text-ink">{masteredCount}</span>
            <span className="font-mono text-xs text-ink3">/ {TOTAL}</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">mastered</span>
        </div>
      </section>

      {/* mode tabs */}
      <div className="flex gap-2">
        {(
          [
            { id: 'browse', label: '浏览模式', icon: BookOpen },
            { id: 'practice', label: '练习模式', icon: Dumbbell },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2 font-display font-bold transition-all active:scale-95',
              tab === id
                ? 'border-ink bg-ink text-paper'
                : 'border-paper3 bg-paper text-ink3 hover:border-ink/20 hover:bg-paper2',
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* content */}
      {tab === 'browse' ? (
        <BrowseMode isMastered={isMastered} onToggleMastered={toggleMastered} />
      ) : (
        <PracticeMode
          isMastered={isMastered}
          onMarkPracticed={markPracticed}
          onToggleMastered={toggleMastered}
          masteredCount={masteredCount}
        />
      )}
    </div>
  );
}
