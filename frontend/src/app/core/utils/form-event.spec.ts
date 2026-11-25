import { estaMarcado, valorDeCampo } from './form-event';

describe('utilidades de eventos de formulario', () => {
  it('lee el valor de un campo de texto', () => {
    const campo = document.createElement('input');
    campo.value = 'Cálculo';
    const evento = new Event('input');

    campo.dispatchEvent(evento);

    expect(valorDeCampo(evento)).toBe('Cálculo');
  });

  it('devuelve una cadena vacía cuando el destino no es un control', () => {
    expect(valorDeCampo(new Event('input'))).toBe('');
  });

  it('lee el estado de una casilla de verificación', () => {
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.checked = true;
    const evento = new Event('change');

    casilla.dispatchEvent(evento);

    expect(estaMarcado(evento)).toBe(true);
  });
});
