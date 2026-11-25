import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  BusquedaService,
  type FragmentoBusqueda,
} from '../../../../core/services/busqueda.service';
import type { Materia } from '../../../../core/services/materia.service';
import { mensajeDeErrorHttp } from '../../../../core/utils/http-error';
import { valorDeCampo } from '../../../../core/utils/form-event';

const LONGITUD_MINIMA_CONSULTA = 2;
const LIMITE_RESULTADOS = 8;

/** Buscador semántico de la biblioteca (HU11). Solo consulta fragmentos propios. */
@Component({
  selector: 'app-busqueda-semantica',
  imports: [RouterLink],
  templateUrl: './busqueda-semantica.html',
  styleUrl: './busqueda-semantica.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusquedaSemanticaComponent {
  private readonly busquedaService = inject(BusquedaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly materias = input.required<Materia[]>();

  readonly consulta = signal('');
  readonly materiaId = signal('');
  readonly valorCampo = valorDeCampo;
  readonly resultados = signal<FragmentoBusqueda[]>([]);
  readonly mensajeVacio = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly busquedaRealizada = signal(false);

  readonly consultaValida = () => this.consulta().trim().length >= LONGITUD_MINIMA_CONSULTA;

  buscar(evento?: Event): void {
    evento?.preventDefault();

    const consulta = this.consulta().trim();
    if (!this.consultaValida() || this.cargando()) {
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.mensajeVacio.set(null);
    this.busquedaRealizada.set(true);

    this.busquedaService
      .buscar(consulta, {
        materiaId: this.materiaId() || undefined,
        limit: LIMITE_RESULTADOS,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ resultados, mensaje }) => {
          this.resultados.set(resultados);
          this.mensajeVacio.set(mensaje);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.resultados.set([]);
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudo realizar la búsqueda inteligente.'),
          );
          this.cargando.set(false);
        },
      });
  }

  limpiar(): void {
    this.consulta.set('');
    this.materiaId.set('');
    this.resultados.set([]);
    this.mensajeVacio.set(null);
    this.error.set(null);
    this.busquedaRealizada.set(false);
    this.cargando.set(false);
  }

  similitudTexto(similitud: number): string {
    return `${Math.round(similitud * 100)}%`;
  }

  paginaTexto(numeroPagina: number | null): string {
    return numeroPagina === null ? 'Sin número de página' : `Página ${numeroPagina}`;
  }
}
