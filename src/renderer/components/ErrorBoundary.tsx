/**
 * Error Boundary - Catches React rendering errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-screen flex items-center justify-center bg-bg-primary p-8">
          <div className="max-w-lg w-full bg-bg-secondary border border-border-default rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
            </div>

            <p className="text-gray-400 text-sm">
              The application encountered an unexpected error. You can try reloading the page or resetting the component.
            </p>

            {this.state.error && (
              <div className="bg-bg-primary rounded-md p-3 border border-red-500/30">
                <p className="text-red-400 text-sm font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-400 transition-colors">
                  Stack trace
                </summary>
                <pre className="mt-2 p-2 bg-bg-primary rounded overflow-auto max-h-40 text-gray-600">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              >
                <RefreshCw size={16} />
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
