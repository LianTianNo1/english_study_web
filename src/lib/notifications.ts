/**
 * 纯前端的本地通知 —— 走 Web Notification API。
 * 仅在用户打开过应用（页面 / PWA standalone 后台）时检查；纯后台推送需服务端 Push，目前用不上。
 */
import { progressRepo } from '@/db/repositories/progress';
import { db } from '@/db/schema';

const LAST_NOTIFIED_KEY = 'lastNotifiedAt';
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 同一条至少间隔 6h
const IDLE_THRESHOLD_MS = 22 * 60 * 60 * 1000; // 超过 22h 没活动算"很久没学"
const DUE_THRESHOLD = 30;                        // 复习池 ≥ 30 词触发"快炸了"

export function hasNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!hasNotificationSupport()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!hasNotificationSupport()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface NotifyPayload {
  title: string;
  body: string;
  tag: string;
}

async function fire(p: NotifyPayload) {
  if (!hasNotificationSupport() || Notification.permission !== 'granted') return;
  try {
    new Notification(p.title, {
      body: p.body,
      icon: '/icon.svg',
      badge: '/favicon.svg',
      tag: p.tag,
      lang: 'zh-CN',
    });
    localStorage.setItem(LAST_NOTIFIED_KEY, String(Date.now()));
  } catch (e) {
    console.warn('[notify] fire failed:', e);
  }
}

/** 由应用启动时调用一次：根据数据状态决定是否需要提醒用户 */
export async function checkAndNotify(): Promise<void> {
  if (getNotificationPermission() !== 'granted') return;
  const last = Number(localStorage.getItem(LAST_NOTIFIED_KEY) || 0);
  if (Date.now() - last < MIN_INTERVAL_MS) return; // 频控

  // 1) 检查"很久没学"
  const lastSession = await db.sessions.orderBy('id').reverse().limit(1).first();
  const lastTime = lastSession ? new Date(lastSession.date + 'T00:00:00').getTime() : 0;
  if (lastTime > 0 && Date.now() - lastTime > IDLE_THRESHOLD_MS) {
    await fire({
      title: '今天还没打卡 ⏰',
      body: '抽 5 分钟过几个新词或复习一组吧，保持节奏才不会前功尽弃。',
      tag: 'idle-reminder',
    });
    return;
  }

  // 2) 检查"复习池快炸了"
  const due = await progressRepo.dueForReview(Date.now(), 9999);
  if (due.length >= DUE_THRESHOLD) {
    await fire({
      title: `${due.length} 个词等你复习 📚`,
      body: '复习池已经堆得有点多，集中清一下负担会小很多。',
      tag: 'due-reminder',
    });
    return;
  }
}

/** 启用本地后台轮询（仅 PWA standalone 模式下意义大） */
let intervalId: number | null = null;
export function startNotificationLoop() {
  if (intervalId !== null) return;
  // 首次延迟 30s 触发，给数据加载留出时间
  setTimeout(() => { checkAndNotify(); }, 30 * 1000);
  // 之后每 1h 检查一次
  intervalId = window.setInterval(() => { checkAndNotify(); }, 60 * 60 * 1000);
}
export function stopNotificationLoop() {
  if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
}
