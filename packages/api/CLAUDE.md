# API開発ガイド

## テスト必須

バックエンド（API/DB）を変更・追加する際は、必ず対応するテストを書くこと。テストなしでのバックエンド変更は禁止。

## テストの書き方

テストは `test/integration/` に配置。ヘルパーは `test/helpers/` を使用。

```typescript
import { createTestApp, createTestDb } from './helpers/test-utils.js';

describe('エンドポイント名', () => {
  // テストDBとアプリを初期化
  // リクエストを送信して検証
});
```

## Push前の検証

```bash
pnpm --filter meme-gtd-api lint
pnpm --filter meme-gtd-api openapi:validate
pnpm --filter meme-gtd-api test
```
