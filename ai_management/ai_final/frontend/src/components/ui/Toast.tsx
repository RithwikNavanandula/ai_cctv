import { createContext, useContext, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
    toast: (props: { title: string; description?: string; variant?: ToastType }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [message, setMessage] = useState<string | null>(null);

    const toast = ({ title, variant = 'info' }: { title: string; variant?: ToastType }) => {
        setMessage(`${variant.toUpperCase()}: ${title}`);
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            {message && (
                <div style={{
                    position: 'fixed', bottom: 20, right: 20,
                    background: '#333', color: '#fff', padding: '12px 24px',
                    borderRadius: '8px', zIndex: 9999
                }}>
                    {message}
                </div>
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) return { toast: () => console.warn("No ToastProvider") };
    return context;
}
