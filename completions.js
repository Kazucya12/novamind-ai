import { handle } from '../../../lib/proxy.js';
export const POST = (req) => handle(req, 'chat');
export const OPTIONS = (req) => handle(req, 'chat');
