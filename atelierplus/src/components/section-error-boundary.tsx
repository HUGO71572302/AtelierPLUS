"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  onRetry?: () => void;
};

type State = { failed: boolean };

/**
 * One optional workshop tool must never crash the navigation shell.
 * This boundary keeps the rest of AtelierPLUS usable after a bad cached photo,
 * a browser limitation, or an unexpected data value in one section.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostics in the console for the developer without exposing
    // technical details or data to workshop users.
    console.error(`[AtelierPLUS] Section failed: ${this.props.title}`, error, info.componentStack);
  }

  private retry = () => {
    this.setState({ failed: false });
    this.props.onRetry?.();
  };

  public render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="section-error" role="alert">
        <span className="section-error-icon">✳</span>
        <div>
          <h3>{this.props.title} n’a pas pu s’afficher</h3>
          <p>Vos données restent enregistrées. Réessayez cette section ou revenez aux options.</p>
        </div>
        <button type="button" className="button button-primary" onClick={this.retry}>
          Réessayer
        </button>
      </section>
    );
  }
}
