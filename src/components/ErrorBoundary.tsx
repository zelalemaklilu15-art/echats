import React, { Component, ErrorInfo, ReactNode } from "react";

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

type ErrorBoundaryProps = {
  children: ReactNode;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught React error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private reloadApp = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <section className="w-full max-w-xl border border-border bg-card p-6 shadow-lg">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-destructive">Application error</p>
                <h1 className="mt-2 text-2xl font-bold">Something went wrong</h1>
              </div>

              <p className="text-sm text-muted-foreground">
                The app hit an unexpected error instead of loading the screen.
              </p>

              {this.state.error?.message && (
                <pre className="max-h-40 overflow-auto border border-border bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              )}

              {this.state.errorInfo?.componentStack && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">Component trace</summary>
                  <pre className="mt-3 max-h-56 overflow-auto border border-border bg-muted p-3 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <button
                type="button"
                onClick={this.reloadApp}
                className="inline-flex h-10 items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reload app
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;