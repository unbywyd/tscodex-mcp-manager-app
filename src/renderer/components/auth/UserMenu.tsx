import React, { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export function UserMenu() {
  const { profile, logout } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile) return null;

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const initials = profile.fullName
    .split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-bg-hover transition-all"
      >
        <span className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
          {initials}
        </span>
        <span className="hidden sm:inline max-w-[120px] truncate font-medium">
          {profile.fullName}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-bg-primary border border-border-default rounded-lg shadow-xl z-50">
          {/* User Info */}
          <div className="p-4 border-b border-border-default">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-sm font-medium text-white">
                {initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{profile.fullName}</p>
                <p className="text-sm text-gray-400 truncate">{profile.email}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-bg-hover rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
