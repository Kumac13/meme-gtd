import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import { MarkdownRenderer } from "../../components/Article/MarkdownRenderer";
import { LabelsSection } from "../../components/LabelsSection";
import LinkSection from "../../components/LinkSection";
import type { Article } from "meme-gtd-shared";

export const ArticleReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        setLoading(true);
        const data = await ArticlesService.getApiArticles1(Number(id));
        setArticle(data as unknown as Article); 
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load article");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const handleLabelsChanged = async () => {
    if (!id) return;
    try {
      const data = await ArticlesService.getApiArticles1(Number(id));
      setArticle(data as unknown as Article);
    } catch (err) {
      console.error("Failed to refresh article after label change", err);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm("Are you sure you want to delete this article?")) return;
    try {
      await ArticlesService.deleteApiArticles(Number(id));
      navigate("/articles");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to delete: " + message);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading article...</div>;
  if (error || !article) return <div className="p-8 text-center text-red-600">Error: {error || "Article not found"}</div>;

  // Safe access to meta properties
  const meta = article.meta as { siteName?: string; archivedAt?: string; originalUrl?: string } | undefined;

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 max-w-7xl">
      <div className="flex-1 min-w-0 bg-white shadow-sm rounded-lg border border-gray-200 p-8">
        <header className="mb-8 border-b border-gray-100 pb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 leading-tight">
              {article.title}
            </h1>
            <button
              onClick={handleDelete}
              className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Delete Article"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            {meta?.siteName && (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {meta.siteName}
              </span>
            )}
            {meta?.archivedAt && (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(meta.archivedAt).toLocaleDateString()}
              </span>
            )}
            {meta?.originalUrl && (
              <a 
                href={meta.originalUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center text-blue-600 hover:text-blue-800 hover:underline transition-colors group"
              >
                <svg className="w-4 h-4 mr-1.5 text-blue-400 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Original Link
              </a>
            )}
          </div>
        </header>

        <div className="prose prose-lg max-w-none text-gray-800 prose-headings:font-serif prose-headings:font-bold prose-headings:text-gray-900 prose-p:font-serif prose-p:leading-loose prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900">
          <MarkdownRenderer content={article.bodyMd} />
        </div>

        <div className="mt-16 pt-8 border-t border-gray-100">
           <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
             <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
             </svg>
             Comments
           </h3>
           <p className="text-gray-500 italic bg-gray-50 p-4 rounded text-sm text-center">
             Comments feature coming soon for articles.
           </p>
        </div>
      </div>

      <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Properties</h3>
          </div>
          <div className="p-4">
            <LabelsSection
              itemId={article.id}
              itemType="article"
              assignedLabels={article.labels || []}
              onLabelsChanged={handleLabelsChanged}
            />
          </div>
        </div>
        
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Relations</h3>
          </div>
          <div className="p-4">
            <LinkSection
              itemId={article.id}
              itemType="article"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
