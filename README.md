# English Hub · 英语学习

个人专属、0 基础友好的英语学习 PWA。

## 功能

- **词库浏览**：初中 / 高中 / CET4 / CET6 / 考研 / 托福 / SAT，共 6 万+ 词条
- **渐进式学新词**：选释义 / 选单词 / 拼写 / 短语填空 4 种题型
- **SRS 复习**：基于 SuperMemo SM-2 算法的间隔重复
- **0 基础语法路线图**：25 节内置课程，从 be 动词到从句
- **学习统计**：日历热力图 + 词库掌握度
- **离线可用**：所有数据存浏览器 IndexedDB

## 技术栈

Vite 5 · React 18 · TypeScript · React Router v6 · Zustand · Tailwind CSS · Dexie.js

## 启动

```bash
pnpm install
pnpm dev
```

首次启动会自动跳转到 Onboarding 引导词库导入。

## 数据源

词库 JSON 来自 `json/` 目录，构建前需复制到 `public/data/`：

```bash
# Windows PowerShell
Copy-Item -Recurse -Force json public/data

# macOS / Linux
cp -r json public/data
```

## 测试

```bash
pnpm test
```

## 构建

```bash
pnpm build
pnpm preview
```
