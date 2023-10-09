import { FetchControllerConfig } from './fetch/FetchControllerConfig';
import { JsonRefResolver } from '@enraged-dun-cookie-development-team/common/json';
import json5 from 'json5';
import clone from 'clone';

export * from './datasource/DataSource';
export * from './fetch/FetchController';
export * from './fetch/FetchResult';
export * from './fetch/FetchControllerConfig';
export { JsonDataSource } from './datasource/JsonDataSource';
export type { DataSourceConfig } from './datasource/DataSourceConfig';
export type { FetchData } from './fetch/CookieFetcher';
export type { DataSourceRegisterInfo } from './fetch/DataSourceRegisterInfo';

export async function parseConfig<T = FetchControllerConfig>(configStr: string): Promise<T> {
  const resolveResult = await JsonRefResolver.resolve(json5.parse(configStr));
  if (resolveResult.errors.length > 0) {
    const msg = resolveResult.errors.map((it) => `${it.path.join('/')}:${it.message}`).toString();
    throw new Error(`配置文件解析引用时出错：${msg}`);
  }
  // JsonRefResolver返回的内容是不可变的，但是配置校验过程中包含对原始配置的修改流程(目前只有给group添加默认name)，所以要deepClone一下
  const config = resolveResult.result as T;
  return clone(config);
}
