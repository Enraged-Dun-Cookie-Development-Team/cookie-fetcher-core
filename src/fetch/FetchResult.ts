import { DataSourceId } from '../datasource/DataSource';
import { Patch } from 'rfc6902';
import { ErrorObject } from 'ajv';

type TimestampNormal = {
  /**
   * 平台的时间戳，必须是毫秒级的，精度不足的应当补零
   */
  timestamp: number;
  /**
   * 时间戳精度
   */
  timestampPrecision: 'day' | 'hour' | 'minute' | 'second' | 'ms';
};

type TimestampNone = {
  /**
   * 没有时间戳
   */
  timestampPrecision: 'none';
};

export type Timestamp = TimestampNormal | TimestampNone;

type DataContentCommon = {
  /**
   * 通用数据类型
   */
  type: 'common';
  /**
   * 数据id，通常使用平台提供的id即可，不同数据源的id值可以重复
   */
  id: string;
  /**
   * 饼的原始内容
   */
  rawContent: string;
  /**
   * 饼的额外内容
   */
  extraRawContent?: Record<string, string>;
};

/**
 * 用于监视json
 */
export type DataContentJson<T = unknown> = {
  /**
   * json类型
   */
  type: 'json';

  /**
   * 旧内容
   */
  oldValue: T;
  /**
   * 新内容
   */
  newValue: T;
  /**
   * 将oldValue转换成newValue的patch
   */
  patch: Patch;
  /**
   * patch中涉及到的全部路径，代表有哪些路径被修改了
   */
  changePaths: string[];
};

/**
 * 用于监视简单值的key/value
 */
export type DataContentKeyValue<T = unknown> = {
  /**
   * key/value类型
   */
  type: 'kv';

  /**
   * 更新了的key
   */
  key: string;
  /**
   * 旧内容
   */
  oldValue: T;
  /**
   * 新内容
   */
  newValue: T;
};

export type DataContentUnion = DataContentCommon | DataContentJson | DataContentKeyValue;

/**
 * 一个饼
 */
export type DataItem = {
  /**
   * 数据源id
   */
  dataSourceId: DataSourceId;
  /**
   * 蹲饼器蹲到这个饼的时间(unix毫秒时间戳)
   */
  fetchTime: number;
  /**
   * 响应结构不满足预定义结构时产生的异常。
   * 如果是通过正常蹲饼流程拿到的DataItem对象，该字段不会被json序列化输出
   */
  schemaErrors?: ErrorObject[];
} & DataContentUnion &
  Timestamp;

export class FetchResult {
  /**
   * @param allCookies 本次蹲到的所有饼(包括旧饼)，要求从新到旧排序
   * @param newCookies 本次蹲到的新饼，要求从新到旧排序
   */
  constructor(readonly allCookies: DataItem[], readonly newCookies: DataItem[]) {}

  /**
   * JSON序列化时只输出简要的数量信息
   */
  toJSON() {
    return `FetchResult[all=${this.allCookies.length},new=${this.newCookies.length}]`;
  }
}
