import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Notificacion,
  PreferenciasNotificacion,
  TIPOS_NOTIFICACION,
  TipoNotificacion,
} from '../../core/models/dominio.models';
import { NotificacionService } from '../../core/services/notificacion.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';

type FiltroLectura = 'todas' | 'no-leidas' | 'leidas';

const LIMITE_PAGINA = 20;
const ANTICIPACION_MINIMA = 5;
const ANTICIPACION_MAXIMA = 10080;

const ZONAS_HORARIAS = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Argentina/Buenos_Aires',
  'Europe/Madrid',
  'UTC',
] as const;

const ETIQUETAS_TIPO: Record<TipoNotificacion, string> = {
  tarea: 'Tarea',
  evaluacion: 'Evaluación',
  sesion: 'Sesión de estudio',
};

@Component({
  selector: 'app-notificaciones',
  imports: [DatePipe],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacionesPage {
  private readonly notificacionService = inject(NotificacionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly notificaciones = signal<Notificacion[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly totalPaginas = signal(0);
  readonly cargando = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);

  readonly filtroLectura = signal<FiltroLectura>('todas');
  readonly filtroTipo = signal<TipoNotificacion | ''>('');
  readonly tipos = TIPOS_NOTIFICACION;
  readonly etiquetasTipo = ETIQUETAS_TIPO;
  readonly zonasHorarias = ZONAS_HORARIAS;

  readonly preferencias = signal<PreferenciasNotificacion | null>(null);
  readonly notificacionesActivas = signal(true);
  readonly canalEmail = signal(false);
  readonly anticipacionMinutos = signal(60);
  readonly zonaHoraria = signal<string>('America/Bogota');
  readonly guardandoPreferencias = signal(false);
  readonly errorPreferencias = signal<string | null>(null);
  readonly errorAnticipacion = computed(() => {
    const valor = this.anticipacionMinutos();
    return valor < ANTICIPACION_MINIMA || valor > ANTICIPACION_MAXIMA
      ? `La anticipación debe estar entre ${ANTICIPACION_MINIMA} y ${ANTICIPACION_MAXIMA} minutos.`
      : null;
  });

  constructor() {
    this.cargar();
    this.cargarPreferencias();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorMessage.set(null);

    this.notificacionService
      .listar({
        leida: this.leidaFiltro(),
        tipo: this.filtroTipo() || undefined,
        page: this.pagina(),
        limit: LIMITE_PAGINA,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, meta }) => {
          this.notificaciones.set(items);
          this.total.set(meta.total);
          this.totalPaginas.set(meta.totalPages);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(mensajeDeErrorHttp(error, 'No se pudieron cargar las notificaciones.'));
          this.notificaciones.set([]);
          this.cargando.set(false);
        },
      });
  }

  cambiarFiltroLectura(valor: string): void {
    if (valor !== 'todas' && valor !== 'no-leidas' && valor !== 'leidas') {
      return;
    }

    this.filtroLectura.set(valor);
    this.pagina.set(1);
    this.cargar();
  }

  cambiarFiltroTipo(valor: string): void {
    const tipo = TIPOS_NOTIFICACION.find((candidato) => candidato === valor) ?? '';
    this.filtroTipo.set(tipo);
    this.pagina.set(1);
    this.cargar();
  }

  paginaAnterior(): void {
    if (this.pagina() <= 1) {
      return;
    }

    this.pagina.update((valor) => valor - 1);
    this.cargar();
  }

  paginaSiguiente(): void {
    if (this.pagina() >= this.totalPaginas()) {
      return;
    }

    this.pagina.update((valor) => valor + 1);
    this.cargar();
  }

  marcarLeida(notificacion: Notificacion): void {
    if (notificacion.leida) {
      return;
    }

    this.notificacionService
      .marcarLeida(notificacion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.cargar(),
        error: (error: unknown) => {
          this.errorMessage.set(mensajeDeErrorHttp(error, 'No se pudo marcar la notificación.'));
        },
      });
  }

  marcarTodasLeidas(): void {
    this.notificacionService
      .marcarTodasLeidas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mensajeExito.set('Todas las notificaciones quedaron marcadas como leídas.');
          this.cargar();
        },
        error: (error: unknown) => {
          this.errorMessage.set(mensajeDeErrorHttp(error, 'No se pudieron marcar todas como leídas.'));
        },
      });
  }

  guardarPreferencias(): void {
    if (this.errorAnticipacion()) {
      return;
    }

    this.guardandoPreferencias.set(true);
    this.errorPreferencias.set(null);

    this.notificacionService
      .actualizarPreferencias({
        notificaciones_activas: this.notificacionesActivas(),
        canal_email: this.canalEmail(),
        anticipacion_minutos: this.anticipacionMinutos(),
        zona_horaria: this.zonaHoraria(),
        idioma: 'es',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preferencias) => {
          this.preferencias.set(preferencias);
          this.mensajeExito.set('Preferencias de notificaciones guardadas.');
          this.guardandoPreferencias.set(false);
        },
        error: (error: unknown) => {
          this.errorPreferencias.set(
            mensajeDeErrorHttp(error, 'No se pudieron guardar las preferencias.'),
          );
          this.guardandoPreferencias.set(false);
        },
      });
  }

  cambiarAnticipacion(valor: string): void {
    this.anticipacionMinutos.set(Number(valor));
  }

  private leidaFiltro(): boolean | undefined {
    const filtro = this.filtroLectura();
    if (filtro === 'leidas') {
      return true;
    }
    if (filtro === 'no-leidas') {
      return false;
    }
    return undefined;
  }

  private cargarPreferencias(): void {
    this.notificacionService
      .obtenerPreferencias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preferencias) => {
          this.preferencias.set(preferencias);
          this.notificacionesActivas.set(preferencias.notificaciones_activas);
          this.canalEmail.set(preferencias.canal_email);
          this.anticipacionMinutos.set(preferencias.anticipacion_minutos);
          this.zonaHoraria.set(preferencias.zona_horaria);
        },
        error: (error: unknown) => {
          this.errorPreferencias.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar tus preferencias.'),
          );
        },
      });
  }
}
