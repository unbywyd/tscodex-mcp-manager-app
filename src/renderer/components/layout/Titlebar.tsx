import { useState, useEffect } from 'react';
import { Minus, Square, Maximize2, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { SignInModal } from '../auth/SignInModal';
import { UserMenu } from '../auth/UserMenu';
import { AIAssistantButton } from '../ai/AIAssistantButton';
import { UpdateButton } from '../updater/UpdateNotification';
import logoImage from '../../assets/logo.png';

export function Titlebar() {
  const { profile } = useAppStore();
  const [showSignIn, setShowSignIn] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Get initial state
    window.electronAPI?.isMaximized().then(setIsMaximized);

    // Subscribe to state changes
    const unsubscribeMaximized = window.electronAPI?.onMaximized(() => setIsMaximized(true));
    const unsubscribeUnmaximized = window.electronAPI?.onUnmaximized(() => setIsMaximized(false));

    return () => {
      unsubscribeMaximized?.();
      unsubscribeUnmaximized?.();
    };
  }, []);

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
        </div>

        {/* Center: Empty for drag */}
        <div className="flex-1" />

        {/* Right: Profile & Window controls */}
        <div className="flex items-center gap-4 titlebar-no-drag">
          {/* Update Button */}
          <UpdateButton />

          {/* AI Assistant Button */}
          <AIAssistantButton />

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
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
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
