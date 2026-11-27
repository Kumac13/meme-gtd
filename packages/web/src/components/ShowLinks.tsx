import { IoGitNetworkOutline } from 'react-icons/io5';
import { Link, useLocation } from 'react-router-dom';
import { linksPath } from '../utils/linksUrl';

export default function ShowLinks({ id, onNavigate }: { id: number; onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <Link to={linksPath(id, location.pathname === '/links' ? location.search : '')} onClick={onNavigate}
      className="flex w-fit items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
      <IoGitNetworkOutline className="size-4 shrink-0" aria-hidden />
      Show Links
    </Link>
  );
}
