"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastProps {
    message: string;
    type?: ToastType;
    isVisible: boolean;
    onClose: () => void;
}

export default function Toast({ message, type = 'info', isVisible, onClose }: ToastProps) {
    useEffect(() => {
        if (isVisible && type !== 'loading') {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose, type]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 shadow-2xl rounded-xl"
                >
                    {type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    {type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                    {type === 'loading' && (
                        <div className="h-5 w-5 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                    )}

                    <p className={`text-sm font-medium ${type === 'loading' ? 'text-slate-600' : 'text-slate-800'}`}>
                        {message}
                    </p>

                    {type !== 'loading' && (
                        <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
