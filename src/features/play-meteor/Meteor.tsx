// 单颗陨石 —— 低面岩石 + 逐字母单词 + 锁定准星
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Meteor as MeteorT } from './types';
import { meteorWorldPos } from './meteorEngine';

interface Props {
  meteor: MeteorT;
  locked: boolean;
  onTap: (id: string) => void;
}

// 模块级共享几何 —— 所有陨石复用
const ROCK_GEO = new THREE.IcosahedronGeometry(0.62, 0);
const ROCK_WIRE = new THREE.IcosahedronGeometry(0.66, 0);

const AMBER = '#FFB020';
const GREEN = '#39FF6A';
const ALARM = '#FF3B30';

export function Meteor({ meteor, locked, onTap }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const rockRef = useRef<THREE.Mesh>(null);
  const target = useRef(new THREE.Vector3());

  const spin = useMemo(
    () => ({
      x: (meteor.seed - 0.5) * 0.7,
      y: (meteor.seed * 1.7 - 0.5) * 0.9,
    }),
    [meteor.seed]
  );

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const [wx, wy, wz] = meteorWorldPos(meteor);
    target.current.set(wx, wy, wz);
    const baseScale = 0.55 + meteor.z * 0.95;

    if (meteor.status === 'incoming') {
      g.position.lerp(target.current, Math.min(1, dt * 14));
      g.scale.setScalar(
        THREE.MathUtils.lerp(g.scale.x || baseScale, baseScale, Math.min(1, dt * 10))
      );
    } else if (meteor.status === 'destroyed') {
      const k = meteor.endedAt ? Math.min(1, (Date.now() - meteor.endedAt) / 600) : 0;
      g.scale.setScalar(baseScale * (1 + k * 1.9));
      setOpacity(rockRef.current, 1 - k);
    } else {
      const k = meteor.endedAt ? Math.min(1, (Date.now() - meteor.endedAt) / 400) : 0;
      g.scale.setScalar(baseScale * (1 - k));
      setOpacity(rockRef.current, 1 - k);
    }

    if (rockRef.current) {
      rockRef.current.rotation.x += spin.x * dt;
      rockRef.current.rotation.y += spin.y * dt;
    }
  });

  const dying = meteor.status !== 'incoming';
  const rockColor =
    meteor.status === 'breached' ? ALARM : meteor.errors > 0 ? '#C77A12' : '#7a5410';
  const emissive =
    meteor.status === 'destroyed' ? '#FFFFFF'
      : meteor.status === 'breached' ? ALARM
      : locked ? GREEN : AMBER;

  const letters = meteor.word.split('');
  const letterW = 0.5;
  const wordW = letters.length * letterW;

  return (
    <group ref={groupRef}>
      {/* 岩石本体 */}
      <mesh
        ref={rockRef}
        geometry={ROCK_GEO}
        onPointerDown={(e) => { e.stopPropagation(); onTap(meteor.id); }}
      >
        <meshStandardMaterial
          color={rockColor}
          emissive={emissive}
          emissiveIntensity={meteor.status === 'destroyed' ? 3 : locked ? 1.2 : 0.6}
          roughness={0.85}
          metalness={0.3}
          transparent
          flatShading
        />
      </mesh>
      {/* 线框外壳 */}
      {!dying && (
        <mesh geometry={ROCK_WIRE}>
          <meshBasicMaterial
            color={locked ? GREEN : AMBER}
            wireframe
            transparent
            opacity={0.35}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* 单词 + 准星（始终面向相机） */}
      {!dying && (
        <Billboard position={[0, 1.05, 0]}>
          {locked && <Reticle width={wordW + 0.5} height={0.9} />}
          {letters.map((ch, i) => (
            <Text
              key={i}
              position={[(i - (letters.length - 1) / 2) * letterW, 0, 0]}
              fontSize={0.56}
              color={i < meteor.typedLen ? GREEN : AMBER}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.04}
              outlineColor="#07060A"
              characters="abcdefghijklmnopqrstuvwxyz"
            >
              {ch}
            </Text>
          ))}
        </Billboard>
      )}
    </group>
  );
}

function setOpacity(mesh: THREE.Mesh | null, o: number) {
  if (!mesh) return;
  const m = mesh.material as THREE.MeshStandardMaterial;
  m.opacity = o;
}

/** 锁定准星 —— 四角 L 形绿框 */
function Reticle({ width, height }: { width: number; height: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const s = 1 + Math.sin(performance.now() * 0.008) * 0.04;
    ref.current.scale.set(s, s, 1);
  });
  const hw = width / 2;
  const hh = height / 2;
  const arm = 0.22;
  const corners: Array<[number, number, number, number]> = [
    [-hw, hh, 1, -1], [hw, hh, -1, -1],
    [-hw, -hh, 1, 1], [hw, -hh, -1, 1],
  ];
  return (
    <group ref={ref}>
      {corners.map(([cx, cy, dx, dy], i) => (
        <group key={i} position={[cx, cy, 0]}>
          <mesh position={[(dx * arm) / 2, 0, 0]}>
            <planeGeometry args={[arm, 0.05]} />
            <meshBasicMaterial color="#39FF6A" toneMapped={false} />
          </mesh>
          <mesh position={[0, (dy * arm) / 2, 0]}>
            <planeGeometry args={[0.05, arm]} />
            <meshBasicMaterial color="#39FF6A" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
