import MemoForm from '../components/MemoForm';
import FormPageLayout from '../components/FormPageLayout';

export default function MemoNew() {
  return (
    <FormPageLayout wide backTo="/memos" backLabel="Back to memos" title="Create New Memo">
      <MemoForm mode="create" />
    </FormPageLayout>
  );
}
