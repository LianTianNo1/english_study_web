import { useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS, type LevelId } from '@/db/types';
import { useSettings, type AIProvider, type AIEndpoint, type LearnOrder, type ReviewAlgorithm, type LearningMode, type GistConfig } from '@/stores/settingsStore';
import { db } from '@/db/schema';
import { getLevelCount, importLevel } from '@/db/importer';
import { Download, RefreshCw, Trash2, Volume2, Sparkles, Loader2, Check, Upload, ShieldAlert, Cloud, CloudUpload, CloudDownload, Link2Off, Copy, CheckCheck, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listVoices, speak, whenVoicesReady, type VoiceInfo } from '@/lib/tts';
import { fetchModels } from '@/lib/ai';
import { applyBackup, buildBackup, downloadBackup, parseBackup, type ImportReport, type ImportStrategy } from '@/lib/backup';
import { pushToGist, pullFromGist } from '@/lib/gist';
import { getNotificationPermission, requestNotificationPermission, hasNotificationSupport, checkAndNotify } from '@/lib/notifications';
import { importCustomWords, type CustomImportResult } from '@/lib/customImport';

export function Settings() {
  const {
    activeLevel, dailyNewWords, dailyReviewLimit, learnOrder, reviewAlgorithm, sfxEnabled, tts, ai,
    learningMode, enhanced, gist,
    setActiveLevel, setDailyNewWords, setDailyReviewLimit, setLearnOrder, setReviewAlgorithm, setSfxEnabled, setTTS, setAI,
    setLearningMode, setEnhanced, setGist,
    loaded,
  } = useSettings();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState<LevelId | null>(null);
  const [progress, setProgress] = useState(0);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [includeSessions, setIncludeSessions] = useState(true);
  const [includeSettingsInExport, setIncludeSettingsInExport] = useState(true);
  const [includeWords, setIncludeWords] = useState(false);
  const [includeAIConfig, setIncludeAIConfig] = useState(false);
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('merge');
  const [importAIConfig, setImportAIConfig] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState('');
  const [importing2, setImporting2] = useState(false);

  // Gist 同步状态
  const [gistPushing, setGistPushing] = useState(false);
  const [gistPulling, setGistPulling] = useState(false);
  const [gistError, setGistError] = useState('');
  const [gistSuccess, setGistSuccess] = useState('');
  const [gistPullStrategy, setGistPullStrategy] = useState<ImportStrategy>('merge');
  const [gistPullAIConfig, setGistPullAIConfig] = useState(false);

  useEffect(() => {
    whenVoicesReady(() => setVoices(listVoices()));
  }, []);

  useEffect(() => {
    (async () => {
      const m: Record<string, number> = {};
      for (const l of LEVELS) m[l.id] = await getLevelCount(l.id);
      setCounts(m);
    })();
  }, [importing]);

  async function importOne(l: typeof LEVELS[number]) {
    if (importing) return;
    setImporting(l.id);
    setProgress(0);
    await importLevel({
      levelId: l.id,
      sourceFile: l.sourceFile,
      onProgress: (loaded, total) => setProgress(Math.round((loaded / total) * 100)),
    });
    setImporting(null);
  }

  async function exportBackup() {
    const bk = await buildBackup({
      includeSettings: includeSettingsInExport,
      includeSessions,
      includeWords,
      includeAIConfig,
    });
    downloadBackup(bk);
  }

  async function handleImportFile(file: File) {
    setImporting2(true);
    setImportError('');
    setImportReport(null);
    try {
      const text = await file.text();
      const backup = parseBackup(text);
      if (importStrategy === 'replace' && !confirm('替换模式将清空当前进度、会话与语法进度。确认继续？')) {
        setImporting2(false);
        return;
      }
      const report = await applyBackup(backup, { strategy: importStrategy, applyAIConfig: importAIConfig });
      setImportReport(report);
      // 重载设置（备份可能更改了用户偏好）
      await useSettings.getState().load();
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting2(false);
    }
  }

  async function resetAll() {
    if (!confirm('确认重置？所有词库与学习进度将被清除。')) return;
    await db.delete();
    location.href = '/onboarding';
  }

  async function pullModels() {
    setLoadingModels(true);
    setModelError('');
    try {
      const list = await fetchModels(ai);
      setModels(list);
    } catch (e) {
      setModelError((e as Error).message);
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleGistPush() {
    if (!gist.token) return;
    setGistPushing(true);
    setGistError('');
    setGistSuccess('');
    try {
      const backup = await buildBackup({
        includeSettings: true,
        includeSessions: true,
        includeWords: false,
        includeAIConfig: gist.includeAIConfig,
      });
      const gistId = await pushToGist(backup, gist);
      await setGist({ gistId, lastSyncedAt: new Date().toISOString(), lastSyncStatus: 'ok' });
      setGistSuccess('推送成功');
    } catch (e) {
      await setGist({ lastSyncStatus: 'error' });
      setGistError((e as Error).message);
    } finally {
      setGistPushing(false);
    }
  }

  async function handleGistPull() {
    if (!gist.token || !gist.gistId) return;
    setGistPulling(true);
    setGistError('');
    setGistSuccess('');
    try {
      const backup = await pullFromGist(gist);
      if (gistPullStrategy === 'replace' && !confirm('替换模式将清空当前进度、会话与语法进度。确认继续？')) {
        setGistPulling(false);
        return;
      }
      const report = await applyBackup(backup, { strategy: gistPullStrategy, applyAIConfig: gistPullAIConfig });
      await useSettings.getState().load();
      await setGist({ lastSyncedAt: new Date().toISOString(), lastSyncStatus: 'ok' });
      setGistSuccess(`拉取成功 · 进度 ${report.progress} 条 · 设置 ${report.settings} 项`);
    } catch (e) {
      await setGist({ lastSyncStatus: 'error' });
      setGistError((e as Error).message);
    } finally {
      setGistPulling(false);
    }
  }

  function handleGistDisconnect() {
    if (!confirm('断开配置将清除本设备保存的 Gist ID 和 Token，不影响 Gist 上的数据。确认？')) return;
    setGist({ gistId: '', token: '', lastSyncedAt: undefined, lastSyncStatus: undefined });
    setGistSuccess('');
    setGistError('');
  }

  if (!loaded) return null;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_180px]">
      <div className="space-y-12">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 06 · preferences</div>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-black tracking-tight">设置</h1>
        </header>

      {/* ============= 学习模式 (Classic / Enhanced) ============= */}
      <Section id="mode" title="学习模式" sub="learning mode · classic / enhanced">
        <Field label="选择模式" hint="Enhanced 模式启用 5min 微复习、错词加权、主动造句、词根关联等强化机制。可在下方按需关闭单项。">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ModeTile
              active={learningMode === 'classic'}
              title="经典模式"
              en="Classic"
              sub="原有流程：预览 → 练习 → 复习 → 错题专攻。专注、零干扰。"
              onClick={() => setLearningMode('classic')}
            />
            <ModeTile
              active={learningMode === 'enhanced'}
              title="增强模式"
              en="Enhanced"
              sub="叠加 5 分钟微复习、错词加权、AI 造句点评、慢速跟读、词根关联与周报。"
              onClick={() => setLearningMode('enhanced')}
            />
          </div>
        </Field>

        {learningMode === 'enhanced' && (
          <>
            <div className="rounded-md border border-persimmon/30 bg-persimmon-50/30 p-3 font-mono text-[10px] uppercase tracking-wider text-persimmon-700">
              enhanced features · 按需开关下方任一项
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EnhancedToggle
                label="5 分钟微复习"
                en="micro review"
                sub="学完新词后即刻启动 5 分钟内的快闪复习——艾宾浩斯曲线的第一拐点"
                on={enhanced.microReview}
                onChange={(b) => setEnhanced({ microReview: b })}
              />
              <EnhancedToggle
                label="错词加权复习"
                en="wrong-weighted"
                sub="错过 ≥2 次的词自动混入每日复习，比常规词更频繁出现"
                on={enhanced.wrongWeighted}
                onChange={(b) => setEnhanced({ wrongWeighted: b })}
              />
              <EnhancedToggle
                label="主动回忆造句"
                en="active recall"
                sub="复习揭晓后用该词造一个句子，AI 即时点评。从被动认词 → 主动产出"
                on={enhanced.activeRecall}
                onChange={(b) => setEnhanced({ activeRecall: b })}
              />
              <EnhancedToggle
                label="慢速朗读 ×2"
                en="auto slow tts"
                sub="词卡显示后自动正常朗读 + 慢速朗读各一遍，强化听觉编码"
                on={enhanced.autoSlowTTS}
                onChange={(b) => setEnhanced({ autoSlowTTS: b })}
              />
              <EnhancedToggle
                label="录音跟读对比"
                en="recording"
                sub="按住按钮录制自己的发音，松开后回放与原声对比"
                on={enhanced.recordingEnabled}
                onChange={(b) => setEnhanced({ recordingEnabled: b })}
              />
              <EnhancedToggle
                label="词根 / 词缀关联"
                en="word roots"
                sub="AI 提取词根并展示 5-8 个同根词，结果永久缓存，下次免费"
                on={enhanced.showWordRoots}
                onChange={(b) => setEnhanced({ showWordRoots: b })}
              />
              <DailyReminderToggle
                on={enhanced.dailyReminder}
                onChange={(b) => setEnhanced({ dailyReminder: b })}
              />
            </div>
          </>
        )}
      </Section>

      {/* 学习偏好 */}
      <Section id="study" title="学习偏好" sub="study preferences">
        <Field label="当前词库" hint="决定 / 学新词 / 抽取来源">
          <div className="flex flex-wrap gap-2">
            {LEVELS.filter((l) => (counts[l.id] ?? 0) > 0).map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveLevel(l.id)}
                className={cn(
                  'rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
                  activeLevel === l.id ? 'border-ink bg-ink text-paper' : 'border-paper3 text-ink2 hover:border-ink'
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="学习顺序" hint="决定每日抽取新词的方式">
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <OrderTile value="sequential" active={learnOrder === 'sequential'} title="顺序" sub="按词频/教材编排顺序学" onClick={() => setLearnOrder('sequential')} />
            <OrderTile value="random" active={learnOrder === 'random'} title="乱序" sub="全词库随机抽取，抗遗忘更强" onClick={() => setLearnOrder('random')} />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="每日新词目标" value={dailyNewWords} onChange={setDailyNewWords} min={5} max={100} />
          <NumField label="每日复习上限" value={dailyReviewLimit} onChange={setDailyReviewLimit} min={10} max={500} />
        </div>

        <Field label="复习算法" hint="决定每个词的下次复习时间">
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-2xl">
              <AlgoTile
                active={reviewAlgorithm === 'sm2'}
                title="SM-2（自适应）"
                sub="SuperMemo-2 算法 · 根据每题的难易自评（忘了/模糊/记住）动态调整间隔，长期更高效。"
                onClick={() => setReviewAlgorithm('sm2')}
              />
              <AlgoTile
                active={reviewAlgorithm === 'ebbinghaus'}
                title="艾宾浩斯（固定）"
                sub="经典遗忘曲线 · 固定间隔 5min → 30min → 12h → 1d → 2d → 4d → 7d → 15d → 30d → 60d，节奏清晰可预期。"
                onClick={() => setReviewAlgorithm('ebbinghaus')}
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
              提示 · sm-2 本质上也基于艾宾浩斯曲线，只是把固定间隔升级为根据你的表现自适应。
            </p>
          </div>
        </Field>

        <Field label="打字机音效" hint="拼写/填空/翻译时键击发出复古打字声，答对一串上行音，答错一声闷响">
          <div className="flex items-center gap-3">
            <Toggle on={sfxEnabled} onChange={setSfxEnabled} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">
              {sfxEnabled ? 'on · clicky' : 'off · silent'}
            </span>
          </div>
        </Field>
      </Section>

      {/* TTS */}
      <Section id="tts" title="朗读 · Text-to-Speech" sub="voice & speed">
        <Field label="发音" hint="Edge / Chrome 在 Windows 上会暴露高质量的 Online (Natural) 音色">
          <div className="space-y-2">
            <select
              className="input"
              value={tts.voiceURI}
              onChange={(e) => setTTS({ voiceURI: e.target.value })}
            >
              <option value="">系统默认</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.isEdgeNatural ? '✨ ' : ''}{v.name} · {v.lang}{v.remote ? ' (online)' : ''}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button onClick={() => speak('Hello, this is your study companion.')} className="btn-ghost text-xs">
                <Volume2 size={12} /> 试听
              </button>
              <span className="font-mono text-[10px] text-ink3">{voices.length} voices available</span>
            </div>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <RangeField label={`语速 · ${tts.rate.toFixed(2)}x`} min={0.5} max={1.5} step={0.05} value={tts.rate} onChange={(v) => setTTS({ rate: v })} />
          <RangeField label={`音调 · ${tts.pitch.toFixed(2)}`} min={0.6} max={1.4} step={0.05} value={tts.pitch} onChange={(v) => setTTS({ pitch: v })} />
        </div>
      </Section>

      {/* AI */}
      <Section id="ai" title="AI 助手 · LLM" sub="optional · openai / gemini compatible">
        <Field label="启用 AI 助手" hint="启用后可生成单词精讲、语法加题、错题解释等">
          <Toggle on={ai.enabled} onChange={(b) => setAI({ enabled: b })} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <div className="flex gap-2">
              {(['openai', 'gemini'] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    const next: any = { provider: p };
                    if (p === 'gemini') {
                      next.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
                      next.model = 'gemini-2.0-flash';
                    } else if (p === 'openai' && ai.baseURL.includes('googleapis')) {
                      next.baseURL = 'https://api.openai.com/v1';
                      next.model = 'gpt-4o-mini';
                    }
                    setAI(next);
                  }}
                  className={cn(
                    'flex-1 rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
                    ai.provider === p ? 'border-ink bg-ink text-paper' : 'border-paper3 text-ink2 hover:border-ink'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          {ai.provider === 'openai' && (
            <Field label="Endpoint 风格">
              <div className="flex gap-2">
                {(['chat', 'responses'] as AIEndpoint[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => setAI({ endpoint: e })}
                    className={cn(
                      'flex-1 rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
                      ai.endpoint === e ? 'border-ink bg-ink text-paper' : 'border-paper3 text-ink2 hover:border-ink'
                    )}
                  >
                    /{e === 'chat' ? 'chat/completions' : 'responses'}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>

        <Field label="Base URL">
          <input className="input font-mono" value={ai.baseURL} onChange={(e) => setAI({ baseURL: e.target.value })} placeholder="https://api.openai.com/v1" />
        </Field>

        <Field label="API Key">
          <input className="input font-mono" type="password" value={ai.apiKey} onChange={(e) => setAI({ apiKey: e.target.value })} placeholder="sk-... / AIza..." />
        </Field>

        <Field label="Model" hint="可手动输入，或点击右侧从 /models 拉取列表">
          <div className="flex gap-2">
            <input
              className="input font-mono"
              list="model-list"
              value={ai.model}
              onChange={(e) => setAI({ model: e.target.value })}
              placeholder={ai.provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'}
            />
            <datalist id="model-list">
              {models.map((m) => <option key={m} value={m} />)}
            </datalist>
            <button onClick={pullModels} disabled={loadingModels || !ai.apiKey} className="btn-ghost shrink-0">
              {loadingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {models.length > 0 ? `${models.length} 个` : '拉取'}
            </button>
          </div>
          {modelError && <p className="mt-1 font-mono text-[10px] text-crimson">{modelError}</p>}
        </Field>

        <Field label={`Temperature · ${ai.temperature.toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={ai.temperature}
            onChange={(e) => setAI({ temperature: Number(e.target.value) })}
            className="w-full sm:max-w-md accent-persimmon"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`AI 加题数量 · ${ai.exerciseCount ?? 3} 道`} hint="语法练习页一键加题的默认数量 (1-10)">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={ai.exerciseCount ?? 3}
                onChange={(e) => setAI({ exerciseCount: Number(e.target.value) })}
                className="flex-1 accent-persimmon"
              />
              <span className="w-8 text-right font-mono text-sm font-bold text-ink">{ai.exerciseCount ?? 3}</span>
            </div>
          </Field>
          <Field label={`巧记批次大小 · ${ai.mnemonicBatchSize ?? 20} 词/次`} hint="批量生成巧记时每次 API 请求处理的单词数 (5-50)">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={ai.mnemonicBatchSize ?? 20}
                onChange={(e) => setAI({ mnemonicBatchSize: Number(e.target.value) })}
                className="flex-1 accent-persimmon"
              />
              <span className="w-8 text-right font-mono text-sm font-bold text-ink">{ai.mnemonicBatchSize ?? 20}</span>
            </div>
          </Field>
        </div>

        <div className="rounded-md border border-dashed border-paper3 bg-paper2/40 p-4 text-xs text-ink3">
          <div className="mb-1 flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <Sparkles size={12} className="text-persimmon" /> ai 能为你做的事
          </div>
          <ul className="ml-4 list-disc space-y-0.5">
            <li><b>学习页 · 巧记预学</b> · 一键为今日所有新词批量生成口诀，练习时悬浮提示</li>
            <li>词库详情页 · 生成词根/记忆法/三档例句/易混词</li>
            <li>语法练习页 · 答错时一键解释 / 一键加题（数量可配置）</li>
            <li>所有数据仅发送到你填的 BaseURL，本地零中转。</li>
          </ul>
        </div>
      </Section>

      {/* 词库管理 */}
      <Section id="library" title="词库管理" sub="dictionaries">
        <div className="grid gap-2">
          {LEVELS.filter((l) => l.id !== 'custom').map((l) => {
            const imported = (counts[l.id] ?? 0) > 0;
            const isImporting = importing === l.id;
            return (
              <div key={l.id} className="flex items-center justify-between rounded-md border border-paper3 bg-paper px-4 py-3">
                <div>
                  <div className="font-display text-base font-bold text-ink">{l.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink3">
                    {imported ? `imported · ${counts[l.id].toLocaleString()} words` : `${l.totalEstimate.toLocaleString()} words · not imported`}
                  </div>
                </div>
                {isImporting ? (
                  <div className="font-mono text-xs text-persimmon">{progress}%</div>
                ) : (
                  <button onClick={() => importOne(l)} className={imported ? 'btn-ghost text-xs' : 'btn-accent text-xs'}>
                    {imported ? <><RefreshCw size={12} /> 重新导入</> : <><Download size={12} /> 导入</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 自定义词库 */}
        <CustomLibraryImport currentCount={counts['custom'] ?? 0} onImported={(n) => setCounts((m) => ({ ...m, custom: (m.custom ?? 0) + n }))} />
      </Section>

      {/* ============= 云端同步 · GitHub Gist ============= */}
      <GistSyncSection
        gist={gist}
        setGist={setGist}
        pushing={gistPushing}
        pulling={gistPulling}
        error={gistError}
        success={gistSuccess}
        pullStrategy={gistPullStrategy}
        setPullStrategy={setGistPullStrategy}
        pullAIConfig={gistPullAIConfig}
        setPullAIConfig={setGistPullAIConfig}
        onPush={handleGistPush}
        onPull={handleGistPull}
        onDisconnect={handleGistDisconnect}
      />

      {/* 数据备份 */}
      <Section id="backup" title="数据备份" sub="export · import">
        {/* 导出 */}
        <Field label="导出备份" hint="不含 API Key（自动脱敏）">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Checkbox checked={includeSessions} onChange={setIncludeSessions} label="包含会话记录（热力图）" />
              <Checkbox checked={includeSettingsInExport} onChange={setIncludeSettingsInExport} label="包含设置偏好" />
              <Checkbox checked={includeWords} onChange={setIncludeWords} label="包含词库本体 (大 ⚠)" />
              <Checkbox checked={includeAIConfig} onChange={setIncludeAIConfig} label="含 AI 配置（含 API Key ⚠）" />
            </div>
            <button onClick={exportBackup} className="btn-ghost">
              <Download size={14} /> 导出 JSON
            </button>
            <div className="flex items-start gap-2 rounded-md border border-paper3 bg-paper2/40 p-3 text-xs text-ink3">
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-persimmon" />
              <span>
                默认只含 <b>学习进度 / 错题 / 难词 / 语法关卡 / AI 巧记 / 偏好</b>，体积约 100 KB。
                勾选"词库本体"会额外打包已导入的词条（含全部释义和短语），换设备时可省去 5 分钟重新导入，
                但单文件可达 <b>30+ MB</b>。勾选"含 AI 配置"时 <b>API Key 会明文写入文件</b>，请妥善保管。
              </span>
            </div>
          </div>
        </Field>

        {/* 导入 */}
        <Field label="导入备份" hint="从此前导出的 JSON 文件还原">
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['merge', 'replace'] as ImportStrategy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setImportStrategy(s)}
                  className={cn(
                    'rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
                    importStrategy === s ? 'border-ink bg-ink text-paper' : 'border-paper3 text-ink2 hover:border-ink'
                  )}
                >
                  {s === 'merge' ? '合并 (推荐)' : '替换 (危险)'}
                </button>
              ))}
              <span className="self-center font-mono text-[10px] text-ink3">
                {importStrategy === 'merge' ? '保留现有数据，按 wordId/lessonId 去重更新' : '清空后再导入（无法恢复）'}
              </span>
            </div>
            <Checkbox checked={importAIConfig} onChange={setImportAIConfig} label="导入 AI 配置（含 API Key）" />
            <label className="btn-ghost cursor-pointer w-fit">
              {importing2 ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              选择 JSON 文件
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            {importError && (
              <div className="rounded-md border border-crimson bg-crimson-50 p-3 text-sm text-crimson">{importError}</div>
            )}
            {importReport && (
              <div className="rounded-md border border-moss bg-moss-50/50 p-3 text-sm text-moss-700">
                <div className="font-semibold">✓ 导入成功</div>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs">
                  <li>学习进度 · {importReport.progress} 条</li>
                  <li>会话记录 · {importReport.sessions} 条</li>
                  <li>语法关卡 · {importReport.grammarProgress} 节</li>
                  <li>AI 巧记 · {importReport.mnemonics} 条</li>
                  {importReport.wordRoots > 0 && <li>词根关联 · {importReport.wordRoots} 条</li>}
                  {importReport.userSentences > 0 && <li>主动造句 · {importReport.userSentences} 条</li>}
                  {importReport.words > 0 && <li>词条 · {importReport.words.toLocaleString()} 个</li>}
                  <li>设置偏好 · {importReport.settings} 项</li>
                  {importReport.skippedSettings.length > 0 && (
                    <li className="text-ink3">跳过：{importReport.skippedSettings.join('、')}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </Field>

        <Field label="重置所有数据" hint="不可逆操作">
          <button onClick={resetAll} className="btn border border-crimson text-crimson hover:bg-crimson-50">
            <Trash2 size={14} /> 删库并回到 Onboarding
          </button>
        </Field>

        <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
          data lives in indexeddb · clearing site data will erase progress
        </p>
      </Section>
      </div>
      <aside className="hidden lg:block">
        <SettingsTOC />
      </aside>
    </div>
  );
}

/* 设置页大纲 —— sticky 右侧，IntersectionObserver 自动高亮当前 section */
const TOC_ITEMS: { id: string; label: string; en: string }[] = [
  { id: 'gist', label: '云端同步', en: 'gist sync' },
  { id: 'study', label: '学习偏好', en: 'study' },
  { id: 'tts', label: '朗读', en: 'tts' },
  { id: 'ai', label: 'AI 助手', en: 'ai' },
  { id: 'library', label: '词库管理', en: 'library' },
  { id: 'backup', label: '数据备份', en: 'backup' },
];

function SettingsTOC() {
  const [active, setActive] = useState<string>('study');

  useEffect(() => {
    const sections = TOC_ITEMS.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // 取最靠近顶部且在视野中的 section
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
          setActive(top.target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="sticky top-24 space-y-1 border-l border-paper3 pl-4">
      <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.3em] text-ink3">on this page</div>
      {TOC_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => jump(item.id)}
            className={cn(
              'relative block w-full text-left transition-all',
              'py-1 pl-3 font-display text-sm',
              isActive ? 'font-bold text-ink' : 'text-ink3 hover:text-ink'
            )}
          >
            {/* 当前小标 */}
            <span
              className={cn(
                'absolute -left-[17px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-all',
                isActive ? 'bg-persimmon' : 'bg-transparent'
              )}
            />
            <div>{item.label}</div>
            <div className={cn('font-mono text-[9px] uppercase tracking-wider', isActive ? 'text-persimmon-700' : 'text-ink3/60')}>
              {item.en}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

function Section({ id, title, sub, children }: { id?: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <header className="mb-5 flex items-baseline justify-between border-b border-paper3 pb-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{sub}</span>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold text-ink">{label}</label>
        {hint && <span className="text-xs text-ink3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function NumField(props: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <Field label={props.label}>
      <input
        type="number"
        className="input font-mono"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) props.onChange(Math.max(props.min, Math.min(props.max, n)));
        }}
      />
    </Field>
  );
}

function RangeField(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <Field label={props.label}>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-persimmon"
      />
    </Field>
  );
}

function AlgoTile({ active, title, sub, onClick }: { active: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex items-start gap-3 rounded-md border p-3 text-left transition',
        active ? 'border-ink bg-paper shadow-ink' : 'border-paper3 bg-paper hover:border-ink'
      )}
    >
      <div className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border', active ? 'border-ink bg-ink text-paper' : 'border-paper3')}>
        {active && <Check size={12} />}
      </div>
      <div className="min-w-0">
        <div className="font-display text-base font-bold text-ink">{title}</div>
        <div className="mt-0.5 text-xs leading-snug text-ink3">{sub}</div>
      </div>
    </button>
  );
}

function OrderTile({ value, active, title, sub, onClick }: { value: LearnOrder; active: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex items-start gap-3 rounded-md border p-3 text-left transition',
        active ? 'border-ink bg-paper shadow-ink' : 'border-paper3 bg-paper hover:border-ink'
      )}
    >
      <div className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border', active ? 'border-ink bg-ink text-paper' : 'border-paper3')}>
        {active && <Check size={12} />}
      </div>
      <div>
        <div className="font-display text-base font-bold text-ink">{title}</div>
        <div className="text-xs text-ink3">{sub}</div>
      </div>
    </button>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink2">
      <span
        onClick={() => onChange(!checked)}
        className={cn(
          'grid h-4 w-4 place-items-center rounded-sm border transition',
          checked ? 'border-ink bg-ink text-paper' : 'border-paper3 bg-paper'
        )}
      >
        {checked && <Check size={10} />}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}

/** 自定义词库导入 (CSV/JSON) */
function CustomLibraryImport({ currentCount, onImported }: { currentCount: number; onImported: (n: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CustomImportResult | null>(null);
  const [error, setError] = useState('');
  const [strategy, setStrategy] = useState<'merge' | 'replace'>('merge');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const r = await importCustomWords(f, { strategy });
      setResult(r);
      onImported(r.imported);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mt-3 rounded-md border border-paper3 bg-paper2/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display text-base font-bold text-ink">自定义 · Custom</div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">
          {currentCount > 0 ? `imported · ${currentCount.toLocaleString()} words` : 'no custom words yet'}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink3 leading-relaxed">
        上传 <code className="font-mono">.csv</code> / <code className="font-mono">.tsv</code> / <code className="font-mono">.json</code> 文件加入自定义词库（行业词 / 影视台词 / 复习清单皆可）。
        CSV 表头需含 <code>word</code> 和 <code>translation</code> 两列；JSON 可用 WordRecord 标准结构或 <code>{`{word, translation, type}`}</code> 扁平结构。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5 text-xs text-ink2">
          <input type="radio" name="custom-strategy" checked={strategy === 'merge'} onChange={() => setStrategy('merge')} />
          合并（保留已有，跳过重复）
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink2">
          <input type="radio" name="custom-strategy" checked={strategy === 'replace'} onChange={() => setStrategy('replace')} />
          覆盖（清空自定义词库后导入）
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt" onChange={handleFile} disabled={busy} className="hidden" id="custom-file-input" />
        <label htmlFor="custom-file-input" className={cn('btn-accent text-xs cursor-pointer', busy && 'opacity-50 pointer-events-none')}>
          {busy ? <><Loader2 size={12} className="animate-spin" /> 解析中…</> : <><Upload size={12} /> 选择文件</>}
        </label>
        <a
          href={'data:text/csv;charset=utf-8,' + encodeURIComponent('word,translation,type,phrase,phraseTranslation\napple,苹果,n,,\nrun,跑、运行,v,run out of time,时间不够')}
          download="custom-words-template.csv"
          className="btn-ghost text-xs"
        >
          下载 CSV 模板
        </a>
      </div>
      {error && <div className="mt-2 text-xs text-crimson">{error}</div>}
      {result && (
        <div className="mt-2 rounded-md border border-moss/40 bg-moss-50/60 p-2.5 text-xs text-moss-700">
          ✓ 已导入 <b>{result.imported}</b> 条
          {result.preview.length > 0 && <span className="ml-2 text-ink3">预览：{result.preview.join(' · ')}…</span>}
        </div>
      )}
    </div>
  );
}

/** 每日提醒：需联动浏览器通知权限 */
function DailyReminderToggle({ on, onChange }: { on: boolean; onChange: (b: boolean) => void }) {
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const supported = hasNotificationSupport();

  async function handleToggle(b: boolean) {
    if (!supported) return;
    if (b && perm !== 'granted') {
      const next = await requestNotificationPermission();
      setPerm(next);
      if (next !== 'granted') return; // 用户拒绝就不打开
    }
    onChange(b);
  }

  const blocked = perm === 'denied';

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-md border p-3 transition-colors',
      on && perm === 'granted' ? 'border-persimmon/50 bg-paper' : 'border-paper3 bg-paper2/50'
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-sm font-bold text-ink">每日学习提醒</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink3">daily reminder</span>
        </div>
        <p className="mt-1 text-xs text-ink3 leading-relaxed">
          {!supported && '此浏览器不支持通知 API。'}
          {supported && blocked && '通知权限已被拒绝，请到浏览器设置中允许后再试。'}
          {supported && !blocked && '超过 22h 没学习 / 复习池 ≥ 30 词时，自动弹系统通知。PWA 安装到桌面后体验更佳。'}
        </p>
        {on && perm === 'granted' && (
          <button onClick={() => checkAndNotify()} className="mt-2 font-mono text-[10px] uppercase tracking-wider text-persimmon-700 hover:text-persimmon">
            ▸ 立即测试通知
          </button>
        )}
      </div>
      <Toggle on={on && perm === 'granted'} onChange={handleToggle} />
    </div>
  );
}

function ModeTile({ active, title, en, sub, onClick }: { active: boolean; title: string; en: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border p-4 text-left transition-all',
        active ? 'border-persimmon bg-persimmon-50/40 shadow-paper' : 'border-paper3 bg-paper hover:border-ink'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{en}</span>
        <span className={cn('grid h-5 w-5 place-items-center rounded-full border', active ? 'border-persimmon bg-persimmon text-paper' : 'border-paper3')}>
          {active && <Check size={12} />}
        </span>
      </div>
      <div className="font-display text-xl font-bold text-ink">{title}</div>
      <p className="text-xs text-ink3 leading-relaxed">{sub}</p>
    </button>
  );
}

function EnhancedToggle({ label, en, sub, on, onChange }: { label: string; en: string; sub: string; on: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-md border p-3 transition-colors',
      on ? 'border-persimmon/50 bg-paper' : 'border-paper3 bg-paper2/50'
    )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-sm font-bold text-ink">{label}</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink3">{en}</span>
        </div>
        <p className="mt-1 text-xs text-ink3 leading-relaxed">{sub}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-7 w-12 items-center rounded-full border transition-colors',
        on ? 'border-persimmon bg-persimmon' : 'border-paper3 bg-paper2'
      )}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-paper shadow-paper transition-transform', on ? 'translate-x-6' : 'translate-x-0.5')} />
    </button>
  );
}

/* ============================================================
   Gist 同步 Section
   ============================================================ */

interface GistSyncSectionProps {
  gist: GistConfig;
  setGist: (cfg: Partial<GistConfig>) => Promise<void>;
  pushing: boolean;
  pulling: boolean;
  error: string;
  success: string;
  pullStrategy: ImportStrategy;
  setPullStrategy: (s: ImportStrategy) => void;
  pullAIConfig: boolean;
  setPullAIConfig: (b: boolean) => void;
  onPush: () => void;
  onPull: () => void;
  onDisconnect: () => void;
}

function GistSyncSection({
  gist, setGist,
  pushing, pulling, error, success,
  pullStrategy, setPullStrategy,
  pullAIConfig, setPullAIConfig,
  onPush, onPull, onDisconnect,
}: GistSyncSectionProps) {
  const [copied, setCopied] = useState(false);
  const canPush = !!gist.token;
  const canPull = !!gist.token && !!gist.gistId;
  const canCopy = !!gist.token && !!gist.gistId;
  const isBusy = pushing || pulling;

  function copyConfigUrl() {
    const url = `${window.location.origin}/#/?gistId=${gist.gistId}&githubToken=${gist.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Section id="gist" title="云端同步" sub="cloud sync · github gist">
      {/* 凭据输入 */}
      <Field label="Gist ID" hint="留空时推送将自动创建新 Gist">
        <div className="flex gap-2">
          <input
            className="input font-mono flex-1"
            value={gist.gistId}
            onChange={(e) => setGist({ gistId: e.target.value.trim() })}
            placeholder="a1b2c3d4e5f6…"
          />
          <button
            onClick={copyConfigUrl}
            disabled={!canCopy}
            title="复制配置链接（用于新设备快速导入）"
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
              canCopy
                ? copied
                  ? 'border-moss bg-moss-50/50 text-moss-700'
                  : 'border-paper3 text-ink2 hover:border-ink'
                : 'border-paper3 text-ink3 opacity-50 cursor-not-allowed'
            )}
          >
            {copied ? <><CheckCheck size={12} /> 已复制</> : <><Link size={12} /> 复制链接</>}
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-ink3">
          复制链接可在新设备直接打开完成配置导入
        </p>
      </Field>

      <Field label="GitHub Token" hint="建议只授予 Gist 读写权限">
        <input
          className="input font-mono"
          type="password"
          value={gist.token}
          onChange={(e) => setGist({ token: e.target.value.trim() })}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        />
        <a
          href="https://github.com/settings/tokens?type=beta"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-persimmon-700 hover:text-persimmon transition-colors"
        >
          <Link2Off size={10} /> 查看 Token 权限说明 ↗
        </a>
      </Field>

      {/* 同步选项 */}
      <Field label="同步选项">
        <div className="flex flex-wrap gap-4">
          <Checkbox
            checked={gist.autoSync}
            onChange={(b) => setGist({ autoSync: b })}
            label="自动推送（学习/复习结束后）"
          />
          <Checkbox
            checked={gist.includeAIConfig}
            onChange={(b) => setGist({ includeAIConfig: b })}
            label="含 AI 配置（含 API Key ⚠）"
          />
        </div>
      </Field>

      {/* 状态栏 */}
      {gist.gistId && (
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0',
            !gist.lastSyncedAt ? 'bg-ink3' :
            gist.lastSyncStatus === 'ok' ? 'bg-moss' : 'bg-crimson'
          )} />
          {!gist.lastSyncedAt && <span className="text-ink3">从未同步</span>}
          {gist.lastSyncedAt && (
            <>
              <span className="text-ink3">
                上次同步：{new Date(gist.lastSyncedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={gist.lastSyncStatus === 'ok' ? 'text-moss' : 'text-crimson'}>
                {gist.lastSyncStatus === 'ok' ? '✓ 成功' : '✗ 失败'}
              </span>
            </>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <Field label="操作">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onPush}
            disabled={!canPush || isBusy}
            className={cn(
              'btn-ghost flex-1 sm:flex-none',
              (!canPush || isBusy) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {pushing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
            推送备份
          </button>
          <button
            onClick={onPull}
            disabled={!canPull || isBusy}
            className={cn(
              'btn-ghost flex-1 sm:flex-none',
              (!canPull || isBusy) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {pulling ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            拉取同步
          </button>
          {gist.gistId && (
            <button
              onClick={onDisconnect}
              disabled={isBusy}
              className="btn border border-crimson/50 text-crimson hover:bg-crimson-50 flex-1 sm:flex-none"
            >
              <Link2Off size={14} /> 断开配置
            </button>
          )}
        </div>
      </Field>

      {/* 拉取策略 */}
      <Field label="拉取策略" hint="决定拉取时如何处理本地已有数据">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['merge', 'replace'] as ImportStrategy[]).map((s) => (
              <button
                key={s}
                onClick={() => setPullStrategy(s)}
                className={cn(
                  'rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition',
                  pullStrategy === s ? 'border-ink bg-ink text-paper' : 'border-paper3 text-ink2 hover:border-ink'
                )}
              >
                {s === 'merge' ? '合并 (推荐)' : '替换 (危险)'}
              </button>
            ))}
            <span className="self-center font-mono text-[10px] text-ink3">
              {pullStrategy === 'merge' ? '保留现有数据，按 wordId/lessonId 去重更新' : '清空后再导入（无法恢复）'}
            </span>
          </div>
          <Checkbox
            checked={pullAIConfig}
            onChange={setPullAIConfig}
            label="拉取时导入 AI 配置（含 API Key）"
          />
        </div>
      </Field>

      {/* 错误 / 成功提示 */}
      {error && (
        <div className="rounded-md border border-crimson bg-crimson-50/50 p-3 text-sm text-crimson">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-moss bg-moss-50/50 p-3 text-sm text-moss-700">
          <div className="font-semibold">✓ {success}</div>
        </div>
      )}

      {/* 安全说明 */}
      <div className="rounded-md border border-dashed border-paper3 bg-paper2/40 p-4 text-xs text-ink3">
        <div className="mb-1 flex items-center gap-1.5 font-mono uppercase tracking-wider">
          <Cloud size={12} className="text-persimmon" /> gist sync · 安全说明
        </div>
        <ul className="ml-4 list-disc space-y-0.5">
          <li>Token 仅存储在<b>本设备 IndexDB</b>，不经任何服务器中转</li>
          <li>建议使用 GitHub Fine-grained PAT，只授予 <b>Gists: Read and Write</b> 权限</li>
          <li>Gist 创建时为<b>私有（Secret）</b>，非公开可见</li>
          <li>默认不含 API Key；勾选"含 AI 配置"时 apiKey 才写入 Gist</li>
        </ul>
      </div>
    </Section>
  );
}
