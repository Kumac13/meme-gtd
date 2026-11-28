import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectClient, createTestEnv, type TestEnv } from './helpers.js';

const READ_TOOLS = [
  'list_tasks', 'get_task',
  'list_task_comments', 'list_memo_comments', 'list_article_comments',
  'list_memos', 'get_memo', 'list_articles', 'get_article', 'list_templates', 'get_template',
  'list_projects', 'get_project', 'get_projects_for_issue',
  'list_issue_links', 'get_link', 'get_links_graph', 'list_url_links', 'get_url_link',
  'list_labels',
  'list_activity_log', 'get_issue_activity_log', 'get_project_activity_log', 'get_completed_tasks', 'get_activity_log_entry',
  'keyword_search',
];
const WRITE_TOOLS = [
  'create_task', 'update_task', 'delete_task', 'close_task', 'cancel_task', 'reopen_task', 'bookmark_task', 'unbookmark_task',
  'create_task_comment', 'update_task_comment', 'delete_task_comment',
  'add_project_item', 'update_project_item', 'remove_project_item',
  'create_link', 'delete_link', 'create_url_link', 'update_url_link', 'delete_url_link',
  'assign_label_to_issue', 'remove_label_from_issue',
];

describe('meme-gtd MCP server', () => {
  let env: TestEnv;
  // MCP が作成を公開しないリソースは REST API で用意する。
  let memo: { id: number };
  let article: { id: number };
  let project: { id: number };
  let label: { id: number; name: string };
  let template: { id: number };

  before(async () => {
    env = await createTestEnv();
    memo = await env.rest('POST', '/api/memos', { bodyMd: 'Seed memo about gardening' });
    await env.rest('POST', `/api/memos/${memo.id}/comments`, { bodyMd: 'Memo comment' });
    article = await env.rest('POST', '/api/articles', { title: 'Seed article', bodyMd: 'Article body' });
    await env.rest('POST', `/api/articles/${article.id}/comments`, { bodyMd: 'Article comment' });
    project = await env.rest('POST', '/api/projects', { name: 'Seed project' });
    label = await env.rest('POST', '/api/labels', { name: 'seed-label' });
    template = await env.rest('POST', '/api/templates', { title: 'Seed template', bodyMd: '## Why', templateTarget: 'task' });
  });

  after(async () => {
    await env.close();
  });

  describe('tool descriptors', () => {
    it('exposes exactly the defined read and write tools', async () => {
      const { tools } = await env.client.listTools();
      assert.deepEqual(tools.map(tool => tool.name).sort(), [...READ_TOOLS, ...WRITE_TOOLS].sort());
      assert.equal(tools.length, 47);
    });

    it('declares title, description, schemas and all safety annotations on every tool', async () => {
      const { tools } = await env.client.listTools();
      for (const tool of tools) {
        assert.ok(tool.title, `${tool.name} title`);
        assert.match(tool.description ?? '', /^Use this /, `${tool.name} description`);
        assert.equal(tool.inputSchema.type, 'object', `${tool.name} inputSchema`);
        assert.equal(tool.outputSchema?.type, 'object', `${tool.name} outputSchema`);
        const annotations = tool.annotations ?? {};
        assert.equal(annotations.readOnlyHint, READ_TOOLS.includes(tool.name), `${tool.name} readOnlyHint`);
        assert.equal(typeof annotations.destructiveHint, 'boolean', `${tool.name} destructiveHint`);
        assert.equal(annotations.openWorldHint, false, `${tool.name} openWorldHint`);
        if (annotations.readOnlyHint) assert.equal(annotations.destructiveHint, false, `${tool.name} read is not destructive`);
      }
    });

    it('marks overwriting and removing tools as destructive, and adding tools as not', async () => {
      const { tools } = await env.client.listTools();
      const destructive = tools.filter(tool => tool.annotations?.destructiveHint).map(tool => tool.name).sort();
      assert.deepEqual(destructive, [
        'delete_link', 'delete_task', 'delete_task_comment', 'delete_url_link',
        'remove_label_from_issue', 'remove_project_item',
        'update_project_item', 'update_task', 'update_task_comment', 'update_url_link',
      ]);
      // ラベル付与は再実行で履歴が増えるため idempotent としない。
      assert.equal(tools.find(tool => tool.name === 'assign_label_to_issue')?.annotations?.idempotentHint, false);
    });

    it('keeps every schema self-contained and within client limits', async () => {
      const { tools } = await env.client.listTools();
      for (const tool of tools) {
        // $ref を解決しないクライアントがあるため、スキーマは参照なしで展開する。
        assert.equal(JSON.stringify(tool).includes('$ref'), false, `${tool.name} has no $ref`);
        // Codex は入力スキーマが 5000 バイトを超えるツールを切り詰める（tool_input_schema_max_bytes の既定値）。
        assert.ok(JSON.stringify(tool.inputSchema).length <= 5000, `${tool.name} inputSchema size`);
        // Claude のコネクタはツール名 64 文字以下。
        assert.ok(tool.name.length <= 64, `${tool.name} name length`);
      }
    });

    it('registers only read tools when started read-only', async () => {
      const client = await connectClient(env.apiUrl, true);
      const { tools } = await client.listTools();
      assert.deepEqual(tools.map(tool => tool.name).sort(), [...READ_TOOLS].sort());
      const result = await client.callTool({ name: 'create_task', arguments: { title: 'Should not exist' } });
      assert.equal(result.isError, true);
      await client.close();
    });
  });

  describe('tasks', () => {
    it('creates, reads, updates and lists a task', async () => {
      const { task } = await env.ok('create_task', {
        title: 'Write report', bodyMd: 'Draft first', status: 'open',
        scheduledStart: '2026-12-01T10:00:00', scheduledEnd: '2026-12-01T11:00:00',
      });
      assert.equal(task.type, 'task');
      assert.equal(task.status, 'open');
      assert.equal(task.scheduledStart, '2026-12-01T10:00:00');
      // 非推奨フィールドは出力に含めない。
      assert.equal('scheduledOn' in task, false);

      assert.equal((await env.ok('get_task', { id: task.id })).task.title, 'Write report');

      const updated = await env.ok('update_task', { id: task.id, title: 'Write the report', scheduledEnd: null });
      assert.equal(updated.task.title, 'Write the report');
      assert.equal(updated.task.bodyMd, 'Draft first');
      assert.equal(updated.task.scheduledEnd, null);

      const page = await env.ok('list_tasks', { status: 'open', search: 'report', scheduledFrom: '2026-12-01', scheduledTo: '2026-12-01' });
      assert.equal(page.total, 1);
      assert.equal(page.limit, 20);
      assert.equal(page.data[0].id, task.id);
      assert.deepEqual(page.data[0].projectIds, []);
    });

    it('changes status and bookmark through the state tools', async () => {
      const { task } = await env.ok('create_task', { title: 'State task' });
      assert.equal(task.status, 'inbox');
      const closed = (await env.ok('close_task', { id: task.id })).task;
      assert.equal(closed.status, 'done');
      assert.ok(closed.actualEnd, 'closing records actualEnd');
      assert.equal((await env.ok('reopen_task', { id: task.id })).task.status, 'open');
      assert.equal((await env.ok('cancel_task', { id: task.id })).task.status, 'canceled');
      assert.equal((await env.ok('bookmark_task', { id: task.id })).task.isBookmarked, true);
      assert.equal((await env.ok('list_tasks', { bookmarked: true })).data.some((item: { id: number }) => item.id === task.id), true);
      assert.equal((await env.ok('unbookmark_task', { id: task.id })).task.isBookmarked, false);
    });

    it('deletes a task', async () => {
      const { task } = await env.ok('create_task', { title: 'To delete' });
      assert.deepEqual(await env.ok('delete_task', { id: task.id }), { deleted: true, id: task.id });
      const result = await env.call('get_task', { id: task.id });
      assert.equal(result.isError, true);
    });

    it('rewrites #id mentions and creates a relates link', async () => {
      const target = (await env.ok('create_task', { title: 'Mention target' })).task;
      const source = (await env.ok('create_task', { title: 'Mention source', bodyMd: `See #${target.id}` })).task;
      assert.equal(source.bodyMd, `See [#${target.id}](/tasks/${target.id})`);
      const { links } = await env.ok('list_issue_links', { issueId: source.id });
      assert.equal(links[0].linkType, 'relates');
      assert.equal(links[0].targetIssue.id, target.id);
    });

    it('returns actionable errors without changing data', async () => {
      const missing = await env.call('get_task', { id: 999999 });
      assert.equal(missing.isError, true);
      assert.match(missing.text, /HTTP 404.*not found/i);

      const notATask = await env.call('get_task', { id: memo.id });
      assert.equal(notATask.isError, true);

      const noChange = await env.call('update_task', { id: 1 });
      assert.equal(noChange.isError, true);
      assert.match(noChange.text, /at least one field/);

      const badInput = await env.call('create_task', { title: 'Bad time', scheduledStart: '2026-12-01 10:00' });
      assert.equal(badInput.isError, true);
    });
  });

  describe('comments', () => {
    it('adds, lists, edits and deletes task comments', async () => {
      const { task } = await env.ok('create_task', { title: 'Commented task' });
      const { comment } = await env.ok('create_task_comment', { taskId: task.id, bodyMd: 'First note' });
      assert.equal(comment.issueId, task.id);
      assert.equal((await env.ok('list_task_comments', { taskId: task.id })).comments.length, 1);
      const edited = await env.ok('update_task_comment', { taskId: task.id, commentId: comment.id, bodyMd: 'Edited note' });
      assert.equal(edited.comment.bodyMd, 'Edited note');
      assert.deepEqual(
        await env.ok('delete_task_comment', { taskId: task.id, commentId: comment.id }),
        { deleted: true, taskId: task.id, commentId: comment.id }
      );
      assert.deepEqual((await env.ok('list_task_comments', { taskId: task.id })).comments, []);
    });

    it('refuses to edit or delete a comment through another task', async () => {
      const owner = (await env.ok('create_task', { title: 'Owner' })).task;
      const other = (await env.ok('create_task', { title: 'Other' })).task;
      const { comment } = await env.ok('create_task_comment', { taskId: owner.id, bodyMd: 'Keep me' });

      const edit = await env.call('update_task_comment', { taskId: other.id, commentId: comment.id, bodyMd: 'Hijacked' });
      assert.equal(edit.isError, true);
      assert.match(edit.text, /does not belong to task/);
      const remove = await env.call('delete_task_comment', { taskId: other.id, commentId: comment.id });
      assert.equal(remove.isError, true);

      const { comments } = await env.ok('list_task_comments', { taskId: owner.id });
      assert.equal(comments[0].bodyMd, 'Keep me');
    });

    it('lists memo and article comments', async () => {
      assert.equal((await env.ok('list_memo_comments', { memoId: memo.id })).comments[0].bodyMd, 'Memo comment');
      assert.equal((await env.ok('list_article_comments', { articleId: article.id })).comments[0].bodyMd, 'Article comment');
    });
  });

  describe('memos, articles and templates', () => {
    it('reads memos', async () => {
      const page = await env.ok('list_memos', { search: 'gardening', order: 'asc' });
      assert.equal(page.total, 1);
      assert.equal(page.data[0].id, memo.id);
      assert.equal((await env.ok('get_memo', { id: memo.id })).memo.bodyMd, 'Seed memo about gardening');
    });

    it('reads articles', async () => {
      const page = await env.ok('list_articles', { origin: 'manual' });
      assert.equal(page.data[0].id, article.id);
      assert.equal((await env.ok('get_article', { id: article.id })).article.origin, 'manual');
    });

    it('reads templates', async () => {
      const page = await env.ok('list_templates', { target: 'task' });
      assert.equal(page.data[0].id, template.id);
      assert.equal((await env.ok('get_template', { id: template.id })).template.templateTarget, 'task');
    });
  });

  describe('projects', () => {
    it('reads projects and manages task membership', async () => {
      const { task } = await env.ok('create_task', { title: 'Project task' });
      assert.equal((await env.ok('list_projects')).projects.some((item: { id: number }) => item.id === project.id), true);

      const { item } = await env.ok('add_project_item', { projectId: project.id, issueId: task.id, column: 'To Do' });
      assert.equal(item.issueId, task.id);
      assert.equal(item.viewMeta.column, 'To Do');
      assert.equal((await env.ok('get_projects_for_issue', { issueId: task.id })).projects[0].id, project.id);
      assert.equal((await env.ok('list_tasks', { projectIds: [project.id] })).total, 1);

      const moved = await env.ok('update_project_item', { projectId: project.id, taskId: task.id, column: 'Done', position: 5 });
      assert.equal(moved.item.viewMeta.column, 'Done');
      assert.equal(moved.item.position, 5);
      const detail = (await env.ok('get_project', { id: project.id })).project;
      assert.equal(detail.items.find((entry: { issueId: number }) => entry.issueId === task.id).issue.title, 'Project task');

      assert.deepEqual(
        await env.ok('remove_project_item', { projectId: project.id, taskId: task.id }),
        { removed: true, projectId: project.id, taskId: task.id }
      );
      assert.deepEqual((await env.ok('get_projects_for_issue', { issueId: task.id })).projects, []);
    });

    it('adds a memo to a project but only moves or removes tasks', async () => {
      await env.ok('add_project_item', { projectId: project.id, issueId: memo.id });
      const move = await env.call('update_project_item', { projectId: project.id, taskId: memo.id, position: 1 });
      assert.equal(move.isError, true);
      assert.match(move.text, /is not a task/);
      const remove = await env.call('remove_project_item', { projectId: project.id, taskId: memo.id });
      assert.equal(remove.isError, true);
      assert.equal((await env.ok('get_projects_for_issue', { issueId: memo.id })).projects.length, 1);
    });
  });

  describe('issue links', () => {
    it('creates, reads and removes a link through its task', async () => {
      const parent = (await env.ok('create_task', { title: 'Parent' })).task;
      const child = (await env.ok('create_task', { title: 'Child' })).task;
      const { link } = await env.ok('create_link', { sourceIssueId: child.id, targetIssueId: parent.id, linkType: 'child' });
      assert.equal(link.linkType, 'child');

      const { links } = await env.ok('list_issue_links', { issueId: parent.id, type: 'child' });
      assert.equal(links[0].direction, 'incoming');
      assert.equal(links[0].targetIssue.id, child.id);
      assert.equal((await env.ok('get_link', { issueId: child.id, linkId: link.id })).link.direction, 'outgoing');

      const graph = await env.ok('get_links_graph', { rootId: parent.id, depth: 1, includeLabels: true });
      assert.deepEqual(graph.nodes.map((node: { id: number }) => node.id).sort(), [parent.id, child.id].sort());
      assert.equal(graph.edges[0].id, link.id);

      const unrelated = (await env.ok('create_task', { title: 'Unrelated' })).task;
      const wrongTask = await env.call('delete_link', { taskId: unrelated.id, linkId: link.id });
      assert.equal(wrongTask.isError, true);
      assert.match(wrongTask.text, /does not belong to issue/);
      assert.equal((await env.ok('list_issue_links', { issueId: parent.id })).links.length, 1);

      assert.deepEqual(await env.ok('delete_link', { taskId: child.id, linkId: link.id }), { deleted: true, taskId: child.id, linkId: link.id });
      assert.deepEqual((await env.ok('list_issue_links', { issueId: parent.id })).links, []);
    });

    it('refuses to remove a link through a memo', async () => {
      const { link } = await env.ok('create_link', { sourceIssueId: memo.id, targetIssueId: article.id, linkType: 'relates' });
      const result = await env.call('delete_link', { taskId: memo.id, linkId: link.id });
      assert.equal(result.isError, true);
      assert.equal((await env.ok('list_issue_links', { issueId: memo.id })).links.length, 1);
    });

    it('does not record a promotion when linking a task to a memo', async () => {
      const { task } = await env.ok('create_task', { title: 'Derived' });
      await env.ok('create_link', { sourceIssueId: task.id, targetIssueId: memo.id, linkType: 'derived_from' });
      const { entries } = await env.ok('list_activity_log', { eventType: 'memo.promoted' });
      assert.deepEqual(entries, []);
    });
  });

  describe('external links', () => {
    it('adds, reads, renames and removes a URL link through its task', async () => {
      const { task } = await env.ok('create_task', { title: 'With URL' });
      const { urlLink } = await env.ok('create_url_link', { issueId: task.id, url: 'https://example.com/doc', title: 'Doc' });
      assert.equal(urlLink.title, 'Doc');
      assert.equal((await env.ok('list_url_links', { issueId: task.id })).urlLinks.length, 1);
      assert.equal((await env.ok('get_url_link', { issueId: task.id, urlLinkId: urlLink.id })).urlLink.url, 'https://example.com/doc');

      const renamed = await env.ok('update_url_link', { taskId: task.id, urlLinkId: urlLink.id, title: null });
      assert.equal(renamed.urlLink.title, null);

      const other = (await env.ok('create_task', { title: 'Other URL owner' })).task;
      const wrongTask = await env.call('delete_url_link', { taskId: other.id, urlLinkId: urlLink.id });
      assert.equal(wrongTask.isError, true);
      assert.match(wrongTask.text, /does not belong to issue/);

      assert.deepEqual(
        await env.ok('delete_url_link', { taskId: task.id, urlLinkId: urlLink.id }),
        { deleted: true, taskId: task.id, urlLinkId: urlLink.id }
      );
      assert.deepEqual((await env.ok('list_url_links', { issueId: task.id })).urlLinks, []);
    });

    it('adds a URL link to a memo but refuses to rename or remove it', async () => {
      const { urlLink } = await env.ok('create_url_link', { issueId: memo.id, url: 'https://example.com/memo' });
      const rename = await env.call('update_url_link', { taskId: memo.id, urlLinkId: urlLink.id, title: 'x' });
      assert.equal(rename.isError, true);
      const remove = await env.call('delete_url_link', { taskId: memo.id, urlLinkId: urlLink.id });
      assert.equal(remove.isError, true);
      assert.equal((await env.ok('get_url_link', { issueId: memo.id, urlLinkId: urlLink.id })).urlLink.title, null);
    });
  });

  describe('labels', () => {
    it('lists labels, assigns to any issue and removes only from tasks', async () => {
      const { task } = await env.ok('create_task', { title: 'Labeled task' });
      assert.deepEqual(await env.ok('assign_label_to_issue', { issueId: task.id, labelId: label.id }), { assigned: true, issueId: task.id, labelId: label.id });
      await env.ok('assign_label_to_issue', { issueId: memo.id, labelId: label.id });

      const listed = (await env.ok('list_labels')).labels.find((item: { id: number }) => item.id === label.id);
      assert.equal(listed.taskCount, 1);
      assert.equal(listed.memoCount, 1);
      assert.deepEqual((await env.ok('get_task', { id: task.id })).task.labels, [label.name]);
      assert.equal((await env.ok('list_tasks', { labels: [label.name] })).total, 1);

      const fromMemo = await env.call('remove_label_from_issue', { taskId: memo.id, labelId: label.id });
      assert.equal(fromMemo.isError, true);
      assert.deepEqual((await env.ok('get_memo', { id: memo.id })).memo.labels, [label.name]);

      assert.deepEqual(await env.ok('remove_label_from_issue', { taskId: task.id, labelId: label.id }), { removed: true, taskId: task.id, labelId: label.id });
      assert.deepEqual((await env.ok('get_task', { id: task.id })).task.labels, []);
    });

    it('reports an unknown label instead of creating it', async () => {
      const { task } = await env.ok('create_task', { title: 'No new label' });
      const before = (await env.ok('list_labels')).labels.length;
      const result = await env.call('assign_label_to_issue', { issueId: task.id, labelId: 999999 });
      assert.equal(result.isError, true);
      assert.equal((await env.ok('list_labels')).labels.length, before);
    });
  });

  describe('activity and search', () => {
    it('reads activity by list, issue, project and entry id', async () => {
      const { task } = await env.ok('create_task', { title: 'Tracked task' });
      await env.ok('add_project_item', { projectId: project.id, issueId: task.id });
      await env.ok('close_task', { id: task.id });

      const issueLog = (await env.ok('get_issue_activity_log', { issueId: task.id })).entries;
      assert.equal(issueLog[0].eventType, 'task.created');
      assert.equal(issueLog.at(-1).eventType, 'task.status_changed');

      const listed = (await env.ok('list_activity_log', { issueId: task.id, eventType: 'task.status_changed', limit: 1 })).entries;
      assert.equal(listed.length, 1);
      assert.equal(listed[0].sourceType, 'api');
      assert.deepEqual((await env.ok('get_activity_log_entry', { id: listed[0].id })).entry, listed[0]);

      const projectLog = (await env.ok('get_project_activity_log', { projectId: project.id })).entries;
      assert.equal(projectLog.some((entry: { eventType: string }) => entry.eventType === 'project.item_added'), true);

      const completed = (await env.ok('get_completed_tasks')).tasks;
      assert.equal(completed.some((entry: { taskId: number }) => entry.taskId === task.id), true);

      const missing = await env.call('get_activity_log_entry', { id: 999999 });
      assert.equal(missing.isError, true);
    });

    it('searches across issue types and comments', async () => {
      const { task } = await env.ok('create_task', { title: 'Plain title' });
      await env.ok('create_task_comment', { taskId: task.id, bodyMd: 'zebra-crossing detail' });
      const found = await env.ok('keyword_search', { q: 'zebra-crossing' });
      assert.equal(found.total, 1);
      assert.equal(found.results[0].id, task.id);
      assert.equal(found.results[0].matches[0].field, 'comment');

      const memosOnly = await env.ok('keyword_search', { q: 'gardening', types: ['memo'] });
      assert.deepEqual(memosOnly.results.map((result: { id: number }) => result.id), [memo.id]);
    });
  });
});
