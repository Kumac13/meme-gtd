import { Link, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const isMemosActive = location.pathname.startsWith('/memos');
  const isTasksActive = location.pathname.startsWith('/tasks');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">meme-gtd</h1>
              </div>
              <div className="ml-6 flex space-x-8">
                <Link
                  to="/memos"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isMemosActive
                      ? 'border-github-green-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Memos
                </Link>
                <Link
                  to="/tasks"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isTasksActive
                      ? 'border-github-green-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Tasks
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto py-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
