// 檔案位置：src/components/table/TurnTimerCircle.jsx
import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../../services/sound';

export function TurnTimerCircle({ turnStartTime, duration = 15, isLocal = false }) {
  const [remaining, setRemaining] = useState(duration);
  const prevTickRef = useRef(null);

  useEffect(() => {
    const startTime = turnStartTime || Date.now();
    const update = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rem = Math.max(0, duration - elapsed);
      setRemaining(rem);

      if (isLocal && rem > 0 && rem <= 3) {
        const sec = Math.ceil(rem);
        if (prevTickRef.current !== sec) {
          prevTickRef.current = sec;
          soundManager.playTick();
        }
      }
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [turnStartTime, duration, isLocal]);

  const progress = Math.min(1, Math.max(0, remaining / duration));
  const r = 13;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  const isLow = remaining <= 5;
  const isCritical = remaining <= 2;
  const strokeColor = isCritical ? '#ef4444' : (isLow ? '#f59e0b' : '#10b981');

  return (
    <div
      className={`relative flex items-center justify-center transition-all select-none ${
        isCritical ? 'animate-pulse scale-105' : ''
      }`}
      title={`思考限時 ${duration} 秒（剩餘 ${Math.ceil(remaining)} 秒）`}
    >
      <svg className="w-8 h-8 sm:w-8.5 sm:h-8.5 -rotate-90 drop-shadow-md" viewBox="0 0 34 34">
        <circle
          cx="17"
          cy="17"
          r={r}
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="3.2"
          fill="rgba(10, 28, 18, 0.85)"
        />
        <circle
          cx="17"
          cy="17"
          r={r}
          stroke={strokeColor}
          strokeWidth="3.2"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 250ms ease' }}
        />
      </svg>
      <span
        className={`absolute text-[11px] font-black tracking-tighter ${
          isCritical ? 'text-red-400 font-extrabold' : (isLow ? 'text-amber-300' : 'text-emerald-300')
        }`}
      >
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}
