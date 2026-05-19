// 通关 2D 覆盖层：白闪 + 巨大金字（字母逐个延迟弹入）
// 用 HTML 渲染，永远在 3D 内容之上，免遮挡 / 享受 CSS gradient & blur 文本效果
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  text: string;
  /** stage 索引：变化时重置动画 */
  stageIndex: number;
  visible: boolean;
}

export function StageClearOverlay({ text, stageIndex, visible }: Props) {
  // 用 key 重置 CSS 动画，每次 stage-clear 重新播
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (visible) setAnimKey((k) => k + 1);
  }, [visible, stageIndex]);

  if (!visible) return null;

  const letters = text.split('');
  // 自适应字号：保证 90vw 内不溢出（每个字母约占 fontSize × 0.6 宽）
  // 单词越长字号越小：5 字母用 16vw，10 字母用 10vw，15 字母用 ~7vw
  const fontVw = Math.min(16, Math.max(5, 90 / Math.max(letters.length, 4) / 0.65));

  return (
    <div
      key={animKey}
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden"
    >
      {/* 全屏白闪 — 200ms shutter effect */}
      <div
        className="absolute inset-0 bg-white"
        style={{
          animation: 'playFlashWhite 240ms ease-out forwards',
        }}
      />

      {/* 巨大金字：字母逐个错峰 50ms 弹入 + 上升拖尾 */}
      <div
        className={cn(
          'relative flex items-end gap-[0.02em] font-tech max-w-[92vw]',
          'font-black uppercase tracking-tight leading-none',
          'drop-shadow-[0_0_28px_rgba(255,200,80,0.6)]'
        )}
        style={{ fontSize: `clamp(40px, ${fontVw}vw, 180px)` }}
      >
        {letters.map((ch, i) => (
          <span
            key={i}
            className="inline-block bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text text-transparent"
            style={{
              animation: `playRevealLetter 900ms cubic-bezier(0.16, 1.2, 0.3, 1) ${i * 60}ms both`,
              filter: 'drop-shadow(0 0 18px rgba(255, 215, 0, 0.55))',
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* 副标题：上滑后淡入 */}
      <div
        className="absolute bottom-[18%] font-tech text-xs uppercase tracking-[0.4em] text-amber-200/80"
        style={{
          animation: 'playSubtitleIn 600ms ease-out 600ms both',
        }}
      >
        ✦ stage clear ✦
      </div>
    </div>
  );
}
