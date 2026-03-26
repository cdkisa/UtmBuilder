import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in
            ${t.type === 'success' ? 'bg-brand-600 text-white' : ''}
            ${t.type === 'error' ? 'bg-red-600 text-white' : ''}
            ${t.type === 'info' ? 'bg-gray-800 text-white' : ''}
          `}>
            {t.msg}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
