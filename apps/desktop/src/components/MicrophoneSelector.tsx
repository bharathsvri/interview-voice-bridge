import React, { useEffect, useState } from 'react';
import { Mic, Volume2, RefreshCw } from 'lucide-react';
import { audioRecorder, AudioDevice } from '../services/audioRecorder';
import { AudioVisualizer } from './AudioVisualizer';
import { useAppStore } from '../stores/useAppStore';

export const MicrophoneSelector: React.FC = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('default');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const { isListening, audioLevel, setAudioLevel } = useAppStore();

  const loadMicrophones = async () => {
    try {
      const mics = await audioRecorder.getAvailableMicrophones();
      setDevices(mics);
    } catch (err) {
      console.error('Error fetching microphones:', err);
    }
  };

  useEffect(() => {
    loadMicrophones();
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = () => loadMicrophones();
    }
  }, []);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const devId = e.target.value;
    setSelectedMic(devId);
    audioRecorder.setMicrophone(devId);
  };

  const toggleTestMic = async () => {
    if (isTesting) {
      audioRecorder.stop();
      setIsTesting(false);
    } else {
      audioRecorder.setCallbacks({
        onLevel: (lvl) => setAudioLevel(lvl),
      });
      const started = await audioRecorder.start();
      if (started) {
        setIsTesting(true);
      }
    }
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-200">Microphone Input</h2>
        </div>
        <button
          onClick={loadMicrophones}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          title="Refresh microphone devices"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex gap-3">
        <select
          value={selectedMic}
          onChange={handleDeviceChange}
          disabled={isListening}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>

        {!isListening && (
          <button
            onClick={toggleTestMic}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              isTesting
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700 border border-slate-600'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            {isTesting ? 'Stop Test' : 'Test Mic'}
          </button>
        )}
      </div>

      {/* Real-time Level Visualizer */}
      <AudioVisualizer level={audioLevel} isListening={isListening || isTesting} />
    </div>
  );
};
