import { CookieIdsPersister } from '../../src';

export const mockCookieIdsPersister: CookieIdsPersister = {
  readCookieIds(): Promise<string[] | false> {
    return Promise.resolve([]);
  },
  writeCookieIds(): Promise<boolean> {
    return Promise.resolve(true);
  },
};
