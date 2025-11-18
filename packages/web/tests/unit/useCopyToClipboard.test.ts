import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '../../src/hooks/useCopyToClipboard';

describe('useCopyToClipboard', () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
    mockWriteText.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with copied as false', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);
  });

  it('should copy text successfully', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.copy('Test markdown');
    });

    expect(success).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith('Test markdown');
    expect(result.current.copied).toBe(true);
  });

  it('should reset copied state after 1 second', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('Test');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(false);
  });

  it('should return false and log error when clipboard API fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockWriteText.mockRejectedValue(new Error('Clipboard access denied'));
    const { result } = renderHook(() => useCopyToClipboard());

    let success: boolean = true;
    await act(async () => {
      success = await result.current.copy('Test');
    });

    expect(success).toBe(false);
    expect(result.current.copied).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to copy to clipboard:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should reset copied state manually', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('Test');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.copied).toBe(false);
  });

  it('should copy empty string without error', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.copy('');
    });

    expect(success).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith('');
  });
});
