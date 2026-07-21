import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import ProjectFilterDropdown from "../../components/ProjectFilterDropdown";
import {
  validateBookmarked,
  updateBookmarkedParam,
  updateSearchParam,
  parseLabelParam,
  updateLabelParam,
} from "../../utils/urlFilterHelpers";
import { sortProjectsByStatus } from "../../utils/projectStatus";
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
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <LabelFilterDropdown
          selectedLabels={selectedLabels}
          onToggle={handleLabelToggle}
          onClear={handleClearLabels}
          countKey="articleCount"
        />

        <ProjectFilterDropdown
          projects={projects}
          selectedIds={selectedProjectIds}
          includesNoProject={selectedNoneProject}
          label={projectFilterLabel}
          onToggle={handleProjectToggle}
          onToggleNoProject={handleNoneProjectToggle}
          onClear={handleClearProjects}
        />

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
