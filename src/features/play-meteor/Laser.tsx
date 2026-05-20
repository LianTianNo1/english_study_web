// 激光射线 —— 模块级 store，基地→陨石的短生命发光束
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';

interface Bolt {
  id: number;
  from: [number, number, number];
  to: [number, number, number];
  startedAt: number;
  color: string;
}

const LIFE = 170;
const SHARED_GEO = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true);

let store: Bolt[] = [];
const subs = new Set<() => void>();
let seq = 0;

function emit() {
  store = store.filter((b) => performance.now() - b.startedAt < LIFE + 60);
  subs.forEach((s) => s());
}

export function fireLaser(from: [number, number, number], to: [number, number, number], color = '#39FF6A') {
  store = [...store, { id: ++seq, from, to, startedAt: performance.now(), color }];
  subs.forEach((s) => s());
  setTimeout(emit, LIFE + 80);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => { subs.delete(cb); };
}
function snapshot() { return store; }

export function Lasers() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (
    <>
      {list.map((b) => <Bolt key={b.id} bolt={b} />)}
    </>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

function Bolt({ bolt }: { bolt: Bolt }) {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const from = new THREE.Vector3(...bolt.from);
  const to = new THREE.Vector3(...bolt.to);
  const dir = to.clone().sub(from);
  const len = dir.length();
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());

  useFrame(() => {
    const t = (performance.now() - bolt.startedAt) / LIFE;
    const k = t > 1 ? 0 : 1 - t;
    if (ref.current) {
      (ref.current.material as THREE.MeshBasicMaterial).opacity = k;
      ref.current.visible = k > 0;
    }
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = k * 0.4;
      glowRef.current.visible = k > 0;
    }
  });

  return (
    <group position={mid} quaternion={quat}>
      <mesh ref={ref} geometry={SHARED_GEO} scale={[1, len, 1]}>
        <meshBasicMaterial color={bolt.color} transparent toneMapped={false} />
      </mesh>
      <mesh ref={glowRef} geometry={SHARED_GEO} scale={[3.2, len, 3.2]}>
        <meshBasicMaterial color={bolt.color} transparent opacity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}
