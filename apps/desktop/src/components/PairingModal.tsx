import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Clock, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

export const PairingModal: React.FC = () => {
  const { pairingModal, closePairingModal } = useAppStore();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(pairingModal.expiresInSeconds || 300);

  useEffect(() => {
    if (pairingModal.qrCodeData) {
      QRCode.toDataURL(pairingModal.qrCodeData, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR Code:', err));
    }
  }, [pairingModal.qrCodeData]);

  useEffect(() => {
    if (!pairingModal.isOpen) return;

    setTimeLeft(pairingModal.expiresInSeconds || 300);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pairingModal.isOpen, pairingModal.expiresInSeconds]);

  if (!pairingModal.isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={closePairingModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Pair Android Device</h3>
            <p className="text-xs text-slate-400">Connect securely over the internet</p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 flex flex-col items-center justify-center mb-5">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Pairing QR Code"
              className="w-56 h-56 rounded-xl shadow-inner bg-white p-2"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-slate-500 text-sm">
              Generating QR Code...
            </div>
          )}

          {/* 6-Digit Code */}
          <div className="mt-4 text-center">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Or Enter 6-Digit Code in App
            </span>
            <span className="text-3xl font-mono font-extrabold tracking-widest text-indigo-400 px-4 py-1.5 rounded-lg bg-indigo-950/50 border border-indigo-800/60 inline-block">
              {pairingModal.pairingCode}
            </span>
          </div>
        </div>

        {/* Timer and Security Info */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 mb-5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>
              Expires in:{' '}
              <strong className="text-slate-200">
                {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>One-Time Token</span>
          </div>
        </div>

        <button
          onClick={closePairingModal}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-colors text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
};
