import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  side?: 'bottom' | 'right';
  title?: string;
  children: React.ReactNode;
  /** 自定义最大高度（仅 bottom 模式生效） */
  maxHeight?: string;
}

/** 通用移动端抽屉：底部上滑 或 右侧滑出 */
export function MobileSheet({ open, onClose, side = 'bottom', title, children, maxHeight = '75vh' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px] animate-fade-up"
        style={{ animationDuration: '0.2s' }}
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute bg-paper shadow-paper border-paper3',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 rounded-t-2xl border-t animate-fade-up'
            : 'inset-y-0 right-0 w-72 max-w-[85vw] border-l overflow-y-auto'
        )}
        style={
          side === 'bottom'
            ? { maxHeight, paddingBottom: 'env(safe-area-inset-bottom)' }
            : { paddingTop: 'env(safe-area-inset-top)' }
        }
      >
        {side === 'bottom' && (
          <div className="flex justify-center pt-2 pb-1">
            <span className="h-1 w-10 rounded-full bg-paper3" />
          </div>
        )}
        {title && (
          <div className="flex items-center justify-between border-b border-paper3 px-5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{title}</span>
            <button onClick={onClose} className="font-mono text-xs uppercase tracking-wider text-ink3 hover:text-ink">
              close
            </button>
          </div>
        )}
        <div
          className={cn('overflow-y-auto', side === 'bottom' ? 'px-5 pb-5 pt-2' : 'px-4 py-4')}
          style={side === 'bottom' ? { maxHeight: `calc(${maxHeight} - 3.5rem)` } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
