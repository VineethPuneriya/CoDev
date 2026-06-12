import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Workspace from './pages/Workspace';

/**
 * Main application component.
 * Sets up the routing context and defines the primary application routes:
 * - /login: Authentication page
 * - /dashboard: User dashboard to manage projects
 * - /workspace/:id: The collaborative code editor workspace
 */
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspace/:id" element={<Workspace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
