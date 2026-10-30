import { setupServer } from 'msw/node';

/** The one MSW server of the unit project: tests add handlers with mswServer.use(...). */
export const mswServer = setupServer();

export const API = 'https://api.test';
export const IDP = 'https://idp.test';
