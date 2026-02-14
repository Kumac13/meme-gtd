import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const isMemosRoute = location.pathname === "/" || location.pathname.startsWith("/memos");
  const isMemosActive = location.pathname.startsWith("/memos");
  const isTasksActive = location.pathname.startsWith("/tasks");
  const isProjectsActive = location.pathname.startsWith("/projects");
  const isCalendarActive = location.pathname.startsWith("/calendar");
  const isArticlesActive = location.pathname.startsWith("/articles");
  const isActivityActive = location.pathname.startsWith("/activity");

  return (
    <div className={isMemosRoute ? "min-h-screen bg-white sm:bg-gray-50" : "min-h-screen bg-gray-50"}>
      <header className={isMemosRoute ? "bg-white shadow border-b border-gray-200 sm:border-b-0" : "bg-white shadow"}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex w-full sm:w-auto">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="hidden sm:block text-xl font-bold text-gray-900">Mëmo</h1>
              </div>
              <div className="flex justify-around w-full sm:justify-start sm:w-auto sm:ml-6 sm:space-x-8">
                <Link
                  to="/memos"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isMemosActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Memos
                </Link>
                <Link
                  to="/tasks"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isTasksActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Tasks
                </Link>
                <Link
                  to="/projects"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isProjectsActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Projects
                </Link>
                <Link
                  to="/articles"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isArticlesActive // Use new active state
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Articles
                </Link>
                <Link
                  to="/calendar"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isCalendarActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Calendar
                </Link>
                <Link
                  to="/activity"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActivityActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Activity
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </header>
      <main className={isMemosRoute ? "max-w-7xl mx-auto sm:py-4 sm:px-6 lg:px-8 bg-white sm:bg-transparent" : "max-w-7xl mx-auto py-4 sm:px-6 lg:px-8"}>
        <Outlet />
      </main>
    </div>
  );
}
