import { Component } from '@angular/core';

@Component({
  selector: 'app-ui-showcase',
  template: `
    <div class="container py-6">
      <!-- Hero Section -->
      <div class="mb-8 text-center">
        <span class="page-eyebrow mb-2 d-inline-block">Sistema de Diseño MINGO</span>
        <h1 class="page-title mb-3">UI Component Showcase</h1>
        <p class="page-subtitle mx-auto">
          Demostración del sistema de diseño mejorado con Tailwind inspirado, paleta oficial y
          componentes IA
        </p>
      </div>

      <!-- Color Palette Grid -->
      <section class="mb-8">
        <h2 class="h4 mb-4 text-primary">Paleta de Colores Oficial</h2>
        <div class="row g-4">
          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--hover p-4">
              <div class="d-flex align-items-center mb-3">
                <div
                  class="color-swatch me-3"
                  style="background-color: #060B18; width: 40px; height: 40px; border-radius: var(--mingo-radius);"
                ></div>
                <div>
                  <div class="fw-semibold">Fondo Principal</div>
                  <div class="text-muted small">#060B18</div>
                </div>
              </div>
              <p class="text-muted small mb-0">
                Azul oscuro profundo para el fondo de la aplicación
              </p>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--hover p-4">
              <div class="d-flex align-items-center mb-3">
                <div
                  class="color-swatch me-3"
                  style="background-color: #0A1128; width: 40px; height: 40px; border-radius: var(--mingo-radius);"
                ></div>
                <div>
                  <div class="fw-semibold">Superficie</div>
                  <div class="text-muted small">#0A1128</div>
                </div>
              </div>
              <p class="text-muted small mb-0">Azul marino para tarjetas y contenedores</p>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--hover p-4">
              <div class="d-flex align-items-center mb-3">
                <div
                  class="color-swatch me-3"
                  style="background-color: #2563EB; width: 40px; height: 40px; border-radius: var(--mingo-radius);"
                ></div>
                <div>
                  <div class="fw-semibold">Color Primario</div>
                  <div class="text-muted small">#2563EB</div>
                </div>
              </div>
              <p class="text-muted small mb-0">Azul vibrante de alta visibilidad (Marca)</p>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--hover p-4">
              <div class="d-flex align-items-center mb-3">
                <div
                  class="color-swatch me-3"
                  style="background-color: #38BDF8; width: 40px; height: 40px; border-radius: var(--mingo-radius); border: 2px solid rgba(56, 189, 248, 0.3);"
                ></div>
                <div>
                  <div class="fw-semibold">Color IA</div>
                  <div class="text-muted small">#38BDF8</div>
                </div>
              </div>
              <p class="text-muted small mb-0">Azul ciano para componentes inteligentes</p>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--hover p-4">
              <div class="d-flex align-items-center mb-3">
                <div
                  class="color-swatch me-3"
                  style="background-color: #10B981; width: 40px; height: 40px; border-radius: var(--mingo-radius);"
                ></div>
                <div>
                  <div class="fw-semibold">Éxito</div>
                  <div class="text-muted small">#10B981</div>
                </div>
              </div>
              <p class="text-muted small mb-0">Esmeralda para estados de éxito/indexado</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Card Variations -->
      <section class="mb-8">
        <h2 class="h4 mb-4 text-primary">Variaciones de Tarjetas</h2>
        <div class="row g-4">
          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--hover p-4">
              <div class="icon-badge icon-badge--primary mb-3">
                <i class="bi bi-card-text"></i>
              </div>
              <h3 class="h5 mb-2">Tarjeta Estándar</h3>
              <p class="text-muted mb-3">
                Fondo azul marino con borde sutil y efecto hover elegante
              </p>
              <span class="badge badge-success">Disponible</span>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--elevated p-4">
              <div class="icon-badge icon-badge--ai mb-3">
                <i class="bi bi-stars"></i>
              </div>
              <h3 class="h5 mb-2">Tarjeta Elevada</h3>
              <p class="text-muted mb-3">
                Fondo más profundo con sombras extendidas y hover dramático
              </p>
              <span class="ai-badge">IA Avanzada</span>
            </div>
          </div>

          <div class="col-12 col-md-6 col-lg-4">
            <div class="app-card app-card--glass p-4">
              <div class="icon-badge icon-badge--gradient mb-3">
                <i class="bi bi-gem"></i>
              </div>
              <h3 class="h5 mb-2">Tarjeta Glass</h3>
              <p class="text-muted mb-3">
                Efecto de cristal esmerilado con blur y transparencia premium
              </p>
              <span class="badge badge-role">Premium</span>
            </div>
          </div>
        </div>
      </section>

      <!-- AI Components -->
      <section class="mb-8">
        <h2 class="h4 mb-4 text-ai">Componentes de IA</h2>
        <div class="app-card app-card--ai p-4">
          <div class="row align-items-center">
            <div class="col-md-8">
              <div class="d-flex align-items-center mb-3">
                <div class="icon-badge icon-badge--ai icon-badge--lg me-3">
                  <i class="bi bi-stars"></i>
                </div>
                <div>
                  <h3 class="h5 mb-1">Asistente de Estudio IA</h3>
                  <span class="ai-badge ai-badge--sparkle">Contexto RAG</span>
                </div>
              </div>
              <p class="text-muted mb-3">
                Sube tus documentos y obtén resúmenes, explicaciones y cuestionarios generados con
                IA. El asistente utiliza embeddings vectoriales para entender el contexto de tus
                materiales.
              </p>
              <div class="d-flex gap-2">
                <span class="status-dot status-dot--active me-2"></span>
                <span class="text-muted small">Modelo GPT-4 activo</span>
              </div>
            </div>
            <div class="col-md-4 text-end">
              <button class="btn btn-primary mt-3 mt-md-0">
                <i class="bi bi-robot me-2"></i>
                Probar IA
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Interactive Elements -->
      <section class="mb-8">
        <h2 class="h4 mb-4 text-primary">Elementos Interactivos</h2>
        <div class="app-card p-4">
          <div class="row g-4">
            <div class="col-12 col-md-6">
              <h3 class="h6 mb-3">Botones</h3>
              <div class="d-flex flex-wrap gap-2 mb-4">
                <button class="btn btn-primary">
                  <i class="bi bi-rocket-takeoff me-2"></i>
                  Primario
                </button>
                <button class="btn btn-outline-secondary">
                  <i class="bi bi-gear me-2"></i>
                  Secundario
                </button>
                <button class="btn btn-outline-danger">
                  <i class="bi bi-trash me-2"></i>
                  Peligro
                </button>
              </div>

              <div class="d-flex flex-wrap gap-2 mb-3">
                <div class="btn-icon">
                  <i class="bi bi-chat-left-text"></i>
                </div>
                <div class="btn-icon btn-icon--danger">
                  <i class="bi bi-trash"></i>
                </div>
                <div class="btn-icon">
                  <i class="bi bi-share"></i>
                </div>
                <div class="btn-icon">
                  <i class="bi bi-star"></i>
                </div>
              </div>
            </div>

            <div class="col-12 col-md-6">
              <h3 class="h6 mb-3">Badges y Estados</h3>
              <div class="d-flex flex-wrap gap-2 mb-3">
                <span class="badge badge-primary">Estudiante</span>
                <span class="badge badge-success">Activo</span>
                <span class="badge badge-warning">Pendiente</span>
                <span class="badge badge-danger">Error</span>
                <span class="badge badge-info">IA</span>
              </div>

              <div class="d-flex flex-wrap gap-3 align-items-center mb-3">
                <span class="status-dot status-dot--active"></span>
                <span class="small">En línea</span>

                <span class="status-dot status-dot--inactive"></span>
                <span class="small">Offline</span>

                <span class="status-dot status-dot--warning"></span>
                <span class="small">Advertencia</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Form Elements -->
      <section class="mb-8">
        <h2 class="h4 mb-4 text-primary">Elementos de Formulario</h2>
        <div class="app-card p-4">
          <div class="row g-4">
            <div class="col-12 col-md-6">
              <div class="mb-3">
                <label for="inputEmail" class="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  class="form-control"
                  id="inputEmail"
                  placeholder="usuario@mingo.edu"
                />
                <div class="form-text">Ingresa tu correo institucional</div>
              </div>

              <div class="mb-3">
                <label for="inputPassword" class="form-label">Contraseña</label>
                <div class="input-with-icon">
                  <i class="bi bi-lock"></i>
                  <input
                    type="password"
                    class="form-control"
                    id="inputPassword"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div class="col-12 col-md-6">
              <div class="mb-3">
                <label for="selectCourse" class="form-label">Materia</label>
                <select class="form-select" id="selectCourse">
                  <option selected>Selecciona una materia</option>
                  <option value="1">Matemáticas Avanzadas</option>
                  <option value="2">Física Cuántica</option>
                  <option value="3">Programación IA</option>
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label">Archivos</label>
                <div class="input-group">
                  <input type="file" class="form-control" id="inputFile" />
                  <button class="btn btn-outline-secondary" type="button">
                    <i class="bi bi-upload"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Responsive Grid -->
      <section>
        <h2 class="h4 mb-4 text-primary">Diseño Responsivo</h2>
        <div class="row g-4">
          <div class="col-12 col-sm-6 col-lg-3">
            <div class="app-card app-card--hover p-4 text-center">
              <div class="icon-badge icon-badge--primary icon-badge--circle mx-auto mb-3">
                <i class="bi bi-phone"></i>
              </div>
              <h3 class="h6 mb-2">Mobile First</h3>
              <p class="text-muted small mb-0">Diseño optimizado para dispositivos móviles</p>
            </div>
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <div class="app-card app-card--hover p-4 text-center">
              <div class="icon-badge icon-badge--ai icon-badge--circle mx-auto mb-3">
                <i class="bi bi-tablet"></i>
              </div>
              <h3 class="h6 mb-2">Tablet</h3>
              <p class="text-muted small mb-0">Adaptación perfecta para tablets</p>
            </div>
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <div class="app-card app-card--hover p-4 text-center">
              <div class="icon-badge icon-badge--success icon-badge--circle mx-auto mb-3">
                <i class="bi bi-laptop"></i>
              </div>
              <h3 class="h6 mb-2">Desktop</h3>
              <p class="text-muted small mb-0">Experiencia completa en escritorio</p>
            </div>
          </div>

          <div class="col-12 col-sm-6 col-lg-3">
            <div class="app-card app-card--hover p-4 text-center">
              <div class="icon-badge icon-badge--gradient icon-badge--circle mx-auto mb-3">
                <i class="bi bi-display"></i>
              </div>
              <h3 class="h6 mb-2">Widescreen</h3>
              <p class="text-muted small mb-0">Soporte para pantallas ultra anchas</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .color-swatch {
        position: relative;
        overflow: hidden;
      }

      .color-swatch::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(45deg, transparent 50%, rgba(255, 255, 255, 0.1) 50%);
        background-size: 8px 8px;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .btn-primary {
        background: linear-gradient(135deg, var(--mingo-primary), var(--mingo-primary-hover));
        border: none;
        padding: 0.625rem 1.25rem;
        font-weight: 600;
        transition: all var(--mingo-transition-normal);
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(37, 99, 235, 0.3);
      }

      .btn-outline-secondary:hover {
        border-color: var(--mingo-primary);
        color: var(--mingo-text);
      }

      .form-control,
      .form-select {
        background: rgba(6, 11, 24, 0.5);
        border: 1px solid var(--mingo-border);
        transition: all var(--mingo-transition-fast);
      }

      .form-control:focus,
      .form-select:focus {
        background: rgba(6, 11, 24, 0.7);
        border-color: var(--mingo-primary);
        box-shadow: 0 0 0 0.25rem rgba(37, 99, 235, 0.25);
      }

      .input-group .btn {
        border-color: var(--mingo-border);
        background: rgba(148, 163, 184, 0.08);
      }

      .input-group .btn:hover {
        background: rgba(37, 99, 235, 0.14);
        border-color: rgba(37, 99, 235, 0.4);
      }
    `,
  ],
})
export class UiShowcaseComponent {}
