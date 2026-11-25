import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocumentoService, type Documento } from '../../core/services/documento.service';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import {
  CANTIDAD_MAXIMA_TARJETAS,
  CANTIDAD_MINIMA_TARJETAS,
  CANTIDAD_TARJETAS_POR_DEFECTO,
  LIMITE_CONJUNTOS_POR_PAGINA,
  TarjetaService,
  type ConjuntoTarjetasGenerado,
  type ConjuntoTarjetasResumen,
} from '../../core/services/tarjeta.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { valorDeCampo } from '../../core/utils/form-event';
import { EstudiadorTarjetasComponent } from './components/estudiador-tarjetas/estudiador-tarjetas';

const LIMITE_MATERIAS = 100;
const LIMITE_DOCUMENTOS = 50;

interface ConjuntoEnEstudio {
  id: string;
  titulo: string;
}

@Component({
  selector: 'app-tarjetas-memoria',
  imports: [DatePipe, RouterLink, EstudiadorTarjetasComponent],
  templateUrl: './tarjetas-memoria.html',
  styleUrl: './tarjetas-memoria.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetasMemoriaPage {
  private readonly tarjetaService = inject(TarjetaService);
  private readonly materiaService = inject(MateriaService);
  private readonly documentoService = inject(DocumentoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly materias = signal<Materia[]>([]);
  readonly documentos = signal<Documento[]>([]);
  readonly conjuntos = signal<ConjuntoTarjetasResumen[]>([]);
  readonly totalConjuntos = signal(0);

  readonly cargandoMaterias = signal(false);
  readonly cargandoDocumentos = signal(false);
  readonly cargandoConjuntos = signal(true);
  readonly generando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly confirmandoEliminar = signal<string | null>(null);
  readonly eliminandoId = signal<string | null>(null);
  readonly estudiando = signal<ConjuntoEnEstudio | null>(null);

  readonly materiaId = signal('');
  readonly documentoId = signal('');
  readonly cantidadTarjetas = signal(CANTIDAD_TARJETAS_POR_DEFECTO);
  readonly valorCampo = valorDeCampo;

  readonly materiasActivas = computed(() =>
    this.materias().filter((materia) => materia.estado === 'activo'),
  );

  readonly sinMaterias = computed(
    () => !this.cargandoMaterias() && this.materiasActivas().length === 0,
  );

  readonly puedeGenerar = computed(
    () =>
      this.materiaId().length > 0 &&
      this.cantidadTarjetas() >= CANTIDAD_MINIMA_TARJETAS &&
      this.cantidadTarjetas() <= CANTIDAD_MAXIMA_TARJETAS &&
      !this.generando(),
  );

  readonly hayMasConjuntos = computed(
    () => this.conjuntos().length < this.totalConjuntos(),
  );

  constructor() {
    this.cargarMaterias();
    this.cargarConjuntos();
  }

  cargarMaterias(): void {
    this.cargandoMaterias.set(true);

    this.materiaService
      .listarMaterias({ limit: LIMITE_MATERIAS })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.materias.set(respuesta.data ?? []);
          this.cargandoMaterias.set(false);
        },
        error: () => {
          this.materias.set([]);
          this.cargandoMaterias.set(false);
        },
      });
  }

  cargarConjuntos(): void {
    this.cargandoConjuntos.set(true);
    this.error.set(null);

    this.tarjetaService
      .listar({ limit: LIMITE_CONJUNTOS_POR_PAGINA, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ conjuntos, total }) => {
          this.conjuntos.set(conjuntos);
          this.totalConjuntos.set(total);
          this.cargandoConjuntos.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar tus conjuntos de tarjetas.'),
          );
          this.cargandoConjuntos.set(false);
        },
      });
  }

  cargarMas(): void {
    if (this.cargandoConjuntos() || !this.hayMasConjuntos()) {
      return;
    }

    this.cargandoConjuntos.set(true);

    this.tarjetaService
      .listar({ limit: LIMITE_CONJUNTOS_POR_PAGINA, offset: this.conjuntos().length })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ conjuntos, total }) => {
          this.conjuntos.update((actuales) => [...actuales, ...conjuntos]);
          this.totalConjuntos.set(total);
          this.cargandoConjuntos.set(false);
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar más conjuntos.'),
          );
          this.cargandoConjuntos.set(false);
        },
      });
  }

  cambiarMateria(valor: string): void {
    this.materiaId.set(valor);
    this.documentoId.set('');
    this.documentos.set([]);

    if (valor) {
      this.cargarDocumentos(valor);
    }
  }

  cambiarDocumento(valor: string): void {
    this.documentoId.set(valor);
  }

  cambiarCantidad(valor: string): void {
    const cantidad = Number(valor);
    this.cantidadTarjetas.set(Number.isFinite(cantidad) ? cantidad : 0);
  }

  generar(): void {
    if (!this.puedeGenerar()) {
      return;
    }

    this.generando.set(true);
    this.error.set(null);
    this.errorAccion.set(null);
    this.mensajeExito.set(null);

    this.tarjetaService
      .generar({
        materia_id: this.materiaId(),
        documento_id: this.documentoId() || null,
        cantidad_tarjetas: this.cantidadTarjetas(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conjunto) => {
          this.generando.set(false);
          this.mensajeExito.set(`"${conjunto.titulo}" se generó correctamente.`);
          this.agregarConjunto(conjunto);
          this.estudiar(conjunto);
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudieron generar las tarjetas. Inténtalo de nuevo.'),
          );
          this.generando.set(false);
        },
      });
  }

  estudiar(conjunto: ConjuntoTarjetasResumen): void {
    this.errorAccion.set(null);
    this.estudiando.set({ id: conjunto.id, titulo: conjunto.titulo });
  }

  cerrarEstudiador(): void {
    this.estudiando.set(null);
  }

  alActualizar(): void {
    this.cargarConjuntos();
  }

  solicitarEliminar(conjunto: ConjuntoTarjetasResumen): void {
    if (this.confirmandoEliminar() === conjunto.id) {
      this.eliminar(conjunto);
      return;
    }

    this.confirmandoEliminar.set(conjunto.id);
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(null);
  }

  eliminar(conjunto: ConjuntoTarjetasResumen): void {
    if (this.eliminandoId()) {
      return;
    }

    this.eliminandoId.set(conjunto.id);
    this.errorAccion.set(null);

    this.tarjetaService
      .eliminar(conjunto.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.conjuntos.update((conjuntos) =>
            conjuntos.filter((actual) => actual.id !== conjunto.id),
          );
          this.totalConjuntos.update((total) => Math.max(0, total - 1));
          this.confirmandoEliminar.set(null);
          this.eliminandoId.set(null);
          this.mensajeExito.set(`"${conjunto.titulo}" se eliminó.`);
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo eliminar el conjunto de tarjetas.'),
          );
          this.eliminandoId.set(null);
        },
      });
  }

  cerrarMensaje(): void {
    this.mensajeExito.set(null);
  }

  cerrarErrorAccion(): void {
    this.errorAccion.set(null);
  }

  private cargarDocumentos(materiaId: string): void {
    this.cargandoDocumentos.set(true);

    this.documentoService
      .listar({ materia_id: materiaId, estado: 'procesado', limit: LIMITE_DOCUMENTOS })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ documentos }) => {
          this.documentos.set(documentos);
          this.cargandoDocumentos.set(false);
        },
        error: () => {
          this.documentos.set([]);
          this.cargandoDocumentos.set(false);
        },
      });
  }

  private agregarConjunto(conjunto: ConjuntoTarjetasGenerado): void {
    this.conjuntos.update((actuales) => [conjunto, ...actuales]);
    this.totalConjuntos.update((total) => total + 1);
  }
}
