import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArticlesService } from "../../api/services/ArticlesService";
import { MarkdownRenderer } from "../../components/Article/MarkdownRenderer";
import { LabelsSection } from "../../components/LabelsSection";
import LinkSection from "../../components/LinkSection";
// import CommentSection from "../../components/CommentSection";
// import { CommentsService } from "../../api/services/CommentsService";
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
      } catch (err: any) {
        setError(err.message || "Failed to load article");
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
    } catch (err: any) {
      alert("Failed to delete: " + (err.message || "Unknown error"));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading article...</div>;
  if (error || !article) return <div className="p-8 text-center text-red-500">Error: {error || "Article not found"}</div>;

  return (
    <div className="container mx-auto p-4 flex gap-6 max-w-7xl flex-col lg:flex-row">
      <div className="flex-1 min-w-0">
        <header className="mb-6 border-b pb-4">
          <h1 className="text-3xl font-serif font-bold mb-2 text-gray-900 dark:text-gray-100">{article.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 items-center">
            {article.meta && (article.meta as any).siteName && (
              <span className="font-medium text-gray-700 dark:text-gray-300">{(article.meta as any).siteName}</span>
            )}
            {article.meta && (article.meta as any).archivedAt && (
              <time dateTime={(article.meta as any).archivedAt}>
                Saved: {new Date((article.meta as any).archivedAt).toLocaleDateString()}
              </time>
            )}
            {article.meta && (article.meta as any).originalUrl && (
              <a 
                href={(article.meta as any).originalUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline truncate max-w-xs"
              >
                Original Link
              </a>
            )}
            <button onClick={handleDelete} className="text-red-600 hover:text-red-800 ml-auto px-2 py-1 rounded hover:bg-red-50">
              Delete
            </button>
          </div>
        </header>

        <MarkdownRenderer content={article.bodyMd} />

        <div className="mt-12 pt-6 border-t">
           <h3 className="text-xl font-bold mb-4">Comments</h3>
           <p className="text-gray-500 italic">Comments feature coming soon for articles.</p>
        </div>
      </div>

      <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <LabelsSection
            itemId={article.id}
            itemType="article"
            assignedLabels={article.labels || []}
            onLabelsChanged={handleLabelsChanged}
          />
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <LinkSection
            itemId={article.id}
            itemType="article"
          />
        </div>
      </div>
    </div>
  );
};
