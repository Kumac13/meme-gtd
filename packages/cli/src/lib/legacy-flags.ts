/**
 * 旧フラグ（camelCase）検出ユーティリティ
 */

export interface LegacyFlagMapping {
  [legacyFlag: string]: string; // legacy → modern or special message
}

export interface LegacyFlagDetectionResult {
  detected: boolean;
  legacyFlag?: string;
  suggestion?: string;
}

/**
 * process.argvから旧フラグを検出する
 * @param mappings 旧フラグ → 新フラグ or 特殊メッセージのマッピング
 * @returns 検出結果
 */
export function detectLegacyFlags(
  mappings: LegacyFlagMapping
): LegacyFlagDetectionResult {
  for (const [legacy, modern] of Object.entries(mappings)) {
    if (process.argv.includes(legacy)) {
      return {
        detected: true,
        legacyFlag: legacy,
        suggestion: modern
      };
    }

    // 短縮形もチェック（例: -f が --bodyFile の短縮の場合）
    // ただし、今回のケースでは短縮形は変更されないため、
    // ロングオプションのみをチェック
  }

  return { detected: false };
}

/**
 * 旧フラグ検出時のエラーメッセージを生成
 * @param result 検出結果
 * @returns エラーメッセージ
 */
export function formatLegacyFlagError(result: LegacyFlagDetectionResult): string {
  if (!result.detected || !result.legacyFlag || !result.suggestion) {
    return '';
  }

  // 特殊メッセージ（例: "removed (use: ...)"）の場合
  if (result.suggestion.startsWith('removed')) {
    return (
      `${result.legacyFlag} has been removed.\n` +
      result.suggestion.replace('removed (use: ', 'Use ').replace(')', ' instead.')
    );
  }

  // 通常のリネーム
  return (
    `Unknown flag: ${result.legacyFlag}\n` +
    `Did you mean: ${result.suggestion}?`
  );
}
