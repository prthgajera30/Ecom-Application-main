'use client';
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5">
          <div className="text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h3 className="mb-2 text-lg font-semibold text-white">Something went wrong</h3>
            <p className="text-sm text-slate-400">
              We encountered an unexpected error. Please refresh the page or try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
