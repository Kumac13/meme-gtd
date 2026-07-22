import { useEffect, type RefObject } from 'react';

/** Owns the document listener used to dismiss popovers and inline editors. */
export function useOutsideClick<T extends HTMLElement>(ref: RefObject<T | null>, active: boolean, onOutside: () => void) {
  useEffect(() => {
    if (!active) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [active, onOutside, ref]);
}
