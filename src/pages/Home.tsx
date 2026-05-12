import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, RotateCw, GraduationCap, ArrowRight, Flame, Trophy, Target } from 'lucide-react';
import { LEVELS } from '@/db/types';
import { useSettings } from '@/stores/settingsStore';
import { progressRepo } from '@/db/repositories/progress';
import { sessionsRepo } from '@/db/repositories/sessions';
import { grammarRepo } from '@/db/repositories/grammar';
import { GRAMMAR_LESSONS } from '@/data/grammar-lessons';

export function Home() {
  const { activeLevel, dailyNewWords, load, loaded } = useSettings();
  const [dueCount, setDueCount] = useState(0);
  const [todayStats, setTodayStats] = useState({ learn: 0, review: 0, grammar: 0 });
  const [grammarDone, setGrammarDone] = useState(0);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    (async () => {
      const due = await progressRepo.dueForReview(Date.now(), 9999);
      setDueCount(due.length);
      const st = await sessionsRepo.todayStats();
      setTodayStats({ learn: st.learn.words, review: st.review.words, grammar: st.grammar.words });
      const grams = await grammarRepo.all();
      setGrammarDone(grams.filter((g) => g.status === 'completed').length);
    })();
  }, []);

  const activeLevelMeta = LEVELS.find((l) => l.id === activeLevel)!;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-warm-400 via-warm-500 to-warm-600 p-8 text-white shadow-soft">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium opacity-90">今日学习</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">每天一点点，英语很快就好起来 🌱</h1>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <div className="rounded-2xl bg-white/15 px-4 py-2 backdrop-blur">
              <span className="opacity-80">当前词库</span> · <b>{activeLevelMeta.name}</b>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-2 backdrop-blur">
              <span className="opacity-80">每日新词</span> · <b>{dailyNewWords}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ActionCard
          to="/learn"
          icon={<BookOpen size={20} />}
          title="学新词"
          subtitle={`今天还有 ${Math.max(0, dailyNewWords - todayStats.learn)} 个新词`}
          accent="bg-warm-500"
        />
        <ActionCard
          to="/review"
          icon={<RotateCw size={20} />}
          title="复习"
          subtitle={dueCount > 0 ? `${dueCount} 个词等你回顾` : '今日已无待复习 ✓'}
          accent="bg-mint-500"
        />
        <ActionCard
          to="/grammar"
          icon={<GraduationCap size={20} />}
          title="语法学习"
          subtitle={`已完成 ${grammarDone} / ${GRAMMAR_LESSONS.length} 节`}
          accent="bg-sky2-500"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatTile icon={<Flame size={18} />} label="今日新学" value={todayStats.learn} unit="词" tone="warm" />
        <StatTile icon={<Target size={18} />} label="今日复习" value={todayStats.review} unit="词" tone="mint" />
        <StatTile icon={<Trophy size={18} />} label="语法关卡" value={grammarDone} unit="节" tone="sky" />
      </section>
    </div>
  );
}

function ActionCard(props: { to: string; icon: React.ReactNode; title: string; subtitle: string; accent: string }) {
  return (
    <Link
      to={props.to}
      className="card group flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${props.accent}`}>
        {props.icon}
      </div>
      <div className="flex-1">
        <div className="text-base font-semibold text-ink-800">{props.title}</div>
        <div className="text-sm text-ink-500">{props.subtitle}</div>
      </div>
      <ArrowRight className="text-ink-300 transition-transform group-hover:translate-x-0.5" size={18} />
    </Link>
  );
}

function StatTile(props: { icon: React.ReactNode; label: string; value: number; unit: string; tone: 'warm' | 'mint' | 'sky' }) {
  const toneCls =
    props.tone === 'warm'
      ? 'bg-warm-50 text-warm-600'
      : props.tone === 'mint'
      ? 'bg-emerald-50 text-mint-500'
      : 'bg-sky-50 text-sky2-500';
  return (
    <div className="card flex items-center gap-3">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${toneCls}`}>{props.icon}</div>
      <div>
        <div className="text-xs text-ink-500">{props.label}</div>
        <div className="text-xl font-bold text-ink-800">
          {props.value} <span className="text-sm font-normal text-ink-400">{props.unit}</span>
        </div>
      </div>
    </div>
  );
}
