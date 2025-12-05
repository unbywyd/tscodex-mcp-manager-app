import React, { useState, useEffect } from 'react';
import { X, User, Mail, HelpCircle, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const { login } = useAppStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Clear errors when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setEmailError(null);
      setFullNameError(null);
      setFullName('');
      setEmail('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateEmail = (value: string): string | null => {
    if (!value.trim()) {
      return 'Email is required';
    }
    if (!emailRegex.test(value.trim())) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const validateFullName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Full name is required';
    }
    return null;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (value) {
      setEmailError(validateEmail(value));
    } else {
      setEmailError(null);
    }
  };

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFullName(value);
    if (value) {
      setFullNameError(validateFullName(value));
    } else {
      setFullNameError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullNameValidation = validateFullName(fullName);
    const emailValidation = validateEmail(email);

    if (fullNameValidation) {
      setFullNameError(fullNameValidation);
    } else {
      setFullNameError(null);
    }

    if (emailValidation) {
      setEmailError(emailValidation);
    } else {
      setEmailError(null);
    }

    if (fullNameValidation || emailValidation) {
      return;
    }

    setIsLoading(true);

    try {
      await login(fullName.trim(), email.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-primary border border-border-default rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Sign In</h2>
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
              title="What is sign in?"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="btn-icon text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="card p-3 bg-red-950/30 border-red-900">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Full Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none select-none" />
              <input
                type="text"
                value={fullName}
                onChange={handleFullNameChange}
                placeholder="John Doe"
                className={`input ${fullNameError ? 'border-red-500' : ''}`}
                style={{ paddingInlineStart: '2.75rem' }}
                required
                autoFocus
              />
            </div>
            {fullNameError && (
              <p className="text-xs text-red-400 mt-1">{fullNameError}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none select-none" />
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="john@example.com"
                className={`input ${emailError ? 'border-red-500' : ''}`}
                style={{ paddingInlineStart: '2.75rem' }}
                required
              />
            </div>
            {emailError && (
              <p className="text-xs text-red-400 mt-1">{emailError}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading || !!emailError || !!fullNameError || !email.trim() || !fullName.trim()}
              className="btn btn-primary flex-1"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHelpModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-bg-card border border-border-default rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border-default flex-shrink-0">
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold">What is Sign In?</h2>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-none">
                <p className="text-gray-300 leading-relaxed">
                  MCP Manager uses a <strong>pseudo-authorization</strong> system that allows you to identify yourself to MCP servers. When you sign in, you provide your name and email address, which are then sent to MCP servers so they can recognize you as a specific user.
                </p>

                <h3 className="text-white font-medium mt-6 mb-3">How It Works</h3>
                <p className="text-gray-300 leading-relaxed">
                  When you sign in with your name and email, these credentials are stored locally and transmitted to MCP servers along with a unique authentication token. The server is responsible for generating and managing this token, which it uses to verify your identity and provide personalized features.
                </p>

                <h3 className="text-white font-medium mt-6 mb-3">Authentication Token</h3>
                <p className="text-gray-300 leading-relaxed">
                  The authentication token is stored as <code className="px-1.5 py-0.5 bg-bg-secondary rounded font-mono text-sm">SECRET_MCP_AUTH_TOKEN</code> in the server's configuration. This token can be set at three different levels:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 mt-3 ml-2">
                  <li><strong>Globally:</strong> Set in the Global workspace secrets, applying to all workspaces by default</li>
                  <li><strong>Workspace:</strong> Override the global token for a specific workspace</li>
                  <li><strong>Server:</strong> Override both global and workspace tokens for a specific server instance</li>
                </ul>

                <h3 className="text-white font-medium mt-6 mb-3">Configuration</h3>
                <p className="text-gray-300 leading-relaxed">
                  To configure authorization for a server, navigate to the server's configuration page and open the <strong>Connection</strong> tab. In the Authorization section, you can enter your authentication token. This token, along with your name and email from sign in, will be passed to the server as environment variables when the server starts.
                </p>

                <h3 className="text-white font-medium mt-6 mb-3">Server Responsibility</h3>
                <p className="text-gray-300 leading-relaxed">
                  It is the MCP server's responsibility to provide a unique token that it can process and validate. The server should handle token generation, validation, and user identification based on the provided credentials (name, email) and token.
                </p>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="p-4 border-t border-border-default flex-shrink-0">
              <button
                onClick={() => setShowHelpModal(false)}
                className="btn btn-primary w-full"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
