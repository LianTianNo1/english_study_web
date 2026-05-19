// 一次性粒子爆裂：模块级 store + useSyncExternalStore
import { useRef, useMemo, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 模块级共享几何 — 所有粒子复用，避免每次 burst 创建几十个 buffer
const SHARED_SPHERE_GEO = new THREE.SphereGeometry(0.06, 6, 6);

interface Burst {
  position: [number, number, number];
  color: string;
  count: number;
  spread: number;
  lifeMs: number;
}

interface BurstEntry {
  id: string;
  data: Burst;
  startedAt: number;
}

// ============ 模块级 store ============
let store: BurstEntry[] = [];
const subs = new Set<() => void>();
let nextId = 0;

function emit() {
  store = store.filter((b) => performance.now() - b.startedAt < b.data.lifeMs + 200);
  subs.forEach((s) => s());
}

export function spawnBurst(data: Burst) {
  store = [...store, { id: `burst-${++nextId}`, data, startedAt: performance.now() }];
  subs.forEach((s) => s());
  // 自动清理
  setTimeout(emit, data.lifeMs + 250);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

function getSnapshot() {
  return store;
}

export function useBurstStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ============ 渲染 ============
export function Bursts() {
  const list = useBurstStore();
  return (
    <>
      {list.map((b) => (
        <BurstMesh key={b.id} entry={b} />
      ))}
    </>
  );
}

function BurstMesh({ entry }: { entry: BurstEntry }) {
  const group = useRef<THREE.Group>(null);
  const velocities = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < entry.data.count; i++) {
      const theta = (i / entry.data.count) * Math.PI * 2 + Math.random() * 0.4;
      const phi = (Math.random() - 0.5) * Math.PI * 0.6;
      const speed = 2 + Math.random() * 2;
      arr.push(
        new THREE.Vector3(
          Math.cos(theta) * Math.cos(phi),
          Math.sin(phi) + 0.5,
          Math.sin(theta) * Math.cos(phi)
        ).multiplyScalar(speed * entry.data.spread)
      );
    }
    return arr;
  }, [entry.data.count, entry.data.spread]);

  useFrame(() => {
    if (!group.current) return;
    const t = (performance.now() - entry.startedAt) / entry.data.lifeMs;
    if (t > 1) {
      group.current.visible = false;
      return;
    }
    group.current.visible = true;
    group.current.children.forEach((child, i) => {
      const v = velocities[i];
      child.position.set(v.x * t, v.y * t - 4 * t * t, v.z * t);
      const mesh = child as THREE.Mesh;
      const m = mesh.material as THREE.MeshBasicMaterial;
      m.opacity = 1 - t;
      m.transparent = true;
      child.scale.setScalar(1 - t * 0.6);
    });
  });

  return (
    <group ref={group} position={entry.data.position}>
      {Array.from({ length: entry.data.count }).map((_, i) => (
        <mesh key={i} geometry={SHARED_SPHERE_GEO}>
          <meshBasicMaterial color={entry.data.color} toneMapped={false} transparent />
        </mesh>
      ))}
    </group>
  );
}
