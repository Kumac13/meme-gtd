import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiError, type Api } from './api.js';

/**
 * ツールの副作用の種類。annotations と、読み取り専用起動時の登録可否を決める。
 * - read: 取得のみ
 * - create: 追加のみ（既存の内容を書き換えない）
 * - state: 状態やブックマークの切り替え（元に戻せる）
 * - update: 既存の内容を上書きする
 * - delete: 削除・解除
 */
type ToolKind = 'read' | 'create' | 'state' | 'update' | 'delete';

const ANNOTATIONS: Record<ToolKind, { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }> = {
  // meme-gtd の中だけを操作し外部ページへはアクセスしないため、openWorldHint は常に false。
  read: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  // 追加や状態変更は再実行のたびに履歴（activity log）が増えるため idempotent としない。
  create: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  state: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  update: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  delete: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
};

export interface ToolContext {
  server: McpServer;
  api: Api;
  readOnly: boolean;
}

interface ToolDefinition<I extends z.ZodRawShape, O extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  kind: ToolKind;
  input: I;
  output: O;
  run: (args: z.infer<z.ZodObject<I>>, api: Api) => Promise<unknown>;
}

type LooseRegisterTool = (
  name: string,
  config: Record<string, unknown>,
  handler: (args: Record<string, unknown>) => Promise<unknown>
) => unknown;

/** 入力の検証後に呼ばれる前提条件の不一致（対象が別のタスクのもの、など）。 */
export class ToolInputError extends Error {}

export function defineTool<I extends z.ZodRawShape, O extends z.ZodRawShape>(
  context: ToolContext,
  definition: ToolDefinition<I, O>
): void {
  if (context.readOnly && definition.kind !== 'read') return;
  const outputSchema = z.object(definition.output);
  // SDK の registerTool は Zod のジェネリクスが深く、型推論が打ち切られるため緩い型で呼ぶ。
  const registerTool = context.server.registerTool.bind(context.server) as unknown as LooseRegisterTool;
  registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.input,
      outputSchema: definition.output,
      annotations: ANNOTATIONS[definition.kind],
    },
    async args => {
      try {
        const raw = await definition.run(args as z.infer<z.ZodObject<I>>, context.api);
        // 宣言した outputSchema にない項目は落とし、structuredContent をスキーマと一致させる。
        const data = outputSchema.parse(raw);
        return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
      } catch (error) {
        const message = error instanceof ApiError || error instanceof ToolInputError
          ? error.message
          : 'The meme-gtd API returned a response this tool could not interpret. A write may have been applied; check before retrying.';
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    }
  );
}

/** id がタスクであることを確認する（タスク以外への書き込みを防ぐ）。 */
export async function requireTask(api: Api, taskId: number): Promise<void> {
  try {
    await api.get(`/api/tasks/${taskId}`);
  } catch (error) {
    // API はタスク以外の ID に「ID refers to different type(...)」を返す。
    if (error instanceof ApiError && error.message.includes('different type')) {
      throw new ToolInputError(`Issue #${taskId} is not a task. This tool only changes tasks. Nothing was changed.`);
    }
    throw error;
  }
}

export function csv(values: Array<string | number> | undefined): string | undefined {
  return values && values.length > 0 ? values.join(',') : undefined;
}

/** projectIds と noProject を API の projectId クエリ（"none,1,2"）に変換する。 */
export function projectFilter(projectIds: number[] | undefined, noProject: boolean | undefined): string | undefined {
  return csv([...(noProject ? ['none'] : []), ...(projectIds ?? [])]);
}
