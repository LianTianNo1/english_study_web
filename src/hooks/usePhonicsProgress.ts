import { useState, useCallback } from 'react';

const STORAGE_KEY = 'phonics_progress_v1';

export interface PhonicsProgress {
  counts: Record<string, number>;
  mastered: Record<string, boolean>;
}

function loadProgress(): PhonicsProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PhonicsProgress;
  } catch {
    // ignore parse errors
  }
  return { counts: {}, mastered: {} };
}

function saveProgress(p: PhonicsProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

export function usePhonicsProgress() {
  const [progress, setProgress] = useState<PhonicsProgress>(loadProgress);

  const markPracticed = useCallback((id: string) => {
    setProgress((prev) => {
      const next: PhonicsProgress = {
        counts: { ...prev.counts, [id]: (prev.counts[id] ?? 0) + 1 },
        mastered: { ...prev.mastered },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const toggleMastered = useCallback((id: string) => {
    setProgress((prev) => {
      const next: PhonicsProgress = {
        counts: { ...prev.counts },
        mastered: { ...prev.mastered, [id]: !prev.mastered[id] },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const isMastered = useCallback(
    (id: string) => !!progress.mastered[id],
    [progress],
  );

  const masteredCount = Object.values(progress.mastered).filter(Boolean).length;

  return { progress, markPracticed, toggleMastered, isMastered, masteredCount };
}
