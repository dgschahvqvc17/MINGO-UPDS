import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defaultIfEmpty, last, switchMap, tap } from 'rxjs';
import {
  EXTENSIONES_ACEPTADAS,
  TAMANO_MAXIMO_BYTES,
  DocumentoService,
  type Documento,
} from '../../../../core/services/documento.service';
import { mensajeDeErrorHttp } from '../../../../core/utils/http-error';
import type { Materia } from '../../../../core/services/materia.service';

type Fase = 'inactivo' | 'firmando' | 'subiendo' | 'registrando';

const MENSAJE_SUBIDA_FALLIDA =
  'No se pudo subir el archivo a S3. Revisa tu conexión e inténtalo de nuevo.';

@Component({
  selector: 'app-documento-upload',
  imports: [ReactiveFormsModule],
  templateUrl: './documento-upload.html',
  styleUrl: './documento-upload.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoUploadComponent {
  private readonly documentoService = inject(DocumentoService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly materias = input.required<Materia[]>();
  readonly materiaSeleccionada = input<string>('');
  readonly cargado = output<Documento>();
  readonly cancelado = output<void>();

  readonly inputArchivo = viewChild<ElementRef<HTMLInputElement>>('archivoInput');

  readonly archivo = signal<File | null>(null);
  readonly fase = signal<Fase>('inactivo');
  readonly progreso = signal(0);
  readonly error = signal<string | null>(null);
  readonly arrastrando = signal(false);

  readonly extensionesAceptadas = EXTENSIONES_ACEPTADAS.join(',');
  readonly tamanoMaximoMb = Math.round(TAMANO_MAXIMO_BYTES / (1024 * 1024));

  readonly form = this.formBuilder.nonNullable.group({
    materia_id: ['', [Validators.required]],
    nombre: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(255)],
    ],
  });

  constructor() {
    const materia = this.materiaSeleccionada();
    if (materia) {
      this.form.controls.materia_id.setValue(materia);
    }
  }

  get enviando(): boolean {
    return this.fase() !== 'inactivo';
  }

  get nombreControl() {
    return this.form.controls.nombre;
  }

  get materiaControl() {
    return this.form.controls.materia_id;
  }

  alSeleccionarArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (archivo) {
      this.validarArchivo(archivo, input);
    }
  }

  alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);

    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) {
      this.validarArchivo(archivo);
    }
  }

  alArrastrar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(true);
  }

  alSalirArrastre(): void {
    this.arrastrando.set(false);
  }

  enviar(): void {
    this.form.markAllAsTouched();

    const archivo = this.archivo();
    if (this.form.invalid || !archivo || this.enviando) {
      if (!archivo) {
        this.error.set('Selecciona un archivo antes de continuar.');
      }
      return;
    }

    const formato = this.documentoService.obtenerFormatoPorNombre(archivo.name);
    if (!formato) {
      this.error.set('El formato del archivo no está permitido.');
      return;
    }

    const nombre = this.form.controls.nombre.value.trim();
    const materiaId = this.form.controls.materia_id.value;

    this.error.set(null);
    this.progreso.set(0);
    this.fase.set('firmando');

    this.documentoService
      .solicitarUrlCarga({
        nombre_archivo: archivo.name,
        tipo_archivo: formato.mime,
        tamano: archivo.size,
        materia_id: materiaId,
      })
      .pipe(
        switchMap((respuesta) => {
          this.fase.set('subiendo');

          return this.documentoService.subirArchivo(respuesta.uploadUrl, archivo).pipe(
            tap((progreso) => this.progreso.set(progreso)),
            defaultIfEmpty(100),
            last(),
            switchMap(() => {
              this.fase.set('registrando');
              this.progreso.set(100);

              return this.documentoService.registrar({
                objectKey: respuesta.objectKey,
                nombre,
                materia_id: materiaId,
                unidad_id: null,
              });
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (documento) => {
          this.fase.set('inactivo');
          this.cargado.emit(documento);
          this.reiniciar();
        },
        error: (error: unknown) => {
          const falloEnSubida = this.fase() === 'subiendo';
          this.fase.set('inactivo');
          this.progreso.set(0);
          this.error.set(
            falloEnSubida
              ? MENSAJE_SUBIDA_FALLIDA
              : mensajeDeErrorHttp(error, 'No se pudo registrar el documento.'),
          );
        },
      });
  }

  cancelar(): void {
    if (this.enviando) {
      return;
    }

    this.cancelado.emit();
  }

  quitarArchivo(): void {
    if (this.enviando) {
      return;
    }

    this.archivo.set(null);
    this.error.set(null);

    const input = this.inputArchivo()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  faseTexto(): string {    const textos: Record<Fase, string> = {
      inactivo: '',
      firmando: 'Preparando la carga...',
      subiendo: 'Subiendo el archivo...',
      registrando: 'Guardando en tu biblioteca...',
    };

    return textos[this.fase()];
  }

  formatearTamano(bytes: number): string {
    return this.documentoService.formatearTamano(bytes);
  }

  private validarArchivo(archivo: File, input?: HTMLInputElement): void {
    this.error.set(null);

    const formato = this.documentoService.obtenerFormatoPorNombre(archivo.name);

    if (!formato) {
      this.rechazar('Formato no permitido. Se aceptan PDF, DOC, DOCX, PPT, PPTX y TXT.', input);
      return;
    }

    if (archivo.size === 0) {
      this.rechazar('El archivo está vacío.', input);
      return;
    }

    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      this.rechazar(`El archivo supera el límite de ${this.tamanoMaximoMb} MB.`, input);
      return;
    }

    this.archivo.set(archivo);

    if (!this.form.controls.nombre.value) {
      this.form.controls.nombre.setValue(this.nombreSinExtension(archivo.name));
      this.form.controls.nombre.markAsDirty();
    }
  }

  private rechazar(mensaje: string, input?: HTMLInputElement): void {
    this.error.set(mensaje);
    this.archivo.set(null);
    if (input) {
      input.value = '';
    }
  }

  private nombreSinExtension(nombreArchivo: string): string {
    const extension = this.documentoService.obtenerExtension(nombreArchivo);
    const nombre = extension ? nombreArchivo.slice(0, -extension.length) : nombreArchivo;

    return nombre.slice(0, 255).trim();
  }

  private reiniciar(): void {
    this.archivo.set(null);
    this.progreso.set(0);
    this.form.controls.nombre.reset('');
    this.form.controls.nombre.markAsPristine();
    this.form.controls.nombre.markAsUntouched();

    const input = this.inputArchivo()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }
}
