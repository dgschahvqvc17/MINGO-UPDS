import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DocumentoService,
  type Documento,
  type PaginacionDocumentos,
} from '../../core/services/documento.service';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { DocumentoCardComponent } from './components/documento-card/documento-card';
import { DocumentoUploadComponent } from './components/documento-upload/documento-upload';

const LIMITE_POR_PAGINA = 12;
const MAXIMO_MATERIAS = 100;

const PAGINACION_INICIAL: PaginacionDocumentos = {
  limit: LIMITE_POR_PAGINA,
  offset: 0,
  total: 0,
};

@Component({
  selector: 'app-biblioteca',
  imports: [RouterLink, DocumentoCardComponent, DocumentoUploadComponent],
  templateUrl: './biblioteca.html',
  styleUrl: './biblioteca.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BibliotecaPage {
  private readonly documentoService = inject(DocumentoService);
  private readonly materiaService = inject(MateriaService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly documentos = signal<Documento[]>([]);
  readonly materias = signal<Materia[]>([]);
  readonly paginacion = signal<PaginacionDocumentos>(PAGINACION_INICIAL);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly mostrarFormulario = signal(false);
  readonly materiaFiltro = signal('');

  readonly materiasDisponibles = computed(() =>
    this.materias().filter((materia) => materia.estado === 'activo'),
  );

  readonly tieneResultados = computed(() => this.documentos().length > 0);
  readonly mostrarCargando = computed(() => this.loading() && this.documentos().length === 0);
  readonly mostrarError = computed(() => !this.loading() && this.error() !== null);
  readonly mostrarListaVacia = computed(
    () => !this.loading() && !this.error() && !this.tieneResultados(),
  );

  readonly sinMaterias = computed(
    () => !this.loading() && this.materiasDisponibles().length === 0,
  );

  readonly paginaActual = computed(
    () => Math.floor(this.paginacion().offset / this.paginacion().limit) + 1,
  );

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.paginacion().total / this.paginacion().limit)),
  );

  readonly rangoMostrado = computed(() => {
    const { offset, limit, total } = this.paginacion();

    if (total === 0) {
      return 'Sin documentos para mostrar';
    }

    const inicio = offset + 1;
    const fin = Math.min(offset + limit, total);

    return `Mostrando ${inicio}-${fin} de ${total} documentos`;
  });

  readonly puedeRetroceder = computed(() => this.paginacion().offset > 0);
  readonly puedeAvanzar = computed(
    () => this.paginacion().offset + this.paginacion().limit < this.paginacion().total,
  );

  constructor() {
    const materiaId = this.route.snapshot.queryParamMap.get('materia_id');
    if (materiaId) {
      this.materiaFiltro.set(materiaId);
    }

    if (this.route.snapshot.queryParamMap.get('subir') === '1') {
      this.mostrarFormulario.set(true);
    }

    this.cargarMaterias();
    this.cargarDocumentos();
  }

  cargarMaterias(): void {
    this.materiaService
      .listarMaterias({ limit: MAXIMO_MATERIAS })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => this.materias.set(respuesta.data ?? []),
        error: () => this.materias.set([]),
      });
  }

  cargarDocumentos(): void {
    this.loading.set(true);
    this.error.set(null);

    const { limit, offset } = this.paginacion();

    this.documentoService
      .listar({
        materia_id: this.materiaFiltro() || undefined,
        limit,
        offset,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ documentos, paginacion }) => {
          this.documentos.set(documentos);
          this.paginacion.set(paginacion);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar los documentos.'));
          this.loading.set(false);
        },
      });
  }

  cambiarMateria(valor: string): void {
    this.materiaFiltro.set(valor);
    this.paginacion.update((paginacion) => ({ ...paginacion, offset: 0 }));
    this.cargarDocumentos();
  }

  limpiarFiltros(): void {
    this.materiaFiltro.set('');
    this.paginacion.update((paginacion) => ({ ...paginacion, offset: 0 }));
    this.cargarDocumentos();
  }

  paginaAnterior(): void {
    if (!this.puedeRetroceder()) {
      return;
    }

    this.paginacion.update((paginacion) => ({
      ...paginacion,
      offset: Math.max(0, paginacion.offset - paginacion.limit),
    }));
    this.cargarDocumentos();
  }

  paginaSiguiente(): void {
    if (!this.puedeAvanzar()) {
      return;
    }

    this.paginacion.update((paginacion) => ({
      ...paginacion,
      offset: paginacion.offset + paginacion.limit,
    }));
    this.cargarDocumentos();
  }

  abrirFormulario(): void {
    this.mensajeExito.set(null);
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario(): void {
    this.mostrarFormulario.set(false);
  }

  alCargarDocumento(documento: Documento): void {
    this.mostrarFormulario.set(false);
    this.mensajeExito.set(`"${documento.nombre}" se agregó a tu biblioteca.`);
    this.paginacion.update((paginacion) => ({ ...paginacion, offset: 0 }));
    this.cargarDocumentos();
    this.cargarMaterias();
  }

  cerrarMensaje(): void {
    this.mensajeExito.set(null);
  }
}
