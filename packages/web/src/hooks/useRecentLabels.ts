/**
 * useRecentLabels hook
 * Feature: 020-web-label-management
 * User Story 4: Quick Access to Recently Used Labels
 *
 * Manages recently used labels in localStorage
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'mgtd:recentLabels';
const MAX_STORED_LABELS = 5;
const MAX_DISPLAYED_RECENT = 5;

interface Label {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface RecentLabelsStorage {
  labelIds: number[];
  lastUsedAt: Record<number, string>;
}

/**
 * Parse recent labels from localStorage
 * Returns empty storage on error (Safari private mode, etc.)
 */
function loadRecentLabels(): RecentLabelsStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { labelIds: [], lastUsedAt: {} };
    }
    const parsed = JSON.parse(stored);
    return {
      labelIds: Array.isArray(parsed.labelIds) ? parsed.labelIds : [],
      lastUsedAt: typeof parsed.lastUsedAt === 'object' ? parsed.lastUsedAt : {},
    };
  } catch (error) {
    console.error('Failed to load recent labels from localStorage:', error);
    return { labelIds: [], lastUsedAt: {} };
  }
}

/**
 * Save recent labels to localStorage
 */
function saveRecentLabels(storage: RecentLabelsStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Failed to save recent labels to localStorage:', error);
  }
}

export function useRecentLabels() {
  const [storage, setStorage] = useState<RecentLabelsStorage>(loadRecentLabels);

  /**
   * Add a label to recent list
   * - Updates timestamp
   * - Moves to front of list
   * - Keeps max 5 labels
   */
  const addRecentLabel = useCallback((labelId: number) => {
    setStorage((prev) => {
      // Remove existing entry if present
      const filtered = prev.labelIds.filter((id) => id !== labelId);

      // Add to front
      const newLabelIds = [labelId, ...filtered].slice(0, MAX_STORED_LABELS);

      // Update timestamp
      const newLastUsedAt = {
        ...prev.lastUsedAt,
        [labelId]: new Date().toISOString(),
      };

      const newStorage = {
        labelIds: newLabelIds,
        lastUsedAt: newLastUsedAt,
      };

      saveRecentLabels(newStorage);
      return newStorage;
    });
  }, []);

  /**
   * Get recent labels sorted by last used time
   * Returns top 5 most recent labels
   */
  const getRecentLabels = useCallback(
    (allLabels: Label[]): Label[] => {
      // Filter to labels that exist in allLabels
      const recentIds = storage.labelIds.filter((id) =>
        allLabels.some((l) => l.id === id)
      );

      // Map to label objects
      const recentLabels = recentIds
        .map((id) => allLabels.find((l) => l.id === id))
        .filter((l): l is Label => l !== undefined);

      // Sort by lastUsedAt (newest first)
      recentLabels.sort((a, b) => {
        const timeA = storage.lastUsedAt[a.id] || '';
        const timeB = storage.lastUsedAt[b.id] || '';
        return timeB.localeCompare(timeA);
      });

      // Return top 5
      return recentLabels.slice(0, MAX_DISPLAYED_RECENT);
    },
    [storage]
  );

  return {
    recentLabelIds: storage.labelIds,
    addRecentLabel,
    getRecentLabels,
  };
}
