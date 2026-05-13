import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Volume2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { speak } from '@/lib/tts';

interface Props {
  /** 目标单词或句子，用于"原声"对照 */
  reference: string;
  /** 紧凑模式：仅显示一个按钮 */
  compact?: boolean;
}

/**
 * 按住录音 / 松开停止；提供与原声对比的播放按钮。
 * 不渲染波形（避免增加复杂度），但提供录音时长指示。
 */
export function PronunciationRecorder({ reference, compact = false }: Props) {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [audioURL]);

  // 切换参考文本时清空旧录音
  useEffect(() => {
    setAudioURL((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
    setDuration(0);
    setError('');
  }, [reference]);

  async function start() {
    setError('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持录音');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
                : '';
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioURL((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      startTimeRef.current = Date.now();
      setDuration(0);
      mr.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);
    } catch (e) {
      setError((e as Error).message || '麦克风权限被拒绝');
    }
  }

  function stop() {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    mr.stop();
    setRecording(false);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  }

  function playMine() {
    if (!audioURL) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = audioURL;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }

  function clearRecording() {
    if (audioURL) URL.revokeObjectURL(audioURL);
    setAudioURL('');
    setDuration(0);
  }

  if (compact) {
    return (
      <button
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={() => recording && stop()}
        className={cn(
          'btn-icon !h-8 !w-8 transition-colors select-none',
          recording && 'border-crimson bg-crimson text-paper animate-pulse'
        )}
        title="按住录音 · 松开停止"
      >
        <Mic size={14} />
      </button>
    );
  }

  return (
    <div className="rounded-md border border-paper3 bg-paper p-3">
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
        <span>recording · 跟读对比</span>
        {audioURL && (
          <button onClick={clearRecording} className="text-ink3 hover:text-ink" title="清除录音">
            <X size={12} />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={() => recording && stop()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition select-none',
            recording
              ? 'border-crimson bg-crimson text-paper'
              : 'border-paper3 bg-paper text-ink hover:border-ink'
          )}
        >
          {recording ? <><Square size={12} className="animate-pulse" /> 松开停止 · {duration.toFixed(1)}s</> : <><Mic size={12} /> 按住录音</>}
        </button>
        <button
          onClick={() => speak(reference)}
          className="inline-flex items-center gap-1.5 rounded-md border border-paper3 bg-paper px-3 py-2 text-xs font-semibold text-ink2 hover:border-ink"
          title="听原声"
        >
          <Volume2 size={12} /> 原声
        </button>
        <button
          onClick={playMine}
          disabled={!audioURL}
          className="inline-flex items-center gap-1.5 rounded-md border border-paper3 bg-paper px-3 py-2 text-xs font-semibold text-ink2 hover:border-ink disabled:opacity-40"
          title="回放我的发音"
        >
          <Play size={12} /> 我的{duration > 0 && audioURL ? ` · ${duration.toFixed(1)}s` : ''}
        </button>
      </div>
      {error && <div className="mt-2 text-xs text-crimson">{error}</div>}
    </div>
  );
}
