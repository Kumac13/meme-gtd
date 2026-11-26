import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { LinksGraphSchema } from '../../src/schemas/linkSchemas.js';
import { createTestServer } from '../helpers/testServer.js';

type Graph = z.infer<typeof LinksGraphSchema>;

describe('GET /api/links/graph', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ app, cleanup } = await createTestServer());
  });

  afterEach(async () => cleanup());

  function issue({
    type = 'task', title = 'Task', body = '', deleted = 0, bookmark = 0, updated = '2020-01-01',
  }: {
    type?: 'task' | 'memo' | 'article' | 'template'; title?: string | null; body?: string;
    deleted?: number; bookmark?: number; updated?: string;
  } = {}) {
    return Number(app.db.prepare(`
      INSERT INTO issues (type, title, body_md, is_deleted, is_bookmarked, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, title, body, deleted, bookmark, updated).lastInsertRowid);
  }

  function link(source: number, target: number, type: Graph['edges'][number]['linkType'] = 'relates') {
    return {
      id: Number(app.db.prepare('INSERT INTO links (source_issue_id, target_issue_id, link_type) VALUES (?, ?, ?)')
        .run(source, target, type).lastInsertRowid),
      sourceIssueId: source, targetIssueId: target, linkType: type,
    };
  }

  function label(name: string, ...issues: number[]) {
    const id = Number(app.db.prepare('INSERT INTO labels (name) VALUES (?)').run(name).lastInsertRowid);
    const assign = app.db.prepare('INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?)');
    for (const issueId of issues) assign.run(issueId, id);
    return id;
  }

  async function get(query = '') {
    const response = await app.inject({ method: 'GET', url: `/api/links/graph${query ? `?${query}` : ''}` });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers['cache-control'], 'no-store');
    return LinksGraphSchema.parse(response.json());
  }

  const ids = (graph: Graph) => graph.nodes.map(node => node.id);

  function assertEndpoints(graph: Graph) {
    const issues = new Set(ids(graph));
    const labels = new Set(graph.labels.map(label => label.id));
    assert.ok(graph.edges.every(edge => issues.has(edge.sourceIssueId) && issues.has(edge.targetIssueId)));
    assert.ok(graph.memberships.every(entry => issues.has(entry.issueId) && labels.has(entry.labelId)));
    assert.deepEqual(labels, new Set(graph.memberships.map(entry => entry.labelId)));
  }

  it('includes isolated issues, computes shortest distances in both directions and preserves each saved edge', async () => {
    const root = issue();
    const memo = issue({ type: 'memo', title: null, body: '  Long\nMemo ' + '😀'.repeat(24) });
    const article = issue({ type: 'article', title: 'Article' });
    const third = issue();
    const fourth = issue();
    const fifth = issue();
    const isolated = issue({ type: 'memo', title: null, updated: '2021-01-01' });
    const edges = [
      link(root, memo, 'parent'), link(article, memo, 'child'), link(root, article, 'derived_from'),
      link(third, article), link(memo, third), link(fourth, third), link(fifth, fourth),
    ];

    const all = await get();
    assert.equal(all.rootId, null);
    assert.equal(all.depth, null);
    assert.deepEqual(ids(all), [isolated, root, memo, article, third, fourth, fifth]);
    assert.deepEqual(all.nodes[0], { id: isolated, type: 'memo', title: `Memo #${isolated}`, status: null });
    assert.equal(all.nodes[2].title, 'Long Memo ' + '😀'.repeat(20) + '…');
    assert.deepEqual(all.edges, edges);
    assert.deepEqual(ids(await get(`rootId=${isolated}`)), [isolated]);
    assert.deepEqual(ids(await get(`rootId=${root}&depth=1`)), [root, memo, article]);
    assert.deepEqual(ids(await get(`rootId=${root}&depth=2`)), [root, memo, article, third]);
    assert.deepEqual(ids(await get(`rootId=${root}&depth=3`)), [root, memo, article, third, fourth]);
    const depthFour = await get(`rootId=${root}&depth=4`);
    assert.equal(depthFour.depth, 4);
    assert.deepEqual(ids(depthFour), [root, memo, article, third, fourth, fifth]);
    const unlimited = await get(`rootId=${root}`);
    assert.equal(unlimited.depth, null);
    assert.deepEqual(ids(unlimited), ids(depthFour));
    assert.deepEqual(unlimited.edges, edges);
    assert.deepEqual(ids(await get(`rootId=${article}&depth=1`)), [article, root, memo, third]);
  });

  it('applies title, body and active-comment search and combines filters after traversal', async () => {
    const root = issue();
    const middle = issue();
    const inProject = issue({ title: 'Keyword Title', bookmark: 1 });
    const noProject = issue({ type: 'memo', body: 'Keyword Body', bookmark: 1 });
    const commentHit = issue({ type: 'article', title: 'Article', bookmark: 1 });
    const deletedComment = issue({ bookmark: 1 });
    const wrongLabel = issue({ title: 'Keyword', bookmark: 1 });
    const wrongProject = issue({ title: 'Keyword', bookmark: 1 });
    const notBookmarked = issue({ title: 'Keyword' });
    const disconnected = issue({ title: 'Keyword', bookmark: 1 });
    link(root, middle);
    for (const id of [inProject, noProject, commentHit, deletedComment, wrongLabel, wrongProject, notBookmarked]) link(middle, id);
    const addComment = app.db.prepare('INSERT INTO comments (issue_id, body_md, is_deleted) VALUES (?, ?, ?)');
    addComment.run(commentHit, 'Keyword in this comment', 0);
    addComment.run(deletedComment, 'Keyword in a deleted comment', 1);
    const red = label('Red', inProject, commentHit, deletedComment, notBookmarked, disconnected);
    const blue = label('Blue', noProject, wrongProject);
    label('Other', wrongLabel, middle);
    const addProject = app.db.prepare('INSERT INTO projects (name) VALUES (?)');
    const project = Number(addProject.run('Graph project').lastInsertRowid);
    const unrelated = Number(addProject.run('Other project').lastInsertRowid);
    const addItem = app.db.prepare('INSERT INTO project_items (project_id, issue_id, position) VALUES (?, ?, 0)');
    addItem.run(project, inProject);
    addItem.run(project, commentHit);
    addItem.run(unrelated, wrongProject);

    const query = `rootId=${root}&q=keyword&label=Blue,Red&projectId=${project},none&bookmarked=true`;
    const result = await get(query);
    assert.deepEqual(ids(result), [root, inProject, noProject, commentHit]);
    assert.deepEqual(result.edges, []);
    assert.deepEqual(result.labels, []);
    assert.deepEqual(ids(await get(`${query}&depth=1`)), [root]);
    assert.deepEqual(ids(await get('q=keyword')), [inProject, noProject, commentHit, wrongLabel, wrongProject, notBookmarked, disconnected]);
    assert.deepEqual(ids(await get('q=unavailable')), []);

    const labelled = await get(`${query}&includeLabels=true`);
    assert.deepEqual(labelled.nodes, result.nodes);
    assert.deepEqual(labelled.edges, result.edges);
    assert.deepEqual(labelled.labels, [{ id: red, name: 'Red' }, { id: blue, name: 'Blue' }]);
    assert.deepEqual(labelled.memberships, [
      { issueId: inProject, labelId: red }, { issueId: commentHit, labelId: red }, { issueId: noProject, labelId: blue },
    ]);
    assertEndpoints(labelled);
  });

  it('rejects invalid filters and unavailable roots and excludes inactive endpoints from traversal', async () => {
    const root = issue();
    const deleted = issue({ deleted: 1 });
    const template = issue({ type: 'template' });
    const behindDeleted = issue();
    const behindTemplate = issue();
    link(root, deleted);
    link(deleted, behindDeleted);
    link(root, template);
    link(template, behindTemplate);

    assert.deepEqual(ids(await get(`rootId=${root}`)), [root]);
    const all = await get();
    assert.deepEqual(ids(all), [root, behindDeleted, behindTemplate]);
    assert.deepEqual(all.edges, []);
    for (const id of [deleted, template, 999_999]) {
      const response = await app.inject({ url: `/api/links/graph?rootId=${id}` });
      assert.equal(response.statusCode, 404, response.body);
    }
    for (const query of [
      'depth=1', 'rootId=0', 'rootId=oops', 'rootId=-1', 'rootId=9007199254740992',
      'rootId=1.5', 'rootId=1e0', 'rootId=0x1', 'rootId=1&rootId=2', 'rootId=1&depth=0', 'rootId=1&depth=1.2',
      'bookmarked=yes', 'includeLabels=1', 'projectId=0', 'projectId=1,foo', 'projectId=1,',
    ]) {
      const response = await app.inject({ url: `/api/links/graph?${query}` });
      assert.equal(response.statusCode, 400, `${query}: ${response.body}`);
    }
  });

  it('reports each output cap at its boundary and keeps stable order and matching endpoints', async () => {
    const db = app.db;
    const root = issue();
    const limits = (await get()).limits;
    const updateDate = '2021-01-01';
    db.prepare(`
      WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM n WHERE i < ?)
      INSERT INTO issues (type, title, body_md, updated_at) SELECT 'task', 'Fixture ' || i, '', ? FROM n
    `).run(limits.issueNodes - 1, updateDate);
    const atIssues = await get();
    assert.equal(atIssues.truncated, false);
    assert.equal(atIssues.nodes.length, limits.issueNodes);
    assert.equal(atIssues.nodes.at(-1)?.id, root);
    const beyond = issue({ updated: updateDate });
    link(root, beyond);
    assert.deepEqual(ids(await get(`rootId=${root}`)), [root, beyond]);
    const overIssues = await get();
    assert.equal(overIssues.truncated, true);
    assert.deepEqual(ids(overIssues), ids(atIssues).slice(0, -1).concat(beyond));
    assert.deepEqual(overIssues.edges, []);
    assertEndpoints(overIssues);

    // Reuse the fixture via the root scope; only its own component counts.
    db.prepare(`
      WITH RECURSIVE n(i) AS (VALUES(0) UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
      INSERT INTO links (source_issue_id, target_issue_id, link_type)
      SELECT 2 + i / 200, 102 + i % 200, 'relates' FROM n
    `).run(limits.issueEdges);
    const linkedRoot = 2;
    const atEdges = await get(`rootId=${linkedRoot}`);
    assert.equal(atEdges.edges.length, limits.issueEdges);
    assert.equal(atEdges.truncated, false);
    const extraEdge = link(102, 2, 'derived_from');
    const overEdges = await get(`rootId=${linkedRoot}`);
    assert.deepEqual(overEdges.edges, atEdges.edges);
    assert.equal(overEdges.truncated, true);
    assertEndpoints(overEdges);
    db.prepare('DELETE FROM links WHERE id = ?').run(extraEdge.id);

    db.prepare(`
      WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM n WHERE i < ?)
      INSERT INTO labels (name) SELECT 'Graph label ' || i FROM n
    `).run(limits.labelNodes);
    db.prepare('INSERT INTO issue_labels (issue_id, label_id) SELECT ?, id FROM labels').run(linkedRoot);
    const url = `rootId=${linkedRoot}&includeLabels=true`;
    const atLabels = await get(url);
    assert.equal(atLabels.truncated, false);
    assert.equal(atLabels.labels.length, limits.labelNodes);
    const extraLabel = label('Extra label', linkedRoot);
    const overLabels = await get(url);
    assert.equal(overLabels.truncated, true);
    assert.deepEqual(overLabels.labels, atLabels.labels);
    assertEndpoints(overLabels);
    db.prepare('DELETE FROM labels WHERE id = ?').run(extraLabel);

    db.prepare(`
      INSERT INTO issue_labels (issue_id, label_id)
      SELECT issues.id, labels.id FROM issues CROSS JOIN labels WHERE issues.id BETWEEN 3 AND 11
    `).run();
    const atMemberships = await get(url);
    assert.equal(atMemberships.memberships.length, limits.memberships);
    assert.equal(atMemberships.truncated, false);
    db.prepare('INSERT INTO issue_labels (issue_id, label_id) VALUES (12, 1)').run();
    const overMemberships = await get(url);
    assert.equal(overMemberships.truncated, true);
    assert.equal(overMemberships.memberships.length, limits.memberships);
    assertEndpoints(overMemberships);
    assert.deepEqual(overMemberships, await get(url));
  });
});
