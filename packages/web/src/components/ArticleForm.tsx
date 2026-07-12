import { useNavigate } from 'react-router-dom';
import { ArticlesService } from '../api/services/ArticlesService';
import { ProjectsService } from '../api/services/ProjectsService';
import { LinksService } from '../api/services/LinksService';
import { UrlLinksService } from '../api/services/UrlLinksService';
import { isPendingIssueLink, isPendingUrlLink } from '../types/links';
import type { PendingLink } from '../types/links';
import IssueForm, { type IssueFormValues } from './IssueForm';

interface ArticleFormProps {
  initialTitle?: string;
  initialBodyMd?: string;
  initialLabelIds?: number[];
  initialProjectIds?: number[];
  initialLinks?: PendingLink[];
}

/**
 * Manual article creation form. A thin wrapper over the shared IssueForm
 * (same construction as TaskForm/TemplateForm): no article-specific extra
 * fields — a manual article is title + body + labels/projects/links. The
 * created article gets origin='manual' server-side (no originalUrl).
 */
export default function ArticleForm({
  initialTitle = '',
  initialBodyMd = '',
  initialLabelIds = [],
  initialProjectIds,
  initialLinks = [],
}: ArticleFormProps) {
  const navigate = useNavigate();

  const handleSubmit = async (values: IssueFormValues) => {
    const article = await ArticlesService.createArticle({
      title: values.title,
      bodyMd: values.bodyMd,
      labels: values.labelNames,
    });

    if (values.projectIds.length > 0) {
      await Promise.all(
        values.projectIds.map((projectId) =>
          ProjectsService.addProjectItem(projectId.toString(), { issueId: article.id })
        )
      );
    }

    if (values.links.length > 0) {
      const linkResults = await Promise.allSettled([
        ...values.links.filter(isPendingIssueLink).map((link) =>
          LinksService.createLink({
            sourceIssueId: article.id,
            targetIssueId: link.targetIssueId,
            linkType: link.linkType,
          })
        ),
        ...values.links.filter(isPendingUrlLink).map((link) =>
          UrlLinksService.createUrlLink(String(article.id), { url: link.url, title: link.title })
        ),
      ]);
      const failed = linkResults.filter((r) => r.status === 'rejected');
      if (failed.length > 0) console.warn(`Failed to create ${failed.length} link(s):`, failed);
    }

    navigate(`/articles/${article.id}`);
  };

  return (
    <IssueForm
      initialTitle={initialTitle}
      initialBodyMd={initialBodyMd}
      initialLabelIds={initialLabelIds}
      initialProjectIds={initialProjectIds}
      initialLinks={initialLinks}
      titleLabel="Article Title *"
      titlePlaceholder="Enter article title..."
      bodyLabel="Article Body (Markdown)"
      bodyPlaceholder="Write the article in Markdown format..."
      submitLabel="Create Article"
      errorTitle="Error saving article"
      onSubmit={handleSubmit}
      onCancel={() => navigate('/articles')}
    />
  );
}
