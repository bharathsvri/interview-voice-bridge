import React from 'react';
import { Copy, Trash2, Send, Check } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

export const TranscriptionPanel: React.FC = () => {
  const {
    interimTranscript,
    finalSegments,
    clearTranscripts,
    forwardToAndroid,
    setForwardToAndroid,
    isListening,
  } = useAppStore();

  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = finalSegments.map((s) => s.text).join(' ');
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 flex flex-col h-[420px]">
      {/* Header Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">Transcription Stream</h2>
          {isListening && (
            <span className="flex items-center gap-1.5 text-xs text-rose-400 font-medium px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              Live Capturing
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Forwarding to Android Toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forwardToAndroid}
              onChange={(e) => setForwardToAndroid(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="flex items-center gap-1">
              <Send className="w-3 h-3 text-indigo-400" />
              Forward to Android
            </span>
          </label>

          <button
            onClick={handleCopy}
            disabled={finalSegments.length === 0}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg transition-colors disabled:opacity-30"
            title="Copy full transcript"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={clearTranscripts}
            disabled={finalSegments.length === 0 && !interimTranscript}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition-colors disabled:opacity-30"
            title="Clear transcripts"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transcript Scrolling Body */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
        {finalSegments.length === 0 && !interimTranscript ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
            <p>Ready to transcribe.</p>
            <p className="text-xs text-slate-600 mt-1">
              Click &quot;Start Listening&quot; to begin streaming audio to Deepgram Nova-3.
            </p>
          </div>
        ) : (
          <>
            {finalSegments.map((segment) => {
              const timeStr = new Date(segment.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={segment.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Segment #{segment.sequenceNumber}</span>
                    <span>{timeStr}</span>
                  </div>
                  <p className="leading-relaxed">{segment.text}</p>
                </div>
              );
            })}

            {/* Interim live text */}
            {interimTranscript && (
              <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3 text-sm text-indigo-200/90 italic animate-pulse">
                <span className="text-xs text-indigo-400 not-italic uppercase tracking-wider block mb-1">
                  Interim
                </span>
                <p>{interimTranscript}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
