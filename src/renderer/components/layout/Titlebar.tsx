import { useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { SignInModal } from '../auth/SignInModal';
import { UserMenu } from '../auth/UserMenu';
import logoImage from '../../assets/logo.png';

export function Titlebar() {
  const { profile, isConnected } = useAppStore();
  const [showSignIn, setShowSignIn] = useState(false);

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <>
      <div className="h-10 bg-bg-secondary border-b border-border-default flex items-center justify-between px-4 titlebar-drag">
        {/* Left: App title */}
        <div className="flex items-center gap-3">
          <img
            src={logoImage}
            alt="MCP Manager"
            className="h-6 w-auto"
          />
          <span className="font-semibold text-sm">MCP Manager</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-status-running' : 'bg-status-stopped'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>

        {/* Center: Empty for drag */}
        <div className="flex-1" />

        {/* Right: Profile & Window controls */}
        <div className="flex items-center gap-4 titlebar-no-drag">
          {/* Profile / Sign In */}
          {profile ? (
            <UserMenu />
          ) : (
            <button
              onClick={() => setShowSignIn(true)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign in
            </button>
          )}

          {/* Window controls */}
          <div className="flex items-center -mr-2">
            <button
              onClick={handleMinimize}
              className="p-2 hover:bg-bg-hover transition-colors"
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={handleMaximize}
              className="p-2 hover:bg-bg-hover transition-colors"
              title="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-red-600 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sign In Modal */}
      <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
    </>
  );
}
