import * as migration_20260611_151745 from './20260611_151745';
import * as migration_20260620_205416 from './20260620_205416';

export const migrations = [
  {
    up: migration_20260611_151745.up,
    down: migration_20260611_151745.down,
    name: '20260611_151745',
  },
  {
    up: migration_20260620_205416.up,
    down: migration_20260620_205416.down,
    name: '20260620_205416'
  },
];
