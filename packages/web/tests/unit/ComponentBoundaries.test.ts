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

  it('keeps markdown attachments, action menus, and editable cards on shared owners', () => {
    expect(source('../../src/components/MarkdownTextarea.tsx')).toContain('useImageUpload');
    for (const path of [
      '../../src/components/IssueForm.tsx',
      '../../src/components/CommentSection.tsx',
      '../../src/components/EditableContent.tsx',
      '../../src/components/ProjectForm.tsx',
    ]) {
      expect(source(path)).not.toContain('useImageUpload');
    }

    for (const path of [
      '../../src/components/LinkItem.tsx',
      '../../src/components/UrlLinkItem.tsx',
      '../../src/components/EditableContent.tsx',
      '../../src/components/ItemList.tsx',
      '../../src/pages/MemoDetail.tsx',
    ]) {
      expect(source(path)).toContain('ActionMenu');
      expect(source(path)).not.toContain('fixed inset-0 z-10');
    }

    for (const path of [
      '../../src/components/ScheduleSection.tsx',
      '../../src/components/ProjectScheduleSection.tsx',
    ]) {
      expect(source(path)).toContain('EditableSectionCard');
      expect(source(path)).not.toContain("addEventListener('mousedown'");
    }
  });

  it('keeps management, schedule, link creation, and list chrome on shared owners', () => {
    for (const path of ['../../src/components/LabelsSection.tsx', '../../src/components/ProjectsSection.tsx']) {
      expect(source(path)).toContain('ManagementSection');
    }

    for (const path of ['../../src/components/ScheduleInput.tsx', '../../src/components/ScheduleSection.tsx']) {
      expect(source(path)).toContain('ScheduleDateTimeFields');
      expect(source(path)).not.toContain('id="all-day-toggle"');
    }

    for (const path of ['../../src/components/AddLinkInline.tsx', '../../src/components/TaskFormLinks.tsx']) {
      expect(source(path)).toContain('LinkCreationEditor');
      expect(source(path)).not.toContain('Select link type:');
    }

    for (const path of [
      '../../src/pages/TasksList.tsx',
      '../../src/pages/MemosList.tsx',
      '../../src/pages/Articles/ArticleList.tsx',
      '../../src/pages/Templates/TemplatesList.tsx',
    ]) {
      expect(source(path)).toContain('ListPageLayout');
    }

    for (const path of [
      '../../src/components/LabelFilterDropdown.tsx',
      '../../src/components/ProjectFilterDropdown.tsx',
      '../../src/components/DateRangeFilterDropdown.tsx',
    ]) expect(source(path)).toContain('FilterDropdown');

    for (const path of [
      '../../src/pages/TaskDetail.tsx',
      '../../src/pages/MemoDetail.tsx',
      '../../src/components/ItemDetailPanel.tsx',
    ]) {
      expect(source(path)).toContain('useCopyItemContent');
      expect(source(path)).not.toContain('setTimeout(');
    }
  });

  it('keeps iOS cells, pickers, detail operations, and list state on shared boundaries', () => {
    for (const path of [
      '../../../../ios/MemeGTD/MemeGTD/Views/Components/TaskCell.swift',
      '../../../../ios/MemeGTD/MemeGTD/Views/Components/ArticleCell.swift',
      '../../../../ios/MemeGTD/MemeGTD/Views/Components/TemplateCell.swift',
    ]) expect(source(path)).toContain('IssueCellLayout');

    for (const path of [
      '../../../../ios/MemeGTD/MemeGTD/Views/Components/LabelPickerModal.swift',
      '../../../../ios/MemeGTD/MemeGTD/Views/Components/ProjectPickerModal.swift',
    ]) expect(source(path)).toContain('MultiSelectPickerShell');

    for (const path of [
      '../../../../ios/MemeGTD/MemeGTD/ViewModels/TaskDetailViewModel.swift',
      '../../../../ios/MemeGTD/MemeGTD/ViewModels/ArticleDetailViewModel.swift',
      '../../../../ios/MemeGTD/MemeGTD/ViewModels/MemoDetailViewModel.swift',
    ]) {
      const contents = source(path);
      expect(contents).toContain('IssueRelationManaging');
      expect(contents).not.toContain('IssueRelationService(issueId:');
    }

    for (const name of ['Task', 'Memo', 'Article', 'Template']) {
      const contents = source(`../../../../ios/MemeGTD/MemeGTD/ViewModels/${name}ListViewModel.swift`);
      expect(contents).toContain('IssueListStateProviding');
      expect(contents).toContain('performLoadMore');
    }
  });
});
