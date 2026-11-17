import React from 'react';
import { AlertTriangle, BookOpen, Home, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  homeHref?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level Application Error Boundary.
 * Catches uncaught runtime errors anywhere in the React component tree
 * and renders a friendly recovery screen with a direct link back to home.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Top-level ErrorBoundary caught a runtime error:', error, errorInfo);
  }

  private handleTryAgain = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const homeHref = this.props.homeHref || '/';

      return (
        <div
          role="alert"
          className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center px-4 py-12 antialiased selection:bg-amber-200 selection:text-slate-900"
        >
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 overflow-hidden">
            {/* Subtle Brand Top Accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#0c2856] via-[#1d4ed8] to-[#fbbf24]" />

            <div className="p-7 sm:p-9 text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[#0c2856] flex items-center justify-center shadow-xs">
                  <BookOpen className="w-4 h-4 text-[#fbbf24]" />
                </div>
                <span className="text-sm font-extrabold text-[#0c2856] tracking-tight">
                  Kumari Institute
                </span>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-600 flex items-center justify-center mb-5 shadow-2xs">
                <AlertTriangle className="w-7 h-7 stroke-[2]" />
              </div>

              <h1 className="text-2xl sm:text-[26px] font-black text-[#0c2856] tracking-tight leading-tight">
                Something went wrong
              </h1>

              <p className="mt-2.5 text-sm text-slate-600 leading-relaxed max-w-sm">
                We ran into an unexpected problem loading this view. Your account and saved details are safe — return home to continue.
              </p>

              <div className="mt-7 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <a
                  href={homeHref}
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    this.props.onReset?.();
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0c2856] hover:bg-[#133875] active:scale-[0.99] text-white font-bold text-sm shadow-sm transition-all whitespace-nowrap"
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span>Back to Home</span>
                </a>

                <button
                  type="button"
                  onClick={this.handleTryAgain}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 font-semibold text-sm border border-slate-200 transition-all cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-4 h-4 shrink-0 text-slate-500" />
                  <span>Try Again</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
