import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import MemosList from './pages/MemosList';
import MemoDetail from './pages/MemoDetail';
import MemoNew from './pages/MemoNew';
import MemoEdit from './pages/MemoEdit';
import TasksList from './pages/TasksList';
import TasksKanban from './pages/TasksKanban';
import TaskDetail from './pages/TaskDetail';
import TaskNew from './pages/TaskNew';
import TaskEdit from './pages/TaskEdit';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/memos" replace />} />
            <Route path="memos" element={<MemosList />} />
            <Route path="memos/new" element={<MemoNew />} />
            <Route path="memos/:id" element={<MemoDetail />} />
            <Route path="memos/:id/edit" element={<MemoEdit />} />
            <Route path="tasks" element={<TasksList />} />
            <Route path="kanban" element={<TasksKanban />} />
            <Route path="tasks/new" element={<TaskNew />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="tasks/:id/edit" element={<TaskEdit />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
