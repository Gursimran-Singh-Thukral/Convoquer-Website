'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface DialogState {
  message: string;
  kind: 'confirm' | 'prompt';
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | boolean | null) => void;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (
    message: string,
    opts?: { confirmLabel?: string; cancelLabel?: string },
  ) => Promise<boolean>;
  promptText: (message: string, defaultValue?: string) => Promise<string | null>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const timeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, kind, message }]);
    timeouts.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timeouts.current[id];
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeouts.current[id]) {
      clearTimeout(timeouts.current[id]);
      delete timeouts.current[id];
    }
  }, []);

  const confirm = useCallback(
    (message: string, opts?: { confirmLabel?: string; cancelLabel?: string }) => {
      return new Promise<boolean>((resolve) => {
        setDialog({
          message,
          kind: 'confirm',
          confirmLabel: opts?.confirmLabel,
          cancelLabel: opts?.cancelLabel,
          resolve: (value) => resolve(Boolean(value)),
        });
      });
    },
    [],
  );

  const promptText = useCallback((message: string, defaultValue = '') => {
    setPromptValue(defaultValue);
    return new Promise<string | null>((resolve) => {
      setDialog({
        message,
        kind: 'prompt',
        defaultValue,
        resolve: (value) => resolve(typeof value === 'string' ? value : null),
      });
    });
  }, []);

  const closeDialog = (result: string | boolean | null) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ToastContext.Provider value={{ toast, confirm, promptText }}>
      {children}

      {/* Toast stack */}
      <div
        className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[min(92vw,360px)]"
        data-purpose="toast-stack"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => dismissToast(t.id)}
            className={`px-4 py-3 rounded-xl border shadow-2xl text-xs font-display font-semibold tracking-wide cursor-pointer backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              t.kind === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : t.kind === 'error'
                  ? 'bg-[#3a0d16]/90 border-[#D4AF37]/40 text-[#f5c6cf]'
                  : 'bg-[#16141a]/95 border-white/15 text-gray-200'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm / Prompt dialog */}
      {dialog && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-[#16141a] border border-[#2f2b34] rounded-2xl shadow-2xl p-5 space-y-4">
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">
              {dialog.message}
            </p>
            {dialog.kind === 'prompt' && (
              <input
                autoFocus
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0c0a0d] border border-white/15 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50"
              />
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => closeDialog(dialog.kind === 'prompt' ? null : false)}
                className="px-3.5 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
              >
                {dialog.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus={dialog.kind === 'confirm'}
                onClick={() => closeDialog(dialog.kind === 'prompt' ? promptValue : true)}
                className="px-3.5 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider text-white bg-[#701A2B] hover:bg-[#882236] border border-[#D4AF37]/40 transition-colors"
              >
                {dialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
