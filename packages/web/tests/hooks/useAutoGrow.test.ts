import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useAutoGrow } from '../../src/hooks/useAutoGrow';

// jsdomはレイアウトを行わないため、scrollHeight / clientHeight をモックする
function createTextarea({
  scrollHeight,
  clientHeight,
}: {
  scrollHeight: number;
  clientHeight: number;
}): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  // border加算分を排除して高さの期待値を単純にする
  textarea.style.borderWidth = '0px';
  Object.defineProperty(textarea, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(textarea, 'clientHeight', {
    configurable: true,
    get: () => clientHeight,
  });
  textarea.scrollIntoView = vi.fn();
  document.body.appendChild(textarea);
  return textarea;
}

describe('useAutoGrow', () => {
  let textarea: HTMLTextAreaElement | null = null;

  beforeEach(() => {
    textarea = null;
  });

  afterEach(() => {
    textarea?.remove();
  });

  test('sets height to scrollHeight', () => {
    textarea = createTextarea({ scrollHeight: 300, clientHeight: 300 });
    const ref = createRef<HTMLTextAreaElement>();
    Object.assign(ref, { current: textarea });

    renderHook(() => useAutoGrow(ref, 'hello'));

    expect(textarea.style.height).toBe('300px');
  });

  test('hides internal scrollbar while content fits (not clamped by max-height)', () => {
    textarea = createTextarea({ scrollHeight: 300, clientHeight: 300 });
    const ref = createRef<HTMLTextAreaElement>();
    Object.assign(ref, { current: textarea });

    renderHook(() => useAutoGrow(ref, 'hello'));

    expect(textarea.style.overflowY).toBe('hidden');
  });

  test('enables internal scrolling when clamped by max-height', () => {
    // max-heightにより clientHeight < scrollHeight となった状態
    textarea = createTextarea({ scrollHeight: 800, clientHeight: 500 });
    const ref = createRef<HTMLTextAreaElement>();
    Object.assign(ref, { current: textarea });

    renderHook(() => useAutoGrow(ref, 'long content'));

    expect(textarea.style.overflowY).toBe('auto');
  });

  test('keeps textarea in view when height changes while focused', () => {
    textarea = createTextarea({ scrollHeight: 300, clientHeight: 300 });
    const ref = createRef<HTMLTextAreaElement>();
    Object.assign(ref, { current: textarea });
    textarea.focus();

    renderHook(() => useAutoGrow(ref, 'hello'));

    // 初回計算で height が '' → '300px' に変化しているため追従スクロールされる
    expect(textarea.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  test('does not scroll when textarea is not focused', () => {
    textarea = createTextarea({ scrollHeight: 300, clientHeight: 300 });
    const ref = createRef<HTMLTextAreaElement>();
    Object.assign(ref, { current: textarea });

    renderHook(() => useAutoGrow(ref, 'hello'));

    expect(textarea.scrollIntoView).not.toHaveBeenCalled();
  });

  test('does not scroll when height is unchanged', () => {
    textarea = createTextarea({ scrollHeight: 300, clientHeight: 300 });
    textarea.style.height = '300px';
    const ref = createRef<HTMLTextAreaElement>();
    Object.assign(ref, { current: textarea });
    textarea.focus();

    renderHook(() => useAutoGrow(ref, 'hello'));

    expect(textarea.scrollIntoView).not.toHaveBeenCalled();
  });

  test('recalculates when value changes', () => {
    let scrollHeight = 300;
    textarea = document.createElement('textarea');
    textarea.style.borderWidth = '0px';
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(textarea, 'clientHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    textarea.scrollIntoView = vi.fn();
    document.body.appendChild(textarea);
    const ref = createRef<HTMLTextAreaElement>();
    Object.assign(ref, { current: textarea });

    const { rerender } = renderHook(({ value }) => useAutoGrow(ref, value), {
      initialProps: { value: 'short' },
    });
    expect(textarea.style.height).toBe('300px');

    scrollHeight = 450;
    rerender({ value: 'short\nplus more lines' });
    expect(textarea.style.height).toBe('450px');
  });
});
