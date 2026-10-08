/**
 * Reproducción aleatoria (fase 5).
 *
 * No reorganiza la lista enlazada ni el orden guardado: solo decide **qué id**
 * seleccionar. La selección efectiva siempre la hace `Playlist` (`select`), y
 * Anterior/Siguiente sin aleatorio siguen usando `prev`/`next`.
 *
 * Estado auxiliar de la sesión (no se guarda; se reconstruye al activar):
 * - `history`: ids visitados en este modo y un cursor (la actual).
 * - `pending`: candidatos del ciclo que aún no sonaron.
 *
 * Reglas:
 * - Siguiente: primero el historial adelantado (si se retrocedió); si no, un
 *   candidato pendiente elegido de forma uniforme. Nunca la actual si hay otras.
 *   Sin candidatos ni historial adelantado devuelve `null` (Siguiente se
 *   deshabilita; los controles manuales no renuevan el ciclo).
 * - Anterior: retrocede por el historial; sin historial, `null`.
 * - `newCycle`: solo lo pide el avance automático con "Repetir playlist". Con
 *   al menos dos canciones, la primera elección evita la última del ciclo anterior.
 * - Selección manual: entra en el historial (descarta el historial adelantado)
 *   y sale de los candidatos.
 * - Importar: el id nuevo pasa a candidato (no cambia la canción actual).
 * - Eliminar: sale del historial y de los candidatos.
 *
 * El generador aleatorio se inyecta (pruebas deterministas).
 */
export type RandomSource = () => number;

export class ShuffleNavigator {
  readonly #random: RandomSource;
  #history: string[] = [];
  #cursor = -1;
  #pending = new Set<string>();
  /** Id que la próxima elección debe evitar (última del ciclo anterior). */
  #avoid: string | null = null;

  constructor(random: RandomSource = Math.random) {
    this.#random = random;
  }

  /** Inicia el modo desde la selección actual: el resto son candidatos. */
  start(currentId: string | null, allIds: readonly string[]): void {
    this.#history = currentId === null ? [] : [currentId];
    this.#cursor = this.#history.length - 1;
    this.#pending = new Set(allIds.filter((id) => id !== currentId));
    this.#avoid = null;
  }

  /** Olvida historial y candidatos (desactivar o vaciar). */
  reset(): void {
    this.#history = [];
    this.#cursor = -1;
    this.#pending.clear();
    this.#avoid = null;
  }

  get hasPrevious(): boolean {
    return this.#cursor > 0;
  }

  get hasNext(): boolean {
    return this.#cursor < this.#history.length - 1 || this.#pending.size > 0;
  }

  /** Siguiente id (historial adelantado o candidato al azar), o `null`. */
  next(): string | null {
    if (this.#cursor < this.#history.length - 1) {
      this.#cursor++;
      return this.#history[this.#cursor]!;
    }
    if (this.#pending.size === 0) return null;
    const all = [...this.#pending];
    const allowed = all.filter((id) => id !== this.#avoid);
    const pool = allowed.length > 0 ? allowed : all;
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(this.#random() * pool.length)));
    const id = pool[index]!;
    this.#avoid = null;
    this.#pending.delete(id);
    this.#history.push(id);
    this.#cursor = this.#history.length - 1;
    return id;
  }

  /** Id anterior del historial, o `null`. */
  previous(): string | null {
    if (this.#cursor <= 0) return null;
    this.#cursor--;
    return this.#history[this.#cursor]!;
  }

  /** Nuevo ciclo con todas las canciones (avance automático con "Repetir playlist"). */
  newCycle(allIds: readonly string[], lastId: string | null): void {
    this.#pending = new Set(allIds);
    this.#avoid = allIds.length >= 2 ? lastId : null;
  }

  /** Selección manual (o ajena al modo): pasa a ser la actual del historial. */
  select(id: string): void {
    this.#history = this.#history.slice(0, this.#cursor + 1);
    if (this.#history[this.#cursor] !== id) this.#history.push(id);
    this.#cursor = this.#history.length - 1;
    this.#pending.delete(id);
  }

  /** Alinea el historial con la selección real de `Playlist` (por ejemplo, tras eliminar la actual). */
  sync(currentId: string | null): void {
    if (currentId !== null && this.#history[this.#cursor] !== currentId) this.select(currentId);
  }

  /** Canción importada: nuevo candidato del ciclo. */
  add(id: string): void {
    this.#pending.add(id);
  }

  /** Canción eliminada: sale del historial y de los candidatos. */
  remove(id: string): void {
    const kept: string[] = [];
    let cursor = -1;
    this.#history.forEach((entry, index) => {
      if (entry === id) return;
      kept.push(entry);
      if (index <= this.#cursor) cursor = kept.length - 1;
    });
    this.#history = kept;
    this.#cursor = cursor;
    this.#pending.delete(id);
    if (this.#avoid === id) this.#avoid = null;
  }

  /** Estado para pruebas y depuración (copias). */
  get state(): { history: string[]; cursor: number; pending: string[] } {
    return { history: [...this.#history], cursor: this.#cursor, pending: [...this.#pending] };
  }
}
