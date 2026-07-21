import { useState } from 'react';
import { Link } from 'react-router-dom';
import ArticleForm from '../../components/ArticleForm';
import TemplateChooser from '../../components/TemplateChooser';

/**
 * New Article page. Same flow as New Task: a pre-screen chooses Blank or an
 * article-target template (the template's body/labels/projects prefill the
 * form; the title stays empty).
 */
export default function ArticleNew() {
  const [phase, setPhase] = useState<'choose' | 'form'>('choose');

  const [initialBody, setInitialBody] = useState<string | undefined>(undefined);
  const [initialLabelIds, setInitialLabelIds] = useState<number[] | undefined>(undefined);
  const [initialProjectIds, setInitialProjectIds] = useState<number[] | undefined>(undefined);

  if (phase === 'choose') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="mb-6">
          <Link to="/articles" className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block">
            ← Back to articles
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Article</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <TemplateChooser
            target="article"
            blankLabel="Blank article"
            onBlank={() => setPhase('form')}
            onTemplate={(template) => {
              setInitialBody(template.bodyMd);
              setInitialLabelIds(template.labelIds);
              setInitialProjectIds(template.projectIds);
              setPhase('form');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to="/articles"
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← Back to articles
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Article</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <ArticleForm
          initialBodyMd={initialBody}
          initialLabelIds={initialLabelIds}
          initialProjectIds={initialProjectIds}
        />
      </div>
    </div>
  );
}
