// 顶部槽位行 + 坐标导出（LetterBlock 飞行需要）
import type { SlotState, Block } from './types';
import { Slot } from './Slot';

const SPACING = 0.95;
export const SLOT_ROW_Y = 2.3;
export const SLOT_ROW_Z = 0;

interface Props {
  slots: SlotState[];
  blocks: Block[];
}

export function slotWorldPos(index: number, total: number): { x: number; y: number; z: number } {
  const startX = -((total - 1) * SPACING) / 2;
  return {
    x: startX + index * SPACING,
    y: SLOT_ROW_Y,
    z: SLOT_ROW_Z,
  };
}

export function SlotRow({ slots, blocks }: Props) {
  return (
    <>
      {slots.map((s, i) => {
        const p = slotWorldPos(i, slots.length);
        const block = blocks.find((b) => b.id === s.filledBlockId);
        return (
          <Slot
            key={i}
            slot={s}
            position={[p.x, p.y, p.z]}
            filledLetter={block?.letter}
          />
        );
      })}
    </>
  );
}
