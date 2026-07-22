# Web UI開発ガイド

## 構成

```
src/
├── api/          # OpenAPIから自動生成（手編集禁止）
│   ├── core/     # fetchラッパー・エラー処理
│   └── services/ # TasksService等の生成サービスクラス
├── pages/        # ルーティング先のページ（App.tsxにルート定義）
├── components/   # 再利用コンポーネント（calendar/含む）
├── hooks/        # useUrlFilters, useCalendarState等
├── utils/        # markdown.tsx, activityLogHelpers.ts等
└── types/        # ローカル型（原則 meme-gtd-shared から import）
```

## API呼び出しルール

APIは必ず生成済みServiceクラス（`src/api/services/`）経由で呼ぶこと（直接fetchすると型安全性・共通エラー処理を失う）。

```typescript
// 正しい
import { TasksService } from '../api';
await TasksService.updateTask(id, { status });

// 禁止（型安全性・エラー処理を失う）
await fetch(`/api/tasks/${id}`, { method: 'PATCH', ... });
```

- 既存コードに直接`fetch()`が数カ所残っているが、これは負債。真似しない。触る機会があればServiceクラスに置き換える
- API変更後は `pnpm --filter meme-gtd-web generate:api` でクライアントを再生成する（`src/api/` を手で直さない）。入力は `packages/api/docs/api/openapi.yaml` なので、スキーマ変更時は先に `pnpm --filter meme-gtd-api openapi:generate` を実行する（順序を誤ると古い契約から生成される）
- `generate:api` は生成後に `src/api/core/OpenAPI.ts` の `BASE` を `''` へ置換する後処理を含む（本番はAPIサーバーがSPAを同一オリジンで配信するため）。`BASE` を localhost に戻さない

## 状態管理

- **集中管理なし**（Redux/Zustand/React Query不使用）。各コンポーネントが`useState` + `useEffect`でフェッチ
- **フィルタ・ビュー状態はURLが正**: `useSearchParams`（フィルタ）と`nuqs`（カレンダー）でURLと同期
- mutation後のキャッシュ無効化は手動refetch。更新後に一覧へ反映されない場合はrefetch漏れを疑う
- ProjectDetailは子ルート（KanbanView/ListView）へ`useOutletContext`で状態を渡す（意図的なパターン）

## 実装ルール

- 型は`meme-gtd-shared`からimportする（コンポーネント内にローカルinterfaceを複製しない）
- スケジュールは新形式フィールド（`scheduledStart`/`scheduledEnd`/`isAllDay`）を使う。旧形式（`scheduledOn`/`startTime`/`endTime`/`duration`/`endDate`）は非推奨
- UI文言は英語（ルートCLAUDE.md参照）
- 検索クエリは free-text のみ。ラベル・ステータスのフィルタは検索ボックスではなく専用 dropdown UI で扱う（`utils/queryParser.ts` 参照）

## 共通UIコンポーネント（新規UI実装前に必ず確認）

新しい画面・UIを作るとき、以下に該当するものは対応する共通コンポーネントを必ず使う。自前実装・既存画面からのコピーは禁止。境界は `tests/unit/ComponentBoundaries.test.ts` が検査し（Web CI で自動実行、新規ファイルも走査対象）、所有権ルールの正は `docs/architecture.md`「Web プレゼンテーション層」。

| 作るもの | 使う共通コンポーネント |
|---|---|
| 一覧ページの外枠（検索・作成導線・filter・件数・empty） | `ListPageLayout` |
| 作成・編集ページの外枠 | `FormPageLayout` |
| Issue系の作成・編集フォーム本体 | `IssueForm`（リソース固有フィールドはslot/callbackで渡す） |
| Template選択からの作成フロー | `TemplateCreationFlow`（`TemplatesService` を画面から直接呼ばない） |
| 右側オーバーレイパネル | `SidePanel` |
| Issue詳細の右パネル | `ItemDetailPanel`（リソース別Detail panelを増やさない） |
| 一覧filterのtrigger・popover・Clear | `FilterDropdown` / `ToggleFilterButton` |
| 行の「…」メニュー・インライン削除確認 | `ActionMenu` / `InlineDeleteConfirmation` |
| 外側クリックで閉じる挙動 | `useOutsideClick`（`document.addEventListener` を直接書かない） |
| Markdown本文入力（画像paste/drop/upload含む） | `MarkdownTextarea` |
| コンテンツ全文コピーとフィードバック | `useCopyItemContent` |
| Label / Project の管理欄 | `ManagementSection` |
| 編集可能な日付カード | `EditableSectionCard` |
| 日時・終日入力 | `ScheduleDateTimeFields` |
| Issue / URL リンク追加エディタ | `LinkCreationEditor` |

## 大型ファイルの注意

`MemosList.tsx`、`utils/activityLogHelpers.ts`、`IssueForm.tsx` は特に大きく（数百行規模）複数の関心事を含む。変更時は影響範囲を慎重に確認すること。

## テスト・検証

```bash
pnpm --filter meme-gtd-web test    # Vitest（tests/unit/ ユーティリティ中心）
pnpm build:web                      # ビルド確認（型チェック含む）
```

- コンポーネントの自動テストはほぼ無いため、UI変更は http://localhost:3001 （テスト環境）での動作確認が必須
- 開発サーバー: `pnpm dev:web`（APIは`pnpm server:dev`をポート3001で併用）
