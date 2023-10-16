import { FetchResult } from '../fetch/FetchResult';
import { CommonRequestOptions, Http } from '@enraged-dun-cookie-development-team/common/request';
import { Logger } from '@enraged-dun-cookie-development-team/common/logger';
import { Schema } from 'ajv';
import { DateTime } from 'luxon';
import { ErrorObject } from 'ajv/lib/types';
import { DataSourceConfig } from './DataSourceConfig';
import { JsonValidator } from '@enraged-dun-cookie-development-team/common/json';
import { DataContentType, DataContentUnion, DataItem, Timestamp } from './DataContent';

/**
 * 显示信息
 */
export interface DisplayInfo {
  /**
   * 图标
   */
  readonly icon: string;
  /**
   * 名字
   */
  readonly name: string;
}

export class DataSourceTypeInfo {
  /**
   * @param platform 唯一的平台名
   * @param type 相同平台下的唯一数据源类型
   * @param reqCountEachFetch 每次蹲饼的请求数量
   */
  constructor(
    readonly platform: string,
    readonly type: string,
    readonly reqCountEachFetch: number = 1
  ) {}

  get id() {
    return this.platform + ':' + this.type;
  }
}

export function DataSourceId(type: DataSourceTypeInfo, dataId: string) {
  return { typeId: type.id, dataId };
}

export type DataSourceId = ReturnType<typeof DataSourceId>;

const PERSIST_CACHE_COUNT = 100;

// noinspection JSUnusedGlobalSymbols
export abstract class DataSource {
  protected readonly logger: Logger;
  readonly id: DataSourceId;
  readonly idStr: string;

  protected cookieIdCacheInited = false;
  private cookieIdCacheMap: Record<string, boolean> = {};
  private cookieIdCacheListForPersist: string[] = [];
  private readonly initPromise: Promise<unknown>;
  private lastPersistWritePromise: Promise<unknown> | undefined;

  /**
   * @param type 类型信息
   * @param dataId 数据源id，相同平台唯一，不同平台可以重复(用于内部识别)
   * @param config 自定义配置
   */
  protected constructor(
    readonly type: DataSourceTypeInfo,
    dataId: string,
    readonly config: DataSourceConfig
  ) {
    this.logger = config.logger;
    this.id = DataSourceId(type, dataId);
    this.idStr = `${this.id.typeId}:${this.id.dataId}`;
    if (config.persistCookieIds) {
      // 使用allSettled保证无论如何initPromise都不会进入reject状态
      this.initPromise = Promise.allSettled([
        config.persistCookieIds.readCookieIds(this).then((list) => {
          if (list) {
            this.cookieIdCacheListForPersist = list;
            list.forEach((id) => {
              this.cookieIdCacheMap[id] = true;
            });
            this.cookieIdCacheInited = true;
          }
        }),
      ]);
    } else {
      this.initPromise = Promise.resolve([]);
    }
    Object.defineProperty(this, 'cookieIdCacheMap', {
      enumerable: false,
    });
  }

  async fetchData(): Promise<FetchResult> {
    await this.initPromise;
    const items = await this.fetchOnce();
    // 把schemaErrors设为禁止枚举以避免被JSON序列化，如果需要的话应当显式获取该字段
    items.forEach((it) => {
      if (Object.hasOwn(it, 'schemaErrors')) {
        Object.defineProperty(it, 'schemaErrors', { enumerable: false });
      }
    });
    const newItems = this.filterNewCookies(items);
    if (!this.cookieIdCacheInited) {
      // 如果饼id列表没有初始化完成的话就把这一轮蹲饼视为初始化(filterNewCookies中会缓存本次蹲到的饼作为旧饼)，然后强制本次新饼列表为空
      this.cookieIdCacheInited = true;
      return new FetchResult(items, []);
    }
    return new FetchResult(items, newItems);
  }

  protected abstract fetchOnce(): Promise<DataItem[]>;

  createDisplayInfo(): Promise<DisplayInfo> | undefined {
    return;
  }

  async sendGetJson<T = unknown>(
    url: string | URL,
    options?: CommonRequestOptions & { schema?: Schema }
  ): Promise<{ json: T; errors?: ErrorObject[] }> {
    const response = await this.sendGet(url, options);
    const json = JSON.parse(response) as T;
    if (options?.schema) {
      if (!JsonValidator.validate(options.schema, json)) {
        this.logger.warn(`数据源[${this.idStr}]的请求[${url.toString()}]的响应数据不满足预定义格式`, JsonValidator.errorMessagesToString());
        return { json, errors: JsonValidator.errors as ErrorObject[] };
      }
    }
    return { json };
  }

  async sendGet(url: string | URL, options?: CommonRequestOptions): Promise<string> {
    return await Http.get(url, { timeout: 30 * 1000, ...options, ...this.config.requestOptions });
  }

  /**
   * 从饼列表中筛选出新饼<p>
   * <strong>注意：该方法不是幂等的，务必只在每次执行完蹲饼后调用一次，多次调用返回的内容是不确定的</strong>
   * @param items 饼列表
   */
  private filterNewCookies(items: DataItem[]) {
    const newCookies: DataItem[] = [];
    const newCookieIds: string[] = [];
    for (const item of items) {
      if (item.type === DataContentType.COMMON) {
        if (!this.cookieIdCacheMap[item.id]) {
          this.cookieIdCacheMap[item.id] = true;
          newCookies.push(item);
          newCookieIds.push(item.id);
        }
      } else if (item.type === DataContentType.JSON || item.type === DataContentType.KV) {
        newCookies.push(item);
      }
    }
    if (this.config.persistCookieIds) {
      if (newCookieIds.length > 0) {
        this.cookieIdCacheListForPersist.push(...newCookieIds);
        this.cookieIdCacheListForPersist.splice(0, this.cookieIdCacheListForPersist.length - PERSIST_CACHE_COUNT); // 不删除cookieIdCacheMap里的旧饼id，避免出现因为各种原因数据里出现旧饼然后被当成新饼的情况
      }
      if (newCookieIds.length > 0 || this.cookieIdCacheListForPersist.length === 0) {
        this.lastPersistWritePromise = this.config.persistCookieIds.writeCookieIds(this, this.cookieIdCacheListForPersist);
      }
    }
    return newCookies;
  }

  protected parseTime(value: string, format: string, useFallback = true, zone = 'UTC+8'): DateTime {
    const time = DateTime.fromFormat(value, format);
    if (time.isValid) {
      return time;
    }

    if (useFallback && !isNaN(Date.parse(value))) {
      let date = new Date(value);
      // 使用en-US以保证在任何运行环境都可用，如果使用其它locate的话不确定会不会在某个运行环境没有特定locate，h23表示0-23小时制
      date = new Date(
        `${date.toLocaleDateString('en-US', { calendar: 'iso8601' })} ${date.toLocaleTimeString('en-US', { hourCycle: 'h23' })}Z`
      );
      const jsTime = DateTime.fromISO(date.toISOString().slice(0, -1), { zone: zone });
      this.logger.warn(
        `[${this.idStr}]时间戳[${value}]格式异常：` +
          `${String(time.invalidReason)}: ${String(time.invalidExplanation)}，` +
          `使用回退机制解析为${jsTime.toJSON()!}`
      );
      if (jsTime.isValid) {
        return jsTime;
      }
    }

    throw new Error(`[${this.idStr}]时间戳[${value}]无法解析`);
  }

  protected createDataItem(
    content: DataContentUnion,
    schemaErrors?: ErrorObject[],
    timestamp: Timestamp = { timestampPrecision: 'none' }
  ): DataItem {
    return {
      dataSourceId: this.id,
      fetchTime: Date.now(),
      schemaErrors,
      ...timestamp,
      ...content,
    };
  }

  async gracefulShutdown() {
    if (this.lastPersistWritePromise) await this.lastPersistWritePromise;
  }

  /**
   * JSON序列化时只输出id
   */
  toJSON() {
    return this.id;
  }

  getPlatform() {
    return this.id.typeId.split(':')[0];
  }
}
