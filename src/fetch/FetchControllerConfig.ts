import { Static, Type } from '@sinclair/typebox';

// 此处的时间模板字符串类型的来源 https://stackoverflow.com/a/68526558
type D1 = 0 | 1;
type D3 = D1 | 2 | 3;
type D5 = D3 | 4 | 5;
type D9 = D5 | 6 | 7 | 8 | 9;

type Hours = `${D1}${D9}` | `2${D3}`;
type Minutes = '00' | '15' | '30' | '45';
/**
 * 时间字符串 但是做了限制只允许15分钟的精度
 */
export type TimeStr = `${Hours}:${Minutes}` | `24:00`;

export const TimeStrRegex = /^([01][0-9]|2[0-4]):(00|15|30|45)$/;

/**
 * 蹲饼器配置
 */
export type FetchControllerConfig = {
  /**
   * 默认蹲饼间隔，单位：毫秒
   * 当数据源未设置蹲饼间隔时使用默认间隔
   */
  default_interval: number;

  /**
   * 分组列表
   */
  groups: {
    /**
     * 分组名
     * 仅用于各种提示中的人性化显示，未提供时默认name为第N组(N为分组在列表中的序号，从1开始)
     */
    name?: string;

    /**
     * 数据源类型，需要参考支持的数据源类型文档
     */
    type: string;

    /**
     * 每个数组项都是数据源参数，参考各个数据源的说明，不需要参数的必须使用空对象
     */
    datasource: Record<string, unknown>[];

    /**
     * 蹲饼间隔，单位：毫秒
     * 未提供时使用default_interval的值
     */
    interval?: number;

    /**
     * 根据时间范围配置蹲饼间隔，该配置中没有覆盖到的时间范围使用interval的值
     */
    interval_by_time_range?: {
      /**
       * 时间范围
       */
      time_range: [TimeStr, TimeStr];
      /**
       * 蹲饼间隔，单位：毫秒，设为0时禁用蹲饼
       */
      interval: number;
    }[];
  }[];

  /**
   * 平台配置
   */
  platform?: {
    /**
     * 平台ID
     */
    [key: string]: {
      /**
       * 最短请求间隔(根据目标数据源api设计的不同 可能出现一次蹲饼需要多个请求的情况)，单位：毫秒
       */
      min_request_interval: number;
    };
  };
};

// 最小间隔限制为500，避免出现超高频率压测的情况，500ms已经是相当高的频率了
export const MIN_INTERVAL = 500;
// 最大间隔限制为20小时，原因是超过24小时的间隔可能导致时间判断逻辑出问题，这里不用24的原因是懒得思考边界情况，选择20的原因是20够用了并且20是个整数好看
export const MAX_INTERVAL = 20 * 60 * 60 * 1000;

const intervalLimitOptions = () => ({
  minimum: MIN_INTERVAL,
  maximum: MAX_INTERVAL,
});

export const FetchControllerConfigSchema = Type.Object({
  default_interval: Type.Number(intervalLimitOptions()),
  groups: Type.Array(
    Type.Object({
      name: Type.Optional(Type.String({ minLength: 1 })),
      type: Type.String({ minLength: 1 }),
      datasource: Type.Array(Type.Record(Type.String({ minLength: 1 }), Type.Unknown()), { minItems: 1 }),
      interval: Type.Optional(Type.Number(intervalLimitOptions())),
      interval_by_time_range: Type.Optional(
        Type.Array(
          Type.Object({
            time_range: Type.Unsafe<[TimeStr, TimeStr]>(Type.Tuple([Type.RegEx(TimeStrRegex), Type.RegEx(TimeStrRegex)])),
            interval: Type.Number({ ...intervalLimitOptions(), minimum: 0 }),
          }),
          { minItems: 1 }
        )
      ),
    })
  ),
  platform: Type.Optional(
    Type.Record(
      Type.String({ minLength: 1 }),
      Type.Object({
        min_request_interval: Type.Number(intervalLimitOptions()),
      })
    )
  ),
});

// 这一段是验证FetchControllerConfigSchema的定义是否符合FetchControllerConfig的定义
// 因为FetchControllerConfigSchema是手写而非根据FetchControllerConfig生成的，所以需要验证来避免出错
// 原理是通过用泛型互相作为子类型定义(如果两个类型互为对方的子类型，则可以推定两个类型相等)
// 值得一提的是出现可选值(两个类型中定义的可选值都是这样)可能会导致它涉及到项不会被验证，原理应该两边定义的类型正好能互相兼容
type FetchControllerConfigSchema = Static<typeof FetchControllerConfigSchema>;
// eslint-disable-next-line
type Check<A extends FetchControllerConfig, B extends FetchControllerConfigSchema> = never;
// eslint-disable-next-line
type Checked = Check<FetchControllerConfigSchema, FetchControllerConfig>;
