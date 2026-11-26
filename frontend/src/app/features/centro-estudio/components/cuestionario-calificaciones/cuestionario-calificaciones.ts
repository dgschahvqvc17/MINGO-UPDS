import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CuestionarioService,
  type CalificacionCuestionario,
  type EstadoIntento,
} from '../../../../core/services/cuestionario.service';
import { mensajeDeErrorHttp } from '../../../../core/utils/http-error';

const LIMITE_CALIFICACIONES = 50;

@Component({
  selector: 'app-cuestionario-calificaciones',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './cuestionario-calificaciones.html',
  styleUrl: './cuestionario-calificaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuestionarioCalificacionesComponent implements OnInit {
  private readonly cuestionarioService = inject(CuestionarioService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cuestionarioId = input.required<string>();
  readonly titulo = input('Cuestionario');

  readonly cerrar = output<void>();

  readonly calificaciones = signal<CalificacionCuestionario[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly estaVacio = computed(
    () => !this.isLoading() && !this.errorMessage() && this.calificaciones().length === 0,
  );

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.cuestionarioService
      .listarCalificaciones(this.cuestionarioId(), { limit: LIMITE_CALIFICACIONES, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ calificaciones, total }) => {
          this.calificaciones.set(calificaciones);
          this.total.set(total);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar las calificaciones.'),
          );
          this.calificaciones.set([]);
          this.isLoading.set(false);
        },
      });
  }

  etiquetaEstado(estado: EstadoIntento): string {
    return estado === 'finalizado' ? 'Finalizado' : 'En progreso';
  }

  cerrarPanel(): void {
    this.cerrar.emit();
  }
}
