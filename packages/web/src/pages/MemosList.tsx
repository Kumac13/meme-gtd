import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';
import { ProjectsService } from '../api/services/ProjectsService';
import { SearchService } from '../api/services/SearchService';
import ItemList from '../components/ItemList';
import RelevanceIndicator from '../components/RelevanceIndicator';
import LabelFilterDropdown from '../components/LabelFilterDropdown';
import DateRangeFilterDropdown from '../components/DateRangeFilterDropdown';
import SearchInput, { type SearchMode } from '../components/SearchInput';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import CopyResultsButtons from '../components/CopyResultsButtons';
import { useUrlFilters } from '../hooks/useUrlFilters';
import {
  validateBookmarked,
  updateBookmarkedParam,
  updateSearchParam,
  parseLabelParam,
  updateLabelParam,
  parseDateRangeParams,
  updateDateRangeParams,
} from '../utils/urlFilterHelpers';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { MarkdownRenderer } from '../utils/markdown';
import MobileFloatingComposer from '../components/MobileFloatingComposer';
import { createItemDetailUrl } from '../utils/navigationHelpers';
import { LabelBadge } from '../components/LabelBadge';
import {
  formatTimelineTime,
  getTimelineDateBucket,
  shouldShowGapTimestamp,
} from '../utils/memoTimeline';
import { extractSnippet, highlightKeyword } from '../utils/searchHighlight';
import { useSearchHighlight } from '../hooks/useSearchHighlight';

interface Memo {
  id: number;
  title: string | null;
  bodyMd: string;
  isBookmarked: boolean;
  commentCount?: number;
  labels?: string[];
  preview?: string;
  createdAt: string;
  updatedAt: string;
}

import { PROJECT_STATUS_LABELS, sortProjectsByStatus } from '../utils/projectStatus';

interface Project {
  id: number;
  name: string;
  status: string;
}

const PAGE_SIZE = 20;

function MemoBody({ bodyMd }: { bodyMd: string }) {
  return (
    <div className="prose prose-sm prose-p:mb-2 prose-li:my-0 prose-p:text-[13px] prose-p:leading-6 max-w-none break-words text-gray-700">
      <MarkdownRenderer content={bodyMd} />
    </div>
  );
}

export default function MemosList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters } = useUrlFilters();
  const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

  // Label filter from URL
  const selectedLabels = useMemo(
    () => parseLabelParam(searchParams.get('label')),
    [searchParams]
  );

  // Date range filter from URL
  const { from: createdFrom, to: createdTo } = useMemo(
    () => parseDateRangeParams(searchParams, 'createdFrom', 'createdTo'),
    [searchParams]
  );

  // Project filter from URL
  const projectIdParam = searchParams.get('projectId') || '';
  const selectedProjectIds = useMemo(() => {
    if (!projectIdParam) return new Set<number>();
    return new Set(
      projectIdParam.split(',')
        .map(id => id.trim())
        .filter(id => id !== 'none')
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id))
    );
  }, [projectIdParam]);

  const selectedNoneProject = useMemo(() => {
    return projectIdParam.split(',').map(s => s.trim()).includes('none');
  }, [projectIdParam]);

  // Pagination state from URL
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Set document title for memos list
  useDocumentTitle('Memos');

  const [memos, setMemos] = useState<Memo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchSnippets, setMatchSnippets] = useState<Record<number, string>>({});
  const [relevanceScores, setRelevanceScores] = useState<Record<number, number>>({});
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [semanticMeta, setSemanticMeta] = useState<{ totalResults: number; searchTimeMs: number } | null>(null);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [newMemoBody, setNewMemoBody] = useState('');
  const [creatingMemo, setCreatingMemo] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Mobile scroll management refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef(0);
  const touchStartYRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Load projects for filter dropdown
  useEffect(() => {
    ProjectsService.listProjects().then(data => {
      const mapped = data.map(p => ({ id: p.id, name: p.name, status: p.status }));
      setProjects(sortProjectsByStatus(mapped));
    }).catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchMemos() {
      try {
        setError(null);

        // Build label parameter from URL
        const labelParam = selectedLabels.size > 0
          ? Array.from(selectedLabels).join(',')
          : undefined;

        // Build projectId parameter
        const projectIdFilter = (() => {
          const parts: string[] = [];
          if (selectedNoneProject) parts.push('none');
          if (selectedProjectIds.size > 0) parts.push(...Array.from(selectedProjectIds).map(String));
          return parts.length > 0 ? parts.join(',') : undefined;
        })();

        // Extract free-text search from parsed query
        const searchParam = filters.parsedQuery.freeText;

        const offset = (currentPage - 1) * PAGE_SIZE;

        if (searchParam && searchMode === 'semantic') {
          // Use semantic search API
          const response = await SearchService.semanticSearch(
            searchParam,
            50,
            'memo',
          );
          const mapped = response.results.map((r) => ({
            id: r.issue.id,
            type: r.issue.type,
            title: r.issue.title,
            bodyMd: r.issue.bodyMd,
            isBookmarked: r.issue.isBookmarked ?? false,
            commentCount: r.issue.commentCount ?? 0,
            labels: r.issue.labels ?? [],
            createdAt: r.issue.createdAt,
            updatedAt: r.issue.updatedAt,
          }));
          const scores: Record<number, number> = {};
          for (const r of response.results) {
            scores[r.issue.id] = r.score;
          }
          setMatchSnippets({});
          setRelevanceScores(scores);
          setSemanticMeta(response.meta);
          setMemos(mapped);
          setTotal(response.meta.totalResults);
        } else if (searchParam) {
          setRelevanceScores({});
          setSemanticMeta(null);
          const response = await SearchService.keywordSearch(
            searchParam,
            PAGE_SIZE,
            offset,
            'memo',
            undefined,
            labelParam,
            bookmarkFilter ? 'true' : undefined,
          );
          const mapped = response.results.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            bodyMd: r.bodyMd,
            isBookmarked: r.isBookmarked,
            commentCount: r.commentCount,
            labels: r.labels,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }));
          const snippets: Record<number, string> = {};
          for (const r of response.results) {
            const match = r.matches[0];
            if (match && match.field === 'comment') {
              snippets[r.id] = match.text;
            }
          }
          setMatchSnippets(snippets);
          setMemos(mapped);
          setTotal(response.total);
        } else {
          setMatchSnippets({});
          setRelevanceScores({});
          setSemanticMeta(null);
          const response = await MemosService.listMemos(
            bookmarkFilter ? 'true' : undefined,
            labelParam,
            projectIdFilter,
            undefined,
            createdFrom || undefined,
            createdTo || undefined,
            PAGE_SIZE,
            offset
          );
          setMemos(response?.data || []);
          setTotal(response?.total || 0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memos');
        console.error('Error fetching memos:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMemos();
  }, [filters.searchQuery, currentPage, bookmarkFilter, selectedLabels, selectedProjectIds, selectedNoneProject, searchMode, createdFrom, createdTo]);

  // Mobile: scroll to bottom after initial load so newest memos are visible
  useEffect(() => {
    if (!loading && memos.length > 0 && !initialScrollDone && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      setInitialScrollDone(true);
    }
  }, [loading, memos.length, initialScrollDone]);

  const filteredMemos = useMemo(() => {
    return memos.filter((memo) => {
      if (bookmarkFilter && !memo.isBookmarked) return false;
      return true;
    });
  }, [memos, bookmarkFilter]);

  // Reversed order for mobile: oldest at top, newest at bottom (chat-like)
  // Keep original order for semantic search (sorted by relevance score)
  const mobileFilteredMemos = useMemo(
    () => searchMode === 'semantic' ? filteredMemos : [...filteredMemos].reverse(),
    [filteredMemos, searchMode]
  );

  // Highlight search keywords across all memo bodies in the timeline container
  const searchQueryForHighlight = searchMode === 'keyword' ? filters.parsedQuery.freeText : undefined;
  const memoContentKey = mobileFilteredMemos.map(m => m.id).join(',');
  useSearchHighlight(timelineContainerRef, searchQueryForHighlight, 'search-match', memoContentKey);

  // Build the filter snapshot used by the Copy Results buttons so the backend
  // export call records the same filters the user is currently looking at.
  const copyExportFilters = useMemo(() => {
    const result: {
      query?: string;
      searchMode?: 'keyword' | 'semantic';
      labels?: string[];
      dateFrom?: string;
      dateTo?: string;
      bookmarked?: boolean;
      projectIds?: number[];
      includeNoProject?: boolean;
    } = {};
    if (filters.parsedQuery.freeText) {
      result.query = filters.parsedQuery.freeText;
      result.searchMode = searchMode;
    }
    if (selectedLabels.size > 0) {
      result.labels = Array.from(selectedLabels);
    }
    if (createdFrom) result.dateFrom = createdFrom;
    if (createdTo) result.dateTo = createdTo;
    if (bookmarkFilter) result.bookmarked = true;
    if (selectedProjectIds.size > 0) {
      result.projectIds = Array.from(selectedProjectIds);
    }
    if (selectedNoneProject) result.includeNoProject = true;
    return result;
  }, [
    filters.parsedQuery.freeText,
    searchMode,
    selectedLabels,
    createdFrom,
    createdTo,
    bookmarkFilter,
    selectedProjectIds,
    selectedNoneProject,
  ]);
  const copyExportItemIds = useMemo(() => filteredMemos.map((m) => m.id), [filteredMemos]);
  // Copy buttons only make sense when the user has actually narrowed the list
  // — showing them on the default (all-memos) view would be misleading since
  // the action is "copy the current search results".
  const hasActiveFilters = useMemo(
    () =>
      !!filters.parsedQuery.freeText ||
      selectedLabels.size > 0 ||
      !!createdFrom ||
      !!createdTo ||
      bookmarkFilter ||
      selectedProjectIds.size > 0 ||
      selectedNoneProject,
    [
      filters.parsedQuery.freeText,
      selectedLabels,
      createdFrom,
      createdTo,
      bookmarkFilter,
      selectedProjectIds,
      selectedNoneProject,
    ]
  );

  const handleBookmarkFilterChange = (newBookmarked: boolean) => {
    const params = updateBookmarkedParam(searchParams, newBookmarked);
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  const handleLabelToggle = (labelName: string) => {
    const newLabels = new Set(selectedLabels);
    if (newLabels.has(labelName)) {
      newLabels.delete(labelName);
    } else {
      newLabels.add(labelName);
    }
    const params = updateLabelParam(searchParams, newLabels);
    params.delete('page');
    setSearchParams(params);
  };

  const handleClearLabels = () => {
    const params = updateLabelParam(searchParams, new Set());
    params.delete('page');
    setSearchParams(params);
  };

  const handleDateRangeChange = (from: string, to: string) => {
    const params = updateDateRangeParams(searchParams, from, to, 'createdFrom', 'createdTo');
    params.delete('page');
    setSearchParams(params);
  };

  const handleDateRangeClear = () => {
    const params = updateDateRangeParams(searchParams, '', '', 'createdFrom', 'createdTo');
    params.delete('page');
    setSearchParams(params);
  };

  const handleProjectToggle = (projectId: number) => {
    const params = new URLSearchParams(searchParams);
    const newIds = new Set(selectedProjectIds);
    if (newIds.has(projectId)) {
      newIds.delete(projectId);
    } else {
      newIds.add(projectId);
    }
    const parts: string[] = [];
    if (selectedNoneProject) parts.push('none');
    parts.push(...Array.from(newIds).map(String));
    if (parts.length === 0) {
      params.delete('projectId');
    } else {
      params.set('projectId', parts.join(','));
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleNoneProjectToggle = () => {
    const params = new URLSearchParams(searchParams);
    const parts: string[] = [];
    if (!selectedNoneProject) parts.push('none');
    if (selectedProjectIds.size > 0) parts.push(...Array.from(selectedProjectIds).map(String));
    if (parts.length === 0) {
      params.delete('projectId');
    } else {
      params.set('projectId', parts.join(','));
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleClearProjects = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('projectId');
    params.delete('page');
    setSearchParams(params);
    setShowProjectDropdown(false);
  };

  const projectFilterLabel = useMemo(() => {
    const count = selectedProjectIds.size + (selectedNoneProject ? 1 : 0);
    if (count === 0) return 'Project';
    if (count === 1 && selectedNoneProject) return 'No Project';
    return `${count} Projects`;
  }, [selectedProjectIds, selectedNoneProject]);

  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, setSearchParams]);

  const fetchOlder = useCallback(async () => {
    if (isFetchingOlder || memos.length >= total) return;

    try {
      setIsFetchingOlder(true);

      // Record scroll height before loading for position preservation
      if (scrollContainerRef.current) {
        previousScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
      }

      const labelParam = selectedLabels.size > 0
        ? Array.from(selectedLabels).join(',')
        : undefined;
      const projectIdFilter = (() => {
        const parts: string[] = [];
        if (selectedNoneProject) parts.push('none');
        if (selectedProjectIds.size > 0) parts.push(...Array.from(selectedProjectIds).map(String));
        return parts.length > 0 ? parts.join(',') : undefined;
      })();
      const searchParam = filters.parsedQuery.freeText;
      const response = await MemosService.listMemos(
        bookmarkFilter ? 'true' : undefined,
        labelParam,
        projectIdFilter,
        searchParam,
        createdFrom || undefined,
        createdTo || undefined,
        PAGE_SIZE,
        memos.length
      );

      setMemos((prev) => [...prev, ...(response?.data || [])]);
      setTotal(response?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more memos');
      console.error('Error loading more memos:', err);
    } finally {
      setIsFetchingOlder(false);
    }
  }, [bookmarkFilter, filters.parsedQuery.freeText, selectedLabels, selectedProjectIds, selectedNoneProject, isFetchingOlder, memos.length, total, createdFrom, createdTo]);

  // Preserve scroll position after older memos are prepended (in reversed view)
  useEffect(() => {
    if (!isFetchingOlder && previousScrollHeightRef.current > 0 && scrollContainerRef.current) {
      const diff = scrollContainerRef.current.scrollHeight - previousScrollHeightRef.current;
      scrollContainerRef.current.scrollTop += diff;
      previousScrollHeightRef.current = 0;
    }
  }, [isFetchingOlder, memos.length]);

  // Pull-to-load: touch gesture to load older memos when at scroll top
  const hasMoreOlder = memos.length < total;
  const PULL_THRESHOLD = 60;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      if (container.scrollTop <= 0 && hasMoreOlder && !isFetchingOlder) {
        touchStartYRef.current = e.touches[0].screenY;
      } else {
        touchStartYRef.current = 0;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartYRef.current) return;
      // Only activate when already at the top
      if (container.scrollTop > 0) {
        touchStartYRef.current = 0;
        setPullDistance(0);
        return;
      }
      const dy = e.touches[0].screenY - touchStartYRef.current;
      if (dy > 0) {
        // Apply resistance: visual distance is less than actual pull
        setPullDistance(Math.min(dy * 0.4, PULL_THRESHOLD * 1.5));
      }
    };

    const onTouchEnd = () => {
      if (pullDistance >= PULL_THRESHOLD && hasMoreOlder && !isFetchingOlder) {
        fetchOlder();
      }
      touchStartYRef.current = 0;
      setPullDistance(0);
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [fetchOlder, hasMoreOlder, isFetchingOlder, pullDistance]);

  const handleCreateMemo = useCallback(async () => {
    const bodyMd = newMemoBody.trim();
    if (!bodyMd || creatingMemo) return;

    // Check if user is near bottom before creating (for conditional auto-scroll)
    const container = scrollContainerRef.current;
    const wasNearBottom = container
      ? (container.scrollHeight - (container.scrollTop + container.clientHeight)) <= 80
      : true;

    try {
      setCreatingMemo(true);
      const created = await MemosService.createMemo({ bodyMd });
      setMemos((prev) => [created as Memo, ...prev]);
      setTotal((prev) => prev + 1);
      setNewMemoBody('');

      // Auto-scroll to bottom only if user was already near the bottom
      if (wasNearBottom) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memo');
      console.error('Error creating memo:', err);
    } finally {
      setCreatingMemo(false);
    }
  }, [creatingMemo, newMemoBody]);

  const handleDelete = async (id: number) => {
    await MemosService.deleteMemo(String(id));
    setMemos(memos.filter((memo) => memo.id !== id));
    setTotal(prev => prev - 1);
  };

  if (loading) {
    return <LoadingState message="Loading memos..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading memos" />;
  }

  return (
    <div className="relative">
      {/* Desktop: intentionally empty — search/filter/count moved into the max-w-4xl container below */}

      <div className="sm:hidden mx-auto flex h-[calc(100dvh-4rem)] max-w-4xl flex-col overflow-hidden bg-white">
        <div className="shrink-0 px-4 pt-2">
          <div className="flex items-center gap-2 mb-4">
            <SearchInput
              value={filters.searchQuery}
              onChange={(value) => {
                const params = updateSearchParam(searchParams, value);
                params.delete('page');
                setSearchParams(params);
              }}
              placeholder="Search memos"
              searchMode={searchMode}
              onSearchModeChange={setSearchMode}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2 items-center" ref={dropdownRef}>
            <LabelFilterDropdown
              selectedLabels={selectedLabels}
              onToggle={handleLabelToggle}
              onClear={handleClearLabels}
              countKey="memoCount"
            />

            {/* Project filter dropdown */}
            {projects.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                    selectedProjectIds.size > 0 || selectedNoneProject
                      ? 'bg-github-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {projectFilterLabel}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProjectDropdown && (
                  <div className="absolute top-full left-0 mt-1 min-w-[280px] max-w-[400px] bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                    {(selectedProjectIds.size > 0 || selectedNoneProject) && (
                      <button
                        onClick={handleClearProjects}
                        className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={handleNoneProjectToggle}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selectedNoneProject ? 'currentColor' : 'none'}>
                        {selectedNoneProject ? (
                          <path className="text-github-green-600" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        ) : (
                          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-300" />
                        )}
                      </svg>
                      <span className="text-gray-500 italic truncate">No Project</span>
                    </button>
                    {projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectToggle(project.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selectedProjectIds.has(project.id) ? 'currentColor' : 'none'}>
                          {selectedProjectIds.has(project.id) ? (
                            <path className="text-github-green-600" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          ) : (
                            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-300" />
                          )}
                        </svg>
                        <span className="text-gray-700 truncate">{project.name}</span>
                        <span className="text-xs text-gray-400 ml-auto shrink-0">{PROJECT_STATUS_LABELS[project.status] || project.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DateRangeFilterDropdown
              dateFrom={createdFrom}
              dateTo={createdTo}
              onChange={handleDateRangeChange}
              onClear={handleDateRangeClear}
            />

            <button
              onClick={() => handleBookmarkFilterChange(!bookmarkFilter)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                bookmarkFilter
                  ? 'bg-github-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bookmarked
            </button>
          </div>

          <div className="text-sm text-gray-500 mb-2">
            {total} {total === 1 ? 'memo' : 'memos'}
            {hasActiveFilters && copyExportItemIds.length > 0 && (
              <CopyResultsButtons
                type="memos"
                filters={copyExportFilters}
                itemIds={copyExportItemIds}
                matchedComments={matchSnippets}
                matchedScores={relevanceScores}
              />
            )}
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-2"
        >
          {mobileFilteredMemos.length === 0 ? (
            <EmptyState
              message={bookmarkFilter ? 'No bookmarked memos' : 'No memos yet'}
              submessage={!bookmarkFilter ? 'Create your first memo to get started' : undefined}
            />
          ) : (
            <>
              {/* Pull-to-load indicator */}
              <div
                className="text-center overflow-hidden transition-all duration-150"
                style={{ height: pullDistance > 0 ? `${pullDistance}px` : undefined }}
              >
                {isFetchingOlder ? (
                  <span className="text-xs text-gray-400 leading-8">Loading older memos...</span>
                ) : hasMoreOlder && pullDistance > 0 ? (
                  <span className="text-xs text-gray-400 leading-8">
                    {pullDistance >= PULL_THRESHOLD ? 'Release to load' : 'Pull down to load older'}
                  </span>
                ) : !hasMoreOlder && memos.length > PAGE_SIZE ? (
                  <span className="text-xs text-gray-400 py-3 block">No older memos</span>
                ) : null}
              </div>

              <div ref={timelineContainerRef}>
                {mobileFilteredMemos.map((memo, index) => {
                  const prev = index > 0 ? mobileFilteredMemos[index - 1] : null;
                  const currentBucket = getTimelineDateBucket(memo.createdAt);
                  const previousBucket = prev ? getTimelineDateBucket(prev.createdAt) : null;
                  const itemPath = createItemDetailUrl({ basePath: '/memos', itemId: memo.id, currentFilters: searchParams });

                  return (
                    <div key={memo.id} className="py-1.5">
                      {currentBucket !== previousBucket && (
                        <div className="flex items-center gap-3 py-2">
                          <span className="text-[13px] font-medium text-gray-500">{currentBucket}</span>
                          <span className="h-px flex-1 bg-gray-200" />
                        </div>
                      )}
                      {(currentBucket !== previousBucket || shouldShowGapTimestamp(prev?.createdAt ?? null, memo.createdAt)) && (
                        <div className="pb-0.5 text-[11px] text-gray-400">{formatTimelineTime(memo.createdAt)}</div>
                      )}

                      <div className="flex items-start gap-2.5">
                        <Link to={itemPath} className="min-w-0 flex-1">
                          <MemoBody bodyMd={memo.bodyMd} />
                          {memo.labels && memo.labels.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {memo.labels.map((label) => (
                                <LabelBadge key={`${memo.id}-${label}`} name={label} />
                              ))}
                            </div>
                          )}
                          {matchSnippets[memo.id] && filters.parsedQuery.freeText && (
                            <div className="text-xs text-gray-500 mt-1.5">
                              {highlightKeyword(extractSnippet(matchSnippets[memo.id], filters.parsedQuery.freeText), filters.parsedQuery.freeText)}
                            </div>
                          )}
                          {relevanceScores[memo.id] != null && (
                            <RelevanceIndicator score={relevanceScores[memo.id]} />
                          )}
                        </Link>

                        {(memo.commentCount ?? 0) > 0 && (
                          <Link to={itemPath} className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                              <path d="M2.5 2.5h11v8h-4l-3 3v-3h-4z" />
                            </svg>
                            {memo.commentCount ?? 0}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <MobileFloatingComposer
          value={newMemoBody}
          onChange={setNewMemoBody}
          onSubmit={handleCreateMemo}
          placeholder="Write a memo..."
          submitLabel="Create memo"
          disabled={creatingMemo}
          submitting={creatingMemo}
        />
      </div>

      <div className="hidden sm:block max-w-4xl mx-auto bg-transparent px-4 py-2">
        <div className="flex items-center gap-2 mb-4">
          <SearchInput
            value={filters.searchQuery}
            onChange={(value) => {
              const params = updateSearchParam(searchParams, value);
              params.delete('page');
              setSearchParams(params);
            }}
            placeholder="Search memos"
            searchMode={searchMode}
            onSearchModeChange={setSearchMode}
          />
          <Link
            to="/memos/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 whitespace-nowrap"
          >
            New Memo
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <LabelFilterDropdown
            selectedLabels={selectedLabels}
            onToggle={handleLabelToggle}
            onClear={handleClearLabels}
            countKey="memoCount"
          />

          {/* Project filter dropdown (desktop) */}
          {projects.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                  selectedProjectIds.size > 0 || selectedNoneProject
                    ? 'bg-github-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {projectFilterLabel}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProjectDropdown && (
                <div className="absolute top-full left-0 mt-1 min-w-[280px] max-w-[400px] bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                  {(selectedProjectIds.size > 0 || selectedNoneProject) && (
                    <button
                      onClick={handleClearProjects}
                      className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleNoneProjectToggle}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selectedNoneProject ? 'currentColor' : 'none'}>
                      {selectedNoneProject ? (
                        <path className="text-github-green-600" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      ) : (
                        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-300" />
                      )}
                    </svg>
                    <span className="text-gray-500 italic truncate">No Project</span>
                  </button>
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectToggle(project.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selectedProjectIds.has(project.id) ? 'currentColor' : 'none'}>
                        {selectedProjectIds.has(project.id) ? (
                          <path className="text-github-green-600" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        ) : (
                          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-300" />
                        )}
                      </svg>
                      <span className="text-gray-700 truncate">{project.name}</span>
                      <span className="text-xs text-gray-400 ml-auto shrink-0">{PROJECT_STATUS_LABELS[project.status] || project.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <DateRangeFilterDropdown
            dateFrom={createdFrom}
            dateTo={createdTo}
            onChange={handleDateRangeChange}
            onClear={handleDateRangeClear}
          />

          <button
            onClick={() => handleBookmarkFilterChange(!bookmarkFilter)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              bookmarkFilter
                ? 'bg-github-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Bookmarked
          </button>
        </div>

        <div className="text-sm text-gray-500 mb-2">
          {total} {total === 1 ? 'memo' : 'memos'}
          {semanticMeta && (
            <span className="ml-2 text-gray-400">
              ({semanticMeta.searchTimeMs}ms)
            </span>
          )}
          {hasActiveFilters && copyExportItemIds.length > 0 && (
            <CopyResultsButtons
              type="memos"
              filters={copyExportFilters}
              itemIds={copyExportItemIds}
              matchedComments={matchSnippets}
              matchedScores={relevanceScores}
            />
          )}
        </div>

        {filteredMemos.length === 0 ? (
          <EmptyState
            message={bookmarkFilter ? 'No bookmarked memos' : 'No memos yet'}
            submessage={!bookmarkFilter ? 'Create your first memo to get started' : undefined}
          />
        ) : (
          <>
            <ItemList items={filteredMemos} itemType="memo" basePath="/memos" currentFilters={searchParams} onDelete={handleDelete} matchSnippets={matchSnippets} searchQuery={searchMode === 'keyword' ? filters.parsedQuery.freeText : undefined} relevanceScores={relevanceScores} />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
