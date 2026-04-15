import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import SearchInput from "../../components/SearchInput";
import ItemList from "../../components/ItemList";
import LoadingState from "../../components/LoadingState";
import ErrorState from "../../components/ErrorState";
import EmptyState from "../../components/EmptyState";
import Pagination from "../../components/Pagination";
import CopyResultsButtons from "../../components/CopyResultsButtons";
import type { Article } from "meme-gtd-shared";

const PAGE_SIZE = 20;

export const ArticleList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const searchQuery = searchParams.get('q') || '';

  // Pagination state from URL
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);

        // Calculate offset for pagination
        const offset = (currentPage - 1) * PAGE_SIZE;

        const response = await ArticlesService.listArticles(PAGE_SIZE, offset, searchQuery || undefined);
        setArticles((response?.data || []) as unknown as Article[]);
        setTotal(response?.total || 0);
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
  }, [searchQuery, currentPage]);

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    params.delete('page'); // Reset to page 1 when searching
    setSearchParams(params);
  };

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

  const handleDelete = async (id: number) => {
    await ArticlesService.deleteArticle(String(id));
    setArticles(articles.filter((article) => article.id !== id));
    setTotal(prev => prev - 1);
  };

  const copyExportFilters = useMemo(() => {
    const result: { query?: string } = {};
    if (searchQuery) result.query = searchQuery;
    return result;
  }, [searchQuery]);
  const copyExportItemIds = useMemo(
    () => articles.map((a) => a.id),
    [articles]
  );

  if (loading) {
    return <LoadingState message="Loading articles..." />;
  }

  if (error) {
    return <ErrorState error={error} title="Error loading articles" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-4">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search articles"
        />
      </div>

      {articles.length === 0 ? (
        <EmptyState
          message="No articles saved"
          submessage="Use the browser extension to save web pages"
        />
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-2">
            {total} {total === 1 ? 'article' : 'articles'}
            {!!searchQuery && copyExportItemIds.length > 0 && (
              <CopyResultsButtons
                type="articles"
                filters={copyExportFilters}
                itemIds={copyExportItemIds}
              />
            )}
          </div>
          <ItemList
            items={articles}
            itemType="article"
            basePath="/articles"
            currentFilters={searchParams}
            onDelete={handleDelete}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};
