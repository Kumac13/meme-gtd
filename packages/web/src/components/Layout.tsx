import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const isMemosRoute = location.pathname === "/" || location.pathname.startsWith("/memos");
  const isMemosActive = location.pathname.startsWith("/memos");
  const isTasksActive = location.pathname.startsWith("/tasks");
  const isProjectsActive = location.pathname.startsWith("/projects");
  const isCalendarActive = location.pathname.startsWith("/calendar");
  const isLinksActive = location.pathname === "/links";
  const isArticlesActive = location.pathname.startsWith("/articles");
  const isTemplatesActive = location.pathname.startsWith("/templates");
  const isActivityActive = location.pathname.startsWith("/activity");
  // Issue 系（Memo / Task / Article / Template / Links）は外枠を画面幅の8割まで広げるため、sm 以上で max-w-7xl の上限を外す
  const isWideRoute = isMemosRoute || isTasksActive || isArticlesActive || isTemplatesActive || isLinksActive;
  const mainWidth = isWideRoute ? "max-w-7xl sm:max-w-none" : "max-w-7xl";

  return (
    <div className={isMemosRoute ? "min-h-screen bg-white sm:bg-gray-50" : "min-h-screen bg-gray-50"}>
      <header className={isMemosRoute ? "bg-white shadow border-b border-gray-200 sm:border-b-0" : "bg-white shadow"}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex min-w-0 w-full sm:w-auto">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="hidden sm:block text-xl font-bold text-gray-900">Mëmo</h1>
              </div>
              <div className="flex min-w-0 w-full justify-between gap-1 overflow-x-auto sm:justify-start sm:w-auto sm:ml-6 sm:gap-8">
                <Link
                  to="/memos"
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isMemosActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Memos
                </Link>
                <Link
                  to="/tasks"
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isTasksActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Tasks
                </Link>
                <Link
                  to="/projects"
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isProjectsActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Projects
                </Link>
                <Link
                  to="/articles"
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isArticlesActive // Use new active state
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Articles
                </Link>
                <Link
                  to="/links"
                  aria-current={isLinksActive ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isLinksActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Links
                </Link>
                <Link
                  to="/templates"
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isTemplatesActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Templates
                </Link>
                <Link
                  to="/calendar"
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isCalendarActive
                      ? "border-github-green-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Calendar
                </Link>
                <Link
                  to="/activity"
                  className={`inline-flex shrink-0 items-center px-1 pt-1 border-b-2 text-sm font-medium ${
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
      <main className={isMemosRoute ? `${mainWidth} mx-auto sm:py-4 sm:px-6 lg:px-8 bg-white sm:bg-transparent` : `${mainWidth} mx-auto py-4 sm:px-6 lg:px-8`}>
        <Outlet />
      </main>
    </div>
  );
}
