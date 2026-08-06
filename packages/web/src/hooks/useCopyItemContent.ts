import { useCallback, useEffect, useRef, useState } from 'react';
import {
  copyItemContent,
  copyItemContentWithJSON,
  type CopyContentJSONOptions,
  type CopyContentOptions,
} from '../utils/copyContent';

type CopyFormat = 'text' | 'json';

/** Shared Copy All operation and transient feedback lifecycle for detail surfaces. */
export function useCopyItemContent() {
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markCopied = useCallback((format: CopyFormat) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setCopiedFormat(format);
    feedbackTimer.current = setTimeout(() => setCopiedFormat(null), 2000);
  }, []);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const copy = useCallback(async (options: CopyContentOptions) => {
    await copyItemContent(options);
    markCopied('text');
  }, [markCopied]);

  const copyWithJSON = useCallback(async (options: CopyContentJSONOptions) => {
    await copyItemContentWithJSON(options);
    markCopied('json');
  }, [markCopied]);

  return {
    copied: copiedFormat !== null,
    copiedFormat,
    copy,
    copyWithJSON,
  };
}
