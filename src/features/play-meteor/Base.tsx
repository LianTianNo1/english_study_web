// 玩家基地 —— 发光穹顶 + 六边形停机坪 + 受击红闪
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BASE_POS } from './types';

interface Props {
  hitFlashAt: number;
  /** 0..1 健康比例，越低越红 */
  hpRatio: number;
}

const AMBER = new THREE.Color('#FFB020');
const ALARM = new THREE.Color('#FF3B30');

export function Base({ hitFlashAt, hpRatio }: Props) {
  const domeRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const tmp = useRef(new THREE.Color());

  useFrame((_, dt) => {
    const now = Date.now();
    const sinceHit = now - hitFlashAt;
    // 受击 350ms 内强红，其余按血量在琥珀↔红之间插值
    const hitK = sinceHit < 350 ? 1 - sinceHit / 350 : 0;
    const dangerK = Math.max(hitK, (1 - hpRatio) * 0.6);
    tmp.current.copy(AMBER).lerp(ALARM, dangerK);

    const pulse = 0.55 + Math.sin(now * 0.004) * 0.18 + hitK * 0.8;

    if (domeRef.current) {
      const mat = domeRef.current.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(tmp.current);
      mat.emissiveIntensity = pulse;
      mat.color.copy(tmp.current).multiplyScalar(0.3);
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(tmp.current);
      mat.opacity = 0.4 + Math.sin(now * 0.006) * 0.2 + hitK * 0.5;
      ringRef.current.rotation.z += dt * 0.4;
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(tmp.current);
      const s = 1 + Math.sin(now * 0.005) * 0.12 + hitK * 0.6;
      coreRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={BASE_POS} scale={0.62}>
      {/* 发光穹顶（上半球） */}
      <mesh ref={domeRef}>
        <sphereGeometry args={[1.5, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#3a2a08"
          emissive={AMBER}
          emissiveIntensity={0.6}
          roughness={0.4}
          metalness={0.6}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* 核心光球 */}
      <mesh ref={coreRef} position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      {/* 旋转能量环 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.8, 2.05, 48]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* 六边形停机坪 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[2.4, 6]} />
        <meshStandardMaterial
          color="#140d05"
          emissive={AMBER}
          emissiveIntensity={0.15}
          roughness={0.9}
          metalness={0.3}
        />
      </mesh>
      {/* 坪边缘描边 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.32, 2.42, 6]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.6} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}
