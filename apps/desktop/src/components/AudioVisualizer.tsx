import React from 'react';

interface AudioVisualizerProps {
  level: number; // 0 to 100
  isListening: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ level, isListening }) => {
  const barsCount = 28;

  return (
    <div className="flex items-center justify-center gap-1 h-12 px-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
      {Array.from({ length: barsCount }).map((_, i) => {
        // Curve formula for symmetrical visualizer animation
        const centerOffset = Math.abs(i - barsCount / 2) / (barsCount / 2);
        const barWeight = Math.max(0.2, 1 - centerOffset * 0.7);
        const dynamicHeight = isListening ? Math.max(8, Math.min(100, level * barWeight * 1.5)) : 8;

        const isHot = level > 65;

        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              isListening
                ? isHot
                  ? 'bg-gradient-to-t from-indigo-500 via-purple-500 to-rose-400'
                  : 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                : 'bg-slate-700/50'
            }`}
            style={{
              height: `${dynamicHeight}%`,
              opacity: isListening ? 0.35 + (level / 100) * 0.65 : 0.25,
            }}
          />
        );
      })}
    </div>
  );
};
