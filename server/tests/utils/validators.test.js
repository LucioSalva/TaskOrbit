const { isValidEstado, isValidPrioridad, isNumericId } = require('../../utils/validators');

describe('Validators', () => {
  test('isValidEstado should accept valid estados', () => {
    expect(isValidEstado('por_hacer')).toBe(true);
    expect(isValidEstado('haciendo')).toBe(true);
    expect(isValidEstado('terminada')).toBe(true);
    expect(isValidEstado('enterado')).toBe(true);
    expect(isValidEstado('ocupado')).toBe(true);
    expect(isValidEstado('aceptada')).toBe(true);
  });

  test('isValidEstado should reject invalid estados', () => {
    expect(isValidEstado('otro')).toBe(false);
    expect(isValidEstado(null)).toBe(false);
  });

  test('isValidPrioridad should accept valid prioridades', () => {
    expect(isValidPrioridad('baja')).toBe(true);
    expect(isValidPrioridad('media')).toBe(true);
    expect(isValidPrioridad('alta')).toBe(true);
    expect(isValidPrioridad('critica')).toBe(true);
  });

  test('isValidPrioridad should reject invalid prioridades', () => {
    expect(isValidPrioridad('urgente')).toBe(false);
    expect(isValidPrioridad(undefined)).toBe(false);
  });

  test('isNumericId should validate numeric ids', () => {
    expect(isNumericId(1)).toBe(true);
    expect(isNumericId('3')).toBe(true);
    expect(isNumericId(0)).toBe(false);
    expect(isNumericId('abc')).toBe(false);
  });
});
