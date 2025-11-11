import { describe, test, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcut } from '../../src/hooks/useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
  test('calls callback on Cmd+Enter', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useKeyboardShortcut(callback));

    const event = {
      metaKey: true,
      ctrlKey: false,
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    result.current(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test('calls callback on Ctrl+Enter', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useKeyboardShortcut(callback));

    const event = {
      metaKey: false,
      ctrlKey: true,
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    result.current(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test('does not call callback when disabled', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useKeyboardShortcut(callback, { disabled: true })
    );

    const event = {
      metaKey: true,
      ctrlKey: false,
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    result.current(event);

    expect(callback).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test('does not call callback on plain Enter', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useKeyboardShortcut(callback));

    const event = {
      metaKey: false,
      ctrlKey: false,
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    result.current(event);

    expect(callback).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test('does not call callback on other keys', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useKeyboardShortcut(callback));

    const event = {
      metaKey: true,
      ctrlKey: false,
      key: 'a',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    result.current(event);

    expect(callback).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test('respects disabled option changes', () => {
    const callback = vi.fn();
    const { result, rerender } = renderHook(
      ({ disabled }) => useKeyboardShortcut(callback, { disabled }),
      { initialProps: { disabled: false } }
    );

    const event = {
      metaKey: true,
      ctrlKey: false,
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

    // First call with disabled=false
    result.current(event);
    expect(callback).toHaveBeenCalledTimes(1);

    // Change to disabled=true
    rerender({ disabled: true });
    result.current(event);
    expect(callback).toHaveBeenCalledTimes(1); // Should still be 1, not 2
  });
});
