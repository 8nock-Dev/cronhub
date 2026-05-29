import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobDetail from './pages/JobDetail';

function Guard({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="font-mono text-slate-400 text-sm">Loading…</span></div>;
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"      element={<Login />} />
      <Route path="/"           element={<Guard><Dashboard /></Guard>} />
      <Route path="/jobs/:id"   element={<Guard><JobDetail /></Guard>} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}
