'use client';

import { Component, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  onError(error: unknown): void;
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  failed: boolean;
}

/**
 * Aísla los fallos de la escena 3D (no se pudo crear el contexto WebGL, falló
 * la carga del módulo o un error dentro de la escena). Si algo falla, deja de
 * renderizar la escena y avisa al padre, que muestra el estado alternativo; el
 * resto del reproductor sigue funcionando.
 */
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  override state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
