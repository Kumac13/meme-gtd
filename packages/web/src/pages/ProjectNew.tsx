import FormPageLayout from '../components/FormPageLayout';
import ProjectForm from '../components/ProjectForm';

export default function ProjectNew() {
  return (
    <FormPageLayout backTo="/projects" backLabel="Back to projects" title="Create New Project" wide>
      <ProjectForm mode="create" />
    </FormPageLayout>
  );
}
