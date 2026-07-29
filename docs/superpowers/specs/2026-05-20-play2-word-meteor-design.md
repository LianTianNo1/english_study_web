# Word Meteor Defense — 单词陨石防御战 设计文档

**日期**：2026-05-20
**路由**：`/play2`（独立顶层路由，全屏）
**取代**：失败的黏土消消乐（已删除）

---

## 1. 目标

English Hub 第二款 3D 游戏。经典 ZType 打字街机的 3D 单词版：核心动词是**键盘狂敲**，打字本身自带速度感与紧张感。高能、爆炸感强、压力源源不断。

## 2. 视觉方向：「Missile-Warning Terminal 深空告警台」

军用雷达告警系统美学，与游戏1（冷调赛博霓虹/Orbitron）明确区分——本作是**热调军用终端**。

| 元素 | 选择 |
|------|------|
| 背景 | 深空黑 `#07060A`，底部琥珀辉光 + 顶部红色辉光的径向渐变 |
| 威胁色 | 危险琥珀 `#FFB020` — 陨石单词、中性 HUD |
| 警报色 | 警报红 `#FF3B30` — 基地伤害、低血、打错 |
| 武器色 | 雷达绿 `#39FF6A` — 锁定框、激光、已打对的字母 |
| 文本 | 米白 `#EDE8DF` |
| 字体 | 全 HUD 用 **JetBrains Mono**（`.font-term`）—— 终端读数美学 |
| 装饰 | `[方括号]` / `>>` / 危险斜纹 `.mtr-hazard` / 四角刻度 `.mtr-corners` / 琥珀扫描线 |
| 签名元素 | 右下角**雷达扫描仪**（陨石光点 + 旋转扫描线）；陨石逼近时全屏从琥珀**升级为红色警报** |

## 3. 玩法

### 核心循环
- 第一人称视角，屏幕底部中央 = 玩家「基地」（发光穹顶）。
- 单词陨石从深空生成，朝基地飞来，正面贴发光英文单词。
- 键盘打字摧毁：
  1. 输入字母 → 自动锁定「下一待打字母 == 该字母」且最逼近的陨石，弹中文释义 + TTS。
  2. 逐字母输入：打对 → 基地射绿激光命中 + 小爆 + `sfxTick` + 字母点亮绿。
  3. 整词打完 → 陨石爆炸（`spawnBurst` + 强屏震 + `sfxStageClear`）。
  4. 打错 → 陨石红闪 + `sfxThud` + combo 归零 + errors++（不解锁，可续打）。
- 多陨石同屏 = 多线程压力。
- 陨石撞基地 → 全屏红裂 + 强屏震 + 基地 -1 血 + 该词记漏失。
- 基地血量（5）耗尽 → 失败。

### Session
- 取 **24 词**（review/mistakes/new）。
- 难度曲线 `difficultyAt(destroyed)`：同屏上限 2→5，生成间隔 3.2s→1.4s，飞行速度线性加快。
- 24 词全击毁 → 胜利；血量耗尽 → 失败。
- 每 8 词显示 `WAVE 02 // INCOMING` 横幅（视觉节奏点）。

### 计分
- 打对字母：`+10 × combo`。
- 整词击毁：`+ wordLen × 50 × combo × (1 + speedBonus)`，speedBonus 按锁定→击毁耗时（≤2s 满奖）。
- combo 连续无失误递增；打错归零。
- 评级 S/A/B/C/D（全击毁+0失误+0漏 = S）。

### 移动端降级
无键盘：点击陨石 = 锁定；之后每点该陨石一次推进一个正确字母。

## 4. 文件结构

```
src/features/play-meteor/
├── types.ts              Meteor / Phase / MeteorState / Action
├── meteorEngine.ts       纯函数：难度曲线 / 位置推进 / 锁定选择 / 命中判定
├── wordSource.ts         fetchMeteorWords(level,count,order,mode)
├── useMeteorSession.ts   useReducer 状态机
├── MeteorScene.tsx       R3F Canvas 根（相机/灯光/雾/Sparkles/后处理）
├── Meteor.tsx            单颗陨石（Icosahedron 岩石 + Text 单词 + 锁定框 + 逐字母点亮）
├── Laser.tsx             激光射线（基地→陨石）
├── Base.tsx              玩家基地（发光穹顶 + 受击红闪）
├── Radar.tsx             右下角雷达扫描仪（签名元素）
├── HUD3.tsx              2D HUD（终端风）
├── ResultPanel3.tsx      胜利/失败结算
└── MeteorModePicker.tsx  终端风 MISSION SELECT 入口（专属，不复用游戏1）

src/pages/Play2.tsx       重写为陨石游戏入口
src/lib/play-meteor-srs.ts SRS 回写
src/styles/index.css      .mtr-* / .font-term 样式（已加）
```

## 5. 复用基础设施

`spawnBurst`+`<Bursts/>`、`<ShakeController/>`+`getShakeApi()`、`sfx*`、`tts.speak`、`srs`（INITIAL_SRS/scheduleNext/nextReviewAtFor）、`progressRepo`/`wordsRepo`、postprocessing（Bloom/ChromaticAberration/Vignette）。无新依赖。

## 6. 关键技术决策

1. 陨石位置纯数据驱动：state 存 `z`（深度）`x`（横向），`TICK` 推进，3D 组件只读 state 渲染。
2. 锁定算法：候选 = `word[typedLen]===输入字母` 的陨石，取 `z` 最大（最近）。
3. `TICK` 用 `setInterval` ~33ms 驱动，视觉位置组件内 lerp 平滑。
4. **离线优先**：禁用 drei `<Environment>` HDR 与外部字体（旧 play2 踩过的坑），纯本地光 + drei 默认 3D 字体。

## 7. SRS 回写（`play-meteor-srs.ts`）

照搬 `lib/play-srs.ts` SM-2 逻辑。quality：漏失=0 / 0错击毁=5 / 1错=4 / ≥2错=3。0错击毁 → `wrongCount` 归零；漏失 → `wrongCount++`。

## 8. 验证

`npm run build` 零错误 → dev + Playwright：ModePicker 截图 → new 模式 → 陨石场景截图 → 模拟键盘敲击一词 → 确认激光/爆炸/计分 → console 无 error。

---

*最终设计文档。实现完毕后追加变更日志至 CLAUDE.md。*
