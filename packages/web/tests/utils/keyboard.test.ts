import { describe, test, expect, afterEach } from 'vitest';
import { isMacOS, getShortcutHint, isSubmitShortcut } from '../../src/utils/keyboard';

describe('keyboard utilities', () => {
  const originalPlatform = navigator.platform;

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });

  describe('isMacOS', () => {
    test('detects macOS', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    test('detects iPhone', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'iPhone',
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    test('detects iPad', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'iPad',
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(true);
    });

    test('detects non-macOS (Windows)', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(false);
    });

    test('detects non-macOS (Linux)', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
        configurable: true,
      });
      expect(isMacOS()).toBe(false);
    });
  });

  describe('getShortcutHint', () => {
    test('returns ⌘+Enter for macOS', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true,
      });
      expect(getShortcutHint()).toBe('⌘+Enter');
    });

    test('returns Ctrl+Enter for Windows', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
        configurable: true,
      });
      expect(getShortcutHint()).toBe('Ctrl+Enter');
    });

    test('returns Ctrl+Enter for Linux', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
        configurable: true,
      });
      expect(getShortcutHint()).toBe('Ctrl+Enter');
    });
  });

  describe('isSubmitShortcut', () => {
    test('detects Cmd+Enter (metaKey)', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        key: 'Enter',
      } as React.KeyboardEvent;
      expect(isSubmitShortcut(event)).toBe(true);
    });

    test('detects Ctrl+Enter (ctrlKey)', () => {
      const event = {
        metaKey: false,
        ctrlKey: true,
        key: 'Enter',
      } as React.KeyboardEvent;
      expect(isSubmitShortcut(event)).toBe(true);
    });

    test('detects Cmd+Ctrl+Enter (both)', () => {
      const event = {
        metaKey: true,
        ctrlKey: true,
        key: 'Enter',
      } as React.KeyboardEvent;
      expect(isSubmitShortcut(event)).toBe(true);
    });

    test('ignores plain Enter', () => {
      const event = {
        metaKey: false,
        ctrlKey: false,
        key: 'Enter',
      } as React.KeyboardEvent;
      expect(isSubmitShortcut(event)).toBe(false);
    });

    test('ignores Cmd without Enter', () => {
      const event = {
        metaKey: true,
        ctrlKey: false,
        key: 'a',
      } as React.KeyboardEvent;
      expect(isSubmitShortcut(event)).toBe(false);
    });

    test('ignores Ctrl without Enter', () => {
      const event = {
        metaKey: false,
        ctrlKey: true,
        key: 's',
      } as React.KeyboardEvent;
      expect(isSubmitShortcut(event)).toBe(false);
    });
  });
});
