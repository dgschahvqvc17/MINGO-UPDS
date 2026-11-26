import { Injectable, signal } from '@angular/core';

const CLAVE_ASISTENTE_FLOTANTE = 'mingo.asistente-flotante.visible';

function leerAsistenteFlotante(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const valorGuardado = window.localStorage.getItem(CLAVE_ASISTENTE_FLOTANTE);
    return valorGuardado === null ? true : valorGuardado === 'true';
  } catch {
    // El almacenamiento puede estar bloqueado; se conserva el valor por defecto.
    return true;
  }
}

/**
 * Preferencias visuales locales del navegador. No forman parte de la cuenta
 * del usuario, por lo que no se envían al backend.
 */
@Injectable({ providedIn: 'root' })
export class PreferenciasInterfazService {
  private readonly asistenteFlotanteSignal = signal(leerAsistenteFlotante());

  readonly asistenteFlotanteVisible = this.asistenteFlotanteSignal.asReadonly();

  establecerAsistenteFlotante(visible: boolean): void {
    this.asistenteFlotanteSignal.set(visible);

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(CLAVE_ASISTENTE_FLOTANTE, String(visible));
    } catch {
      // Sin almacenamiento la preferencia permanece solo durante esta sesión.
    }
  }
}
