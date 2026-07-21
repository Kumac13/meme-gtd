import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('shared component boundaries', () => {
  it('keeps every template-backed entry point on TemplateCreationFlow', () => {
    for (const path of [
      '../../src/pages/TaskNew.tsx',
      '../../src/pages/Articles/ArticleNew.tsx',
      '../../src/components/CreateTaskModal.tsx',
    ]) {
      const contents = source(path);
      expect(contents).toContain('TemplateCreationFlow');
      expect(contents).not.toContain('TemplatesService');
    }
  });

  it('keeps resource forms and page chrome on their shared components', () => {
    expect(source('../../src/components/MemoForm.tsx')).toContain('<IssueForm');

    for (const path of [
      '../../src/pages/TaskNew.tsx',
      '../../src/pages/Articles/ArticleNew.tsx',
      '../../src/pages/MemoNew.tsx',
      '../../src/pages/ProjectNew.tsx',
      '../../src/pages/Templates/TemplateNew.tsx',
      '../../src/pages/TaskEdit.tsx',
      '../../src/pages/MemoEdit.tsx',
    ]) {
      expect(source(path)).toContain('FormPageLayout');
    }
  });

  it('keeps list filters and overlay panels on one implementation', () => {
    for (const path of [
      '../../src/pages/TasksList.tsx',
      '../../src/pages/MemosList.tsx',
      '../../src/pages/Articles/ArticleList.tsx',
    ]) {
      expect(source(path)).toContain('ProjectFilterDropdown');
      expect(source(path)).not.toContain('showProjectDropdown');
    }

    for (const path of [
      '../../src/components/CreateTaskModal.tsx',
      '../../src/components/CreateTaskFromProjectModal.tsx',
      '../../src/components/ItemDetailPanel.tsx',
    ]) {
      expect(source(path)).toContain('SidePanel');
    }

    expect(source('../../src/pages/Calendar.tsx')).toContain('ItemDetailPanel');
    expect(existsSync(new URL('../../src/components/calendar/TaskDetailPanel.tsx', import.meta.url))).toBe(false);
  });
});
