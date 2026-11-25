/** Utilidades tipadas para leer valores de eventos nativos en plantillas. */

type ControlDeFormulario = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function controlDelEvento(evento: Event): ControlDeFormulario | null {
  const objetivo = evento.target;
  return objetivo instanceof HTMLInputElement ||
    objetivo instanceof HTMLSelectElement ||
    objetivo instanceof HTMLTextAreaElement
    ? objetivo
    : null;
}

export function valorDeCampo(evento: Event): string {
  return controlDelEvento(evento)?.value ?? '';
}

export function estaMarcado(evento: Event): boolean {
  const objetivo = evento.target;
  return objetivo instanceof HTMLInputElement ? objetivo.checked : false;
}
