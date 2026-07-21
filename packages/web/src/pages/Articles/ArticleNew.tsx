import ArticleForm from '../../components/ArticleForm';
import FormPageLayout from '../../components/FormPageLayout';
import TemplateCreationFlow from '../../components/TemplateCreationFlow';

/**
 * New Article page. Same flow as New Task: a pre-screen chooses Blank or an
 * article-target template (the template's body/labels/projects prefill the
 * form; the title stays empty).
 */
export default function ArticleNew() {
  return (
    <FormPageLayout backTo="/articles" backLabel="Back to articles" title="Create New Article">
        <TemplateCreationFlow target="article">
          {(initialValues) => (
            <ArticleForm
              initialBodyMd={initialValues.bodyMd}
              initialLabelIds={initialValues.labelIds}
              initialProjectIds={initialValues.projectIds}
            />
          )}
        </TemplateCreationFlow>
    </FormPageLayout>
  );
}
