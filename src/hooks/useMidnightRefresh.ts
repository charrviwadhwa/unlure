import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const msUntilNextDay = () => {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setDate(now.getDate() + 1);
  nextDay.setHours(0, 0, 1, 0);
  return Math.max(nextDay.getTime() - now.getTime(), 1000);
};

export const useMidnightRefresh = (onDayChange: () => void) => {
  const onDayChangeRef = useRef(onDayChange);
  const dateKeyRef = useRef(formatDateKey(new Date()));

  useEffect(() => {
    onDayChangeRef.current = onDayChange;
  }, [onDayChange]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const refreshIfDayChanged = () => {
      const nextKey = formatDateKey(new Date());
      if (nextKey !== dateKeyRef.current) {
        dateKeyRef.current = nextKey;
        onDayChangeRef.current();
      }
    };

    const schedule = () => {
      timeout = setTimeout(() => {
        refreshIfDayChanged();
        schedule();
      }, msUntilNextDay());
    };

    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfDayChanged();
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, []);
};
