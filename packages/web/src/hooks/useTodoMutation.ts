import { useCallback, useEffect, useRef, useState } from 'react';
import { moveTodo, toggleTodo, type MoveTodoResult } from '../utils/todoMarkdown';

interface UseTodoMutationParams {
  content: string;
  save: (newContent: string) => Promise<unknown>;
  onError?: (err: unknown) => void;
}

interface UseTodoMutationResult {
  content: string;
  onToggle: (idx: number, nextChecked: boolean) => void;
  onReorder: (from: number, to: number) => MoveTodoResult['reason'] | null;
}

export function useTodoMutation({ content, save, onError }: UseTodoMutationParams): UseTodoMutationResult {
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const current = optimistic ?? content;
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    if (optimistic !== null && content === optimistic) {
      setOptimistic(null);
    }
  }, [content, optimistic]);

  const enqueue = useCallback(
    (next: string, previous: string) => {
      setOptimistic(next);
      queueRef.current = queueRef.current
        .then(async () => {
          try {
            await save(next);
          } catch (err) {
            setOptimistic(previous);
            onError?.(err);
            throw err;
          }
        })
        .catch(() => {
          /* swallow to keep chain alive */
        });
    },
    [save, onError],
  );

  const onToggle = useCallback(
    (idx: number, _nextChecked: boolean) => {
      const prev = currentRef.current;
      const next = toggleTodo(prev, idx);
      if (next === prev) return;
      enqueue(next, prev);
    },
    [enqueue],
  );

  const onReorder = useCallback(
    (from: number, to: number): MoveTodoResult['reason'] | null => {
      const prev = currentRef.current;
      const result = moveTodo(prev, from, to);
      if (!result.ok) return result.reason ?? 'out-of-range';
      if (result.md === prev) return result.reason ?? 'no-op';
      enqueue(result.md, prev);
      return null;
    },
    [enqueue],
  );

  return { content: current, onToggle, onReorder };
}
