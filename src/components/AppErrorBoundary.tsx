import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render errors so a single bad API shape or undefined access
 * does not leave the whole app as a blank screen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || "Something went wrong" };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary]", err, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="card stack" style={{ gap: "1rem", maxWidth: "36rem" }}>
          <h2 style={{ margin: 0, color: "var(--danger, #f87171)" }}>
            This page crashed
          </h2>
          <p className="muted small" style={{ margin: 0 }}>
            {this.state.message}
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            Try another tab, or reload the page. If this keeps happening after a
            deploy, the API response shape may have drifted from what the UI expects.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
