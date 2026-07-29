# English Hub · 英语学习

<div align="center">

**个人专属、0 基础友好的英语学习 PWA**

所有数据保存在浏览器 IndexedDB，完全离线可用，无需后端，无需账号。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/your-username/english-hub?style=social)](https://github.com/your-username/english-hub)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/your-username/english-hub/pulls)

> 如果这个项目对你有帮助，欢迎点个 ⭐ Star，让更多人发现它！

</div>

---

## 功能

- **词库浏览**：初中 / 高中 / CET4 / CET6 / 考研 / 托福 / SAT，共 6 万+ 词条
- **渐进式学新词**：选释义 / 选单词 / 拼写 / 短语填空 4 种题型，键盘全控
- **统一打字机式输入组件**：方格逐字符 + 句子模式 / 涟漪 / 印章 / Diff 高亮 / 可选音效
- **SRS 复习**：SuperMemo SM-2 或经典艾宾浩斯固定间隔，可在设置切换
- **错题本 + 难词收藏**：自动入库，独立专攻页
- **0 基础语法路线图**：25 节深度课程，每节至少 8 道基础题（场景 → 例句 → 猜规律 → 公式 → 易错对比 → 用法说明 → 基础测验 → 错题订正 → 进阶题）
- **AI 助手**（可选，OpenAI / Gemini 兼容）：批量生成单词巧记 + IPA 音标 + 例句、语法加题、错题解释
- **学习统计**：180 天热力图 + 词库掌握度
- **数据备份**：选择性导出 / 合并 or 替换式导入

---

## 截图预览

### 首页 & 词库

<table>
  <tr>
    <td align="center"><b>首页</b></td>
    <td align="center"><b>词库</b></td>
    <td align="center"><b>统计</b></td>
  </tr>
  <tr>
    <td><img src="images/首页.png" alt="首页" width="280"/></td>
    <td><img src="images/词库.png" alt="词库" width="280"/></td>
    <td><img src="images/统计.png" alt="统计" width="280"/></td>
  </tr>
</table>

### 学单词

<table>
  <tr>
    <td align="center"><b>学习单词</b></td>
    <td align="center"><b>练习模式</b></td>
    <td align="center"><b>选项题</b></td>
  </tr>
  <tr>
    <td><img src="images/学习单词.png" alt="学习单词" width="280"/></td>
    <td><img src="images/学单词-练习.png" alt="练习" width="280"/></td>
    <td><img src="images/学单词-选项.png" alt="选项" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>失败反馈</b></td>
    <td align="center"><b>AI 巧记</b></td>
    <td></td>
  </tr>
  <tr>
    <td><img src="images/学单词-失败.png" alt="失败" width="280"/></td>
    <td><img src="images/学单词-AI补充.png" alt="AI补充" width="280"/></td>
    <td></td>
  </tr>
</table>

### 语法课程

<table>
  <tr>
    <td align="center"><b>语法学习</b></td>
    <td align="center"><b>例句讲解</b></td>
    <td align="center"><b>规律推导</b></td>
  </tr>
  <tr>
    <td><img src="images/语法-学习.png" alt="语法" width="280"/></td>
    <td><img src="images/语法学习.png" alt="语法学习" width="280"/></td>
    <td><img src="images/语法学习2.png" alt="语法学习2" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>公式总结</b></td>
    <td align="center"><b>易错对比</b></td>
    <td align="center"><b>用法说明</b></td>
  </tr>
  <tr>
    <td><img src="images/语法学习3.png" alt="语法学习3" width="280"/></td>
    <td><img src="images/语法学习4.png" alt="语法学习4" width="280"/></td>
    <td><img src="images/语法学习6.png" alt="语法学习6" width="280"/></td>
  </tr>
  <tr>
    <td align="center"><b>基础测验</b></td>
    <td align="center"><b>错题回练</b></td>
    <td align="center"><b>进阶题</b></td>
  </tr>
  <tr>
    <td><img src="images/语法学习7.png" alt="语法学习7" width="280"/></td>
    <td><img src="images/语法学习8.png" alt="语法学习8" width="280"/></td>
    <td><img src="images/语法学习10.png" alt="语法学习10" width="280"/></td>
  </tr>
</table>

### 错题本 & 设置

<table>
  <tr>
    <td align="center"><b>错题本</b></td>
    <td align="center"><b>设置</b></td>
  </tr>
  <tr>
    <td><img src="images/错题.png" alt="错题" width="280"/></td>
    <td><img src="images/设置.png" alt="设置" width="280"/></td>
  </tr>
</table>

---

## 本地开发

```bash
pnpm install
# 把 json/ 内置词库复制到 public/data/ 供前端 fetch
cp -r json/* public/data/    # macOS / Linux
# Copy-Item -Recurse -Force json/* public/data/   # Windows PowerShell

pnpm dev    # http://localhost:5173
```

首次进入会跳转 Onboarding 引导词库导入。

## 测试 & 构建

```bash
pnpm test           # SM-2 单元测试
pnpm build          # 类型检查 + 生产构建
pnpm preview        # 预览生产构建
```

---

## 部署到 GitHub Pages（一键自动部署）

本项目是纯前端，**已内置 GitHub Actions 工作流**，推送到 main/master 分支即自动构建并发布。

### 第 1 步：推到 GitHub 仓库

```bash
git init
git add .
git commit -m "init: english hub"
git branch -M main
git remote add origin git@github.com:<your-username>/<repo-name>.git
git push -u origin main
```

> **`json/` 是源数据**（已 git 提交）。`public/data/` 是构建中间产物（已在 .gitignore 中），CI 会自动从 `json/` 复制。

### 第 2 步：开启 Pages

在仓库页面：

1. **Settings → Pages → Build and deployment**
2. **Source** 选择 **"GitHub Actions"**（**不是** "Deploy from a branch"）

### 第 3 步：等待自动部署

`.github/workflows/deploy.yml` 会在每次 push 时：
1. 安装 pnpm + Node 22
2. 把 `json/*` 复制到 `public/data/`
3. 用 `VITE_BASE_PATH=/<repo-name>/` 构建（自动从仓库名注入）
4. 上传 dist/ 到 Pages 部署环境

完成后访问 `https://<your-username>.github.io/<repo-name>/`。

### 部署细节说明

- **HashRouter 路由**：URL 形如 `/#/learn`，GitHub Pages 等静态托管刷新不会 404。如果你要用纯净 URL（`/learn`），需要自行加 404.html 重定向技巧或换 Netlify/Vercel（带原生 SPA 支持）。

- **Base path 自动注入**：`vite.config.ts` 读取 `VITE_BASE_PATH` 环境变量。本地默认 `/`；CI 用 `/<repo-name>/`。要部署到自定义域名根目录，把工作流里的 env 改成 `VITE_BASE_PATH: /` 即可。

- **数据文件加载**：`src/db/types.ts` 里 `dataUrl()` 用 `window.location.origin + import.meta.env.BASE_URL + 'data/<file>'` 构造 Worker 也能正确解析的绝对 URL。

- **资源体积**：构建后 `dist/data/` 约 36 MB（7 个词库 JSON）。GitHub Pages 单站点 1 GB 限制完全 OK；如果嫌大可以从工作流里只复制部分词库。

### 部署到其他平台

| 平台 | 配置 |
|---|---|
| **Netlify** | 把项目推到 Git → 直接 import → Build command `cp -r json/* public/data/ && pnpm build`，Output `dist`，无需 VITE_BASE_PATH（根路径部署） |
| **Vercel** | 同上 → Framework "Vite"，Build command 同上 |
| **Cloudflare Pages** | 同上 |
| **自托管 Nginx** | 任意目录 → `pnpm build` → 把 `dist/` 内容放 web root；想用 BrowserRouter 需配置 try_files 兜底 |

---

## 技术栈

Vite 5 · React 18 · TypeScript · React Router v6 (HashRouter) · Zustand · Tailwind CSS · Dexie.js · Web Workers · Web Audio API · Web Speech API

## 项目结构

```
english/
├── json/                          # 原始词库数据（git 提交）
├── public/data/                   # 构建中间产物（CI 自动复制；本地需手动）
├── images/                        # README 截图
├── src/
│   ├── components/                # AnswerInput / QuizCard / MnemonicHint / AppLayout
│   ├── db/                        # Dexie schema + 5 个仓储 (words/progress/sessions/grammar/mnemonics)
│   ├── workers/                   # 导入 Web Worker
│   ├── features/
│   │   ├── srs/                   # SM-2 + 艾宾浩斯
│   │   ├── learn-session/         # 学习会话状态机
│   │   └── grammar-engine/        # 5 种题型 + 拖拽
│   ├── data/grammar-lessons.ts    # 25 节深度语法课
│   ├── pages/                     # 9 个页面
│   ├── lib/                       # ai / tts / sfx / backup / diff / utils
│   ├── stores/                    # Zustand
│   └── styles/                    # Tailwind 入口 + 打字机动画
└── .github/workflows/deploy.yml   # GH Pages 部署
```

---

## 贡献

欢迎提 Issue 和 PR！

- **Bug 报告**：请附上复现步骤和浏览器版本
- **功能建议**：在 Issue 中描述使用场景
- **代码贡献**：Fork → 新建分支 → PR，保持代码风格一致即可

---

## License

[MIT](./LICENSE) © 2024 子浪
