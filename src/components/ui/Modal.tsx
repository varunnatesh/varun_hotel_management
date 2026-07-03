import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  open:         boolean;
  onClose:      () => void;
  title?:       string;
  subtitle?:    string;
  children:     React.ReactNode;
  size?:        ModalSize;
  footer?:      React.ReactNode;
  closeOnOverlay?: boolean;
  icon?:        React.ReactNode;
  iconBg?:      string;
  className?:   string;
}

const sizeStyles: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-4xl',
};

const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden:  { opacity: 0, scale: 0.94, y: 16 },
  visible: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.96, y: 8  },
};

export const Modal: React.FC<ModalProps> = ({
  open, onClose, title, subtitle, children, size = 'md', footer,
  closeOnOverlay = true, icon, iconBg, className,
}) => {
  // Lock scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="absolute inset-0 modal-overlay"
            onClick={closeOnOverlay ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'relative w-full z-10 rounded-2xl',
              'bg-white dark:bg-surface-800',
              'border border-surface-200 dark:border-surface-700',
              'shadow-card-hover',
              sizeStyles[size],
              className,
            )}
          >
            {/* Header */}
            {(title || icon) && (
              <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-surface-200 dark:border-surface-700">
                {icon && (
                  <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0',
                    iconBg ?? 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
                  )}>
                    {icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {title && <h2 className="text-base font-semibold text-surface-900 dark:text-surface-100">{title}</h2>}
                  {subtitle && <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {!title && !icon && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors z-10"
              >
                <X size={16} />
              </button>
            )}

            {/* Body */}
            <div className="px-5 py-4 overflow-y-auto max-h-[60vh]">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-200 dark:border-surface-700">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

// ─── Confirmation Dialog ───────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open:       boolean;
  onClose:    () => void;
  onConfirm:  () => void;
  title:      string;
  message:    string;
  confirmLabel?: string;
  cancelLabel?:  string;
  danger?:    boolean;
  loading?:   boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, loading = false,
}) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-surface-600 dark:text-surface-400">{message}</p>
    <div className="flex gap-2 justify-end mt-4">
      <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button
        variant={danger ? 'danger' : 'primary'}
        size="sm"
        onClick={onConfirm}
        loading={loading}
      >
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);

export default Modal;
