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
import {
  DIAS_SEMANA,
  ETIQUETAS_DIAS,
  TIPOS_SESION,
  aFechaLocal,
  aIsoConZona,
  type DiaSemana,
  type PlanEstudio,
  type PlanEstudioDetalle,
  type PropuestaPlan,
  type SesionEstudio,
  type SesionPlanificada,
  type TipoSesion,
} from '../../core/models/plan-estudio.model';
import {
  PlanEstudioService,
  type ConfirmarPlanInput,
  type SesionInput,
} from '../../core/services/plan-estudio.service';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { MascotaAgenteComponent } from '../../shared/components/mascota-agente/mascota-agente.component';
import { crearEstadoMascota } from '../../shared/components/mascota-agente/estado-mascota';
import { CalendarioSesionesComponent } from './components/calendario-sesiones/calendario-sesiones';

const LIMITE_MATERIAS = 100;
const LIMITE_PLANES = 20;

@Component({
  selector: 'app-planes-estudio',
  imports: [DatePipe, RouterLink, CalendarioSesionesComponent, MascotaAgenteComponent],
  templateUrl: './planes-estudio.html',
  styleUrl: './planes-estudio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanesEstudioPage {
  private readonly planService = inject(PlanEstudioService);
  private readonly materiaService = inject(MateriaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly diasSemana = DIAS_SEMANA;
  readonly etiquetasDias = ETIQUETAS_DIAS;
  readonly tiposSesion = TIPOS_SESION;

  readonly materias = signal<Materia[]>([]);
  readonly planes = signal<PlanEstudio[]>([]);
  readonly totalPlanes = signal(0);
  readonly propuesta = signal<PropuestaPlan | null>(null);
  readonly sesionesEditables = signal<SesionPlanificada[]>([]);
  readonly detalle = signal<PlanEstudioDetalle | null>(null);
  readonly planExpandido = signal<string | null>(null);

  readonly editandoPlan = signal(false);
  readonly edicionPlan = signal<{
    objetivo: string;
    fecha_examen: string;
    minutos_por_dia: number;
    dias_disponibles: DiaSemana[];
  }>({
    objetivo: '',
    fecha_examen: '',
    minutos_por_dia: 60,
    dias_disponibles: [],
  });
  readonly sesionEnEdicion = signal<string | null>(null);
  readonly edicionSesion = signal<{
    tema: string;
    actividades: string;
    fecha_inicio: string;
    duracion_minutos: number;
    tipo: TipoSesion | '';
  } | null>(null);

  readonly materiaId = signal('');
  readonly objetivo = signal('');
  readonly fechaExamen = signal('');
  readonly minutosPorDia = signal(60);
  readonly diasSeleccionados = signal<DiaSemana[]>([]);

  readonly cargandoMaterias = signal(false);
  readonly cargandoPlanes = signal(true);
  readonly generando = signal(false);
  private readonly controlMascota = crearEstadoMascota(this.generando, this.destroyRef);
  readonly estadoMascota = this.controlMascota.estado;
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorFormulario = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);

  readonly materiasActivas = computed(() =>
    this.materias().filter((materia) => materia.estado === 'activo'),
  );

  readonly sinMaterias = computed(
    () => !this.cargandoMaterias() && this.materiasActivas().length === 0,
  );

  readonly puedeGenerar = computed(
    () =>
      this.materiaId().length > 0 &&
      this.objetivo().trim().length >= 5 &&
      this.fechaExamen().length > 0 &&
      this.minutosPorDia() >= 15 &&
      this.diasSeleccionados().length > 0 &&
      !this.generando(),
  );

  readonly puedeConfirmar = computed(
    () => this.sesionesEditables().length > 0 && !this.guardando(),
  );

  readonly puedeGuardarPlan = computed(() => {
    const edicion = this.edicionPlan();

    return (
      edicion.objetivo.trim().length >= 5 &&
      edicion.fecha_examen.length > 0 &&
      edicion.minutos_por_dia >= 15 &&
      edicion.dias_disponibles.length > 0 &&
      !this.guardando()
    );
  });

  readonly hayMasPlanes = computed(() => this.planes().length < this.totalPlanes());

  readonly resumenPropuesta = computed(() => {
    const sesiones = this.sesionesEditables();
    const minutos = sesiones.reduce(
      (total, sesion) => total + (Number(sesion.duracion_minutos) || 0),
      0,
    );
    const fechas = sesiones
      .map((sesion) => sesion.fecha_inicio.slice(0, 10))
      .filter((fecha) => fecha.length > 0)
      .sort();

    return {
      cantidad: sesiones.length,
      minutos,
      desde: fechas[0] ?? null,
      hasta: fechas[fechas.length - 1] ?? null,
    };
  });

  readonly estadisticasPlan = computed(() => {
    const sesiones = this.detalle()?.sesiones ?? [];
    const completadas = sesiones.filter((sesion) => sesion.estado === 'completada').length;
    const minutos = sesiones.reduce((total, sesion) => total + sesion.duracion_minutos, 0);

    return {
      total: sesiones.length,
      completadas,
      minutos,
      porcentaje: sesiones.length === 0 ? 0 : Math.round((completadas / sesiones.length) * 100),
    };
  });

  constructor() {
    this.cargarMaterias();
    this.cargarPlanes();
  }

  cargarMaterias(): void {
    this.cargandoMaterias.set(true);

    this.materiaService
      .listarMaterias({ estado: 'activo', limit: LIMITE_MATERIAS })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.materias.set(respuesta.data ?? []);
          this.cargandoMaterias.set(false);
        },
        error: () => {
          this.materias.set([]);
          this.cargandoMaterias.set(false);
          this.errorFormulario.set('No se pudieron cargar tus materias.');
        },
      });
  }

  cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.error.set(null);

    this.planService
      .listar({ limit: LIMITE_PLANES, offset: 0 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ planes, total }) => {
          this.planes.set(planes);
          this.totalPlanes.set(total);
          this.cargandoPlanes.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar tus planes de estudio.'));
          this.planes.set([]);
          this.cargandoPlanes.set(false);
        },
      });
  }

  cargarMas(): void {
    if (this.cargandoPlanes() || !this.hayMasPlanes()) {
      return;
    }

    this.cargandoPlanes.set(true);

    this.planService
      .listar({ limit: LIMITE_PLANES, offset: this.planes().length })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ planes, total }) => {
          this.planes.update((actuales) => [...actuales, ...planes]);
          this.totalPlanes.set(total);
          this.cargandoPlanes.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar más planes.'));
          this.cargandoPlanes.set(false);
        },
      });
  }

  alternarDia(dia: DiaSemana): void {
    this.diasSeleccionados.update((dias) =>
      dias.includes(dia) ? dias.filter((actual) => actual !== dia) : [...dias, dia],
    );
  }

  estaSeleccionado(dia: DiaSemana): boolean {
    return this.diasSeleccionados().includes(dia);
  }

  cambiarMinutos(valor: string): void {
    const minutos = Number(valor);
    this.minutosPorDia.set(Number.isFinite(minutos) ? minutos : 0);
  }

  generarPropuesta(): void {
    if (!this.puedeGenerar()) {
      return;
    }

    this.generando.set(true);
    this.errorFormulario.set(null);
    this.mensajeExito.set(null);
    this.controlMascota.reiniciar();
    this.propuesta.set(null);
    this.sesionesEditables.set([]);

    this.planService
      .proponer({
        materia_id: this.materiaId(),
        objetivo: this.objetivo().trim(),
        fecha_examen: this.fechaExamen(),
        minutos_por_dia: this.minutosPorDia(),
        dias_disponibles: this.diasSeleccionados(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (propuesta) => {
          this.generando.set(false);
          this.propuesta.set(propuesta);
          this.sesionesEditables.set(
            propuesta.sesiones.map((sesion) => ({
              ...sesion,
              fecha_inicio: aFechaLocal(sesion.fecha_inicio),
            })),
          );
          this.controlMascota.anunciarResultado();
        },
        error: (error: unknown) => {
          this.generando.set(false);
          this.errorFormulario.set(
            mensajeDeErrorHttp(error, 'No se pudo generar la propuesta de plan.'),
          );
        },
      });
  }

  descartarPropuesta(): void {
    this.propuesta.set(null);
    this.sesionesEditables.set([]);
    this.errorFormulario.set(null);
  }

  actualizarSesion(
    indice: number,
    campo: keyof SesionPlanificada,
    valor: string | number | TipoSesion,
  ): void {
    this.sesionesEditables.update((sesiones) =>
      sesiones.map((sesion, posicion) =>
        posicion === indice ? { ...sesion, [campo]: valor } : sesion,
      ),
    );
  }

  confirmarPlan(): void {
    const propuesta = this.propuesta();

    if (!propuesta || !this.puedeConfirmar()) {
      return;
    }

    this.guardando.set(true);
    this.errorFormulario.set(null);

    const entrada: ConfirmarPlanInput = {
      materia_id: propuesta.materia_id,
      objetivo: propuesta.objetivo,
      fecha_examen: propuesta.fecha_examen,
      minutos_por_dia: propuesta.minutos_por_dia,
      dias_disponibles: propuesta.dias_disponibles,
      modelo: propuesta.modelo,
      tokens_entrada: propuesta.tokens_entrada,
      tokens_salida: propuesta.tokens_salida,
      sesiones: this.sesionesEditables().map((sesion) => ({
        tema: sesion.tema,
        actividades: sesion.actividades,
        fecha_inicio: aIsoConZona(sesion.fecha_inicio),
        duracion_minutos: sesion.duracion_minutos,
        ...(sesion.tipo ? { tipo: sesion.tipo } : {}),
      })),
    };

    this.planService
      .confirmar(entrada)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (plan) => {
          this.guardando.set(false);
          this.mensajeExito.set('El plan se guardó y sus sesiones ya están en el calendario.');
          this.descartarPropuesta();
          this.planes.update((actuales) => [plan, ...actuales]);
          this.totalPlanes.update((total) => total + 1);
          this.verPlan(plan.id);
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          this.errorFormulario.set(
            mensajeDeErrorHttp(error, 'No se pudo guardar el plan confirmado.'),
          );
        },
      });
  }

  verPlan(planId: string): void {
    if (this.planExpandido() === planId) {
      this.cerrarDetalle();
      return;
    }

    this.planExpandido.set(planId);
    this.detalle.set(null);
    this.cancelarEdicionPlan();
    this.cancelarEdicionSesion();

    this.planService
      .obtener(planId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => this.detalle.set(detalle),
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cargar el detalle del plan.'));
          this.cerrarDetalle();
        },
      });
  }

  cerrarDetalle(): void {
    this.planExpandido.set(null);
    this.detalle.set(null);
    this.cancelarEdicionPlan();
    this.cancelarEdicionSesion();
  }

  iniciarEdicionPlan(plan: PlanEstudioDetalle): void {
    this.edicionPlan.set({
      objetivo: plan.objetivo,
      fecha_examen: plan.fecha_examen,
      minutos_por_dia: plan.minutos_por_dia,
      dias_disponibles: [...plan.dias_disponibles],
    });
    this.cancelarEdicionSesion();
    this.editandoPlan.set(true);
  }

  cancelarEdicionPlan(): void {
    this.editandoPlan.set(false);
  }

  cambiarEdicionPlan(campo: 'objetivo' | 'fecha_examen', valor: string): void {
    this.edicionPlan.update((edicion) => ({ ...edicion, [campo]: valor }));
  }

  cambiarMinutosEdicion(valor: string): void {
    const minutos = Number(valor);
    this.edicionPlan.update((edicion) => ({
      ...edicion,
      minutos_por_dia: Number.isFinite(minutos) ? minutos : 0,
    }));
  }

  alternarDiaEdicion(dia: DiaSemana): void {
    this.edicionPlan.update((edicion) => ({
      ...edicion,
      dias_disponibles: edicion.dias_disponibles.includes(dia)
        ? edicion.dias_disponibles.filter((actual) => actual !== dia)
        : [...edicion.dias_disponibles, dia],
    }));
  }

  guardarEdicionPlan(): void {
    const detalle = this.detalle();

    if (!detalle || !this.puedeGuardarPlan()) {
      return;
    }

    this.guardando.set(true);
    const edicion = this.edicionPlan();

    this.planService
      .actualizar(detalle.id, edicion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.guardando.set(false);
          this.editandoPlan.set(false);
          this.detalle.update((actual) => (actual ? { ...actual, ...actualizado } : actual));
          this.planes.update((actuales) =>
            actuales.map((plan) => (plan.id === actualizado.id ? actualizado : plan)),
          );
          this.mensajeExito.set('Los datos del plan se actualizaron.');
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo actualizar el plan.'));
        },
      });
  }

  editarSesion(sesion: SesionEstudio): void {
    this.cancelarEdicionPlan();
    this.sesionEnEdicion.set(sesion.id);
    this.edicionSesion.set({
      tema: sesion.tema,
      actividades: sesion.actividades,
      fecha_inicio: aFechaLocal(sesion.fecha_inicio),
      duracion_minutos: sesion.duracion_minutos,
      tipo: sesion.tipo ?? '',
    });
  }

  cancelarEdicionSesion(): void {
    this.sesionEnEdicion.set(null);
    this.edicionSesion.set(null);
  }

  cambiarEdicionSesion(
    campo: 'tema' | 'actividades' | 'fecha_inicio' | 'duracion_minutos' | 'tipo',
    valor: string | number,
  ): void {
    this.edicionSesion.update((edicion) =>
      edicion ? { ...edicion, [campo]: valor } : edicion,
    );
  }

  guardarEdicionSesion(): void {
    const sesionId = this.sesionEnEdicion();
    const edicion = this.edicionSesion();

    if (!sesionId || !edicion || this.guardando()) {
      return;
    }

    this.guardando.set(true);

    this.planService
      .actualizarSesion(sesionId, {
        tema: edicion.tema,
        actividades: edicion.actividades,
        fecha_inicio: aIsoConZona(edicion.fecha_inicio),
        duracion_minutos: edicion.duracion_minutos,
        ...(edicion.tipo ? { tipo: edicion.tipo } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizada) => {
          this.guardando.set(false);
          this.cancelarEdicionSesion();
          this.detalle.update((detalle) =>
            detalle
              ? {
                  ...detalle,
                  sesiones: detalle.sesiones.map((item) =>
                    item.id === actualizada.id ? actualizada : item,
                  ),
                }
              : detalle,
          );
          this.mensajeExito.set('La sesión se actualizó.');
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo actualizar la sesión.'));
        },
      });
  }

  cambiarEstadoSesion(sesion: SesionEstudio, estado: 'pendiente' | 'completada'): void {
    this.planService
      .actualizarSesion(sesion.id, { estado })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizada) => {
          this.detalle.update((detalle) =>
            detalle
              ? {
                  ...detalle,
                  sesiones: detalle.sesiones.map((item) =>
                    item.id === actualizada.id ? actualizada : item,
                  ),
                }
              : detalle,
          );
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo actualizar la sesión.'));
        },
      });
  }

  eliminarSesion(sesion: SesionEstudio): void {
    this.planService
      .eliminarSesion(sesion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.detalle.update((detalle) =>
            detalle
              ? {
                  ...detalle,
                  sesiones: detalle.sesiones.filter((item) => item.id !== sesion.id),
                }
              : detalle,
          );
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo eliminar la sesión.'));
        },
      });
  }

  descartarPlan(plan: PlanEstudio): void {
    if (
      !window.confirm(
        `¿Descartar el plan "${plan.objetivo}"? Se eliminarán sus eventos del calendario.`,
      )
    ) {
      return;
    }

    this.planService
      .descartar(plan.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.planes.update((actuales) => actuales.filter((item) => item.id !== plan.id));
          this.totalPlanes.update((total) => Math.max(total - 1, 0));
          if (this.planExpandido() === plan.id) {
            this.cerrarDetalle();
          }
          this.mensajeExito.set('El plan se descartó correctamente.');
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo descartar el plan.'));
        },
      });
  }
}
