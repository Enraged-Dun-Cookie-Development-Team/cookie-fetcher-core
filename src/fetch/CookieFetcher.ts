import { DataSource } from '../datasource/DataSource';
import { FetchResult } from './FetchResult';
import { DataSourceGroup } from '../datasource/DataSourceGroup';
import { Logger } from '@enraged-dun-cookie-development-team/common/logger';

/**
 * 蹲饼器
 */
export class CookieFetcher {
  /**
   * @param group 数据源组
   * @param logger 日志器
   */
  constructor(
    readonly group: DataSourceGroup,
    private readonly logger: Logger
  ) {}

  get groupName() {
    return this.group.name;
  }

  /**
   * 蹲一次饼
   */
  async fetchOnce() {
    const source = this.group.next();
    const startTime = Date.now();
    let fetchData: FetchData;
    try {
      const fetchResult = await source.fetchData();
      fetchData = this.buildFetchData(startTime, source, { success: true, result: fetchResult });
    } catch (e) {
      fetchData = this.buildFetchData(startTime, source, { success: false, error: e as Error });
    }
    this.log(fetchData);
    return fetchData;
  }

  private buildFetchData(startTime: number, source: DataSource, result: FetchDataSuccess | FetchDataFail): FetchData {
    const endTime = Date.now();
    return {
      startTime: startTime,
      endTime: endTime,
      elapsedTime: endTime - startTime,
      source: source,
      ...result,
    };
  }

  private log(fetchData: FetchData) {
    if (fetchData.success) {
      this.logger.debug({ fetchData: fetchData }, `[${this.groupName}]蹲饼成功(${this.group.currentSource.idStr})`);
    } else {
      this.logger.warn(
        { fetchData: fetchData, error: fetchData.error },
        `[${this.groupName}]蹲饼失败(${this.group.currentSource.idStr})：${fetchData.error.toString()}`
      );
    }
  }
}

interface FetchDataCommon {
  /**
   * 蹲饼开始时间(unix时间戳)
   */
  startTime: number;
  /**
   * 蹲饼完成时间(unix时间戳)
   */
  endTime: number;
  /**
   * 蹲饼经过的毫秒数(包含网络请求时间和数据源解析响应内容的时间)
   */
  elapsedTime: number;
  /**
   * 本次蹲饼的数据源
   */
  source: DataSource;
}

interface FetchDataSuccess {
  /**
   * 蹲饼结果：成功
   */
  success: true;
  /**
   * 蹲饼结果
   */
  result: FetchResult;
}

interface FetchDataFail {
  /**
   * 蹲饼结果：失败
   */
  success: false;
  /**
   * 导致失败的异常
   */
  error: Error;
}

export type FetchData = FetchDataCommon & (FetchDataSuccess | FetchDataFail);
