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
  TarjetaService,
  type EstadoTarjeta,
  type FiltroTarjetas,
  type Tarjeta,
} from '../../../../core/services/tarjeta.service';
import { mensajeDeErrorHttp } from '../../../../core/utils/http-error';

@Component({
  selector: 'app-estudiador-tarjetas',
  templateUrl: './estudiador-tarjetas.html',
  styleUrl: './estudiador-tarjetas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstudiadorTarjetasComponent implements OnInit {
  private readonly tarjetaService = inject(TarjetaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly conjuntoId = input.required<string>();
  readonly titulo = input('Conjunto de tarjetas');

  readonly volver = output<void>();
  readonly actualizado = output<void>();

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly tarjetas = signal<Tarjeta[]>([]);
  readonly tituloConjunto = signal('');
  readonly indice = signal(0);
  readonly revelada = signal(false);
  readonly filtro = signal<FiltroTarjetas>('todas');

  readonly total = computed(() => this.tarjetas().length);
  readonly tieneTarjetas = computed(() => this.total() > 0);
  readonly tarjetaActual = computed(() => this.tarjetas()[this.indice()] ?? null);
  readonly esPrimera = computed(() => this.indice() === 0);
  readonly esUltima = computed(() => this.indice() >= this.total() - 1);
  readonly conocidas = computed(
    () => this.tarjetas().filter((tarjeta) => tarjeta.estado === 'conocida').length,
  );
  readonly pendientes = computed(() => this.total() - this.conocidas());
  readonly porcentajeAvance = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.conocidas() / this.total()) * 100),
  );

  ngOnInit(): void {
    this.cargar('todas');
  }

  cargar(filtro: FiltroTarjetas): void {
    this.cargando.set(true);
    this.error.set(null);

    this.tarjetaService
      .obtener(this.conjuntoId(), filtro)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conjunto) => {
          this.tituloConjunto.set(conjunto.titulo);
          this.tarjetas.set(conjunto.tarjetas);
          this.filtro.set(filtro);
          this.indice.set(0);
          this.revelada.set(false);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar las tarjetas. Inténtalo de nuevo.'),
          );
          this.cargando.set(false);
        },
      });
  }

  revelar(): void {
    this.revelada.set(true);
  }

  siguiente(): void {
    if (this.esUltima()) {
      return;
    }

    this.indice.update((valor) => valor + 1);
    this.revelada.set(false);
  }

  anterior(): void {
    if (this.esPrimera()) {
      return;
    }

    this.indice.update((valor) => valor - 1);
    this.revelada.set(false);
  }

  marcar(estado: EstadoTarjeta): void {
    const tarjeta = this.tarjetaActual();

    if (!tarjeta || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.mensaje.set(null);

    this.tarjetaService
      .actualizarEstado(tarjeta.id, estado)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizada) => {
          this.tarjetas.update((tarjetas) =>
            tarjetas.map((actual) => (actual.id === actualizada.id ? actualizada : actual)),
          );
          this.guardando.set(false);
          this.mensaje.set(
            estado === 'conocida'
              ? 'Tarjeta marcada como conocida.'
              : 'Tarjeta marcada para repaso.',
          );
          this.avanzar();
          this.actualizado.emit();
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudo guardar el avance de la tarjeta.'),
          );
          this.guardando.set(false);
        },
      });
  }

  repetirPendientes(): void {
    this.mensaje.set(null);
    this.cargar('pendientes');
  }

  estudiarTodas(): void {
    this.mensaje.set(null);
    this.cargar('todas');
  }

  cerrarMensaje(): void {
    this.mensaje.set(null);
  }

  cerrarError(): void {
    this.error.set(null);
  }

  private avanzar(): void {
    if (!this.esUltima()) {
      this.indice.update((valor) => valor + 1);
    }

    this.revelada.set(false);
  }
}
