import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackKey?: string;
}

interface State {
  hasError: boolean;
  errorCount: number;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, errorCount: 0 };
  }

  componentDidCatch(error: Error) {
    // Check if it's a DOM manipulation error from browser extensions
    if (error.message.includes('removeChild') || error.message.includes('insertBefore')) {
      console.log('Caught DOM error from browser extension, recovering...');
      // Reset after a brief delay to allow clean re-render
      setTimeout(() => {
        this.setState({ hasError: false, errorCount: this.state.errorCount + 1 });
      }, 50);
    }
  }

  render() {
    if (this.state.hasError) {
      // Return empty div briefly while recovering
      return <div className="min-h-[200px]" />;
    }

    return (
      <div key={`auth-boundary-${this.state.errorCount}`}>
        {this.props.children}
      </div>
    );
  }
}
