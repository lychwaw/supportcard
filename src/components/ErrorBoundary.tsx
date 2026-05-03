import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center px-6">
          <AlertTriangle className="w-12 h-12 text-destructive/60" />
          <div>
            <p className="font-semibold text-foreground">Something went wrong on this page</p>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
