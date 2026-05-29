import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-lg">⏰</span>
          <span className="font-display font-bold text-slate-900 text-base">CronHub</span>
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">{user.name}</span>
            <button onClick={() => { logout(); navigate('/login'); }}
              className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
