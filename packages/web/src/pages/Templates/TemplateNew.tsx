import FormPageLayout from '../../components/FormPageLayout';
import TemplateForm from '../../components/TemplateForm';

export default function TemplateNew() {
  return (
    <FormPageLayout backTo="/templates" backLabel="Back to templates" title="Create New Template">
      <TemplateForm mode="create" />
    </FormPageLayout>
  );
}
