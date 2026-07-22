import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface FormPageLayoutProps {
  backTo: string;
  backLabel: string;
  title: ReactNode;
  children: ReactNode;
}

/** Shared page chrome for create and edit forms. */
export default function FormPageLayout({ backTo, backLabel, title, children }: FormPageLayoutProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-2">
      <div className="mb-6">
        <Link
          to={backTo}
          className="text-github-green-600 hover:text-github-green-800 text-sm font-medium mb-4 inline-block"
        >
          ← {backLabel}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">{children}</div>
    </div>
  );
}
