import { useState, type MouseEvent, type ReactNode } from 'react';

interface ActionMenuItem {
  label: ReactNode;
  onSelect: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  disabled?: boolean;
  wrapperClassName?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

/** Owns the shared ellipsis trigger, backdrop, positioning, and close lifecycle. */
export function ActionMenu({
  items,
  disabled = false,
  wrapperClassName = 'relative',
  buttonClassName = 'p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded',
  menuClassName = 'absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-20',
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const stopNavigation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        onClick={(event) => {
          stopNavigation(event);
          setIsOpen((open) => !open);
        }}
        className={buttonClassName}
        aria-label="More options"
        disabled={disabled}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        </svg>
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={(event) => {
              stopNavigation(event);
              setIsOpen(false);
            }}
          />
          <div className={menuClassName}>
            {items.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={(event) => {
                  stopNavigation(event);
                  setIsOpen(false);
                  void item.onSelect();
                }}
                disabled={item.disabled}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50 ${
                  item.destructive ? 'text-red-600' : 'text-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface InlineDeleteConfirmationProps {
  message: string;
  deleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function InlineDeleteConfirmation({
  message,
  deleting = false,
  onConfirm,
  onCancel,
}: InlineDeleteConfirmationProps) {
  return (
    <div className="mt-2 pl-6 flex items-center gap-2 text-sm">
      <span className="text-gray-700">{message}</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={deleting}
        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {deleting ? 'Deleting...' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={deleting}
        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
