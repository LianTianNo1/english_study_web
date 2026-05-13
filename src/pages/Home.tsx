import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, AlertCircle, Ear } from 'lucide-react';
import { LEVELS } from '@/db/types';
import { useSettings } from '@/stores/settingsStore';
import { progressRepo } from '@/db/repositories/progress';
import { sessionsRepo } from '@/db/repositories/sessions';
import { grammarRepo } from '@/db/repositories/grammar';
import { GRAMMAR_LESSONS } from '@/data/grammar-lessons';

export function Home() {
  const { activeLevel, dailyNewWords } = useSettings();
  const [dueCount, setDueCount] = useState(0);
  const [todayStats, setTodayStats] = useState({ learn: 0, review: 0, grammar: 0 });
  const [grammarDone, setGrammarDone] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [starredCount, setStarredCount] = useState(0);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const now = new Date();
    setDateStr(
      now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    );
    (async () => {
      const due = await progressRepo.dueForReview(Date.now(), 9999);
      setDueCount(due.length);
      const st = await sessionsRepo.todayStats();
      setTodayStats({ learn: st.learn.words, review: st.review.words, grammar: st.grammar.words });
      const grams = await grammarRepo.all();
      setGrammarDone(grams.filter((g) => g.status === 'completed').length);
      const wrong = await progressRepo.wrongWords(9999);
      setWrongCount(wrong.length);
      const stars = await progressRepo.starredWords();
      setStarredCount(stars.length);
    })();
  }, []);

  const meta = LEVELS.find((l) => l.id === activeLevel)!;
  const remaining = Math.max(0, dailyNewWords - todayStats.learn);

  return (
    <div className="space-y-12">
      {/* Masthead */}
      <section className="border-b border-paper3 pb-10">
        <div className="flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          <span>vol. 01 · {dateStr}</span>
          <span>focus / {meta.name}</span>
        </div>
        <h1 className="mt-6 font-display text-4xl font-black leading-none tracking-tight text-ink sm:text-6xl md:text-7xl">
          Today, you learn{' '}
          <span className="doodle-underline italic text-persimmon">{remaining}</span>{' '}
          new words.
        </h1>
        <p className="mt-6 max-w-2xl text-pretty font-display text-lg italic text-ink2">
          "每天一点点。三个月后回头，连自己都会惊讶。"
        </p>
      </section>

      {/* Today's columns */}
      <section className="grid gap-3 sm:gap-6 sm:grid-cols-3">
        <PrimaryAction
          to="/learn"
          number="01"
          title="学新词"
          en="Acquire"
          sub={remaining > 0 ? `今天还有 ${remaining} 个新词` : '今日新词已完成'}
          tone="accent"
        />
        <PrimaryAction
          to="/review"
          number="02"
          title="温习"
          en="Recall"
          sub={dueCount > 0 ? `${dueCount} 词待复习` : '复习池已空'}
          tone="dark"
        />
        <PrimaryAction
          to="/grammar"
          number="03"
          title="语法"
          en="Grammar"
          sub={`${grammarDone} / ${GRAMMAR_LESSONS.length} 节通关`}
          tone="paper"
        />
      </section>

      {/* 听写入口 —— 增强模式下额外露出 */}
      <section>
        <Link
          to="/listening"
          className="group flex items-center gap-4 rounded-md border border-indigo2/30 bg-indigo2-50/30 p-4 transition-all hover:-translate-y-0.5 hover:border-indigo2-500"
        >
          <div className="grid h-12 w-12 place-items-center rounded-md bg-indigo2-500 text-paper">
            <Ear size={20} />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-bold text-ink">听写专项 · The Ear Test</div>
            <div className="mt-0.5 text-sm text-ink3">
              纯靠耳朵拼出听到的词。每组 12 个，从已学词中抽取。最快补齐听力短板。
            </div>
          </div>
          <ArrowUpRight size={18} className="text-ink3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </section>

      {/* Stats strip */}
      <section>
        <div className="divider">today · 今日记录</div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-paper3 bg-paper3">
          <StatCell label="new" zh="新学" value={todayStats.learn} unit="words" />
          <StatCell label="review" zh="复习" value={todayStats.review} unit="words" />
          <StatCell label="grammar" zh="语法" value={todayStats.grammar} unit="lessons" />
        </div>
      </section>

      {/* Focus strip 错题本 / 难词 */}
      {(wrongCount > 0 || starredCount > 0) && (
        <section>
          <div className="divider">focus · 专攻</div>
          <Link to="/mistakes" className="group flex items-center gap-4 rounded-md border border-paper3 bg-paper p-5 transition-all hover:-translate-y-0.5 hover:border-ink">
            <div className="grid h-12 w-12 place-items-center rounded-md border border-crimson/30 bg-crimson-50 text-crimson">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <div className="font-display text-xl font-bold text-ink">错题本 / 难词收藏</div>
              <div className="mt-0.5 text-sm text-ink3">
                {wrongCount > 0 && <>错过 <b className="text-crimson">{wrongCount}</b> 个</>}
                {wrongCount > 0 && starredCount > 0 && ' · '}
                {starredCount > 0 && <>收藏 <b className="text-persimmon">{starredCount}</b> 个难词</>}
                {' '}集中突破比泛泛复习更高效。
              </div>
            </div>
            <ArrowUpRight size={18} className="text-ink3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </section>
      )}

      {/* Editor's note */}
      <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="paper-card">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">editor's note</div>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">怎么用这本"学习日志"</h2>
          <p className="mt-3 dropcap text-pretty text-ink2">
            这不是另一个枯燥的背单词 App。把它当作一本属于你自己的学习手账：每天翻开
            <Link to="/learn" className="linky font-semibold text-ink"> 学新词 </Link>
            过 20 个新词，
            <Link to="/review" className="linky font-semibold text-ink"> 复习 </Link>
            把昨天/上周容易忘的词再过一遍，到了周末挑一节
            <Link to="/grammar" className="linky font-semibold text-ink"> 语法 </Link>
            读完。坚持三个月，再回头看进度页的热力图——会比任何鸡汤都更有说服力。
          </p>
        </div>
        <div className="paper-card-dark">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/60">tip</div>
          <p className="mt-3 font-display text-xl leading-snug text-paper">
            遗忘是必经之路。不要因为忘了就焦虑，那只是大脑提醒你：该见见这个词了。
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
            — sm-2 algorithm
          </p>
        </div>
      </section>
    </div>
  );
}

function PrimaryAction({
  to,
  number,
  title,
  en,
  sub,
  tone,
}: {
  to: string;
  number: string;
  title: string;
  en: string;
  sub: string;
  tone: 'accent' | 'dark' | 'paper';
}) {
  const styles =
    tone === 'accent'
      ? 'bg-persimmon text-paper hover:bg-persimmon-600'
      : tone === 'dark'
      ? 'bg-ink text-paper hover:bg-ink2'
      : 'border border-paper3 bg-paper text-ink hover:border-ink';
  return (
    <Link
      to={to}
      className={`group relative flex h-32 sm:h-44 flex-col justify-between overflow-hidden rounded-lg p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 ${styles}`}
    >
      <div className="flex items-start justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] opacity-70">{en} · {number}</span>
        <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div>
        <h3 className="font-display text-3xl font-black tracking-tight">{title}</h3>
        <p className="mt-1 text-sm opacity-80">{sub}</p>
      </div>
    </Link>
  );
}

function StatCell({ label, zh, value, unit }: { label: string; zh: string; value: number; unit: string }) {
  return (
    <div className="bg-paper p-3 sm:p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{label} · {zh}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-2xl sm:text-4xl font-black tracking-tight text-ink">{value}</span>
        <span className="font-mono text-xs text-ink3">{unit}</span>
      </div>
    </div>
  );
}
