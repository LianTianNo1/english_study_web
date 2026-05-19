// 霓虹凹槽
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { SlotState } from './types';

interface Props {
  slot: SlotState;
  position: [number, number, number];
  filledLetter?: string;
}

export const SLOT_DIAM = 0.8;
export const SLOT_THICK = 0.06;

export function Slot({ slot, position, filledLetter }: Props) {
  const ringRef = useRef<THREE.Mesh>(null);
  const filled = slot.filledBlockId !== null;
  const correct = slot.correct;

  // 空槽呼吸光晕
  useFrame((state) => {
    if (ringRef.current && !filled) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      const pulse = (Math.sin(state.clock.elapsedTime * 2) + 1) / 2;
      mat.opacity = 0.4 + pulse * 0.3;
    }
  });

  const baseColor = correct ? '#00E5FF' : filled ? '#FF6B35' : '#00E5FF';
  const emissive = correct ? '#00E5FF' : filled ? '#FF6B35' : '#001a22';

  return (
    <group position={position}>
      {/* 凹槽底面：圆盘 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[SLOT_DIAM / 2, 32]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissive}
          emissiveIntensity={correct ? 1.5 : filled ? 0.6 : 0.25}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 凹槽边框：圆环 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[SLOT_DIAM / 2 - SLOT_THICK, SLOT_DIAM / 2, 48]} />
        <meshBasicMaterial
          color={correct ? '#00E5FF' : filled ? '#FF6B35' : '#00E5FF'}
          transparent
          opacity={correct ? 1 : 0.7}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 提示字母（半透明，仅空时显示） */}
      {!filled && (
        <Text
          position={[0, 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.36}
          color="#00E5FF"
          fillOpacity={0.35}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#00E5FF"
        >
          {slot.expected.toLowerCase()}
        </Text>
      )}
      {/* 已填入字母 */}
      {filled && filledLetter && (
        <Text
          position={[0, 0.04, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color={correct ? '#FFFFFF' : '#FF6B35'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor={correct ? '#00E5FF' : '#FF6B35'}
        >
          {filledLetter.toLowerCase()}
        </Text>
      )}
    </group>
  );
}
