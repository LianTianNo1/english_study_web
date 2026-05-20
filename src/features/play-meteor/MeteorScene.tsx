// R3F Canvas 根 —— 深空告警台场景
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Bursts } from '@/features/play-3d/Particles';
import { ShakeController } from '@/features/play-3d/useShake';
import { Base } from './Base';
import { Meteor } from './Meteor';
import { Lasers } from './Laser';
import type { Meteor as MeteorT } from './types';
import { BASE_MAX_HP } from './types';

interface Props {
  meteors: MeteorT[];
  lockedId: string | null;
  baseHp: number;
  combo: number;
  onTapMeteor: (id: string) => void;
}

export function MeteorScene({ meteors, lockedId, baseHp, combo, onTapMeteor }: Props) {
  const ca = useMemo(
    () => new THREE.Vector2(0.0006 + Math.min(combo, 20) * 0.00012, 0.0006),
    [combo]
  );

  return (
    <Canvas
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
      camera={{ position: [0, 1.6, 12], fov: 60, near: 0.1, far: 80 }}
      onCreated={({ camera }) => camera.lookAt(0, -0.8, -4)}
    >
      <color attach="background" args={['#07060A']} />
      <fog attach="fog" args={['#07060A', 16, 54]} />

      {/* 灯光 */}
      <ambientLight intensity={0.35} color="#FFB020" />
      <pointLight position={[0, 0, 6]} intensity={1.4} color="#FFB020" distance={30} />
      <pointLight position={[0, -2, 4]} intensity={1.6} color="#FF8800" distance={14} />
      <directionalLight position={[3, 6, 6]} intensity={0.3} color="#FFD9A0" />

      {/* 深空地网 */}
      <gridHelper args={[160, 64, '#5a3f10', '#1c1305']} position={[0, -6.5, -18]} />

      {/* 星尘 */}
      <Sparkles count={130} scale={[64, 34, 60]} size={2.4} speed={0.18} color="#FFB020" position={[0, 2, -16]} />

      <Base hitFlashAt={useHitFlash(meteors)} hpRatio={baseHp / BASE_MAX_HP} />

      {meteors.map((m) => (
        <Meteor key={m.id} meteor={m} locked={m.id === lockedId} onTap={onTapMeteor} />
      ))}

      <Lasers />
      <Bursts />
      <ShakeController />

      <EffectComposer multisampling={2}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.5} />
        <ChromaticAberration offset={ca} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}

/** 取最近坠毁陨石的时间戳，传给 Base 做受击红闪（轻量，无需额外 state） */
function useHitFlash(meteors: MeteorT[]): number {
  let latest = 0;
  for (const m of meteors) {
    if (m.status === 'breached' && m.endedAt && m.endedAt > latest) latest = m.endedAt;
  }
  return latest;
}
