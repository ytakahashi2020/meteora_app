'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Toast, ToastProps } from './Toast';

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
  showSuccess: (title: string, message: string, txHash?: string) => void;
  showError: (title: string, message: string) => void;
  showInfo: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Date.now().toString();
    const newToast: ToastProps = {
      ...toast,
      id,
      onClose: removeToast,
    };
    setToasts(prev => [...prev, newToast]);
  };

  const showSuccess = (title: string, message: string, txHash?: string) => {
    showToast({
      type: 'success',
      title,
      message,
      txHash,
      duration: txHash ? 8000 : 5000, // Longer duration for transactions
    });
  };

  const showError = (title: string, message: string) => {
    showToast({
      type: 'error',
      title,
      message,
      duration: 6000,
    });
  };

  const showInfo = (title: string, message: string) => {
    showToast({
      type: 'info',
      title,
      message,
    });
  };

  const showWarning = (title: string, message: string) => {
    showToast({
      type: 'warning',
      title,
      message,
    });
  };

  const value: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast, index) => (
          <div 
            key={toast.id} 
            className="pointer-events-auto"
            style={{ 
              transform: `translateY(${index * 100}px)`,
              transition: 'transform 0.3s ease'
            }}
          >
            <Toast {...toast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};