import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { DocumentoService, type Documento } from '../../core/services/documento.service';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import {
  CuestionarioService,
  DIFICULTADES_CUESTIONARIO,
  TIPOS_PREGUNTA_CUESTIONARIO,
  type CuestionarioGenerado,
  type CuestionarioResumen,
  type VentanaPublicacion,
  type DificultadCuestionario,
  type IntentoHistorial,
  type TipoPreguntaCuestionario,
} from '../../core/services/cuestionario.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { valorDeCampo } from '../../core/utils/form-event';
import { CuestionarioCalificacionesComponent } from './components/cuestionario-calificaciones/cuestionario-calificaciones';
import { CuestionarioResolverComponent } from './components/cuestionario-resolver/cuestionario-resolver';

const LIMITE_CUESTIONARIOS = 20;
const LIMITE_INTENTOS = 10;
const LIMITE_MATERIAS = 100;
const LIMITE_DOCUMENTOS = 50;
const CANTIDAD_PREGUNTAS_POR_DEFECTO = 10;

interface CuestionarioEnResolucion {
  id: string;
  titulo: string;
  intentoId?: string;
}

interface CuestionarioSeleccionado {
  id: string;
  titulo: string;
}

@Component({
  selector: 'app-centro-estudio',
  imports: [
    DatePipe,
    RouterLink,
    CuestionarioCalificacionesComponent,
    CuestionarioResolverComponent,
  ],
  templateUrl: './centro-estudio.html',
  styleUrl: './centro-estudio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentroEstudioPage {
  private readonly cuestionarioService = inject(CuestionarioService);
  private readonly materiaService = inject(MateriaService);
  private readonly documentoService = inject(DocumentoService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly esDocente = this.auth.isDocente;

  readonly materias = signal<Materia[]>([]);
  readonly documentos = signal<Documento[]>([]);
  readonly cuestionarios = signal<CuestionarioResumen[]>([]);
  readonly totalCuestionarios = signal(0);
  readonly intentos = signal<IntentoHistorial[]>([]);
  readonly totalIntentos = signal(0);
  readonly cuestionariosDisponibles = signal<CuestionarioResumen[]>([]);
  readonly totalDisponibles = signal(0);

  readonly cargandoMaterias = signal(false);
  readonly cargandoDocumentos = signal(false);
  readonly cargandoCuestionarios = signal(true);
  readonly cargandoIntentos = signal(true);
  readonly cargandoDisponibles = signal(true);
  readonly generando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorHistorial = signal<string | null>(null);
  readonly errorDisponibles = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);
  readonly confirmandoEliminar = signal<string | null>(null);
  readonly eliminandoId = signal<string | null>(null);
  readonly publicandoId = signal<string | null>(null);
  readonly resolviendo = signal<CuestionarioEnResolucion | null>(null);
  readonly calificacionesDe = signal<CuestionarioSeleccionado | null>(null);
  readonly cuestionarioSolicitadoId = signal<string | null>(null);
  readonly ventanasPublicacion = signal<Record<string, { inicio: string; limite: string }>>({});

  readonly materiaId = signal('');
  readonly documentoId = signal('');
  readonly cantidadPreguntas = signal(CANTIDAD_PREGUNTAS_POR_DEFECTO);
  readonly valorCampo = valorDeCampo;
  readonly dificultad = signal<DificultadCuestionario>('intermedia');
  readonly tipos = signal<TipoPreguntaCuestionario[]>([
    ...TIPOS_PREGUNTA_CUESTIONARIO,
  ]);

  readonly dificultades = DIFICULTADES_CUESTIONARIO.map((valor) => ({
    valor,
    etiqueta: this.cuestionarioService.etiquetaDificultad(valor),
  }));

  readonly tiposDisponibles = TIPOS_PREGUNTA_CUESTIONARIO.map((valor) => ({
    valor,
    etiqueta: this.cuestionarioService.etiquetaTipo(valor),
  }));

  readonly materiasActivas = computed(() =>
    this.materias().filter((materia) => materia.estado === 'activo'),
  );

  readonly puedeGenerar = computed(
    () => this.materiaId().length > 0 && this.tipos().length > 0 && !this.generando(),
  );

  readonly mostrarListaVacia = computed(
    () => !this.cargandoCuestionarios() && this.cuestionarios().length === 0,
  );

  readonly hayMasCuestionarios = computed(
    () => this.cuestionarios().length < this.totalCuestionarios(),
  );

  readonly hayMasIntentos = computed(() => this.intentos().length < this.totalIntentos());

  readonly mostrarListaVaciaIntentos = computed(
    () => !this.cargandoIntentos() && !this.errorHistorial() && this.intentos().length === 0,
  );

  readonly mostrarListaVaciaDisponibles = computed(
    () =>
      !this.cargandoDisponibles() &&
      !this.errorDisponibles() &&
      this.cuestionariosDisponibles().length === 0,
  );

  readonly hayMasDisponibles = computed(
    () => this.cuestionariosDisponibles().length < this.totalDisponibles(),
  );

  readonly sinMaterias = computed(
    () => !this.cargandoMaterias() && this.materiasActivas().length === 0,
  );

  constructor() {
    this.cuestionarioSolicitadoId.set(
      this.route.snapshot.queryParamMap.get('cuestionario'),
    );

    this.cargarMaterias();
    this.cargarCuestionarios();
    this.cargarIntentos();
    this.cargarDisponibles();
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

  cargarCuestionarios(): void {
    this.cargandoCuestionarios.set(true);
    this.error.set(null);

    this.cuestionarioService
      .listar({ limit: LIMITE_CUESTIONARIOS, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cuestionarios, total }) => {
          this.cuestionarios.set(cuestionarios);
          this.totalCuestionarios.set(total);
          this.inicializarVentanas(cuestionarios);
          this.cargandoCuestionarios.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar tus cuestionarios.'),
          );
          this.cargandoCuestionarios.set(false);
        },
      });
  }

  cargarMas(): void {
    if (this.cargandoCuestionarios() || !this.hayMasCuestionarios()) {
      return;
    }

    this.cargandoCuestionarios.set(true);

    this.cuestionarioService
      .listar({ limit: LIMITE_CUESTIONARIOS, offset: this.cuestionarios().length })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cuestionarios, total }) => {
          this.cuestionarios.update((actuales) => [...actuales, ...cuestionarios]);
          this.totalCuestionarios.set(total);
          this.inicializarVentanas(cuestionarios);
          this.cargandoCuestionarios.set(false);
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar más cuestionarios.'),
          );
          this.cargandoCuestionarios.set(false);
        },
      });
  }

  cargarDisponibles(): void {
    this.cargandoDisponibles.set(true);
    this.errorDisponibles.set(null);

    this.cuestionarioService
      .listarDisponibles({ limit: LIMITE_CUESTIONARIOS, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cuestionarios, total }) => {
          this.cuestionariosDisponibles.set(cuestionarios);
          this.totalDisponibles.set(total);
          this.cargandoDisponibles.set(false);
          this.abrirCuestionarioSolicitado(cuestionarios);
        },
        error: (error: unknown) => {
          this.errorDisponibles.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar los cuestionarios disponibles.'),
          );
          this.cuestionariosDisponibles.set([]);
          this.cargandoDisponibles.set(false);
        },
      });
  }

  cargarMasDisponibles(): void {
    if (this.cargandoDisponibles() || !this.hayMasDisponibles()) {
      return;
    }

    this.cargandoDisponibles.set(true);

    this.cuestionarioService
      .listarDisponibles({
        limit: LIMITE_CUESTIONARIOS,
        offset: this.cuestionariosDisponibles().length,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ cuestionarios, total }) => {
          this.cuestionariosDisponibles.update((actuales) => [...actuales, ...cuestionarios]);
          this.totalDisponibles.set(total);
          this.cargandoDisponibles.set(false);
        },
        error: (error: unknown) => {
          this.errorDisponibles.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar más cuestionarios disponibles.'),
          );
          this.cargandoDisponibles.set(false);
        },
      });
  }

  cargarIntentos(): void {
    this.cargandoIntentos.set(true);
    this.errorHistorial.set(null);

    this.cuestionarioService
      .listarIntentos({ limit: LIMITE_INTENTOS, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ intentos, total }) => {
          this.intentos.set(intentos);
          this.totalIntentos.set(total);
          this.cargandoIntentos.set(false);
        },
        error: (error: unknown) => {
          this.errorHistorial.set(
            mensajeDeErrorHttp(error, 'No se pudo cargar tu historial de evaluaciones.'),
          );
          this.intentos.set([]);
          this.cargandoIntentos.set(false);
        },
      });
  }

  cargarMasIntentos(): void {
    if (this.cargandoIntentos() || !this.hayMasIntentos()) {
      return;
    }

    this.cargandoIntentos.set(true);

    this.cuestionarioService
      .listarIntentos({ limit: LIMITE_INTENTOS, offset: this.intentos().length })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ intentos, total }) => {
          this.intentos.update((actuales) => [...actuales, ...intentos]);
          this.totalIntentos.set(total);
          this.cargandoIntentos.set(false);
        },
        error: (error: unknown) => {
          this.errorHistorial.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar más evaluaciones.'),
          );
          this.cargandoIntentos.set(false);
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

  cargarDocumentos(materiaId: string): void {
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

  cambiarDocumento(valor: string): void {
    this.documentoId.set(valor);
  }

  cambiarCantidad(valor: string): void {
    const cantidad = Number(valor);
    this.cantidadPreguntas.set(Number.isFinite(cantidad) ? cantidad : 0);
  }

  cambiarDificultad(valor: string): void {
    this.dificultad.set(valor as DificultadCuestionario);
  }

  alternarTipo(tipo: TipoPreguntaCuestionario): void {
    this.tipos.update((tipos) =>
      tipos.includes(tipo) ? tipos.filter((actual) => actual !== tipo) : [...tipos, tipo],
    );
  }

  tipoSeleccionado(tipo: TipoPreguntaCuestionario): boolean {
    return this.tipos().includes(tipo);
  }

  generar(): void {
    if (!this.puedeGenerar()) {
      return;
    }

    this.generando.set(true);
    this.error.set(null);
    this.errorAccion.set(null);
    this.mensajeExito.set(null);

    this.cuestionarioService
      .generar({
        materia_id: this.materiaId(),
        documento_id: this.documentoId() || null,
        cantidad_preguntas: this.cantidadPreguntas(),
        dificultad: this.dificultad(),
        tipos: this.tipos(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cuestionario) => {
          this.generando.set(false);
          this.mensajeExito.set(`"${cuestionario.titulo}" se generó correctamente.`);
          this.agregarCuestionario(cuestionario);
          this.resolviendo.set({ id: cuestionario.id, titulo: cuestionario.titulo });
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudo generar el cuestionario. Inténtalo de nuevo.'),
          );
          this.generando.set(false);
        },
      });
  }

  resolver(cuestionario: CuestionarioResumen): void {
    this.errorAccion.set(null);
    this.resolviendo.set({ id: cuestionario.id, titulo: cuestionario.titulo });
  }

  abrirCuestionarioSolicitado(cuestionarios: CuestionarioResumen[]): void {
    const idSolicitado = this.cuestionarioSolicitadoId();
    const cuestionario = cuestionarios.find((item) => item.id === idSolicitado);

    if (!cuestionario) {
      return;
    }

    this.cuestionarioSolicitadoId.set(null);
    this.resolver(cuestionario);
  }

  cambiarFechaPublicacion(
    cuestionarioId: string,
    campo: 'inicio' | 'limite',
    evento: Event,
  ): void {
    const valor = this.valorCampo(evento);

    this.ventanasPublicacion.update((ventanas) => ({
      ...ventanas,
      [cuestionarioId]: {
        ...ventanas[cuestionarioId],
        [campo]: valor,
      },
    }));
  }

  fechaPublicacion(cuestionarioId: string, campo: 'inicio' | 'limite'): string {
    return this.ventanasPublicacion()[cuestionarioId]?.[campo] ?? '';
  }

  cerrarResolver(): void {
    this.resolviendo.set(null);
  }

  abrirEvaluacion(intento: IntentoHistorial): void {
    this.errorAccion.set(null);
    this.resolviendo.set({
      id: intento.cuestionario_id,
      titulo: intento.cuestionario_titulo ?? 'Evaluación guardada',
      intentoId: intento.id,
    });
  }

  publicar(cuestionario: CuestionarioResumen, publicado: boolean): void {
    if (this.publicandoId()) {
      return;
    }

    const ventana = publicado ? this.construirVentana(cuestionario.id) : undefined;

    if (publicado && !ventana) {
      return;
    }

    this.publicandoId.set(cuestionario.id);
    this.errorAccion.set(null);
    this.mensajeExito.set(null);

    this.cuestionarioService
      .publicar(cuestionario.id, publicado, ventana ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.cuestionarios.update((actuales) =>
            actuales.map((actual) => (actual.id === actualizado.id ? actualizado : actual)),
          );
          this.mensajeExito.set(
            publicado
              ? `"${actualizado.titulo}" está disponible para tus estudiantes.`
              : `"${actualizado.titulo}" ya no está disponible para tus estudiantes.`,
          );
          this.publicandoId.set(null);
          this.cargarDisponibles();
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo cambiar la publicación del cuestionario.'),
          );
          this.publicandoId.set(null);
        },
      });
  }

  private inicializarVentanas(cuestionarios: CuestionarioResumen[]): void {
    const ventanas = { ...this.ventanasPublicacion() };

    for (const cuestionario of cuestionarios) {
      if (!ventanas[cuestionario.id]) {
        ventanas[cuestionario.id] = {
          inicio: this.aFechaLocal(cuestionario.fecha_inicio),
          limite: this.aFechaLocal(cuestionario.fecha_limite),
        };
      }
    }

    this.ventanasPublicacion.set(ventanas);
  }

  private aFechaLocal(iso: string | null): string {
    if (!iso) {
      return '';
    }

    const fecha = new Date(iso);

    if (Number.isNaN(fecha.getTime())) {
      return '';
    }

    const desplazamiento = fecha.getTimezoneOffset() * 60_000;
    return new Date(fecha.getTime() - desplazamiento).toISOString().slice(0, 16);
  }

  private construirVentana(cuestionarioId: string): VentanaPublicacion | null {
    const ventana = this.ventanasPublicacion()[cuestionarioId];
    const inicio = Date.parse(ventana?.inicio ?? '');
    const limite = Date.parse(ventana?.limite ?? '');

    if (Number.isNaN(inicio) || Number.isNaN(limite)) {
      this.errorAccion.set('Indica la fecha de inicio y la fecha límite antes de publicar.');
      return null;
    }

    if (limite < inicio) {
      this.errorAccion.set('La fecha límite no puede ser anterior a la fecha de inicio.');
      return null;
    }

    return {
      fecha_inicio: new Date(inicio).toISOString(),
      fecha_limite: new Date(limite).toISOString(),
    };
  }

  verCalificaciones(cuestionario: CuestionarioResumen): void {
    this.errorAccion.set(null);
    this.calificacionesDe.set({ id: cuestionario.id, titulo: cuestionario.titulo });
  }

  cerrarCalificaciones(): void {
    this.calificacionesDe.set(null);
  }

  alCompletar(): void {
    this.cargarCuestionarios();
    this.cargarIntentos();
    this.cargarDisponibles();
  }

  solicitarEliminar(cuestionario: CuestionarioResumen): void {
    if (this.confirmandoEliminar() === cuestionario.id) {
      this.eliminar(cuestionario);
      return;
    }

    this.confirmandoEliminar.set(cuestionario.id);
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(null);
  }

  eliminar(cuestionario: CuestionarioResumen): void {
    if (this.eliminandoId()) {
      return;
    }

    this.eliminandoId.set(cuestionario.id);
    this.errorAccion.set(null);

    this.cuestionarioService
      .eliminar(cuestionario.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cuestionarios.update((cuestionarios) =>
            cuestionarios.filter((actual) => actual.id !== cuestionario.id),
          );
          this.totalCuestionarios.update((total) => Math.max(0, total - 1));
          this.confirmandoEliminar.set(null);
          this.eliminandoId.set(null);
          this.mensajeExito.set(`"${cuestionario.titulo}" se eliminó.`);
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo eliminar el cuestionario.'),
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

  etiquetaDificultad(cuestionario: CuestionarioResumen): string {
    return this.cuestionarioService.etiquetaDificultad(cuestionario.dificultad);
  }

  private agregarCuestionario(cuestionario: CuestionarioGenerado): void {
    this.cuestionarios.update((actuales) => [cuestionario as CuestionarioResumen, ...actuales]);
    this.totalCuestionarios.update((total) => total + 1);
  }
}
