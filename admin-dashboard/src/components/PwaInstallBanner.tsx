import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Battery, X, Check, ArrowRight } from 'lucide-react';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
        setShowBatteryGuide(true);
      }
      setDeferredPrompt(null);
    }
  };

  if (dismissed) return null;

  return (
    <>
      {/* 1. Install Banner */}
      {!isStandalone && deferredPrompt && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-4 py-3 shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-medium border-b border-blue-600/30">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl shrink-0">
              <Smartphone className="w-5 h-5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm">Install Smart Admin App</p>
              <p className="text-xs text-blue-100/90 truncate">One-tap app installation for background alerts & quick access</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-white text-blue-700 rounded-xl text-xs font-extrabold hover:bg-blue-50 transition-all flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Battery Guide Banner */}
      {isStandalone && !dismissed && (
        <div className="bg-slate-900 text-slate-100 px-4 py-2.5 shadow-sm flex items-center justify-between gap-3 text-xs sm:text-sm border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
              <Battery className="w-4 h-4" />
            </div>
            <p className="truncate text-slate-300 text-xs sm:text-sm">
              <span className="font-semibold text-white font-medium">Ensure Background Alerts:</span> Set battery optimization to Unrestricted.
            </p>
          </div>

          <button
            onClick={() => setShowBatteryGuide(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all shrink-0 flex items-center gap-1 shadow-sm"
          >
            <span>Setup Battery</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Battery Guide Modal */}
      {showBatteryGuide && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                  <Battery className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Background Alerts Setup</h3>
                  <p className="text-xs text-slate-500">2 quick steps for reliable notifications</p>
                </div>
              </div>
              <button
                onClick={() => setShowBatteryGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700">
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">1</span>
                <div>
                  <p className="font-bold text-blue-900">App Info</p>
                  <p className="text-xs text-blue-700 mt-0.5">Long-press the <strong>Smart Admin</strong> app icon on home screen $\rightarrow$ tap <strong>App Info ( ⓘ )</strong>.</p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-100 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shrink-0">2</span>
                <div>
                  <p className="font-bold text-amber-900">Set Battery to Unrestricted</p>
                  <p className="text-xs text-amber-700 mt-0.5">Tap <strong>Battery</strong> $\rightarrow$ select <strong>Unrestricted</strong> (or Allow Background Activity).</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowBatteryGuide(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Got It, Done!</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
