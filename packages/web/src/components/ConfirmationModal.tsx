import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/** 共通の確認モーダル。フォーカスと背景の操作制限はnative dialogが所有する。 */
export default function ConfirmationModal({
  isOpen, title, children, confirmLabel = 'Confirm', pendingLabel = 'Processing...', onConfirm, onClose,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    setError(null);
    dialog.showModal();
    // Enterの連打で確定しないよう、初期フォーカスはCancelに置く。
    cancelRef.current?.focus();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [isOpen]);

  const close = () => {
    if (!submitting.current) onClose();
  };
  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The operation failed. Please try again.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  if (!isOpen) return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
        <div id={descriptionId} className="mt-3 text-sm text-gray-600">{children}</div>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} type="button" disabled={pending} onClick={close}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" disabled={pending} onClick={confirm}
            className="rounded-md bg-github-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-github-green-700 disabled:opacity-50">
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
