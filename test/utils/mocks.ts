import { CookieIdsPersister } from '../../src/datasource/DataSourceConfig';

export const mockCookieIdsPersister: CookieIdsPersister = {
  readCookieIds(): Promise<string[] | false> {
    return Promise.resolve([]);
  },
  writeCookieIds(): Promise<boolean> {
    return Promise.resolve(true);
  },
};
