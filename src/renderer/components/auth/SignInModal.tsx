import React, { useState, useEffect } from 'react';
import { X, User, Mail } from 'lucide-react';
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
          <h2 className="text-lg font-semibold">Sign In</h2>
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
    </div>
  );
}
