import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WIDE_PAGE_WIDTH } from '../utils/pageWidth';

interface FormPageLayoutProps {
  backTo: string;
  backLabel: string;
  title: ReactNode;
  children: ReactNode;
  /** sm 以上で画面幅の8割まで広げる（Issue 系の作成・編集用）。既定は max-w-4xl。 */
  wide?: boolean;
}

/** Shared page chrome for create and edit forms. */
export default function FormPageLayout({ backTo, backLabel, title, children, wide = false }: FormPageLayoutProps) {
  return (
    <div className={`${wide ? WIDE_PAGE_WIDTH : 'max-w-4xl px-4'} mx-auto py-2`}>
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
