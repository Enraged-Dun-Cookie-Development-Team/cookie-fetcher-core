import { CommonRequestOptions } from '@enraged-dun-cookie-development-team/common/request';
import { Logger } from '@enraged-dun-cookie-development-team/common/logger';
import { DataSource } from './DataSource';

/**
 * 数据源配置
 */
export interface DataSourceConfig {
  /**
   * 日志器
   */
  logger: Logger;
  /**
   * 请求参数，会覆盖数据源提供的参数
   */
  requestOptions?: CommonRequestOptions;
  /**
   * 饼id持久化实现
   */
  persistCookieIds?: CookieIdsPersister;
}

/**
 * 用于饼id读/写持久化
 */
export interface CookieIdsPersister {
  /**
   * 从持久化中读取饼id
   * @param source 数据源
   * @return {Promise<string[] | false>}
   */
  readCookieIds(source: DataSource): Promise<string[] | false>;
  /**
   * 将饼列表id持久化
   * @param source 数据源
   * @param cookieIds 新饼ids
   * @return {Promise<boolean>}
   */
  writeCookieIds(source: DataSource, cookieIds: string[]): Promise<boolean>;
}
