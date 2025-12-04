import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, ArrowUpCircle, Package } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { ServerInfo } from '../../../shared/types';

interface UpdateCheckModalProps {
  server: ServerInfo;
  onClose: () => void;
}

interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
}

export function UpdateCheckModal({ server, onClose }: UpdateCheckModalProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const { checkServerUpdate, updateServer, fetchServers } = useAppStore();

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const result = await checkServerUpdate(server.id);
      setUpdateInfo({
        hasUpdate: result.hasUpdate,
        currentVersion: result.currentVersion || server.packageVersion || null,
        latestVersion: result.latestVersion,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (!updateInfo?.latestVersion) return;

    setIsUpdating(true);
    setError(null);

    try {
      await updateServer(server.id, updateInfo.latestVersion);
      setUpdateSuccess(true);
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-card border border-border-default rounded-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Check for Updates</h2>
          </div>
          <button onClick={onClose} className="btn-icon" disabled={isUpdating}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Server info */}
          <div className="mb-6">
            <h3 className="font-medium text-lg">{server.displayName}</h3>
            <p className="text-sm text-gray-500 font-mono">{server.packageName}</p>
          </div>

          {/* Loading state */}
          {isChecking && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-gray-400">Checking for updates...</p>
            </div>
          )}

          {/* Error state */}
          {error && !isChecking && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Update success */}
          {updateSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <p className="font-medium text-green-400">Update successful!</p>
                  <p className="text-sm text-gray-400">
                    Server updated to v{updateInfo?.latestVersion}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Update info */}
          {!isChecking && updateInfo && !updateSuccess && (
            <div className="space-y-4">
              {/* Version comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Current version</p>
                  <p className="font-mono text-lg">
                    {updateInfo.currentVersion || 'unknown'}
                  </p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Latest version</p>
                  <p className="font-mono text-lg">
                    {updateInfo.latestVersion || 'unknown'}
                  </p>
                </div>
              </div>

              {/* Update available message */}
              {updateInfo.hasUpdate ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <ArrowUpCircle className="w-6 h-6 text-green-400" />
                    <div>
                      {updateInfo.currentVersion === 'unknown' ? (
                        <>
                          <p className="font-medium text-green-400">Version not fixed</p>
                          <p className="text-sm text-gray-400">
                            Fix version to {updateInfo.latestVersion} for faster startup
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-green-400">Update available</p>
                          <p className="text-sm text-gray-400">
                            {updateInfo.currentVersion} → {updateInfo.latestVersion}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="font-medium">You're up to date</p>
                      <p className="text-sm text-gray-500">
                        You have the latest version installed
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-default">
          {updateSuccess ? (
            <button onClick={onClose} className="btn btn-primary">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn btn-secondary" disabled={isUpdating}>
                Close
              </button>
              {updateInfo?.hasUpdate && !isChecking && (
                <button
                  onClick={handleUpdate}
                  className="btn btn-primary"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                      {updateInfo.currentVersion === 'unknown' ? 'Fix to' : 'Update to'} {updateInfo.latestVersion}
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
