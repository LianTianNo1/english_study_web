# English Hub — 项目上下文文档

> **给 AI 的重要指令**
> 1. 每次完成功能实现后，**必须更新本文档**的对应章节（新增文件写入文件清单，新功能写入功能列表，变更追加到变更日志）。
> 2. Git commit 使用项目配置：`git config user.email "1584731441@qq.com"` / `git config user.name "子浪"`，无需每次重新配置，已写入仓库级 config。
> 3. 阅读本文档后，**无需再全盘扫描项目**，直接参考此文档定位目标文件。

---

## 项目概述

**English Hub** 是一个本地优先（Local-First）的英语学习 PWA，面向中国学习者设计。

- **口号**：像读一本有温度的笔记本，而不是刷题软件。
- **核心理念**：编辑笔记本美学（paper/ink）+ SRS 间隔重复 + AI 增强
- **部署**：静态托管（GitHub Pages / 任意 CDN），HashRouter，离线可用

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| 路由 | React Router v6（HashRouter，URL 形如 `/#/learn`） |
| 全局状态 | Zustand（`src/stores/settingsStore.ts`） |
| 本地数据库 | Dexie.js（IndexedDB 封装） |
| 样式 | Tailwind CSS v3 + 自定义组件类 |
| 图标 | Lucide React |
| TTS | 三层降级：Web Speech API → 云端镜像 → meSpeak WASM |
| AI | OpenAI / Gemini API（用户自带 key） |
| 云同步 | GitHub Gist（JSON 格式，双向同步） |
| PWA | Vite PWA Plugin |

---

## 设计系统

### 颜色（`tailwind.config.ts`）

```
paper    #FBF7F0  主背景（奶油纸）
paper2   #F4ECDF  次背景
paper3   #EADFC8  分隔线/边框

ink      #1A1614  主文本（深墨）
ink2     #3B342E  次文本
ink3     #6B6058  弱文本/占位符
muted    #A89B8E  边框/禁用

persimmon  #D9501F  主交互色（复古柿橙）→ 学习/强调
indigo2    #243B5C  语法模块色（墨蓝）
moss       #5B7F4C  成功/掌握色（苔藓绿）
crimson    #A8362B  错误色（仅用于错误状态）
```

### 字体

```
font-display  Fraunces（衬线体）     标题、大号数字、IPA 符号
font-body     DM Sans（无衬线）      正文、UI 文本
font-mono     JetBrains Mono        标签、代码、章节码
```

### 常用组件类（`src/styles/index.css`）

```css
.btn               基础按钮
.btn-primary       深墨背景（shadow-ink 错位阴影）
.btn-accent        persimmon 背景 + 按下效果
.btn-ghost         幽灵按钮（border + 透明背景）
.btn-icon          圆形图标按钮

.paper-card        纸质卡片（带纹理 + 阴影）
.paper-card-dark   深色纸质卡片

.input             标准文本输入框

.tag               小标签（带圆角 pill）
.tag-ink           深色小标签

.chapter-num       大号衬线章节数字
.dropcap           段首字下沉
.doodle-underline  手绘波浪强调下划线
.divider           带文字的分隔线

.meter-track       进度条轨道
.meter-bar         进度条填充

.kbd               键帽样式
.no-scrollbar      隐藏滚动条但保留滚动
.fade-x            横向淡出蒙版
```

### 动画（Tailwind 自定义）

```
animate-fade-up    淡入上升（0.45s）
animate-pop        弹跳缩放（0.35s）
animate-underline-grow  下划线伸展（0.6s）
```

---

## 目录结构

```
src/
├── components/          可复用组件库
│   ├── ActiveRecallSentence.tsx    主动回忆（造句练习）
│   ├── AIPanel.tsx                 AI 助手侧边面板
│   ├── AnswerInput.tsx             答题输入框（单字方格 / 自由输入自动切换）
│   ├── AppLayout.tsx               主应用布局（顶部 header + 底部 Tab + 抽屉）
│   ├── GistAutoPullDialog.tsx      Gist 云端自动同步对话框
│   ├── Markdown.tsx                Markdown 渲染器
│   ├── MicroReview.tsx             5 分钟微复习组件
│   ├── MnemonicHint.tsx            AI 巧记提示（浮窗 / 底部抽屉）
│   ├── MobileSheet.tsx             通用移动端抽屉（bottom / right）
│   ├── PronunciationRecorder.tsx   录音回放对比
│   ├── PWAUpdatePrompt.tsx         PWA 更新提示
│   ├── QuizCard.tsx                核心学习卡片（选择题 / 拼写题）
│   ├── SessionWrap.tsx             学习会话包装器（进度条 + 结算）
│   ├── ShortcutsPanel.tsx          键盘快捷键帮助面板
│   └── WordRootsPanel.tsx          词根词缀同源词面板
│
├── pages/               路由页面
│   ├── Home.tsx                    首页（今日概览 + 学习入口）
│   ├── Learn.tsx                   新词学习主流程（Preview→Quiz→Micro→Done）
│   ├── Review.tsx                  复习（SRS 遍历）
│   ├── Grammar.tsx                 语法课程列表（25 节，带进度）
│   ├── GrammarLesson.tsx           单节语法课（场景→例句→规律→练习）
│   ├── Phonics.tsx                 音标学习（浏览模式 + 练习模式）        ← [新增 2026-05]
│   ├── Play.tsx                    3D 拼写积木塔游戏（独立路由 /play）   ← [新增 2026-05-19]
│   ├── Play2.tsx                   单词陨石防御战（独立路由 /play2）      ← [新增 2026-05-20]
│   ├── Library.tsx                 词库浏览
│   ├── Listening.tsx               听写专项（The Ear Test）
│   ├── Mistakes.tsx                错题本 / 难词收藏
│   ├── Stats.tsx                   统计数据展示
│   ├── WeeklyReport.tsx            周报
│   ├── Settings.tsx                设置（AI / TTS / 同步）
│   └── Onboarding.tsx              新用户引导（独立路由，不在 AppLayout 内）
│
├── features/            功能引擎（重逻辑，无 UI）
│   ├── learn-session/
│   │   └── session.ts              学习会话状态机（initSession / submitAnswer / nextQuestion）
│   ├── grammar-engine/
│   │   └── ExerciseRenderer.tsx    语法 5 种题型渲染引擎
│   ├── play-3d/                    3D 拼写游戏引擎（R3F + Postprocessing） ← [v4 全屏沉浸 2026-05-19]
│   │   ├── PlayScene.tsx           R3F Canvas 根（黑底/Bloom/反射地面/雾化/相机推拉 CameraDolly）
│   │   ├── LetterBlock.tsx         发光字母方块 + 点击飞行 + 入场错峰 + 黄金/彩虹流光（共享几何避免泄漏）
│   │   ├── Slot.tsx / SlotRow.tsx  霓虹圆盘凹槽 + 呼吸光环 + 命中爆光
│   │   ├── HUD.tsx                 完整 HUD（exit/stage/lives/timer/释义大窗/已拼进度方格/SCORE/COMBO/BEST/飞字反馈/边缘脉冲/扫描线/H/Tab 按钮）
│   │   ├── ModePicker.tsx          入口模式选择（复习/错题/新学，含各源词量统计）
│   │   ├── StageClearOverlay.tsx   通关 2D HTML 覆盖层（白闪 + 巨大金渐变单词 + 字母错峰弹入）
│   │   ├── ResultPanel.tsx         关卡 / 会话结算 + SS 评级 + 重玩本组/新单词/换模式
│   │   ├── usePlaySession.ts       useReducer 状态机（score/combo/timer/feedbacks/freeze/revealed/pendingRetractIds）
│   │   ├── scoring.ts              分数 / speedBonus / SS 评级算法（纯函数）
│   │   ├── useShake.ts             相机屏震 hook + 单例 api
│   │   ├── Particles.tsx           粒子爆裂模块级 store + 共享 SphereGeometry
│   │   ├── stageBuilder.ts         关卡生成（按 mode 取词 + 干扰字母 + 1/3 概率黄金字母）
│   │   └── types.ts
│   ├── play-meteor/                单词陨石防御战引擎（R3F，无物理库）   ← [新增 2026-05-20]
│   │   ├── MeteorScene.tsx         R3F Canvas 根（深空黑/Bloom/ChromaticAberration/雾化/Sparkles/地网）
│   │   ├── Meteor.tsx              单颗陨石（低面 Icosahedron + 逐字母单词 Billboard + 锁定绿准星）
│   │   ├── Base.tsx                玩家基地（发光穹顶 + 六边停机坪 + 受击红闪）
│   │   ├── Laser.tsx               激光射线（模块级 store，基地→陨石短生命光束）
│   │   ├── Radar.tsx               右下角雷达扫描仪（签名元素：陨石光点 + 旋转扫描线）
│   │   ├── HUD3.tsx                终端风 HUD（SCORE/COMBO/WAVE/基地完整度/锁定单词读数/雷达/飞字）
│   │   ├── MeteorModePicker.tsx    终端风 MISSION SELECT 入口（复习/错题/新学）
│   │   ├── ResultPanel3.tsx        胜利/失败结算 + S~D 评级
│   │   ├── useMeteorSession.ts     useReducer 状态机（meteors/lockedId/baseHp/score/combo/results）
│   │   ├── meteorEngine.ts         纯函数（难度曲线/坐标映射/锁定选择/计分/评级）
│   │   ├── wordSource.ts           取词（复用 review/mistakes/new 三分支）
│   │   └── types.ts
│   └── srs/                        间隔重复算法
│       ├── sm2.ts                  SM-2 算法
│       ├── ebbinghaus.ts           艾宾浩斯算法
│       └── index.ts                SRS 调度器（统一入口）
│
├── db/                  数据库层（Dexie IndexedDB）
│   ├── schema.ts                   数据库表定义 + 版本迁移
│   ├── types.ts                    所有核心数据类型（WordRecord / ProgressRecord 等）
│   ├── importer.ts                 数据导入（JSON / Gist）
│   └── repositories/               数据访问层（Repository 模式）
│       ├── words.ts                单词 CRUD
│       ├── progress.ts             学习进度管理（learned / due 查询）
│       ├── sessions.ts             学习会话记录
│       ├── grammar.ts              语法课程进度（unlock / complete）
│       ├── mnemonics.ts            AI 巧记缓存
│       ├── wordRoots.ts            词根词缀缓存
│       └── userSentences.ts        用户造句记录
│
├── stores/              全局状态（Zustand）
│   └── settingsStore.ts            所有配置（学习模式/AI/TTS/Gist/增强功能）
│
├── lib/                 工具库
│   ├── ai.ts                       AI API 调用（OpenAI / Gemini）
│   ├── tts.ts                      文本转语音（三层降级架构）
│   ├── gist.ts                     GitHub Gist 同步
│   ├── backup.ts                   备份导出
│   ├── notifications.ts            浏览器通知
│   ├── sfx.ts                      音效管理（chime / thud / tick）
│   ├── diff.ts                     字符差分对比（答题错误时高亮）
│   ├── customImport.ts             自定义词库导入
│   ├── play-srs.ts                 拼字游戏关卡→SRS 回写适配器          ← [新增 2026-05-19]
│   ├── play-meteor-srs.ts          陨石游戏单词→SRS 回写适配器          ← [新增 2026-05-20]
│   ├── utils.ts                    通用工具（cn / shuffle 等）
│   └── useMediaQuery.ts            响应式媒体查询 Hook
│
├── hooks/               自定义 React Hooks
│   ├── useGistUrlParams.ts         URL 参数同步（Gist 分享链接处理）
│   └── usePhonicsProgress.ts       音标学习进度（localStorage）        ← [新增 2026-05]
│
├── data/                静态数据
│   ├── grammar-lessons.ts          25 节语法课程完整数据（1246 行）
│   └── phonics-data.ts             44 个 IPA 音标数据（含巧记/分组）  ← [新增 2026-05]
│
├── styles/
│   └── index.css                   Tailwind 指令 + 全局组件类 + 动画 keyframes
│
├── router.tsx           React Router 路由配置（懒加载）
├── main.tsx             应用入口
└── vite-env.d.ts        Vite 类型声明
```

---

## 路由表

| 路径 | 页面组件 | 导航位置 |
|------|----------|----------|
| `/` | `Home` | 移动 Tab[0] / 桌面 Primary[0] |
| `/learn` | `Learn` | 移动 Tab[1] / 桌面 Primary[1] |
| `/review` | `Review` | 移动 Tab[2] / 桌面 Primary[2] |
| `/listening` | `Listening` | 移动 Tab[3] / 桌面 Primary[3] |
| `/mistakes` | `Mistakes` | 移动 More 抽屉 / 桌面 Primary[4] |
| `/grammar` | `Grammar` | 移动 More 抽屉 / 桌面 Primary[5] |
| `/phonics` | `Phonics` | 移动 More 抽屉 / 桌面 Secondary |
| `/play` | `Play` | 移动 More 抽屉 / 桌面导航（3D 拼字游戏，**独立顶层路由，全屏不在 AppLayout 内**） |
| `/play2` | `Play2` | 移动 More 抽屉 / 桌面导航（单词陨石防御战，**独立顶层路由，全屏不在 AppLayout 内**） |
| `/library` | `Library` | 移动 More 抽屉 / 桌面 Secondary |
| `/stats` | `Stats` | 移动 More 抽屉 / 桌面 Secondary |
| `/weekly` | `WeeklyReport` | 移动 More 抽屉 / 桌面 Secondary |
| `/settings` | `Settings` | 移动 More 抽屉 / 桌面 Secondary |
| `/grammar/:lessonId` | `GrammarLesson` | — |
| `/onboarding` | `Onboarding` | 独立路由（AppLayout 外） |

**导航逻辑**（`AppLayout.tsx` NAV 数组顺序决定位置）：
- `NAV.slice(0, 4)` → 移动端底部 Tab 4 项（固定）
- `NAV.slice(4)` → 移动端「更多」右侧抽屉
- `NAV.slice(0, 6)` → 桌面端顶部 Primary 导航
- `NAV.slice(6)` → 桌面端「更多▾」下拉菜单

---

## 功能模块详解

### 1. 词汇学习（Learn）

**流程**：Preview（逐词预览）→ Quiz（答题会话）→ Micro（5分钟微复习，增强模式）→ Done

**题型**（`QuizCard.tsx`）：
- `meaning`：给单词选释义（4选1，键盘 1-4）
- `word`：给释义选单词（4选1）
- `spell`：拼写题（`AnswerInput.tsx` 单字方格 / 自由输入）
- `phrase`：短语题

**键盘**：1-4 选择 / Space 朗读 / Esc 跳过 / Enter 继续

### 2. 间隔复习（Review）

算法：SM-2 或艾宾浩斯（用户可选），`src/features/srs/`。
优先展示最久未复习的词，错词自动加权。

### 3. 语法课程（Grammar / GrammarLesson）

**25 节课**，数据在 `src/data/grammar-lessons.ts`。
学习路径：`locked` → `unlocked` → `completed`。每节至少 8 道基础题；首轮目标为 80%，所有错题必须订正后才解锁下一课。
5 种题型由 `ExerciseRenderer.tsx` 统一渲染（choice / fillblank / reorder / translate / correction）。
旧题缺少独立解析时，练习页回退显示本节核心规则，确保答题后始终有原因反馈。

### 4. 音标学习（Phonics）← 新增 2026-05

**44 个 IPA 音素**，数据在 `src/data/phonics-data.ts`。
- **浏览模式**：6 组 Tab（V1/V2/V3/C1/C2/C3），3列卡片网格，底部抽屉展示巧记详情
- **练习模式**：CSS 3D 翻转卡片（Y轴），4选1示例词，答对翻转查看巧记
- **进度**：localStorage（`phonics_progress_v1`），`usePhonicsProgress` Hook

### 5. 听写专项（Listening）

纯靠耳朵拼出听到的词，TTS 朗读 + 拼写题。

### 6. AI 增强

- **巧记生成**：批量为新词生成记忆口诀，缓存于 `mnemonics` 表
- **词根面板**：展示词根词缀和同源词
- **语法解释**：答错时可让 AI 解释原因
- **加题**：语法课可让 AI 动态生成额外习题

### 7. TTS 系统（`lib/tts.ts`）

三层降级：
1. Web Speech API（浏览器自带，国外优先）
2. 云端 TTS 镜像（国内优先有道，国外 Google Translate）
3. meSpeak WASM（1.7MB 离线，懒加载）

`speak(text)` / `speakSlow(text)` / `speakTwice(text)` / `stopSpeaking()`

### 8. Gist 云端同步

词库 JSON 托管于 GitHub Gist，支持：URL 分享链接自动触发拉取、双向同步、冲突解决弹窗。

### 9. 3D 拼写游戏（Play）— 霓虹赛博沉浸式 ← v4 全屏重做 2026-05-19

独立路由 `/play`，**全屏覆盖**（fixed inset-0 z-50）跳出 AppLayout 限制；技术栈：**@react-three/fiber + @react-three/drei + @react-three/postprocessing**（无物理库，已移除 rapier）。

#### 9.1 设计哲学
- **沉浸式全屏**：突破 max-w-6xl 容器，整个视口都是游戏舞台
- **霓虹赛博 + 玻璃拟态**：深紫黑底 `#0a0612` + 青 `#00E5FF` / 紫 `#A855F7` / 暖橙 `#FF6B35` / 金 `#FFD700` 四色制
- **专属显示字体**：Orbitron（Google Fonts 加载，仅 /play 用，class `.font-tech`）
- **点击秒选 + 键盘秒拼**：无拖拽，鼠标点击或键盘 a-z 直接派字母飞入槽位

#### 9.2 入口模式（ModePicker）
启动 `/play` 先进入 ModePicker，选择词源：
| 模式 | 取词 | 适用场景 |
|------|------|----------|
| **复习 (review)** | `progressRepo.dueForReview` + 顺序/随机填充 | 默认推荐，SRS 到期词优先 |
| **错题 (mistakes)** | `progressRepo.wrongWords` (wrongCount > 0) | 集中练错过的词；为空时按钮禁用 |
| **新学 (new)** | level 内未在 `learnedWordIds` 的词，按 learnOrder 取 | 没学过的新词探索 |

各模式实时显示候选词数量（die/wrong/new）。

#### 9.3 玩法循环
- **关卡数**：每会话 10 关
- **生命**：每关独立 3 条命（v3 起改为关级，不再全局）
- **限时**：每关 30s 倒计时，超时本关 fail
- **难度**：单词长度 ≤4 字母 0 干扰、5-6 字母 2 干扰、7+ 字母 3 干扰
- **黄金字母**：每关 1/3 概率挑一个目标字母为金色（emissive 金 + 金属感），命中 ×3 分

**单字母交互流程**：
1. 鼠标 hover → emissive 强化 + 缩放 1.12
2. click（或键盘按对应字母）→ sfxTick + 字母弹光
3. 飞行（easeOutBack 220ms）：抛物线 + 自旋
4. 命中判定：
   - **正确** → cyan 爆 10 颗粒子 + 屏震 0.04 + sfxCombo(combo)（音高随 combo 阶升）
   - **错放** → 字母变橙 + orange 爆 14 颗 + 强屏震 0.14 + 扣 1 命，700ms 后**自动飞回**候选区（多个错放排队各自计时）
5. 全部正确 → stage-clear

#### 9.4 评分系统（scoring.ts）
- `score += 100 × combo × (1 + speedBonus)`
- `speedBonus = max(0, (25 - elapsedSec) / 20)`：≤5s 满奖、≥25s 无奖
- **完美关卡奖励**：0 错且 ≤8s 通过 → 额外 +500 分 + PERFECT STAGE 反馈
- **会话评级** (gradeFor)：
  | 评级 | 条件 |
  |------|------|
  | S | 全通关 + 0 错误 + 平均 ≤8s/关 |
  | A | 通关 ≥9 + 错误 ≤2 |
  | B | 通关 ≥7 |
  | C | 通关 ≥5 |
  | D | 通关 <5 |

#### 9.5 Combo 阶梯特效
| Combo | 视觉变化 |
|-------|---------|
| ≥5 | 远处霓虹网格脉冲（橙色 + 1.2s 节奏）+ 屏幕四边脉冲条（橙） |
| ≥10 | 网格颜色变金 + 后处理 ChromaticAberration 加剧 + 边框金色 + Space 可用时间冻结 |
| ≥15 | 候选字母 emissive 启用**彩虹流光**（HSL 循环） + 屏幕边框变白 |

#### 9.6 道具与提示
| 键 | 阶段 | 动作 |
|----|------|------|
| `a-z` | playing | 直接拼词（找到匹配候选自动派飞） |
| `?` (Shift+/) | playing | 查看答案（扣 300 分，combo 归零，HUD 显示完整单词，amber 高亮） |
| `Tab` | playing | 跳过本关（preventDefault 防焦点切换） |
| `Space` | playing | 时间冻结 3 秒（combo ≥10 才生效，等同 +3s） |
| `Esc` | playing | 退出到 ModePicker（不直接回首页） |
| `Enter` / `N` / `Space` | stage-clear | 立即下一关 |
| `R` | stage-fail | 重试本关 |
| `N` / `Enter` | stage-fail | 跳到下一关 |
| `R` | session-end | 重玩本组（同 10 关复用） |
| `N` | session-end | 新单词（重新按 mode 取 10 关） |

**注意**：playing 阶段的快捷键已避开 a-z 字母键，避免与拼词输入冲突。

#### 9.7 HUD 布局
- **顶栏**：← exit / STAGE NN / NN + 倒计时条 / 三颗心生命
- **顶部中央释义浮窗**：玻璃拟态半透卡 + ✦ spell the word ✦ + 中文释义大字 + 🔊 朗读按钮 + 剩余秒数（10s 内变暖、5s 内变红闪烁）
- **已拼进度方格行**：每字母独立方格，cyan/wrong rose/hint amber 三色态
- **左侧分数塔**：SCORE/COMBO/BEST 三个大字面板（Orbitron 24px 黑体 + 四角 sci-fi 装饰）
- **右侧飞字反馈**：+700 PERFECT! / +300 GREAT / MISS combo lost / +3.0s TIME FREEZE
- **底部操作栏**：查看 [?] + 跳过 [Tab] 按钮 + 全键位提示
- **全屏扫描线**：repeating-linear-gradient cyan 横线 mix-blend screen
- **结算覆盖层**：stage-clear 时 240ms 白闪 → 巨大金渐变单词 fontSize 自适应 (clamp 40-180px，按字母数缩放) + 字母 60ms 错峰弹入 + "✦ stage clear ✦" 副标题

#### 9.8 性能优化（v3）
| 优化 | 修复前 | 修复后 |
|------|--------|--------|
| LetterBlock 边框几何 | 每 render `new BoxGeometry` | 模块级 `SHARED_EDGES_GEOMETRY` 单例 |
| ChromaticAberration offset | 每 render `new Vector2` | `useMemo([combo, isMobile])` |
| 彩虹流光颜色 | 每帧每字母 `new Color()` (600 alloc/s) | `tmpColor` ref 单例复用 |
| 粒子球几何 | 每颗粒子独立 sphereGeometry | 模块级 `SHARED_SPHERE_GEO` 共享 |
| 通关大字渲染 | 3D `<Text>` 被字母遮挡 + 抗 Bloom | 2D HTML 覆盖层 z-50 在最顶层 |

#### 9.9 SRS 回写与错题联动（实时关卡级，v4.2）
- **错放即时**：每次错放触发 `progressRepo.markWrong(wordId, level)` 进错题集 + wrongCount++
- **每关 stage-clear/stage-fail 即时调用 `commitStageResult`**（lib/play-srs.ts）：
  - **SRS quality 算法**：未过 = 0；用了 HINT = 3；0 错 = 5；错 1 = 4；错 ≥2 = 3
  - **联动清错题**：0 错 + 未用 hint 通过 → wrongCount 直接归零，自动从错题集移除
  - **写入字段**：interval / easeFactor / repetitions / lastReviewAt / nextReviewAt 全部按 SM-2 推进
- **会话结束 `commitPlaySession`** 仍调用，但作为兜底（同样的 commitStageResult 循环，幂等）
- **效果**：在游戏中拼对一个错题词 → 同一秒它就从 `/mistakes` 页面消失、`/review` 页面下次复习日期也被推后

#### 9.10 降级与边界
- WebGL 不可用 → 提示跳 `/learn`
- 当前 mode 无可学词 → 显示原因 + 「选择其他模式」按钮
- 移动端：dpr `[1, 1.5]` + 关 ChromaticAberration + 反射地面降级为 standardMaterial + Sparkles 30 颗
- 桌面：dpr `[1, 2]` + 全后处理 + 反射地面 1024 分辨率 + Sparkles 80 颗
- 退出层次：HUD ← exit → ModePicker；ModePicker ← exit → 首页（两层退出）

### 10. 单词陨石防御战（Play2）— 深空告警台 ← 新增 2026-05-20

独立路由 `/play2`，**全屏覆盖**（fixed inset-0 z-50），ZType 打字街机的 3D 单词版。技术栈：**@react-three/fiber + @react-three/drei + @react-three/postprocessing**（无物理库）。

#### 10.1 视觉方向
「Missile-Warning Terminal 深空告警台」军用雷达美学，与游戏1（冷调赛博霓虹/Orbitron）明确区分：
- 配色：深空黑 `#07060A` + 危险琥珀 `#FFB020`（威胁/单词）+ 警报红 `#FF3B30`（伤害/濒危）+ 雷达绿 `#39FF6A`（武器/已打字母）
- 字体：全 HUD 用 JetBrains Mono（class `.font-term`）—— 终端读数美学
- 样式类：`src/styles/index.css` 的 `.mtr-*` 段（mtr-bg/panel/corners/btn/hazard/scanlines/radar-sweep 等）

#### 10.2 玩法
- 单词陨石从深空飞向底部「基地」，正面贴发光英文单词。
- 键盘打字：输入字母自动锁定「下一待打字母 == 该字母」且最逼近的陨石（弹中文释义 + TTS）；逐字母打对 → 基地射绿激光 + 字母点亮；整词打完 → 陨石爆炸。
- 打错 → 红闪 + combo 归零 + errors++（不解锁）。陨石撞基地 → 全屏红闪 + 屏震 + 基地 -1 血。
- 一 session 取 24 词；难度曲线 `difficultyAt(destroyed)`：同屏 2→5、生成间隔 3.2s→1.4s、速度递增；每 8 词一个 WAVE 横幅。
- 24 词全击毁 → 胜利；基地血量（5）耗尽 → 失败。
- 移动端降级：点击陨石 = 锁定 + 推进一字母。

#### 10.3 计分 & SRS
- 字母 `+10×(combo+1)`；整词 `+wordLen×50×combo×(1+speedBonus)`；评级 S/A/B/C/D。
- `lib/play-meteor-srs.ts` 即时回写：漏失=quality 0 / 0错=5 / 1错=4 / ≥2错=3；0错击毁联动清错题。

#### 10.4 关键技术
- 陨石位置纯数据驱动：state 存 `z`(深度)`x`(横向)，`setInterval` ~33ms 驱动 `TICK`，3D 组件读 state + lerp 平滑。
- **离线优先**：禁用 drei `<Environment>` HDR 与外部字体（旧版踩坑），纯本地光 + drei 默认 3D 字体。
- 复用游戏1基础设施：`Particles.spawnBurst`、`useShake`、postprocessing 美学；自带 `Laser` 模块级 store。

---

## 数据库表（Dexie IndexedDB）

| 表名 | 主键 | 说明 |
|------|------|------|
| `words` | id（自增） | 词汇数据（word / level / translations 等） |
| `progress` | id（自增） | 学习进度（SRS 参数 / wrongCount / starred） |
| `sessions` | id（自增） | 学习会话记录（统计用） |
| `grammarProgress` | lessonId | 语法课进度（status / score） |
| `settings` | key | 键值对配置 |
| `mnemonics` | wordId | AI 巧记缓存（tip / ipa / examples） |
| `wordRoots` | wordId | 词根词缀缓存 |
| `userSentences` | id（自增） | 用户造句记录 |

**进度存储例外**：
- 音标进度（`phonics_progress_v1`）→ localStorage（简单 JSON，无需 DB）

---

## 常用代码模式

### 条件类名
```typescript
import { cn } from '@/lib/utils';
className={cn('base', condition && 'conditional', isError && 'text-crimson')}
```

### 异步数据加载
```typescript
useEffect(() => {
  (async () => {
    const data = await repo.getAll();
    setState(data);
  })();
}, [deps]);
```

### 移动端抽屉
```typescript
<MobileSheet open={isOpen} onClose={() => setOpen(false)} side="bottom" title="标题">
  {children}
</MobileSheet>
```

### TTS 播放
```typescript
import { speak, speakSlow } from '@/lib/tts';
speak('hello world');   // 正常速度
speakSlow('hello');     // 0.6x 慢速
```

### 响应式网格（移动优先）
```typescript
className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5"
```

---

## 响应式断点

| 断点 | 宽度 | 用途 |
|------|------|------|
| （默认） | < 640px | 移动端（3 列网格，底部 Tab） |
| `sm:` | ≥ 640px | 小平板 |
| `md:` | ≥ 768px | **桌面/移动端分界**（顶部导航替代底部 Tab） |
| `lg:` | ≥ 1024px | 宽桌面（5 列网格等） |

移动端安全区：`pb-24`（为底部 Tab 留白）+ `env(safe-area-inset-bottom)`

---

## Git 配置

```
user.name  = 子浪
user.email = 1584731441@qq.com
```

Commit 格式遵循 Conventional Commits：
```
feat(phonics): 添加音标学习模块
fix(tts): 修复降级逻辑
refactor(grammar): 重构题型渲染引擎
```

---

## 变更日志

### 2026-07-29
**feat(grammar): 强化零基础练习与掌握式通关**

- 第 9-25 节各补 3 道基础题，共新增 51 道；统一覆盖选择、填空、改错训练
- 修复 Enter / 方向键可跳过练习阶段的问题
- 错题回练仍答错时继续保留未掌握题，不再直接完成并解锁下一节
- 基础题首轮成绩与进阶题成绩分开显示和记录
- 旧题没有独立解析时回退显示本节核心规则
- 新增语法课程数据测试，约束 25 节连续性、例句数、基础题数与后半程题型覆盖

### 2026-05-15
**feat(phonics): 添加音标学习模块**

新增文件：
- `src/data/phonics-data.ts` — 44 个 IPA 音标数据，6 组分类（短元音/长元音/双元音/爆破音/摩擦音/其他辅音），每个音标含中文联想巧记、发音要点、emoji、示例词、易混音标
- `src/hooks/usePhonicsProgress.ts` — 音标练习进度 Hook，数据存于 localStorage（`phonics_progress_v1`）
- `src/pages/Phonics.tsx` — 音标主页面，含浏览模式（分组 Tab + 卡片网格 + 底部抽屉详情）和练习模式（CSS 3D 翻转卡片 + 4选1 + 巧记揭晓）

修改文件：
- `src/router.tsx` — 懒加载路由 `/phonics`
- `src/components/AppLayout.tsx` — NAV 数组插入 `{ to: '/phonics', label: '音标', code: '03p' }`（自动落入移动端 More 抽屉和桌面端 Secondary 下拉）

### 2026-05-20
**feat(play2): 单词陨石防御战 —— 替换失败的消消乐**

第二款 3D 游戏。先前的「黏土消消乐」节奏慢、反馈弱、张力不足，整体废弃重做为 ZType 风格的打字街机：键盘狂敲摧毁来袭的单词陨石，保卫基地。

删除：旧 `src/features/play2-match/`（11 文件）、`src/data/common-words-3k.ts`、`src/lib/play2-srs.ts`、`.clay-*` 样式、旧 spec。

新增文件：
- `src/features/play-meteor/` — types / meteorEngine（纯函数）/ wordSource / useMeteorSession（reducer）/ MeteorScene / Meteor / Base / Laser / Radar / HUD3 / ResultPanel3 / MeteorModePicker
- `src/lib/play-meteor-srs.ts` — 单词→SRS 回写
- `src/pages/Play2.tsx` — 重写为陨石游戏入口（TICK 循环 + 键盘 + 副作用编排）
- `docs/superpowers/specs/2026-05-20-play2-word-meteor-design.md` — 设计文档

修改文件：
- `src/styles/index.css` — `.clay-*` 段替换为 `.mtr-*`（深空告警台终端样式）+ `.font-term`
- `src/components/AppLayout.tsx` — NAV 项 `/play2` label 改「陨石」、code `02s`
- `src/router.tsx` — `/play2` 路由不变（Play2 组件重写）

视觉：军用「深空告警台」美学（琥珀/警报红/雷达绿 + JetBrains Mono 终端字体 + 右下角雷达扫描仪），与游戏1 冷调赛博霓虹明确区分。复用游戏1 的粒子/屏震/后处理/取词/SRS 基础设施，无新依赖。Play2 chunk 31.8KB（gzip 11KB）。

### 2026-05-19 (v4.2)
**feat(play): 实时关卡级 SRS 联动 + HINT 影响评分**

之前 SRS 只在会话结束时批量写入，错题清理也是简单的 `errs===0`。现在改为：
- 每关 stage-clear/stage-fail 立即调 `commitStageResult` 推进 SRS
- StageResult 新增 `revealed` 字段（是否用过查看答案）
- quality 算法：未过=0 / 用 HINT=3 / 0 错=5 / 错 1=4 / 错 ≥2=3
- 联动清错题条件：0 错 + 未用 hint 通过 → wrongCount 归零（用 hint 不算"真会"）
- 效果：游戏中对一个错题词 → 它立即从 /mistakes 消失、/review 下次复习日期推后

### 2026-05-19 (v4.1)
**fix(router): /play 提到顶层路由，彻底独立于 AppLayout**

之前用 `fixed inset-0 z-50` 想突破 AppLayout 的 max-w-6xl 容器，但 AppLayout 内 `<main className="animate-fade-up">` 的 transform 关键帧创建了 containing block，导致 fixed 相对 main 而非 viewport，ModePicker 仍被挤压在顶部窄条内。

修复：将 `{ path: '/play' }` 从 AppLayout 子路由移到顶层（与 `/onboarding` 平级）。不再有 header / 容器约束。NavLink 仍指向 `/play`，HashRouter 自动匹配新路由。

### 2026-05-19 (v4)
**feat(play): 全屏沉浸 + 入口模式选择 + 完整快捷键 + 性能优化**

突破 AppLayout 容器约束（fixed inset-0 z-50），让 /play 利用整个视口。引入 ModePicker（复习/错题/新学三入口）。补齐所有性能问题（资源池化、Vector2 useMemo、tmpColor 复用、共享 SphereGeometry）。

新增文件：
- `src/features/play-3d/ModePicker.tsx` — 模式选择入口卡片（含实时词量统计）
- `src/features/play-3d/StageClearOverlay.tsx` — 通关 2D HTML 大字层（替代 3D WordReveal）
- `src/styles/index.css` — `.font-tech` Orbitron + 4 套 keyframes（白闪/字母弹入/副标题/边框脉冲）+ `.play-scanlines` + `.play-corners`

扩展：
- `stageBuilder.ts` 加 `GameMode` 类型 + `buildStages(level, count, order, mode)`，按 mode 切换取词源
- `progressRepo.clearWrong()` 新方法（0 错通关移出错题集）
- `usePlaySession.ts` 加 `REVEAL_ANSWER` / `SKIP_STAGE` / `FREEZE_TIME` / `UNFREEZE_TIME` actions + `revealed` / `freezeUntilAt` / `pendingRetractIds[]` 字段
- `LetterBlock` 共享 SHARED_EDGES_GEOMETRY + tmpColor ref + 入场错峰动画 + 黄金/彩虹流光
- `Particles` 模块级 SHARED_SPHERE_GEO
- `PlayScene` 加 `CameraDolly` 通关推拉相机 + ComboGrid 节奏脉冲 + Sparkles 环境粒子 + AspectScaler 窄屏缩放
- `HUD` 加扫描线 + 边缘 combo 脉冲 + 已拼进度方格放大 + 释义浮窗放大 + 查看/跳过按钮
- `Play.tsx` ModePicker 集成 + 全屏 fixed 容器 + 多 phase 键盘绑定

包体增量：vendor 3D chunk 945KB → 945KB（rapier 已移除，postprocessing 净增 100KB 抵消），Play chunk 17→33KB（gzip 6→10KB）。

### 2026-05-19 (v3)
**fix+perf(play): 修复溢出/快捷键冲突 + 视觉冲击力升级**

- 字母 H/S 快捷键与拼词冲突，改为 `?` 查看 / `Tab` 跳过
- 通关大字溢出：字号按字母数自适应 `min(16, 90 / N / 0.65)vw` + `max-w-[92vw]`
- 加键盘：stage-clear N/Enter/Space，stage-fail R retry / N next，session-end R 重玩 / N 新单词
- 新增"查看答案 -300"+"跳过本关"功能 + 重玩本组/新单词二选一

### 2026-05-19 (v2)
**refactor(play): 重构为霓虹赛博 + 玻璃拟态 + 点击秒选**

v1 体验差（相机角度错乱、配色阴暗、无反馈、3D 拖拽精度差）→ 重写视觉/交互/反馈层，状态机/取词/SRS 不动。

移除：`@react-three/rapier`（-500KB），`Workbench.tsx`，`useDragBlock.ts`
新增：`@react-three/postprocessing`、`postprocessing`
重写：`PlayScene/LetterBlock/Slot/SlotRow/HUD/ResultPanel`
新增文件：`scoring.ts`、`useShake.ts`、`Particles.tsx`
扩展：`usePlaySession.ts` 加 `score/combo/bestCombo/feedbacks` + `TIMEOUT_STAGE` action；
       `sfx.ts` 加 `sfxCombo(n)` / `sfxStageClear`

包体变化：3D vendor 从 2.9MB → 1MB（gzip 1MB → 281KB），Play chunk 17KB → 26KB（gzip 6KB → 9KB）。

### 2026-05-19 (v1)
**feat(play): 新增 3D 拼写积木塔游戏模式**

分支：`feat/play-3d-spelling`

新增文件：
- `src/pages/Play.tsx` — `/play` 路由入口，WebGL 检测 + 会话外壳
- `src/features/play-3d/types.ts` — Phase/Stage/Block/SlotState/PlayState 类型
- `src/features/play-3d/stageBuilder.ts` — 关卡生成（取 due 词 + 干扰字母 + 布局）
- `src/features/play-3d/usePlaySession.ts` — useReducer 状态机（10 关 / 3 命）
- `src/features/play-3d/useDragBlock.ts` — pointer→ground 平面 raycaster
- `src/features/play-3d/LetterBlock.tsx` — 字母积木（RigidBody + 拖拽 + 顶面字母）
- `src/features/play-3d/Slot.tsx` + `SlotRow.tsx` — 顶部凹槽 + 命中态发光
- `src/features/play-3d/Workbench.tsx` — 工作台 + 物理地面 + 四周隐形墙
- `src/features/play-3d/PlayScene.tsx` — Canvas 根（灯光/相机/Physics）
- `src/features/play-3d/HUD.tsx` — 2D 叠加（释义/生命/进度/朗读）
- `src/features/play-3d/ResultPanel.tsx` — 关卡 / 会话结算
- `src/lib/play-srs.ts` — 游戏结果回写 progress 表（errors → SRS quality）

修改文件：
- `src/router.tsx` — 懒加载路由 `/play`
- `src/components/AppLayout.tsx` — NAV 数组插入 `{ to: '/play', label: '游戏', code: '02g' }`（桌面 Primary[4] / 移动 More 抽屉）
- `package.json` — 新增 `@react-three/fiber`、`@react-three/drei`、`@react-three/rapier`、`three`、`@types/three`

---

*本文档由 AI 维护，每次功能变更后自动更新。最后更新：2026-07-29 (零基础语法学习优化)*
