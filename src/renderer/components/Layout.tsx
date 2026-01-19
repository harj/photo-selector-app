import { Outlet, Link, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 drag-region">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link to="/" className="text-xl font-semibold text-gray-900 no-drag">
              Photo Selector
            </Link>

            <nav className="flex items-center space-x-4 no-drag">
              <Link
                to="/"
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  location.pathname === '/'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Projects
              </Link>
              <Link
                to="/settings"
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  location.pathname === '/settings'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
