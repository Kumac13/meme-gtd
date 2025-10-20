import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div className="p-4"><h1 className="text-2xl font-bold">meme-gtd Web UI</h1><p className="mt-2 text-gray-600">Phase 2 setup complete. User story pages will be added in Phase 3+.</p></div>} />
          {/* User Story routes will be added in Phase 3+ */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
