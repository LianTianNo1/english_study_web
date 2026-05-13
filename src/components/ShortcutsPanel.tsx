import { Keyboard } from 'lucide-react';
import { MobileSheet } from './MobileSheet';

interface Props {
  open: boolean;
  onClose: () => void;
}

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: '全局 · global',
    items: [
      { keys: ['?'], label: '打开 / 关闭此面板' },
      { keys: ['Esc'], label: '关闭弹层' },
    ],
  },
  {
    title: '新词 · learn',
    items: [
      { keys: ['←', '→'], label: '上一个 / 下一个词卡' },
      { keys: ['Space'], label: '朗读当前词' },
      { keys: ['S'], label: '收藏当前词' },
      { keys: ['↵', 'Enter'], label: '下一个 / 开始练习' },
    ],
  },
  {
    title: '复习 · review',
    items: [
      { keys: ['↵', 'Space'], label: '揭晓释义' },
      { keys: ['F'], label: '重新朗读' },
      { keys: ['S'], label: '收藏 / 取消' },
      { keys: ['1', 'Q'], label: '忘了' },
      { keys: ['2', 'W'], label: '模糊' },
      { keys: ['3', 'E', '↵'], label: '记住' },
    ],
  },
  {
    title: '听写 · listening',
    items: [
      { keys: ['R'], label: '重播音频' },
      { keys: ['S'], label: '慢速朗读' },
      { keys: ['↵'], label: '提交 / 继续' },
    ],
  },
  {
    title: '错词揭晓后 (拼写答错)',
    items: [
      { keys: ['↵'], label: '继续下一题' },
    ],
  },
];

/** 全局快捷键速查面板（按 ? 唤起） */
export function ShortcutsPanel({ open, onClose }: Props) {
  const content = (
    <div>
      <div className="hidden items-center gap-2 px-1 pb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-ink3 md:flex">
        <Keyboard size={12} /> keyboard shortcuts · 速查
      </div>
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-persimmon-700">{g.title}</div>
            <ul className="mt-2 space-y-1.5">
              {g.items.map((it, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 border-b border-paper3/60 pb-1.5 last:border-0">
                  <span className="text-sm text-ink2">{it.label}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {it.keys.map((k, j) => (
                      <span key={j} className="inline-flex items-center gap-1">
                        {j > 0 && <span className="text-[9px] text-ink3">/</span>}
                        <kbd className="kbd">{k}</kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-paper3 pt-3 font-mono text-[10px] uppercase tracking-wider text-ink3">
        提示 · 在输入框中按键不会触发快捷键。移动端可用按钮替代键盘。
      </p>
    </div>
  );

  // 移动端：底部 sheet；桌面端：居中浮窗
  return (
    <>
      <MobileSheet open={open} onClose={onClose} side="bottom" title="keyboard · 快捷键速查" maxHeight="85vh">
        {content}
      </MobileSheet>
      {/* 桌面端居中浮窗 —— MobileSheet 仅 md:hidden 渲染，桌面需独立一份 */}
      {open && (
        <div className="fixed inset-0 z-50 hidden items-center justify-center md:flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} />
          <div className="relative max-h-[80vh] w-[520px] overflow-y-auto rounded-lg border border-paper3 bg-paper p-6 shadow-paper animate-fade-up">
            <button onClick={onClose} className="absolute right-3 top-3 font-mono text-[10px] uppercase tracking-wider text-ink3 hover:text-ink">
              close · esc
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
