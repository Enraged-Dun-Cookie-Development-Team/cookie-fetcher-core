import { DataSourceId } from './DataSource';
import { ErrorObject } from 'ajv';
import { Patch } from 'rfc6902';

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
   * 用于使类型提示更友好
   */
  timestamp?: undefined;
  /**
   * 没有时间戳
   */
  timestampPrecision: 'none';
};
export type Timestamp = TimestampNormal | TimestampNone;

export enum DataContentType {
  COMMON = 'common',
  JSON = 'json',
  KV = 'kv',
}

type DataContentCommon = {
  /**
   * 通用数据类型
   */
  type: DataContentType.COMMON;
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
  type: DataContentType.JSON;

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
  changedPaths: string[];
};

export type PrimitiveWithEmpty = string | boolean | number | undefined | null;
/**
 * 用于监视简单值的key/value，
 */
export type DataContentKeyValue = {
  /**
   * key/value类型
   */
  type: DataContentType.KV;

  /**
   * 旧KV键值对
   */
  oldValue: Record<string, PrimitiveWithEmpty>;
  /**
   * 新KV键值对
   */
  newValue: Record<string, PrimitiveWithEmpty>;

  /**
   * 所有更新的key
   */
  changedKeys: string[];
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
