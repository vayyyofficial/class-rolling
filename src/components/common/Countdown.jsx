import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getTimeUntilNextReroll } from '../../utils/scheduler';
import { formatWIBDateTime } from '../../utils/timezone';

export default function Countdown({ compact = false }) {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilNextReroll());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilNextReroll());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 font-mono text-xs sm:text-sm font-semibold">
        <Clock className="w-4 h-4 text-brand-600 animate-pulse" />
        <span>
          {timeLeft.days}h {String(timeLeft.hours).padStart(2, '0')}j {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}d
        </span>
      </div>
    );
  }

  const units = [
    { label: 'HARI', value: timeLeft.days },
    { label: 'JAM', value: timeLeft.hours },
    { label: 'MENIT', value: timeLeft.minutes },
    { label: 'DETIK', value: timeLeft.seconds },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full max-w-sm">
        {units.map((unit, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center p-2.5 sm:p-3 bg-white rounded-xl border border-divider shadow-subtle text-center"
          >
            <span className="font-mono text-xl sm:text-2xl font-bold text-content-primary">
              {String(unit.value).padStart(2, '0')}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-content-secondary mt-0.5">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-content-secondary mt-2.5 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Target: {formatWIBDateTime(timeLeft.targetDate)}
      </p>
    </div>
  );
}

