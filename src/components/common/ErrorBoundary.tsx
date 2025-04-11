import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  eventId?: string;
}

/**
 * Error Boundary component that catches errors in its child components
 * and reports them to Sentry
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Report the error to Sentry
    const eventId = Sentry.captureException(error);
    
    // Set the event ID to state so it can be used for the Sentry feedback dialog
    this.setState({ eventId });
    
    // Log the error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error caught by ErrorBoundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  // Allow users to report feedback on the error
  handleReportFeedback = () => {
    if (this.state.eventId) {
      Sentry.showReportDialog({ eventId: this.state.eventId });
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Oops, algo deu errado!
          </h2>
          <p className="mb-4 text-gray-700">
            Ocorreu um erro inesperado. Nossa equipe foi notificada.
          </p>
          <button
            onClick={this.handleReportFeedback}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Relatar Feedback
          </button>
          <button
            onClick={() => window.location.reload()}
            className="ml-4 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 