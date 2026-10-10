import { handle } from '../../lib/proxy.js';
export const GET = (req) => handle(req, 'models');
export const OPTIONS = (req) => handle(req, 'models');
