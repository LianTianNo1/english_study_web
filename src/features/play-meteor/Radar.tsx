// 雷达扫描仪 —— /play2 签名元素，右下角 HUD
import { meteorRadarPos } from './meteorEngine';
import type { Meteor } from './types';

interface Props {
  meteors: Meteor[];
  lockedId: string | null;
}

export function Radar({ meteors, lockedId }: Props) {
  const incoming = meteors.filter((m) => m.status === 'incoming');
  return (
    <div className="mtr-panel mtr-corners relative h-[150px] w-[150px] rounded-full">
      {/* 同心环 */}
      <div className="absolute inset-[14%] rounded-full border border-[#FFB020]/25" />
      <div className="absolute inset-[34%] rounded-full border border-[#FFB020]/20" />
      {/* 十字准线 */}
      <div className="absolute left-1/2 top-[8%] bottom-[8%] w-px -translate-x-1/2 bg-[#FFB020]/20" />
      <div className="absolute top-1/2 left-[8%] right-[8%] h-px -translate-y-1/2 bg-[#FFB020]/20" />
      {/* 旋转扫描扇区 */}
      <div
        className="mtr-radar-sweep absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(57,255,106,0.32) 0deg, rgba(57,255,106,0.05) 36deg, transparent 70deg, transparent 360deg)',
        }}
      />
      {/* 陨石光点 */}
      {incoming.map((m) => {
        const { rx, ry } = meteorRadarPos(m);
        const left = 50 + rx * 40;
        const top = 11 + (1 - ry) * 78;
        const isLocked = m.id === lockedId;
        const danger = m.z > 0.66;
        const color = isLocked ? '#39FF6A' : danger ? '#FF3B30' : '#FFB020';
        return (
          <div
            key={m.id}
            className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        );
      })}
      {/* 基地标记 */}
      <div
        className="absolute left-1/2 bottom-[7%] h-[10px] w-[10px] -translate-x-1/2 translate-y-1/2"
        style={{
          background: '#39FF6A',
          boxShadow: '0 0 10px #39FF6A',
          clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
        }}
      />
      {/* 标签 */}
      <div className="font-term absolute -top-px left-1/2 -translate-x-1/2 -translate-y-full pb-1 text-[9px] uppercase tracking-[0.3em] text-[#FFB020]/70">
        radar
      </div>
    </div>
  );
}
