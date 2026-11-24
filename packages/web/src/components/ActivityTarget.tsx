import { Link } from 'react-router-dom';

interface ActivityTargetProps {
  id: number | null;
  type: string;
  title: string | null;
  to: string | null;
}

const symbols: Record<string, string> = {
  memo: 'M4 3h12v10l-5 5H4z M10 18v-6h6 M7 7h6',
  article: 'M2 4h16v13H2z M5 7h4v4H5z M12 7h3 M12 10h3 M5 14h10',
  task: 'M3 3h14v14H3z M6 10l3 3 5-7',
};

export function ActivityTarget({ id, type, title, to }: ActivityTargetProps) {
  const label = [type, id != null && `#${id}`, title].filter(Boolean).join(' ');
  const style = 'flex h-[30px] min-w-0 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 text-[13px] text-neutral-800';
  const content = <>
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-github-green-600" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round">
      <path d={symbols[type] ?? 'M4 3h12v14H4z'} />
    </svg>
    {id != null && <span className="shrink-0 text-xs">#{id}</span>}
    <span className="truncate font-medium">{title}</span>
  </>;
  return to
    ? <Link to={to} aria-label={label} title={label} className={style}>{content}</Link>
    : <span title={label} className={style}>{content}</span>;
}
