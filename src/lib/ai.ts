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
  tip: string;       // 一句话巧记（<= 30 字）
  detail?: string;   // 详细记忆方法
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
        content: `你是中文母语者的英语记忆教练。为每个英文单词输出"巧记"（一句话口诀或联想，限 30 字内）和可选的"详细记忆方法"（拆词根/谐音/场景，1-3 句）。
严格输出 JSON 数组，长度与输入完全一致，不要有多余文字或代码块标记。`,
      },
      {
        role: 'user',
        content: `${list}

输出 JSON 数组，每项格式：
{ "word": "ability", "tip": "abil(能力)+ity=能干的本事", "detail": "abil 来自 able(能够), -ity 是抽象名词后缀" }

要求：
- tip 必须有，简短易记，能在练习时一眼复习
- detail 可选，进一步加深印象
- 严格保持顺序对应`,
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
