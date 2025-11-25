import { Navigate } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * Redirects to the appropriate default view for a project:
 * - Mobile: List view (better for small screens)
 * - Desktop: Kanban view
 */
export default function ProjectDefaultRedirect() {
  const isMobile = useMediaQuery('(max-width: 639px)');

  return <Navigate to={isMobile ? 'list' : 'kanban'} replace />;
}
