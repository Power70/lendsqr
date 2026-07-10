// Root re-export so the knex CLI (npm run migrate:*) finds the config;
// the app itself imports src/config/knexfile directly.
import knexConfig from './src/config/knexfile';

export default knexConfig;
