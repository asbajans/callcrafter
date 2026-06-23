import * as migration_20260611_151745 from './20260611_151745';
import * as migration_20260623_200000 from './20260623_200000';
import * as migration_20260623_220000 from './20260623_220000';

export const migrations = [
  {
    up: migration_20260611_151745.up,
    down: migration_20260611_151745.down,
    name: '20260611_151745',
  },
  {
    up: migration_20260623_200000.up,
    down: migration_20260623_200000.down,
    name: '20260623_200000',
  },
  {
    up: migration_20260623_220000.up,
    down: migration_20260623_220000.down,
    name: '20260623_220000',
  },
];
