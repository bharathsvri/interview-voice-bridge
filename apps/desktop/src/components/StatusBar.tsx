import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';

export const StatusBar: React.FC = () => {
  const { activeSession, isListening } = useAppStore();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isListening) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isListening]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
  };

  return (
    <footer className="h-9 border-t border-slate-800 bg-slate-950 px-6 flex items-center justify-between text-xs text-slate-500">
      <div className="flex items-center gap-4">
        <span>
          Session: <strong className="text-slate-400">{activeSession ? activeSession.id.substring(0, 8) : 'None'}</strong>
        </span>
        {isListening && (
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Duration: {formatTime(elapsedSeconds)}
          </span>
        )}
      </div>

      <div>
        <span>Encoding: 16kHz PCM (Linear-16) · Model: Deepgram Nova-3</span>
      </div>
    </footer>
  );
};
