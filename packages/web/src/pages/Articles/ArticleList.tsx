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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading articles...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;

  if (articles.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-bold mb-2 text-gray-900">No Articles Saved</h2>
        <p>Use the browser extension to save web pages.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Articles</h1>
      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {articles.map((article) => {
            const meta = article.meta as { siteName?: string; archivedAt?: string; originalUrl?: string } | undefined;
            
            return (
              <li key={article.id}>
                <Link
                  to={`/articles/${article.id}`}
                  className="block hover:bg-gray-50 transition duration-150 ease-in-out"
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-600 truncate mb-1">
                        {meta?.siteName || "Unknown Site"}
                      </p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Article
                        </p>
                      </div>
                    </div>
                    <div className="mt-1">
                      <h2 className="text-lg font-semibold text-gray-900 line-clamp-2">
                        {article.title}
                      </h2>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {meta?.originalUrl && (
                            <span className="truncate max-w-md mr-4">
                              {meta.originalUrl}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p>
                          Saved on <time dateTime={meta?.archivedAt}>{meta?.archivedAt ? new Date(meta.archivedAt).toLocaleDateString() : "Unknown date"}</time>
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
