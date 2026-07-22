import { useCallback, useState } from 'react';
import { copyItemContent, type CopyContentOptions } from '../utils/copyContent';

/** Shared Copy All operation and transient feedback lifecycle for detail surfaces. */
export function useCopyItemContent() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (options: CopyContentOptions) => {
    await copyItemContent(options);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  return { copied, copy };
}
