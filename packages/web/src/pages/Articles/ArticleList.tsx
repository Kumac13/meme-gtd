import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import type { Article } from "meme-gtd-shared";

export const ArticleList: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const data = await ArticlesService.getApiArticles();
        setArticles(data as unknown as Article[]);
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
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-2 text-gray-500">Loading articles...</div>;
  if (error) return <div className="max-w-4xl mx-auto px-4 py-2 text-red-600">Error: {error}</div>;

  if (articles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h2 className="text-base font-semibold text-gray-900 mb-1">No Articles Saved</h2>
        <p className="text-sm text-gray-500">Use the browser extension to save web pages.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Articles</h1>
      
      {/* List container matching ItemList structure */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
        {articles.map((article) => {
          const meta = article.meta as { siteName?: string; archivedAt?: string; originalUrl?: string } | undefined;
          
          return (
            <div key={article.id} className="relative">
              <Link
                to={`/articles/${article.id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-base font-medium text-gray-900 truncate">
                        {article.title}
                      </h2>
                      {meta?.siteName && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                          {meta.siteName}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-500 space-x-3">
                      <span>#{article.id}</span>
                      {meta?.archivedAt && (
                        <span title={new Date(meta.archivedAt).toLocaleString()}>
                          Saved {new Date(meta.archivedAt).toLocaleDateString()}
                        </span>
                      )}
                      {meta?.originalUrl && (
                        <span className="truncate max-w-xs">{meta.originalUrl}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};