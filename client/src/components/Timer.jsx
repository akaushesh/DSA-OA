import { useState, useEffect, useRef } from 'react';

export default function Timer({ totalSeconds, onExpire, className = '' }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  useEffect(() => {
    if (totalSeconds <= 0) return;
    setRemaining(totalSeconds);
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          cbRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [totalSeconds]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const display = h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const isLow = remaining < 60;

  return (
    <span className={`font-mono font-bold text-lg tabular-nums ${isLow ? 'text-red-400 animate-pulse' : 'text-green-400'} ${className}`}>
      ⏱ {display}
    </span>
  );
}
