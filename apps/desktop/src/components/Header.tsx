import React from 'react';
import { Mic, Radio, Smartphone, Activity } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

export const Header: React.FC = () => {
  const { backendStatus, deepgramStatus, pairedDevice } = useAppStore();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'ready':
      case 'streaming':
        return 'bg-emerald-500';
      case 'connecting':
        return 'bg-amber-500 animate-pulse';
      default:
        return 'bg-rose-500';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Interview Voice Bridge
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Desktop
            </span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${getStatusColor(backendStatus)}`} />
          <span className="text-slate-300">Backend: {backendStatus}</span>
        </div>

        {/* Deepgram Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${getStatusColor(deepgramStatus)}`} />
          <span className="text-slate-300">Nova-3 STT</span>
        </div>

        {/* Paired Android Device */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-300">
            {pairedDevice ? (pairedDevice.name || 'Android Connected') : 'No Android Paired'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${pairedDevice?.isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}
          />
        </div>
      </div>
    </header>
  );
};
