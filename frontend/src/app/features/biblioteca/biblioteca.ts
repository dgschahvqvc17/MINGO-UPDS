import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, debounceTime, switchMap } from 'rxjs';
import {
  ESTADOS_DOCUMENTO,
  DocumentoService,
  type Documento,
  type DocumentoFiltros,
  type DocumentoListado,
  type EstadoDocumento,
  type PaginacionDocumentos,
} from '../../core/services/documento.service';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { DocumentoCardComponent } from './components/documento-card/documento-card';
import { DocumentoUploadComponent } from './components/documento-upload/documento-upload';

const LIMITE_POR_PAGINA = 12;
const MAXIMO_MATERIAS = 100;
const ESPERA_BUSQUEDA_MS = 300;

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

  private readonly solicitudDocumentos = new Subject<void>();
  private readonly busquedaDocumentos = new Subject<void>();

  readonly documentos = signal<Documento[]>([]);
  readonly materias = signal<Materia[]>([]);
  readonly paginacion = signal<PaginacionDocumentos>(PAGINACION_INICIAL);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly mostrarFormulario = signal(false);
  readonly materiaFiltro = signal('');
  readonly estadoFiltro = signal<EstadoDocumento | ''>('');
  readonly terminoBusqueda = signal('');
  readonly descargandoId = signal<string | null>(null);
  readonly eliminandoId = signal<string | null>(null);

  readonly estados = ESTADOS_DOCUMENTO;

  readonly materiasDisponibles = computed(() =>
    this.materias().filter((materia) => materia.estado === 'activo'),
  );

  readonly tieneResultados = computed(() => this.documentos().length > 0);
  readonly mostrarCargando = computed(() => this.loading() && this.documentos().length === 0);
  readonly mostrarError = computed(() => !this.loading() && this.error() !== null);
  readonly mostrarListaVacia = computed(
    () => !this.loading() && !this.error() && !this.tieneResultados(),
  );

  readonly sinMaterias = computed(() => !this.loading() && this.materiasDisponibles().length === 0);

  readonly hayFiltrosActivos = computed(
    () =>
      Boolean(this.materiaFiltro()) ||
      Boolean(this.estadoFiltro()) ||
      this.terminoBusqueda().trim().length > 0,
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

    this.solicitudDocumentos
      .pipe(
        switchMap(() => this.consultarDocumentos()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ documentos, paginacion }) => this.aplicarResultado(documentos, paginacion));

    this.busquedaDocumentos
      .pipe(debounceTime(ESPERA_BUSQUEDA_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarDocumentos());

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
    this.solicitudDocumentos.next();
  }

  alBuscar(valor: string): void {
    this.terminoBusqueda.set(valor);
    this.reiniciarPaginacion();
    this.busquedaDocumentos.next();
  }

  alCambiarEstado(valor: string): void {
    this.estadoFiltro.set(valor as EstadoDocumento | '');
    this.reiniciarPaginacion();
    this.cargarDocumentos();
  }

  cambiarMateria(valor: string): void {
    this.materiaFiltro.set(valor);
    this.reiniciarPaginacion();
    this.cargarDocumentos();
  }

  limpiarFiltros(): void {
    this.materiaFiltro.set('');
    this.estadoFiltro.set('');
    this.terminoBusqueda.set('');
    this.reiniciarPaginacion();
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

  descargar(documento: Documento): void {
    if (this.descargandoId()) {
      return;
    }

    this.descargandoId.set(documento.id);
    this.errorAccion.set(null);

    this.documentoService
      .urlDescarga(documento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ downloadUrl }) => {
          this.iniciarDescarga(downloadUrl, documento.nombre_archivo);
          this.descargandoId.set(null);
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo descargar el documento.'),
          );
          this.descargandoId.set(null);
        },
      });
  }

  eliminar(documento: Documento): void {
    if (this.eliminandoId()) {
      return;
    }

    this.eliminandoId.set(documento.id);
    this.errorAccion.set(null);

    this.documentoService
      .eliminar(documento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.eliminandoId.set(null);
          this.mensajeExito.set(`"${documento.nombre}" se eliminó de tu biblioteca.`);
          this.documentos.update((documentos) =>
            documentos.filter((actual) => actual.id !== documento.id),
          );
          this.paginacion.update((paginacion) => ({
            ...paginacion,
            total: Math.max(0, paginacion.total - 1),
          }));

          if (this.documentos().length === 0 && this.puedeRetroceder()) {
            this.paginaAnterior();
            return;
          }

          this.cargarDocumentos();
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo eliminar el documento.'),
          );
          this.eliminandoId.set(null);
        },
      });
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
    this.reiniciarPaginacion();
    this.cargarDocumentos();
    this.cargarMaterias();
  }

  cerrarMensaje(): void {
    this.mensajeExito.set(null);
  }

  cerrarErrorAccion(): void {
    this.errorAccion.set(null);
  }

  estadoTexto(estado: EstadoDocumento): string {
    return this.documentoService.estadoTexto(estado);
  }

  private consultarDocumentos(): Observable<DocumentoListado> {
    this.loading.set(true);
    this.error.set(null);

    return this.documentoService.listar(this.filtrosActuales()).pipe(
      catchError((error: unknown) => {
        this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar los documentos.'));
        this.loading.set(false);
        return EMPTY;
      }),
    );
  }

  private aplicarResultado(
    documentos: Documento[],
    paginacion: PaginacionDocumentos,
  ): void {
    this.documentos.set(documentos);
    this.paginacion.set(paginacion);
    this.loading.set(false);
  }

  private filtrosActuales(): DocumentoFiltros {
    const { limit, offset } = this.paginacion();
    const termino = this.terminoBusqueda().trim();

    return {
      materia_id: this.materiaFiltro() || undefined,
      q: termino || undefined,
      estado: this.estadoFiltro() || undefined,
      limit,
      offset,
    };
  }

  private reiniciarPaginacion(): void {
    this.paginacion.update((paginacion) => ({ ...paginacion, offset: 0 }));
  }

  private iniciarDescarga(url: string, nombreArchivo: string): void {
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.rel = 'noopener';
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }
}
