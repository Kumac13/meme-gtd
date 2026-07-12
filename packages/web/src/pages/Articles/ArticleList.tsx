import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import { SearchService } from "../../api/services/SearchService";
import { ProjectsService } from "../../api/services/ProjectsService";
import SearchInput from "../../components/SearchInput";
import ItemList from "../../components/ItemList";
import LabelFilterDropdown from "../../components/LabelFilterDropdown";
import FilterBar from "../../components/FilterBar";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import Pagination from "../../components/Pagination";
import CopyResultsButtons from "../../components/CopyResultsButtons";
import {
  validateBookmarked,
  updateBookmarkedParam,
  updateSearchParam,
  parseLabelParam,
  updateLabelParam,
} from "../../utils/urlFilterHelpers";
import { PROJECT_STATUS_LABELS, sortProjectsByStatus } from "../../utils/projectStatus";
import type { Article } from "meme-gtd-shared";

interface Project {
  id: number;
  name: string;
  status: string;
}

const PAGE_SIZE = 20;

export const ArticleList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchSnippets, setMatchSnippets] = useState<Record<number, string>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filters from URL (same parameter names as tasks)
  const searchQuery = searchParams.get("q") || "";
  const bookmarkFilter = validateBookmarked(searchParams.get("bookmarked"));
  const selectedLabels = useMemo(() => parseLabelParam(searchParams.get("label")), [searchParams]);
  const rawOrigin = searchParams.get("origin");
  const originFilter = rawOrigin === "web" || rawOrigin === "manual" ? rawOrigin : "all";

  const projectIdParam = searchParams.get("projectId") || "";
  const selectedProjectIds = useMemo(() => {
    if (!projectIdParam) return new Set<number>();
    return new Set(
      projectIdParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== "none")
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id))
    );
  }, [projectIdParam]);
  const selectedNoneProject = useMemo(
    () => projectIdParam.split(",").map((s) => s.trim()).includes("none"),
    [projectIdParam]
  );

  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Load projects for the filter dropdown
  useEffect(() => {
    ProjectsService.listProjects()
      .then((data) => {
        const mapped = data.map((p) => ({ id: p.id, name: p.name, status: p.status }));
        setProjects(sortProjectsByStatus(mapped));
      })
      .catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        setError(null);

        const offset = (currentPage - 1) * PAGE_SIZE;
        const labelParam = selectedLabels.size > 0 ? Array.from(selectedLabels).join(",") : undefined;
        const projectIdFilter = (() => {
          const parts: string[] = [];
          if (selectedNoneProject) parts.push("none");
          if (selectedProjectIds.size > 0) parts.push(...Array.from(selectedProjectIds).map(String));
          return parts.length > 0 ? parts.join(",") : undefined;
        })();

        if (searchQuery) {
          // Keyword search (same as tasks): matches title/body/comments and
          // returns snippets for highlighting.
          const response = await SearchService.keywordSearch(
            searchQuery,
            PAGE_SIZE,
            offset,
            "article",
            undefined,
            labelParam,
            bookmarkFilter ? "true" : undefined
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
            if (match) {
              if (match.field === "comment") {
                snippets[r.id] = match.text;
              } else {
                const isTitleMatch = r.title && match.text === r.title;
                if (!isTitleMatch) {
                  snippets[r.id] = match.text;
                }
              }
            }
          }
          setMatchSnippets(snippets);
          setArticles(mapped as unknown as Article[]);
          setTotal(response.total);
        } else {
          setMatchSnippets({});
          const response = await ArticlesService.listArticles(
            PAGE_SIZE,
            offset,
            undefined,
            labelParam,
            projectIdFilter,
            bookmarkFilter ? "true" : undefined,
            originFilter === "all" ? undefined : originFilter
          );
          setArticles((response?.data || []) as unknown as Article[]);
          setTotal(response?.total || 0);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, [searchQuery, currentPage, selectedLabels, projectIdParam, selectedProjectIds, selectedNoneProject, bookmarkFilter, originFilter]);

  const handleSearchChange = (value: string) => {
    const params = updateSearchParam(searchParams, value);
    params.delete("page");
    setSearchParams(params);
  };

  const handleBookmarkFilterChange = (newBookmarked: boolean) => {
    const params = updateBookmarkedParam(searchParams, newBookmarked);
    params.delete("page");
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
    params.delete("page");
    setSearchParams(params);
  };

  const handleClearLabels = () => {
    const params = updateLabelParam(searchParams, new Set());
    params.delete("page");
    setSearchParams(params);
  };

  const handleOriginChange = (origin: string) => {
    const params = new URLSearchParams(searchParams);
    if (origin === "all") {
      params.delete("origin");
    } else {
      params.set("origin", origin);
    }
    params.delete("page");
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
    if (selectedNoneProject) parts.push("none");
    parts.push(...Array.from(newIds).map(String));
    if (parts.length === 0) {
      params.delete("projectId");
    } else {
      params.set("projectId", parts.join(","));
    }
    params.delete("page");
    setSearchParams(params);
  };

  const handleNoneProjectToggle = () => {
    const params = new URLSearchParams(searchParams);
    const parts: string[] = [];
    if (!selectedNoneProject) parts.push("none");
    if (selectedProjectIds.size > 0) parts.push(...Array.from(selectedProjectIds).map(String));
    if (parts.length === 0) {
      params.delete("projectId");
    } else {
      params.set("projectId", parts.join(","));
    }
    params.delete("page");
    setSearchParams(params);
  };

  const handleClearProjects = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("projectId");
    params.delete("page");
    setSearchParams(params);
    setShowProjectDropdown(false);
  };

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams);
      if (page === 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [searchParams, setSearchParams]
  );

  const handleDelete = async (id: number) => {
    await ArticlesService.deleteArticle(String(id));
    setArticles(articles.filter((article) => article.id !== id));
    setTotal((prev) => prev - 1);
  };

  const projectFilterLabel = useMemo(() => {
    const count = selectedProjectIds.size + (selectedNoneProject ? 1 : 0);
    if (count === 0) return "Project";
    if (count === 1 && selectedNoneProject) return "No Project";
    return `${count} Projects`;
  }, [selectedProjectIds, selectedNoneProject]);

  const hasActiveFilters = useMemo(
    () =>
      !!searchQuery ||
      selectedLabels.size > 0 ||
      bookmarkFilter ||
      selectedProjectIds.size > 0 ||
      selectedNoneProject ||
      originFilter !== "all",
    [searchQuery, selectedLabels, bookmarkFilter, selectedProjectIds, selectedNoneProject, originFilter]
  );

  const copyExportFilters = useMemo(() => {
    const result: { query?: string; labels?: string[]; bookmarked?: boolean; projectIds?: number[]; includeNoProject?: boolean } = {};
    if (searchQuery) result.query = searchQuery;
    if (selectedLabels.size > 0) result.labels = Array.from(selectedLabels);
    if (bookmarkFilter) result.bookmarked = true;
    if (selectedProjectIds.size > 0) result.projectIds = Array.from(selectedProjectIds);
    if (selectedNoneProject) result.includeNoProject = true;
    return result;
  }, [searchQuery, selectedLabels, bookmarkFilter, selectedProjectIds, selectedNoneProject]);
  const copyExportItemIds = useMemo(() => articles.map((a) => a.id), [articles]);

  if (loading) {
    return <LoadingState message="Loading articles..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading articles" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center gap-2 mb-4">
        <SearchInput value={searchQuery} onChange={handleSearchChange} placeholder="Search articles" />
        <Link
          to="/articles/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-github-green-600 hover:bg-github-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-github-green-500 whitespace-nowrap"
        >
          New Article
        </Link>
      </div>

      {/* Filters row: Label, Project, Bookmark (same as tasks) */}
      <div className="mb-4 flex flex-wrap gap-2 items-center" ref={dropdownRef}>
        <LabelFilterDropdown
          selectedLabels={selectedLabels}
          onToggle={handleLabelToggle}
          onClear={handleClearLabels}
          countKey="articleCount"
        />

        {projects.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                selectedProjectIds.size > 0 || selectedNoneProject
                  ? "bg-github-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selectedNoneProject ? "currentColor" : "none"}>
                    {selectedNoneProject ? (
                      <path className="text-github-green-600" fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    ) : (
                      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-gray-300" />
                    )}
                  </svg>
                  <span className="text-gray-500 italic truncate">No Project</span>
                </button>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectToggle(project.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill={selectedProjectIds.has(project.id) ? "currentColor" : "none"}>
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

        <button
          onClick={() => handleBookmarkFilterChange(!bookmarkFilter)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            bookmarkFilter ? "bg-github-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Bookmarked
        </button>
      </div>

      {/* Origin filter row (issues.origin): All / Web / Manual */}
      <FilterBar
        showStatusFilter
        statusFilter={originFilter}
        onStatusFilterChange={handleOriginChange}
        statusOptions={["all", "web", "manual"]}
        statusLabels={{ web: "Web", manual: "Manual" }}
        showBookmarkFilter={false}
      />

      {articles.length === 0 ? (
        <EmptyState
          message={hasActiveFilters ? "No articles match your filters" : "No articles yet"}
          submessage={
            hasActiveFilters
              ? "Try different filters"
              : "Save web pages with the browser extension, or create one with New Article"
          }
        />
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-2">
            {total} {total === 1 ? "article" : "articles"}
            {hasActiveFilters && copyExportItemIds.length > 0 && (
              <CopyResultsButtons type="articles" filters={copyExportFilters} itemIds={copyExportItemIds} />
            )}
          </div>
          <ItemList
            items={articles}
            itemType="article"
            basePath="/articles"
            currentFilters={searchParams}
            onDelete={handleDelete}
            matchSnippets={matchSnippets}
            searchQuery={searchQuery || undefined}
          />
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
};
