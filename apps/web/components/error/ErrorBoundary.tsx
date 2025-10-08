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
        <div className="flex h-64 items-center justify-center rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-10)]">
          <div className="text-center">
              <div className="mb-4 text-4xl">⚠️</div>
              <h3 className="mb-2 text-lg font-semibold text-primary">Something went wrong</h3>
              <p className="text-sm text-muted">
                We encountered an unexpected error. Please refresh the page or try again later.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-[linear-gradient(120deg,var(--brand),#7c3aed)] px-4 py-2 text-sm font-medium text-primary hover:opacity-95"
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
