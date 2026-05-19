// R3F Canvas 根：黑底 + Bloom + 反射地面 + 浮空字母舞台
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import { MeshReflectorMaterial, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { LetterBlock } from './LetterBlock';
import { SlotRow, slotWorldPos } from './SlotRow';
import { Bursts } from './Particles';
import { ShakeController } from './useShake';
import type { Stage } from './types';
import { useMediaQuery } from '@/lib/useMediaQuery';

interface Props {
  stage: Stage;
  onClickBlock: (blockId: string) => void;
  combo: number;
  freezeUntilAt: number | null;
  /** stage-clear 时触发相机推近 → 拉回的镜头特效 */
  stageClearActive: boolean;
}

// 候选区：所有字母同 Z 平面 → 屏幕大小一致、无遮挡；超过 SINGLE_MAX 才分上下两行
const CANDIDATE_Z = 2.6;
const SINGLE_MAX = 5;       // ≤5 单排，>5 两排 — 更狭长视口也能放得下
const ROW_Y_TOP = 0.45;
const ROW_Y_BOT = -0.6;
const ROW_Y_CENTER = -0.05;
const CANDIDATE_SPACING_X = 0.8;

function candidatePos(index: number, total: number): { x: number; y: number; z: number } {
  if (total <= SINGLE_MAX) {
    const startX = -((total - 1) * CANDIDATE_SPACING_X) / 2;
    return { x: startX + index * CANDIDATE_SPACING_X, y: ROW_Y_CENTER, z: CANDIDATE_Z };
  }
  // 上排放前 N/2，下排放剩余
  const topCount = Math.ceil(total / 2);
  const inTop = index < topCount;
  const col = inTop ? index : index - topCount;
  const items = inTop ? topCount : total - topCount;
  const startX = -((items - 1) * CANDIDATE_SPACING_X) / 2;
  return {
    x: startX + col * CANDIDATE_SPACING_X,
    y: inTop ? ROW_Y_TOP : ROW_Y_BOT,
    z: CANDIDATE_Z,
  };
}

export function PlayScene({ stage, onClickBlock, combo, freezeUntilAt, stageClearActive }: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const candidatePositions = useMemo(() => {
    const total = stage.blocks.length;
    return stage.blocks.map((_, i) => candidatePos(i, total));
  }, [stage.blocks]);

  // useMemo Vector2 — 避免 combo 变化时每次 render 重建对象触发后处理 uniform 重设
  const chromaOffset = useMemo(
    () =>
      new THREE.Vector2(
        isMobile ? 0 : 0.0008 + (combo >= 10 ? 0.0025 : 0),
        isMobile ? 0 : 0.0008 + (combo >= 10 ? 0.0025 : 0)
      ),
    [combo, isMobile]
  );

  return (
    <Canvas
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      camera={{ fov: 42, position: [0, 1.8, 12.5], near: 0.1, far: 60 }}
      style={{ touchAction: 'none', background: '#0a0612' }}
      gl={{ antialias: !isMobile }}
    >
      <color attach="background" args={['#0a0612']} />
      <fog attach="fog" args={['#0a0612', 7, 18]} />

      {/* 灯光：偏冷紫 + 顶部冷光 + 暖色后补 */}
      <ambientLight intensity={0.25} color="#7B6BFF" />
      <directionalLight position={[2, 6, 4]} intensity={0.6} color="#00E5FF" />
      <pointLight position={[-3, 2, 2]} intensity={1.2} color="#A855F7" distance={10} />
      <pointLight position={[3, 1, 2]} intensity={0.8} color="#FF6B35" distance={8} />

      <Suspense fallback={null}>
        {/* 反射地面（移动端降级） */}
        {!isMobile ? (
          <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[40, 40]} />
            <MeshReflectorMaterial
              blur={[300, 100]}
              resolution={1024}
              mixBlur={1}
              mixStrength={50}
              roughness={0.85}
              depthScale={1.1}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.4}
              color="#080510"
              metalness={0.6}
              mirror={0.6}
            />
          </mesh>
        ) : (
          <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial color="#050309" roughness={0.9} metalness={0.4} />
          </mesh>
        )}

        {/* 远处霓虹网格背景（combo ≥5 时脉冲） */}
        <ComboGrid combo={combo} />

        {/* 环境漂浮粒子 — 增强空间深度感（移动端减少） */}
        <Sparkles
          count={isMobile ? 30 : 80}
          scale={[20, 8, 12]}
          size={2.5}
          speed={0.3}
          opacity={0.6}
          color="#7DD3FC"
          position={[0, 1, -2]}
        />

        {/* 自适应缩放：窄屏整体缩小，宽屏 1.0 */}
        <AspectScaler>
        {/* 槽位行 */}
        <SlotRow slots={stage.slots} blocks={stage.blocks} />

        {/* 候选字母 */}
        {stage.blocks.map((b, i) => {
          const placed = b.placedSlot !== null;
          const slot = placed ? stage.slots[b.placedSlot!] : null;
          const targetPos = placed
            ? slotWorldPos(b.placedSlot!, stage.slots.length)
            : null;
          return (
            <LetterBlock
              key={b.id}
              block={b}
              candidatePos={candidatePositions[i]}
              targetPos={targetPos ? { x: targetPos.x, y: targetPos.y + 0.15, z: targetPos.z } : null}
              correct={slot ? slot.correct : null}
              onClick={() => onClickBlock(b.id)}
              combo={combo}
            />
          );
        })}

        {/* 粒子 */}
        <Bursts />
        </AspectScaler>

        {/* 屏震控制器 + 通关镜头推拉 */}
        <ShakeController />
        <CameraDolly active={stageClearActive} />

        {/* 后处理：combo ≥10 时 chromatic 加强；freeze 时 vignette 加深 */}
        <EffectComposer multisampling={isMobile ? 0 : 4}>
          <Bloom
            intensity={isMobile ? 0.55 : 0.85 + Math.min(combo / 30, 0.6)}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.25}
            radius={0.8}
          />
          <ChromaticAberration
            offset={chromaOffset}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.2} darkness={freezeUntilAt && Date.now() < freezeUntilAt ? 0.85 : 0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

/** 根据视口宽高比缩放：窄屏整体缩小，避免内容溢出 */
function AspectScaler({ children }: { children: React.ReactNode }) {
  const { size } = useThree();
  const aspect = size.width / size.height;
  const scale = Math.min(1, aspect / 1.4);
  return <group scale={scale}>{children}</group>;
}

/** 通关相机推拉：active=true 时 z 从 12.5 推到 9（300ms 推 + 700ms 停 + 500ms 拉回） */
function CameraDolly({ active }: { active: boolean }) {
  const { camera } = useThree();
  const startedRef = useRef<number | null>(null);
  const baseZ = useRef(12.5);

  useFrame(() => {
    if (active && startedRef.current === null) {
      startedRef.current = performance.now();
      baseZ.current = camera.position.z;
    }
    if (!active && startedRef.current !== null && performance.now() - startedRef.current > 1500) {
      startedRef.current = null;
      camera.position.z = baseZ.current;
      return;
    }
    if (startedRef.current === null) return;
    const t = (performance.now() - startedRef.current) / 1500;
    if (t > 1) {
      camera.position.z = baseZ.current;
      return;
    }
    // 0-0.2 推近；0.2-0.65 停留；0.65-1 拉回
    let targetZ = baseZ.current;
    if (t < 0.2) {
      const k = t / 0.2;
      targetZ = baseZ.current - 3.5 * easeOutBack(k);
    } else if (t < 0.65) {
      targetZ = baseZ.current - 3.5;
    } else {
      const k = (t - 0.65) / 0.35;
      targetZ = baseZ.current - 3.5 * (1 - k);
    }
    camera.position.z = targetZ;
  });
  return null;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** 远处霓虹网格：基础静态显示；combo ≥5 时按节奏脉冲 + 颜色饱和度上升 */
function ComboGrid({ combo }: { combo: number }) {
  const ref = useRef<THREE.GridHelper>(null);
  useFrame((s) => {
    if (!ref.current) return;
    if (combo >= 5) {
      const pulse = (Math.sin(s.clock.elapsedTime * 6) + 1) / 2;
      const k = 1 + pulse * 0.25;
      ref.current.scale.set(k, 1, k);
      const mat = ref.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.6 + pulse * 0.4;
      mat.transparent = true;
    } else {
      ref.current.scale.set(1, 1, 1);
    }
  });
  const colorMain = combo >= 10 ? '#FFD700' : combo >= 5 ? '#FF6B35' : '#A855F7';
  return (
    <gridHelper
      ref={ref}
      args={[40, 40, colorMain, '#3a1d5c']}
      position={[0, -1.39, -8]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  );
}
