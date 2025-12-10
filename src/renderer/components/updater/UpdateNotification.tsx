/**
 * UpdateNotification - Shows update status in the titlebar or as a toast
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, CheckCircle, XCircle, Loader2, X } from 'lucide-react';

type UpdateStatusType = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateStatus {
  status: UpdateStatusType;
  version?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

export function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Get initial status
    window.electronAPI?.getUpdateStatus?.().then(setStatus);

    // Listen for status updates
    const unsubscribe = window.electronAPI?.onUpdateStatus?.((newStatus) => {
      setStatus(newStatus);
      // Reset dismissed state when a new update is available
      if (newStatus.status === 'available') {
        setDismissed(false);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleCheckUpdates = useCallback(() => {
    window.electronAPI?.checkForUpdates?.();
  }, []);

  const handleDownload = useCallback(() => {
    window.electronAPI?.downloadUpdate?.();
  }, []);

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate?.();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render if dismissed or nothing to show
  if (dismissed && status.status !== 'downloaded') {
    return null;
  }

  // Render based on status
  switch (status.status) {
    case 'checking':
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking for updates...</span>
        </div>
      );

    case 'available':
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-md">
          <Download className="w-4 h-4 text-teal-400" />
          <span className="text-sm text-teal-400">
            Update {status.version} available
          </span>
          <button
            onClick={handleDownload}
            className="ml-2 px-2 py-0.5 text-xs bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors"
          >
            Download
          </button>
          <button
            onClick={handleDismiss}
            className="p-0.5 text-gray-500 hover:text-white"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );

    case 'downloading':
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
          <span>Downloading... {status.progress}%</span>
          <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-300"
              style={{ width: `${status.progress || 0}%` }}
            />
          </div>
        </div>
      );

    case 'downloaded':
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-md">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-sm text-green-400">
            Update ready
          </span>
          <button
            onClick={handleInstall}
            className="ml-2 px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Restart & Install
          </button>
        </div>
      );

    case 'error':
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400">
          <XCircle className="w-4 h-4" />
          <span className="truncate max-w-[200px]" title={status.error}>
            Update error
          </span>
          <button
            onClick={handleCheckUpdates}
            className="p-1 hover:bg-gray-700 rounded"
            title="Retry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDismiss}
            className="p-0.5 text-gray-500 hover:text-white"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );

    case 'not-available':
      // Show briefly then hide
      return null;

    default:
      return null;
  }
}

/**
 * Compact update button for titlebar
 */
export function UpdateButton() {
  const [status, setStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    window.electronAPI?.getUpdateStatus?.().then(setStatus);

    const unsubscribe = window.electronAPI?.onUpdateStatus?.((newStatus) => {
      setStatus(newStatus);

      // Show feedback for terminal states
      if (newStatus.status === 'not-available') {
        setFeedbackMessage({ type: 'success', text: 'You have the latest version!' });
        setShowFeedback(true);
        // Auto-hide after 3 seconds
        setTimeout(() => setShowFeedback(false), 3000);
      } else if (newStatus.status === 'error') {
        setFeedbackMessage({ type: 'error', text: newStatus.error || 'Failed to check for updates' });
        setShowFeedback(true);
      } else if (newStatus.status === 'available') {
        setShowDropdown(true);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleCheck = useCallback(() => {
    setShowFeedback(false);
    setFeedbackMessage(null);
    setShowDropdown(true); // Show dropdown immediately to show "checking" state
    window.electronAPI?.checkForUpdates?.();
  }, []);

  const handleDownload = useCallback(() => {
    window.electronAPI?.downloadUpdate?.();
    setShowDropdown(false);
  }, []);

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate?.();
  }, []);

  // Determine button appearance based on status
  const getButtonContent = () => {
    switch (status.status) {
      case 'checking':
        return (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        );
      case 'available':
        return (
          <div className="relative">
            <Download className="w-4 h-4 text-teal-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-teal-500 rounded-full" />
          </div>
        );
      case 'downloading':
        return (
          <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
        );
      case 'downloaded':
        return (
          <div className="relative">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        );
      case 'error':
        return (
          <XCircle className="w-4 h-4 text-red-400" />
        );
      default:
        return (
          <RefreshCw className="w-4 h-4 text-gray-500" />
        );
    }
  };

  const getTitle = () => {
    switch (status.status) {
      case 'checking':
        return 'Checking for updates...';
      case 'available':
        return `Update ${status.version} available`;
      case 'downloading':
        return `Downloading update... ${status.progress}%`;
      case 'downloaded':
        return 'Update ready - click to install';
      case 'error':
        return `Update error: ${status.error}`;
      default:
        return 'Check for updates';
    }
  };

  const handleClick = () => {
    if (status.status === 'downloaded') {
      handleInstall();
    } else if (status.status === 'available') {
      setShowDropdown(!showDropdown);
    } else if (status.status === 'checking' || status.status === 'downloading') {
      // Show current status
      setShowDropdown(true);
    } else {
      handleCheck();
    }
  };

  const closeDropdown = () => {
    setShowDropdown(false);
    setShowFeedback(false);
  };

  // Render dropdown content based on status
  const renderDropdownContent = () => {
    // Show feedback message (up-to-date or error after manual check)
    if (showFeedback && feedbackMessage) {
      return (
        <div className="p-3 w-72">
          <div className={`flex items-start gap-3 ${
            feedbackMessage.type === 'success' ? 'text-green-400' :
            feedbackMessage.type === 'error' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {feedbackMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : feedbackMessage.type === 'error' ? (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Loader2 className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" />
            )}
            <div>
              <p className="text-sm font-medium">
                {feedbackMessage.type === 'success' ? 'Up to date' : 'Update Error'}
              </p>
              <p className="text-xs text-gray-400 mt-1">{feedbackMessage.text}</p>
            </div>
          </div>
          {feedbackMessage.type === 'error' && (
            <button
              onClick={handleCheck}
              className="mt-3 w-full px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      );
    }

    switch (status.status) {
      case 'checking':
        return (
          <div className="p-3 w-64">
            <div className="flex items-center gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <div>
                <p className="text-sm font-medium">Checking for updates...</p>
                <p className="text-xs text-gray-500">Please wait</p>
              </div>
            </div>
          </div>
        );

      case 'available':
        return (
          <div className="p-3 w-72">
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-teal-400">Update Available</p>
                <p className="text-xs text-gray-400 mt-1">
                  Version {status.version} is ready to download.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleDownload}
                className="flex-1 px-3 py-1.5 bg-teal-500 text-white text-sm rounded hover:bg-teal-600 transition-colors"
              >
                Download
              </button>
              <button
                onClick={closeDropdown}
                className="px-3 py-1.5 text-gray-400 text-sm hover:text-white transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        );

      case 'downloading':
        return (
          <div className="p-3 w-72">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-teal-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Downloading update...</p>
                <p className="text-xs text-gray-400 mt-1">Version {status.version}</p>
              </div>
              <span className="text-sm text-teal-400 font-medium">{status.progress || 0}%</span>
            </div>
            <div className="mt-3 w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-300"
                style={{ width: `${status.progress || 0}%` }}
              />
            </div>
          </div>
        );

      case 'downloaded':
        return (
          <div className="p-3 w-72">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-400">Update Ready</p>
                <p className="text-xs text-gray-400 mt-1">
                  Version {status.version} has been downloaded. Restart to install.
                </p>
              </div>
            </div>
            <button
              onClick={handleInstall}
              className="mt-3 w-full px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
            >
              Restart & Install
            </button>
          </div>
        );

      case 'idle':
        // Show checking state when dropdown is manually opened (before check starts)
        if (showDropdown) {
          return (
            <div className="p-3 w-64">
              <div className="flex items-center gap-3 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <div>
                  <p className="text-sm font-medium">Checking for updates...</p>
                  <p className="text-xs text-gray-500">Please wait</p>
                </div>
              </div>
            </div>
          );
        }
        return null;

      case 'not-available':
        // Feedback is shown via showFeedback block above
        return null;

      default:
        return null;
    }
  };

  const shouldShowDropdown = showDropdown || showFeedback;
  const hasDropdownContent = status.status === 'checking' ||
                             status.status === 'available' ||
                             status.status === 'downloading' ||
                             status.status === 'downloaded' ||
                             status.status === 'idle' ||
                             status.status === 'not-available' ||
                             showFeedback;

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="p-1.5 hover:bg-gray-700 rounded transition-colors"
        title={getTitle()}
      >
        {getButtonContent()}
      </button>

      {/* Dropdown */}
      {shouldShowDropdown && hasDropdownContent && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeDropdown}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-bg-primary border border-border-default rounded-lg shadow-lg">
            {renderDropdownContent()}
          </div>
        </>
      )}
    </div>
  );
}
