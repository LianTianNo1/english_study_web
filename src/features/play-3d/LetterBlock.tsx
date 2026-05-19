// 玻璃字母方块：候选区悬停 + 点击飞行到槽位 + 错放自动飞回
import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Block } from './types';
import { spawnBurst } from './Particles';
import { getShakeApi } from './useShake';
import { sfxTick } from '@/lib/sfx';

interface Props {
  block: Block;
  candidatePos: { x: number; y: number; z: number };
  targetPos: { x: number; y: number; z: number } | null;
  correct: boolean | null;
  onClick: () => void;
  /** 全局 combo，决定是否启用彩虹流光（≥15） */
  combo: number;
}

const BOX_SIZE: [number, number, number] = [0.7, 0.7, 0.32];
const FLY_MS = 220;
const NOOP_RAYCAST = () => {};

// 模块级共享几何 — 字母方块尺寸固定，不需要每个 instance 各自创建
const SHARED_BOX_GEOMETRY = new THREE.BoxGeometry(...BOX_SIZE);
const SHARED_EDGES_GEOMETRY = new THREE.EdgesGeometry(SHARED_BOX_GEOMETRY);

interface Flight {
  from: THREE.Vector3;
  to: THREE.Vector3;
  startedAt: number;
  fired: boolean;       // 是否已发粒子（仅飞入时发）
  isReturn: boolean;    // true=飞回原位
}

export function LetterBlock({ block, candidatePos, targetPos, correct, onClick, combo }: Props) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeRef = useRef<THREE.LineBasicMaterial>(null);
  const tmpColor = useRef(new THREE.Color());
  const rainbow = combo >= 15;
  // 入场动画 — 按 candidateIndex 错峰 60ms，scale 0→1
  const spawnAt = useMemo(
    () => performance.now() + block.candidateIndex * 60,
    [block.candidateIndex]
  );

  const startPosVec = useMemo(
    () => new THREE.Vector3(candidatePos.x, candidatePos.y, candidatePos.z),
    [candidatePos.x, candidatePos.y, candidatePos.z]
  );

  // 飞行通过 ref 而非 state 管理：避免 useEffect/setState 滞后于父级状态变化
  const flightRef = useRef<Flight | null>(null);
  const prevTargetRef = useRef<typeof targetPos>(null);

  // 检测 targetPos 变化触发飞行（飞入 / 飞回）
  useEffect(() => {
    if (!group.current) return;
    const prev = prevTargetRef.current;
    const curr = targetPos;
    if (curr && !prev) {
      // 飞入槽位
      flightRef.current = {
        from: group.current.position.clone(),
        to: new THREE.Vector3(curr.x, curr.y, curr.z),
        startedAt: performance.now(),
        fired: false,
        isReturn: false,
      };
    } else if (!curr && prev) {
      // 飞回候选区（错放撤回 / RETRY 复位）
      flightRef.current = {
        from: group.current.position.clone(),
        to: new THREE.Vector3(candidatePos.x, candidatePos.y, candidatePos.z),
        startedAt: performance.now(),
        fired: true, // 飞回不再发粒子
        isReturn: true,
      };
    }
    prevTargetRef.current = curr;
  }, [targetPos, candidatePos.x, candidatePos.y, candidatePos.z]);

  useFrame(() => {
    if (!group.current) return;
    const flight = flightRef.current;
    if (flight) {
      const t = (performance.now() - flight.startedAt) / FLY_MS;
      if (t >= 1) {
        group.current.position.copy(flight.to);
        group.current.rotation.set(0, 0, 0);
        if (!flight.fired) {
          flight.fired = true;
          if (correct === true) {
            spawnBurst({
              position: [flight.to.x, flight.to.y, flight.to.z],
              color: '#00E5FF',
              count: 10,
              spread: 0.45,
              lifeMs: 600,
            });
            getShakeApi()?.shake(0.04, 100);
          } else if (correct === false) {
            spawnBurst({
              position: [flight.to.x, flight.to.y, flight.to.z],
              color: '#FF6B35',
              count: 14,
              spread: 0.6,
              lifeMs: 700,
            });
            getShakeApi()?.shake(0.14, 220);
          }
        }
        flightRef.current = null;
        return;
      }
      const eased = easeOutBack(t);
      const x = flight.from.x + (flight.to.x - flight.from.x) * eased;
      const y =
        flight.from.y + (flight.to.y - flight.from.y) * eased + Math.sin(eased * Math.PI) * 0.6;
      const z = flight.from.z + (flight.to.z - flight.from.z) * eased;
      group.current.position.set(x, y, z);
      group.current.rotation.z = eased * Math.PI * 2 * (flight.isReturn ? -1 : 1);
      group.current.rotation.x = eased * Math.PI * (flight.isReturn ? -1 : 1);
      return;
    }

    // 非飞行：在槽位停留 OR 在候选区悬停浮动
    if (targetPos) {
      group.current.position.set(targetPos.x, targetPos.y, targetPos.z);
      return;
    }
    // 入场动画：错峰从 0 弹出至 1（前 400ms）
    const sinceSpawn = performance.now() - spawnAt;
    let spawnScale = 1;
    if (sinceSpawn < 0) spawnScale = 0;
    else if (sinceSpawn < 400) {
      const k = sinceSpawn / 400;
      // easeOutBack
      const c1 = 1.70158;
      const c3 = c1 + 1;
      spawnScale = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
    }
    // 候选区：悬停缩放 + 轻浮动 + 入场系数
    const targetScale = (hover ? 1.12 : 1) * spawnScale;
    const s = group.current.scale.x;
    const ns = s + (targetScale - s) * 0.25;
    group.current.scale.setScalar(ns);
    const t = performance.now() / 1000;
    const floatY = Math.sin(t * 1.5 + block.candidateIndex) * 0.05;
    group.current.position.set(candidatePos.x, candidatePos.y + floatY, candidatePos.z);

    // 高 combo（≥15）启用彩虹流光（复用 tmpColor ref 避免 GC 压力）
    if (rainbow && matRef.current && edgeRef.current && !block.isGold && correct !== false) {
      const hue = ((performance.now() / 12 + block.candidateIndex * 30) % 360) / 360;
      tmpColor.current.setHSL(hue, 1.0, 0.6);
      matRef.current.emissive.copy(tmpColor.current);
      edgeRef.current.color.copy(tmpColor.current);
    }
  });

  const isPlaced = block.placedSlot !== null;
  const isFlying = flightRef.current !== null;

  return (
    <group
      ref={group}
      position={[startPosVec.x, startPosVec.y, startPosVec.z]}
    >
      <RoundedBox
        args={BOX_SIZE}
        radius={0.08}
        smoothness={4}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!isPlaced && !isFlying) setHover(true);
          document.body.style.cursor = !isPlaced && !isFlying ? 'pointer' : '';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHover(false);
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isPlaced || isFlying) return;
          sfxTick();
          onClick();
        }}
      >
        <meshStandardMaterial
          ref={matRef}
          color={block.isGold ? '#2a1a04' : '#1a0a2e'}
          emissive={block.isGold ? '#FFD700' : correct === false ? '#FF6B35' : '#00E5FF'}
          emissiveIntensity={block.isGold ? (hover ? 1.6 : 0.85) : hover ? 1.2 : 0.55}
          roughness={0.25}
          metalness={block.isGold ? 0.85 : 0.6}
          transparent
          opacity={0.92}
        />
      </RoundedBox>
      <lineSegments geometry={SHARED_EDGES_GEOMETRY} raycast={NOOP_RAYCAST}>
        <lineBasicMaterial
          ref={edgeRef}
          color={block.isGold ? '#FFD700' : correct === false ? '#FF6B35' : '#00E5FF'}
          transparent
          opacity={hover ? 1 : 0.7}
          toneMapped={false}
        />
      </lineSegments>
      <Text
        position={[0, 0, BOX_SIZE[2] / 2 + 0.01]}
        fontSize={0.4}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#00E5FF"
        raycast={NOOP_RAYCAST}
      >
        {block.letter.toLowerCase()}
      </Text>
      <Text
        position={[0, 0, -BOX_SIZE[2] / 2 - 0.01]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.4}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#00E5FF"
        raycast={NOOP_RAYCAST}
      >
        {block.letter.toLowerCase()}
      </Text>
    </group>
  );
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
