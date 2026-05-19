// 屏震 hook：暴露 shake(strength, durationMs)，每帧抖动相机位置
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface ShakeApi {
  shake: (strength: number, durationMs: number) => void;
}

let api: ShakeApi | null = null;

export function getShakeApi(): ShakeApi | null {
  return api;
}

/** 挂在 Canvas 内任一处。维护单例 api，外部组件可调用 shake() */
export function ShakeController() {
  const { camera } = useThree();
  const origin = useRef(camera.position.clone());
  const until = useRef(0);
  const strength = useRef(0);

  useEffect(() => {
    origin.current = camera.position.clone();
    api = {
      shake: (s: number, durMs: number) => {
        strength.current = Math.max(strength.current, s);
        until.current = Math.max(until.current, performance.now() + durMs);
      },
    };
    return () => {
      api = null;
    };
  }, [camera]);

  useFrame(() => {
    const now = performance.now();
    if (now < until.current) {
      const remaining = (until.current - now) / 1000;
      const k = Math.min(remaining * 4, 1) * strength.current;
      camera.position.x = origin.current.x + (Math.random() - 0.5) * k;
      camera.position.y = origin.current.y + (Math.random() - 0.5) * k;
    } else if (camera.position.x !== origin.current.x || camera.position.y !== origin.current.y) {
      camera.position.x += (origin.current.x - camera.position.x) * 0.3;
      camera.position.y += (origin.current.y - camera.position.y) * 0.3;
      if (Math.abs(camera.position.x - origin.current.x) < 0.001) {
        camera.position.x = origin.current.x;
        camera.position.y = origin.current.y;
      }
    }
  });

  return null;
}

export { THREE as _THREE };
