# GitHub Gist 云端同步功能设计规格

**日期**：2026-05-13  
**状态**：已批准，待实现

---

## 概述

为英语学习 PWA 添加 GitHub Gist 作为云端备份/同步后端，补充现有文件导出功能。数据范围与文件导出完全相同（复用 `buildBackup()` / `applyBackup()`），仅同步渠道从本地文件改为 GitHub Gist。支持 URL 参数引导配置（方便新设备快速接入）、冲突检测与手动推拉，以及可选的学习后自动推送。

---

## 1. 数据结构

### 1.1 新增 `GistConfig` 接口（`src/stores/settingsStore.ts`）

```typescript
export interface GistConfig {
  gistId: string;           // GitHub Gist ID，空字符串表示未配置
  token: string;            // GitHub Personal Access Token（gist scope）
  autoSync: boolean;        // 学习/复习结束后自动静默推送
  includeAIConfig: boolean; // 推送时是否含 AI 配置（含 apiKey）
  lastSyncedAt?: string;    // 最后成功同步的 ISO 时间戳
  lastSyncStatus?: 'ok' | 'error'; // 最后同步状态
}

export const DEFAULT_GIST: GistConfig = {
  gistId: '',
  token: '',
  autoSync: false,
  includeAIConfig: false,
};
```

存储键：`'gist'`，写入 IndexDB `settings` 表，与 `ai`/`tts` 完全一致。

### 1.2 settingsStore 扩展

- 新增状态字段 `gist: GistConfig`
- 新增 action `setGist(cfg: Partial<GistConfig>): Promise<void>`
- `load()` 中追加读取 `getSetting<GistConfig>('gist', DEFAULT_GIST)`

---

## 2. 网络层 `src/lib/gist.ts`

三个纯函数，只依赖 GitHub REST API，不依赖 React/Zustand。

### 2.1 `pushToGist`

```typescript
async function pushToGist(backup: BackupV1, config: GistConfig): Promise<string>
```

- `config.gistId` 为空 → `POST /gists`（创建），返回新 gistId
- `config.gistId` 非空 → `PATCH /gists/{id}`（更新），返回原 gistId
- Gist 文件名固定：`english-hub-backup.json`
- `description`：`"English Hub Backup"`，`public: false`
- 认证：`Authorization: Bearer {token}`

### 2.2 `pullFromGist`

```typescript
async function pullFromGist(config: GistConfig): Promise<BackupV1>
```

- `GET /gists/{gistId}` → 取 `files["english-hub-backup.json"].content` → `parseBackup()`
- 抛出语义错误：文件不存在、JSON 解析失败、版本不匹配

### 2.3 `getGistMeta`

```typescript
async function getGistMeta(config: GistConfig): Promise<{ updatedAt: string }>
```

- `GET /gists/{gistId}` → 返回 `updated_at`
- 用于 Settings 页面展示上次同步时间

---

## 3. URL 参数解析 `src/hooks/useGistUrlParams.ts`

### 3.1 触发时机

`AppLayout` 组件挂载时调用一次（`useEffect(fn, [])`）。

### 3.2 URL 格式

```
https://your-app.com/#/settings?gistId=abc123&githubToken=ghp_xxx
```

读取方式：解析 `window.location.hash`，提取 `?` 后的 query string，用 `URLSearchParams` 解析。

### 3.3 处理流程

```
1. 提取 gistId + githubToken
2. 若两者均缺失 → 退出（无 URL 参数）
3. 读取 IndexDB 中已存的 GistConfig
4. 比对：
   ├─ 完全一致（gistId + token 均相同）→ 仅清除 URL 参数，退出
   ├─ 未配置（存储 gistId 为空）→ 静默写入 IndexDB，清除 URL 参数，
   │    toast 提示"已自动配置 Gist 同步"
   └─ 已配置且不一致 → 显示冲突弹窗（见 3.4）
5. 清除 URL 敏感参数：history.replaceState 替换为无参数的当前路径
```

### 3.4 冲突弹窗

使用现有 `MobileSheet` 组件（移动端底部弹出，桌面端居中 dialog）。

**选项**：
- **使用 URL 中的配置**：覆盖存储的 gistId/token，写入 IndexDB
- **保留现有配置**：丢弃 URL 参数

> 凭据（gistId/token）无"合并"语义，只有覆盖或保留。

---

## 4. 自动推送

### 4.1 触发点

- `src/pages/Learn.tsx`：学习会话完成回调末尾
- `src/pages/Review.tsx`：复习会话完成回调末尾

### 4.2 `autoSyncToGist()` 逻辑

```
1. 读取 GistConfig
2. autoSync=false 或 token 为空 → 跳过
3. buildBackup({ includeSettings: true, includeSessions: true,
                 includeWords: false, includeAIConfig: config.includeAIConfig })
4. pushToGist(backup, config)
5. 成功 → setGist({ lastSyncedAt: now, lastSyncStatus: 'ok' })，静默
6. 失败 → setGist({ lastSyncStatus: 'error' })，静默
   （失败状态在 Settings 页 Gist 区域显示红点，不打断用户）
```

全程 `void asyncFn()`，不阻塞学习流程。

---

## 5. UI 设计

### 5.1 新增 Section：云端同步

位置：Settings 页面"数据备份"Section **之前**插入。TOC 同步新增条目 `{ id: 'gist', label: '云端同步', en: 'gist sync' }`。

### 5.2 布局（移动端优先）

```
chapter · cloud sync · github gist
云端同步
──────────────────────────────────────

[配置凭据]
  Gist ID      [__________________________]
  GitHub Token [__________________________]  ← type="password"
               [查看 Token 权限说明 ↗]       ← 外链 github.com/settings/tokens

[同步选项]
  ☐ 含 AI 配置（含 API Key ⚠）
  ☐ 自动推送（学习/复习结束后）

[状态栏]（有 gistId 时显示）
  ● 上次同步：2026-05-13 14:23  ✓ 成功    ← moss 绿
  ● 上次同步：2026-05-13 14:23  ✗ 失败    ← crimson 红
  ● 从未同步                               ← ink3 灰

[操作按钮]
  [↑ 推送备份]   [↓ 拉取同步]   [⊘ 断开配置]
  移动端（<sm）纵向堆叠，sm: 横向排列

[拉取冲突策略]（与现有导入一致）
  [合并（推荐）]  [替换（危险）]

[信息提示框]
  ⚠ Token 仅存储在本设备 IndexDB，不经任何服务器中转。
    建议创建只有 gist 权限的 Fine-grained Token。
```

### 5.3 设计规范

- 沿用现有色彩体系：persimmon / ink / paper / moss / crimson
- 字体：`font-mono text-[10px] uppercase tracking-wider` 用于标签和状态
- 按钮：复用 `btn-ghost` / `btn-accent` / `border-crimson` 风格
- 输入框：复用 `.input` 类
- 状态栏：小圆点 + monospace 文字，不占额外卡片空间
- 信息框：`border border-dashed border-paper3 bg-paper2/40`（与 AI 说明框一致）

### 5.4 前端组件结构

```
Settings.tsx
  └─ GistSyncSection（内联或抽取为独立组件）
       ├─ 凭据输入区
       ├─ 同步选项（Checkbox）
       ├─ 状态栏
       ├─ 操作按钮区
       ├─ 拉取策略选择
       └─ 信息提示框
```

---

## 6. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/stores/settingsStore.ts` | 修改 | 新增 `GistConfig`、`DEFAULT_GIST`、`gist` 状态、`setGist` action |
| `src/lib/gist.ts` | 新建 | GitHub Gist REST API 封装 |
| `src/hooks/useGistUrlParams.ts` | 新建 | URL 参数解析与冲突处理 hook |
| `src/components/AppLayout.tsx` | 修改 | 挂载时调用 `useGistUrlParams` |
| `src/pages/Settings.tsx` | 修改 | 新增 Gist 同步 Section + TOC 条目 |
| `src/pages/Learn.tsx` | 修改 | 会话结束时调用 `autoSyncToGist` |
| `src/pages/Review.tsx` | 修改 | 会话结束时调用 `autoSyncToGist` |

---

## 7. 安全说明

- gistId 和 token 仅存在本设备 IndexDB，不经任何第三方服务器
- Token 建议使用 GitHub Fine-grained PAT，仅授予 `Gists: Read and Write` 权限
- URL 引导的 token 在处理完成后立即通过 `history.replaceState` 从地址栏清除
- 推送时默认 `includeAIConfig: false`，apiKey 不入 Gist，需用户主动勾选
- Gist 创建时 `public: false`（私有），防止数据泄露
