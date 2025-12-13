import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import MemosList from "./pages/MemosList";
import MemoDetail from "./pages/MemoDetail";
import MemoNew from "./pages/MemoNew";
import MemoEdit from "./pages/MemoEdit";
import TasksList from "./pages/TasksList";
import TaskDetail from "./pages/TaskDetail";
import TaskNew from "./pages/TaskNew";
import TaskEdit from "./pages/TaskEdit";
import ProjectsList from "./pages/ProjectsList";
import ProjectNew from "./pages/ProjectNew";
import ProjectDetail from "./pages/ProjectDetail";
import KanbanView from "./pages/KanbanView";
import ListView from "./pages/ListView";
import Calendar from "./pages/Calendar";
import ProjectDefaultRedirect from "./components/ProjectDefaultRedirect";
import { ArticleList } from "./pages/Articles/ArticleList";
import { ArticleReader } from "./pages/Articles/ArticleReader";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NuqsAdapter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/memos" replace />} />
              <Route path="memos" element={<MemosList />} />
              <Route path="memos/new" element={<MemoNew />} />
              <Route path="memos/:id" element={<MemoDetail />} />
              <Route path="memos/:id/edit" element={<MemoEdit />} />
              <Route path="tasks" element={<TasksList />} />
              <Route path="tasks/new" element={<TaskNew />} />
              <Route path="tasks/:id" element={<TaskDetail />} />
              <Route path="tasks/:id/edit" element={<TaskEdit />} />
              <Route path="projects" element={<ProjectsList />} />
              <Route path="projects/new" element={<ProjectNew />} />
              <Route path="projects/:id" element={<ProjectDetail />}>
                <Route index element={<ProjectDefaultRedirect />} />
                <Route path="kanban" element={<KanbanView />} />
                <Route path="list" element={<ListView />} />
              </Route>
              <Route path="calendar" element={<Calendar />} />
              <Route path="articles" element={<ArticleList />} />
              <Route path="articles/:id" element={<ArticleReader />} />
            </Route>
          </Routes>
        </NuqsAdapter>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
