import type { AIConfig } from '@/stores/settingsStore';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AIError extends Error {
  constructor(msg: string, public status?: number) {
    super(msg);
  }
}

/* ---------- /models 拉取 ---------- */
export async function fetchModels(cfg: AIConfig): Promise<string[]> {
  if (!cfg.apiKey) throw new AIError('请先填写 API Key');
  if (cfg.provider === 'gemini') {
    const url = `${cfg.baseURL.replace(/\/$/, '')}/models?key=${encodeURIComponent(cfg.apiKey)}`;
    const r = await fetch(url);
    if (!r.ok) throw new AIError(`Gemini /models 失败：HTTP ${r.status}`, r.status);
    const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return (j.models ?? [])
      .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  }
  const url = `${cfg.baseURL.replace(/\/$/, '')}/models`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  if (!r.ok) throw new AIError(`OpenAI /models 失败：HTTP ${r.status}`, r.status);
  const j = (await r.json()) as { data: { id: string }[] };
  return (j.data ?? []).map((m) => m.id).sort();
}

/* ---------- chat 入口 ---------- */
export async function chat(messages: AIMessage[], cfg: AIConfig, signal?: AbortSignal): Promise<string> {
  if (!cfg.apiKey) throw new AIError('请先填写 API Key');
  if (cfg.provider === 'gemini') return chatGemini(messages, cfg, signal);
  if (cfg.endpoint === 'responses') return chatResponses(messages, cfg, signal);
  return chatCompletions(messages, cfg, signal);
}

async function chatCompletions(messages: AIMessage[], cfg: AIConfig, signal?: AbortSignal): Promise<string> {
  const url = `${cfg.baseURL.replace(/\/$/, '')}/chat/completions`;
  const r = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
    }),
  });
  if (!r.ok) throw new AIError(`API 错误：HTTP ${r.status} · ${await safeText(r)}`, r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}

async function chatResponses(messages: AIMessage[], cfg: AIConfig, signal?: AbortSignal): Promise<string> {
  const url = `${cfg.baseURL.replace(/\/$/, '')}/responses`;
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const input = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
  const r = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      input,
      instructions: sys || undefined,
      temperature: cfg.temperature,
    }),
  });
  if (!r.ok) throw new AIError(`Responses API 错误：HTTP ${r.status} · ${await safeText(r)}`, r.status);
  const j = await r.json();
  // 兼容多种 response 形态
  if (typeof j.output_text === 'string') return j.output_text;
  const items = j.output ?? j.choices ?? [];
  for (const it of items) {
    if (typeof it === 'string') return it;
    if (it.content) {
      if (Array.isArray(it.content)) {
        const t = it.content.find((c: any) => c.type === 'output_text' || c.type === 'text');
        if (t?.text) return typeof t.text === 'string' ? t.text : t.text.value ?? '';
      } else if (typeof it.content === 'string') {
        return it.content;
      }
    }
    if (it.message?.content) return typeof it.message.content === 'string' ? it.message.content : '';
  }
  return '';
}

async function chatGemini(messages: AIMessage[], cfg: AIConfig, signal?: AbortSignal): Promise<string> {
  const modelPath = cfg.model.startsWith('models/') ? cfg.model : `models/${cfg.model}`;
  const url = `${cfg.baseURL.replace(/\/$/, '')}/${modelPath}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const r = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
      generationConfig: { temperature: cfg.temperature },
    }),
  });
  if (!r.ok) throw new AIError(`Gemini 错误：HTTP ${r.status} · ${await safeText(r)}`, r.status);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
}

async function safeText(r: Response) {
  try {
    const t = await r.text();
    return t.slice(0, 240);
  } catch {
    return '';
  }
}

/* ---------- 业务封装 ---------- */
export async function explainWord(word: string, translations: string, cfg: AIConfig): Promise<string> {
  return chat(
    [
      { role: 'system', content: `你是一位耐心的英语老师，帮助 0 基础中文学习者。回答用简体中文，结构清晰，使用 Markdown。` },
      {
        role: 'user',
        content: `请围绕单词 **${word}**（中文释义：${translations}）输出：
1. 词根/词源拆解（如果有）
2. 一个易记的中文记忆方法或联想
3. 三个由浅入深的英文例句（配中文翻译）
4. 一个常见搭配 / 易混词提醒

保持简洁，每节 1-3 句即可。`,
      },
    ],
    cfg
  );
}

export async function generateGrammarExercises(
  lessonTitle: string,
  rule: string,
  cfg: AIConfig,
  count = 3
): Promise<{ question: string; options: string[]; answer: string; explain?: string }[]> {
  const out = await chat(
    [
      { role: 'system', content: `你出英语选择题给 0 基础学习者。严格输出 JSON 数组，不要任何额外文字或代码块标记。` },
      {
        role: 'user',
        content: `语法点：${lessonTitle}
规则：${rule}

请出 ${count} 道选择题，每题 3 个选项，仅一个正确。输出 JSON 数组：
[
  { "question": "She ___ a teacher.", "options": ["am","is","are"], "answer": "is", "explain": "第三人称单数用 is" }
]
要求：题目简洁，难度循序递进，覆盖典型用法。`,
      },
    ],
    cfg
  );
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error('not array');
    return arr.filter((q) => q.question && q.answer && Array.isArray(q.options));
  } catch (e) {
    throw new AIError('AI 返回内容无法解析为题目，请重试或换个模型');
  }
}

/** 批量生成助记，一次 API 调用搞定一组词 */
export interface MnemonicItem {
  word: string;
  tip: string;            // 一句话巧记（<= 30 字）
  detail?: string;        // 详细记忆方法
  ipa?: string;           // 国际音标
  examples?: { en: string; zh: string }[];  // 2 个例句
}

/** 一次 API 调用同时生成：巧记 + 词根族（"AI 一键增强"用） */
export interface EnhancementItem extends MnemonicItem {
  root?: string;            // 词根/词缀本体，如 dict / pre- / -tion
  rootMeaning?: string;     // 词根含义
  family?: { word: string; gloss: string }[]; // 5-8 个同根词
}

export async function batchGenerateMnemonics(
  words: { word: string; translations: string }[],
  cfg: AIConfig,
  signal?: AbortSignal
): Promise<MnemonicItem[]> {
  if (words.length === 0) return [];
  const list = words.map((w, i) => `${i + 1}. ${w.word} —— ${w.translations}`).join('\n');
  const out = await chat(
    [
      {
        role: 'system',
        content: `你是中文母语者的英语记忆教练，**擅长用中式梗、谐音、段子、形象化故事**让中国学习者快速记单词。
为每个英文单词输出：①IPA 音标 ②"中式梗"巧记口诀（30 字内，必须有记忆点：谐音/双关/小段子/形象化场景，禁止干巴巴的"abil+ity=能力"那种）③详细记忆方法（1-3 句）④2 个由浅入深的例句（含中文翻译）。
严格输出 JSON 数组，长度与输入完全一致，不要任何额外文字、解释或代码块标记。`,
      },
      {
        role: 'user',
        content: `${list}

输出 JSON 数组，每项格式：
{
  "word": "ambulance",
  "ipa": "/ˈæmbjələns/",
  "tip": "俺不能死！救护车 ambulance 来啦",
  "detail": "谐音\"俺不能死\"——救护车出现时，伤员的心声。",
  "examples": [
    { "en": "Call an ambulance immediately!", "zh": "快叫救护车！" },
    { "en": "The ambulance rushed him to the nearest hospital.", "zh": "救护车把他紧急送到最近的医院。" }
  ]
}

巧记 tip 的写法范式（任选其一）：
- 谐音 / 中式谐音梗："pest(害虫) → 拍死它" "abandon → 我抛弃了俺爸俺弟俺侄"
- 拆字串故事："ambition → am(我)+bit(一点点)+ion → 我有一点点野心"
- 场景化："develop → 开发(de) 把 envelop(信封) 拆开 → 拆开来发展"
- 反差 / 对比："eligible(合格) ≠ illegible(难辨认)"
- 词根扩展时也要加趣味，如 "spect(看): 注意 inspect(往里看 = 检查)"

严格要求：
- ipa 必须用国际音标符号（重音符 ˈ、长音 ː），不要用 KK 或字母拼音
- tip 必须有记忆点、有趣或形象，禁止"X + Y = 含义"这种干巴公式
- examples **必须来自真实英语语境**：新闻、对话、小说、日常表达。绝对不要造句腔（如 "I am happy" 这种），优先选有动词搭配、定语从句、介词短语等真实结构。例句长度 8-15 词为佳
- 严格保持顺序对应输入`,
      },
    ],
    cfg,
    signal
  );
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error('not array');
    return arr.map((x) => ({
      word: String(x.word ?? ''),
      tip: String(x.tip ?? ''),
      detail: x.detail ? String(x.detail) : undefined,
      ipa: x.ipa ? String(x.ipa) : undefined,
      examples: Array.isArray(x.examples)
        ? x.examples
            .map((e: any) => ({ en: String(e?.en ?? ''), zh: String(e?.zh ?? '') }))
            .filter((e: { en: string; zh: string }) => e.en && e.zh)
            .slice(0, 3)
        : undefined,
    })).filter((x) => x.word && x.tip);
  } catch {
    throw new AIError('AI 返回内容无法解析为巧记数组，请重试或换个模型');
  }
}

export async function explainWrongAnswer(question: string, userAnswer: string, correctAnswer: string, cfg: AIConfig): Promise<string> {
  return chat(
    [
      { role: 'system', content: '用最简短的中文向 0 基础学习者解释错题原因。不超过 80 字。' },
      { role: 'user', content: `题目：${question}\n我的答案：${userAnswer}\n正确答案：${correctAnswer}\n请讲解为什么。` },
    ],
    cfg
  );
}

/* ---------- 一站式增强：巧记 + 词根 一次生成 ---------- */
/** 整批单词调用 1 次（或按 batchSize 分批），同时返回巧记 + 词根 + 词族 */
export async function batchGenerateEnhancement(
  words: { word: string; translations: string }[],
  cfg: AIConfig,
  signal?: AbortSignal
): Promise<EnhancementItem[]> {
  if (words.length === 0) return [];
  const list = words.map((w, i) => `${i + 1}. ${w.word} —— ${w.translations}`).join('\n');
  const out = await chat(
    [
      {
        role: 'system',
        content: `你是中文母语者的英语记忆教练 + 词源学家。一次性输出每个单词的：
①IPA 音标
②中式梗巧记口诀（谐音/段子/形象化故事，30 字内，禁止干巴公式）
③详细记忆方法（1-3 句）
④2 个真实语境例句
⑤词根/词缀本体 + 含义 + 5-8 个同根词
严格输出 JSON 数组，长度与输入完全一致，不要额外文字或代码块标记。`,
      },
      {
        role: 'user',
        content: `${list}

每项格式：
{
  "word": "predict",
  "ipa": "/prɪˈdɪkt/",
  "tip": "pre(预先)+dict(说)→预先说出来=预测",
  "detail": "想象算命先生在你出生前就 pre-dict——预先说出你的命运。",
  "examples": [
    { "en": "Economists predict a sharp rise in inflation next quarter.", "zh": "经济学家预测下季度通胀将急剧上升。" },
    { "en": "It's hard to predict how he'll react.", "zh": "很难预测他会作何反应。" }
  ],
  "root": "dict",
  "rootMeaning": "说、讲",
  "family": [
    { "word": "predict", "gloss": "预言、预测" },
    { "word": "verdict", "gloss": "裁决、定论" },
    { "word": "contradict", "gloss": "反驳" },
    { "word": "dictate", "gloss": "口述、命令" },
    { "word": "dictionary", "gloss": "词典" }
  ]
}

要求：
- tip 必须有中式记忆点（谐音/段子/形象化），禁止"abil+ity=能力"这种公式
- examples 真实语境，禁造句腔，8-15 词
- root 只填最核心的一条，若无（外来语/拟声）填 "—" 并 family=[]
- family 5-8 个，gloss ≤ 8 字中文释义
- 严格 JSON 数组，与输入顺序一致`,
      },
    ],
    cfg,
    signal
  );
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error('not array');
    return arr.map((x: any) => ({
      word: String(x.word ?? ''),
      tip: String(x.tip ?? ''),
      detail: x.detail ? String(x.detail) : undefined,
      ipa: x.ipa ? String(x.ipa) : undefined,
      examples: Array.isArray(x.examples)
        ? x.examples
            .map((e: any) => ({ en: String(e?.en ?? ''), zh: String(e?.zh ?? '') }))
            .filter((e: { en: string; zh: string }) => e.en && e.zh)
            .slice(0, 3)
        : undefined,
      root: x.root ? String(x.root) : undefined,
      rootMeaning: x.rootMeaning ? String(x.rootMeaning) : undefined,
      family: Array.isArray(x.family)
        ? x.family
            .map((f: any) => ({ word: String(f?.word ?? ''), gloss: String(f?.gloss ?? '') }))
            .filter((f: { word: string }) => f.word)
            .slice(0, 8)
        : [],
    })).filter((x: EnhancementItem) => x.word && x.tip);
  } catch {
    throw new AIError('AI 返回内容无法解析为增强数组，请重试或换个模型');
  }
}

/* ---------- 词根 / 词缀关联（单词维度，保留用于 Library 单查） ---------- */
export interface WordRootResult {
  root: string;
  meaning: string;
  family: { word: string; gloss: string }[];
}

export async function generateWordRoot(word: string, translation: string, cfg: AIConfig, signal?: AbortSignal): Promise<WordRootResult> {
  const out = await chat(
    [
      {
        role: 'system',
        content: '你是英文词源学家。给出英文单词的词根/词缀和 5-8 个同根词。严格输出 JSON，不要任何额外文字或代码块标记。',
      },
      {
        role: 'user',
        content: `单词：${word}（${translation}）

输出 JSON：
{
  "root": "词根/词缀本体，如 dict / pre- / -tion",
  "meaning": "中文含义（≤ 15 字）",
  "family": [
    { "word": "predict", "gloss": "预言、预测" },
    { "word": "verdict", "gloss": "裁决" }
  ]
}

要求：
- 只输出一条最核心的词根/前缀/后缀
- family 给 5-8 个真正同根的常见词，按使用频率排序，gloss 用 ≤ 8 字的中文释义
- 当前单词若本身在 family 中可以保留；若该词无明显词根（如外来语 / 拟声词），返回 root="—", family=[]`,
      },
    ],
    cfg,
    signal
  );
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const j = JSON.parse(clean);
    return {
      root: String(j.root ?? '—'),
      meaning: String(j.meaning ?? ''),
      family: Array.isArray(j.family)
        ? j.family
            .map((x: any) => ({ word: String(x?.word ?? ''), gloss: String(x?.gloss ?? '') }))
            .filter((x: { word: string }) => x.word)
            .slice(0, 8)
        : [],
    };
  } catch {
    throw new AIError('AI 返回内容无法解析为词根 JSON');
  }
}

/* ---------- 用户造句点评（主动回忆） ---------- */
export interface SentenceEvaluation {
  score: number;       // 0-5
  feedback: string;    // 简短中文点评（≤ 60 字）
}

export async function evaluateUserSentence(word: string, sentence: string, cfg: AIConfig, signal?: AbortSignal): Promise<SentenceEvaluation> {
  const out = await chat(
    [
      {
        role: 'system',
        content: '你是英语作文教练。学习者用指定单词造句，请打分并简短点评。严格输出 JSON。',
      },
      {
        role: 'user',
        content: `目标单词：${word}
学习者造句：${sentence}

输出 JSON：{"score": 0-5 的整数, "feedback": "中文点评 ≤ 60 字"}

评分维度：
- 是否正确使用该单词（最关键）
- 语法是否正确
- 表达是否自然
- 5 = 完美；4 = 小瑕疵；3 = 可读但有错；2 = 多处错误；1 = 单词使用错误；0 = 完全错误`,
      },
    ],
    cfg,
    signal
  );
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const j = JSON.parse(clean);
    return {
      score: Math.max(0, Math.min(5, Number(j.score ?? 0))),
      feedback: String(j.feedback ?? ''),
    };
  } catch {
    throw new AIError('AI 返回无法解析为评分 JSON');
  }
}
