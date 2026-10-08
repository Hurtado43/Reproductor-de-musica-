import { Player } from '@/features/player/components/Player';

/**
 * Página principal (Server Component). Solo monta el reproductor cliente; no
 * le pasa instancias de clases ni nodos: cada montaje crea su propia playlist.
 */
export default function HomePage() {
  return <Player />;
}
