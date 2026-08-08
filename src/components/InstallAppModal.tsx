import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Apple, Share, PlusSquare, Download, CheckCircle2, X, Globe, Sparkles, ArrowDown } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalled?: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose, onInstalled }) => {
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('android');
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>('ios');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect OS
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setDeviceType('ios');
      setActiveTab('ios');
    } else if (/android/i.test(userAgent)) {
      setDeviceType('android');
      setActiveTab('android');
    } else {
      setDeviceType('desktop');
      setActiveTab('ios');
    }

    // Check if running as standalone (already installed)
    const standaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (navigator as any).standalone === true ||
      localStorage.getItem('barobi_pwa_installed') === 'true';

    if (standaloneMode) {
      setIsInstalled(true);
      if (onInstalled) onInstalled();
    }

    // Listen for Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem('barobi_pwa_installed', 'true');
      if (onInstalled) onInstalled();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstalled]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('barobi_pwa_installed', 'true');
        if (onInstalled) onInstalled();
      }
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white my-auto z-10"
        >
          {/* Header Gradient */}
          <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-indigo-600 p-5 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shrink-0">
                <Smartphone className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold tracking-tight">App Download Guide</h3>
                  <span className="text-[10px] uppercase font-bold bg-white/20 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                    iPhone & Android
                  </span>
                </div>
                <p className="text-xs text-teal-100 mt-0.5">
                  BAROBI অ্যাপটি আইফোন এবং অ্যান্ড্রয়েড ফোনে ইনস্টল করার নিয়মাবলী
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Status Alert if already installed */}
            {isInstalled && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 text-emerald-300 text-xs">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span>BAROBI অ্যাপটি ইতোমধ্যে আপনার ফোনে ইনস্টল করা রয়েছে!</span>
              </div>
            )}

            {/* Quick Install Button for Android */}
            {deferredPrompt && (
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                    <span>এক ক্লিকে ইনস্টল করুন (Android)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Fast Download</span>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98]"
                >
                  <Download className="w-5 h-5" />
                  Install BAROBI App Now
                </button>
              </div>
            )}

            {/* OS Selector Tabs */}
            <div className="flex bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/80">
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'ios'
                    ? 'bg-slate-700 text-white shadow-md border border-slate-600'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Apple className="w-4 h-4 text-white" />
                <span>iPhone / iPad (iOS)</span>
                {deviceType === 'ios' && (
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'android'
                    ? 'bg-slate-700 text-white shadow-md border border-slate-600'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Android Phone</span>
                {deviceType === 'android' && (
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* iOS (iPhone) Instructions */}
            {activeTab === 'ios' && (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-amber-200 text-xs flex items-start gap-2.5">
                  <Apple className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold">আইফোনের নিয়ম:</span> আইফোনে Safari ব্রাউজার ব্যবহার করে খুব সহজেই অ্যাপটি হোম স্ক্রিনে ইনস্টল করা যায়।
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                    <span className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      1
                    </span>
                    <div className="space-y-1 text-xs text-slate-200">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-teal-400" />
                        Safari ব্রাউজারে ওয়েবসাইট ওপেন করুন
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        আপনার আইফোনে <span className="text-teal-300 font-semibold">Safari</span> ব্রাউজারে এই লিংকটি চালু করুন।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                    <span className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      2
                    </span>
                    <div className="space-y-1 text-xs text-slate-200">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <Share className="w-3.5 h-3.5 text-teal-400" />
                        শেয়ার (Share) আইকনে ক্লিক করুন
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Safari ব্রাউজারের নিচে স্ক্রিনে থাকা <span className="bg-slate-700 px-1.5 py-0.5 rounded text-white font-mono">Share 📤</span> বাটনটি চাপুন।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                    <span className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      3
                    </span>
                    <div className="space-y-1 text-xs text-slate-200">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <PlusSquare className="w-3.5 h-3.5 text-teal-400" />
                        'Add to Home Screen' সিলেক্ট করুন
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        অপশনগুলোর মধ্যে নিচে স্ক্রল করে <span className="text-emerald-300 font-semibold">"Add to Home Screen" (হোম স্ক্রীনে যোগ করুন)</span> অপশনে চাপুন।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                    <span className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      4
                    </span>
                    <div className="space-y-1 text-xs text-slate-200">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        'Add' চাপুন - অ্যাপটি তৈরি হয়ে যাবে
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        উপরে ডান পাশে <span className="text-teal-300 font-semibold">"Add"</span> বাটনে চাপুন। অ্যাপের আইকন আপনার আইফোনের মেইন স্ক্রিনে চলে আসবে!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Android Instructions */}
            {activeTab === 'android' && (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 text-emerald-200 text-xs flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-bold">অ্যান্ড্রয়েড ফোনে ডাউনলোড:</span> Chrome ব্রাউজার থেকে সরাসরি অ্যাপ হিসেবে ডাউনলোড করে রাখা যায়।
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      1
                    </span>
                    <div className="space-y-1 text-xs text-slate-200">
                      <p className="font-bold text-white">Google Chrome এ লিংকটি ওপেন করুন</p>
                      <p className="text-slate-400 text-[11px]">
                        আপনার ফোনের Chrome ব্রাউজারে ওয়েবসাইটটি চালু করুন।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      2
                    </span>
                    <div className="space-y-1 text-xs text-slate-200">
                      <p className="font-bold text-white">উপরে ৩টি ডট (⋮) অপশনে চাপ দিন</p>
                      <p className="text-slate-400 text-[11px]">
                        Chrome এর উপরে ডানপাশে ৩টি ডট মোনুতে চাপ দিন।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xs shrink-0">
                      3
                    </span>
                    <div className="space-y-1 text-xs text-slate-200">
                      <p className="font-bold text-white">'Install app' অথবা 'Add to Home Screen' চাপুন</p>
                      <p className="text-slate-400 text-[11px]">
                        মেনু থেকে <span className="text-emerald-300 font-semibold">"Install app"</span> চাপলেই অ্যাপটি আপনার ফোনে ইনস্টল হয়ে যাবে!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">BAROBI Web App Engine</span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
            >
              বুঝেছি (Close)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
