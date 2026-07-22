import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// 共通コンポーネントの所有権ルール（docs/architecture.md「Web プレゼンテーション層」が正）。
// ファイル列挙ではなくディレクトリ走査で検査し、新規追加ファイルも自動的に対象へ入れる。

// vitest は packages/web をカレントディレクトリとして実行する
const webSrc = join(process.cwd(), 'src');
const iosApp = join(process.cwd(), '../../ios/MemeGTD/MemeGTD');

const listFiles = (root: string, extensions: string[]): string[] =>
  readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((path) => extensions.some((extension) => path.endsWith(extension)))
    .map((path) => path.split(sep).join('/'));

const source = (root: string, relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

/** pattern を含んでよいファイルを allowlist に限定する（走査型の負のルール）。 */
const expectOwnedBy = (root: string, files: string[], pattern: string, allowlist: string[]) => {
  for (const file of files) {
    if (allowlist.includes(file)) continue;
    expect(source(root, file), `${file} must not own '${pattern}' — use ${allowlist.join(', ')}`)
      .not.toContain(pattern);
  }
};

describe('shared component boundaries (web)', () => {
  const files = listFiles(webSrc, ['.ts', '.tsx']).filter((file) => !file.startsWith('api/'));
  const pages = files.filter((file) => file.startsWith('pages/'));

  it('scans a sane number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('keeps interaction primitives on their single owners across all files', () => {
    expectOwnedBy(webSrc, files, "addEventListener('mousedown'", ['hooks/useOutsideClick.ts']);
    expectOwnedBy(webSrc, files, 'useImageUpload', ['hooks/useImageUpload.ts', 'components/MarkdownTextarea.tsx']);
    expectOwnedBy(webSrc, files, 'navigator.clipboard', [
      'hooks/useCopyToClipboard.ts',
      'utils/copyContent.ts',
      'utils/markdown.tsx',
    ]);
    expectOwnedBy(webSrc, files, 'fixed inset-0', ['components/ActionMenu.tsx', 'components/SidePanel.tsx']);
  });

  it('keeps template fetching behind TemplateCreationFlow / template screens', () => {
    expectOwnedBy(
      webSrc,
      files,
      'TemplatesService',
      [
        'components/TemplateChooser.tsx',
        'components/TemplateForm.tsx',
        'components/ItemDetail.tsx',
        ...files.filter((file) => file.startsWith('pages/Templates/')),
      ],
    );
    for (const path of ['pages/TaskNew.tsx', 'pages/Articles/ArticleNew.tsx', 'components/CreateTaskModal.tsx']) {
      expect(source(webSrc, path)).toContain('TemplateCreationFlow');
    }
  });

  it('keeps every create/edit page on FormPageLayout (including future pages)', () => {
    const formPages = pages.filter((file) => file.endsWith('New.tsx') || file.endsWith('Edit.tsx'));
    expect(formPages.length).toBeGreaterThanOrEqual(7);
    for (const file of formPages) {
      expect(source(webSrc, file), `${file} must use FormPageLayout`).toContain('FormPageLayout');
    }
  });

  it('keeps every list page on ListPageLayout (including future pages)', () => {
    // ProjectsList は今回の共通化スコープ外の既知の例外。解消したらここから外す。
    const knownExceptions = ['pages/ProjectsList.tsx'];
    const listPages = pages.filter((file) => file.endsWith('List.tsx') && !knownExceptions.includes(file));
    expect(listPages.length).toBeGreaterThanOrEqual(4);
    for (const file of listPages) {
      expect(source(webSrc, file), `${file} must use ListPageLayout`).toContain('ListPageLayout');
    }
  });

  it('keeps shared shells wired into their known consumers', () => {
    expect(source(webSrc, 'components/MemoForm.tsx')).toContain('<IssueForm');

    for (const path of [
      'components/CreateTaskModal.tsx',
      'components/CreateTaskFromProjectModal.tsx',
      'components/ItemDetailPanel.tsx',
    ]) {
      expect(source(webSrc, path)).toContain('SidePanel');
    }

    expect(source(webSrc, 'pages/Calendar.tsx')).toContain('ItemDetailPanel');
    expect(existsSync(join(webSrc, 'components/calendar/TaskDetailPanel.tsx'))).toBe(false);

    for (const path of ['components/LabelsSection.tsx', 'components/ProjectsSection.tsx']) {
      expect(source(webSrc, path)).toContain('ManagementSection');
    }

    for (const path of ['components/ScheduleInput.tsx', 'components/ScheduleSection.tsx']) {
      expect(source(webSrc, path)).toContain('ScheduleDateTimeFields');
      expect(source(webSrc, path)).not.toContain('id="all-day-toggle"');
    }

    for (const path of ['components/AddLinkInline.tsx', 'components/TaskFormLinks.tsx']) {
      expect(source(webSrc, path)).toContain('LinkCreationEditor');
      expect(source(webSrc, path)).not.toContain('Select link type:');
    }

    for (const path of [
      'components/LabelFilterDropdown.tsx',
      'components/ProjectFilterDropdown.tsx',
      'components/DateRangeFilterDropdown.tsx',
    ]) {
      expect(source(webSrc, path)).toContain('FilterDropdown');
    }

    for (const path of ['pages/TaskDetail.tsx', 'pages/MemoDetail.tsx', 'components/ItemDetailPanel.tsx']) {
      expect(source(webSrc, path)).toContain('useCopyItemContent');
    }

    for (const path of ['pages/TasksList.tsx', 'pages/MemosList.tsx', 'pages/Articles/ArticleList.tsx']) {
      expect(source(webSrc, path)).toContain('ProjectFilterDropdown');
    }
  });
});

describe('shared component boundaries (iOS)', () => {
  // CI（web-ci.yml）で唯一自動実行される iOS 境界チェック。
  // Xcode 側の同等チェックは MemeGTDTests/ComponentBoundaryTests.swift。
  const swiftFiles = listFiles(iosApp, ['.swift']);

  it('scans a sane number of Swift files', () => {
    expect(swiftFiles.length).toBeGreaterThan(50);
  });

  it('keeps every list ViewModel on IssueListStateProviding (including future ones)', () => {
    const listViewModels = swiftFiles.filter((file) => file.endsWith('ListViewModel.swift'));
    expect(listViewModels.length).toBeGreaterThanOrEqual(4);
    for (const file of listViewModels) {
      const contents = source(iosApp, file);
      expect(contents, `${file} must adopt IssueListStateProviding`).toContain('IssueListStateProviding');
      expect(contents, `${file} must load more via performLoadMore`).toContain('performLoadMore');
    }
  });

  it('keeps every detail ViewModel on IssueMetadataManaging (including future ones)', () => {
    const detailViewModels = swiftFiles.filter((file) => file.endsWith('DetailViewModel.swift'));
    expect(detailViewModels.length).toBeGreaterThanOrEqual(4);
    for (const file of detailViewModels) {
      expect(source(iosApp, file), `${file} must adopt IssueMetadataManaging`).toContain('IssueMetadataManaging');
    }
  });

  it('keeps metadata/relation service construction inside the shared protocols', () => {
    for (const pattern of ['IssueMetadataService(', 'IssueRelationService(']) {
      expectOwnedBy(iosApp, swiftFiles, pattern, ['Protocols/IssueDetailManaging.swift']);
    }
  });

  it('keeps every issue cell on IssueCellLayout (including future ones)', () => {
    const cells = swiftFiles.filter((file) => file.includes('Views/Components/') && file.endsWith('Cell.swift'));
    expect(cells.length).toBeGreaterThanOrEqual(3);
    for (const file of cells) {
      expect(source(iosApp, file), `${file} must use IssueCellLayout`).toContain('IssueCellLayout');
    }
  });

  it('keeps multi-select pickers on MultiSelectPickerShell', () => {
    for (const path of ['Views/Components/LabelPickerModal.swift', 'Views/Components/ProjectPickerModal.swift']) {
      expect(source(iosApp, path)).toContain('MultiSelectPickerShell');
    }
  });
});
