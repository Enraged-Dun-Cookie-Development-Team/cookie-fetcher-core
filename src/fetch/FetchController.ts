import { Logger } from '@enraged-dun-cookie-development-team/common/logger';
import { CookieFetcher, FetchData } from './CookieFetcher';
import { FetcherSchedule, TimeRange, timeRangeToString } from './FetcherSchedule';
import { DataSourceRegisterInfo } from './DataSourceRegisterInfo';
import { FetchControllerConfig } from './FetchControllerConfig';
import { DataSourceGroup } from '../datasource/DataSourceGroup';
import { DataSource } from '../datasource/DataSource';
import { resolveTimeStr, updateRanges, validateConfig } from './FetchControllerConfigValidator';
import { DateTime, Interval } from 'luxon';
import { CookieIdsPersister } from '../datasource/DataSourceConfig';
import EventEmitter2 from 'eventemitter2';

export type FetchDataHandler = (fetchData: FetchData, platform: string, groupName: string) => void;

const SOURCE_TYPE_MAP: Record<string, DataSourceRegisterInfo> = {};

export function registerDataSourceType(registerInfo: DataSourceRegisterInfo) {
  SOURCE_TYPE_MAP[registerInfo.id] = registerInfo;
}

export interface ScheduleTimeRange extends TimeRange {
  schedules: FetcherSchedule[];
}

function wrapEventEmit(emitter: EventEmitter2, eventName: string, ...eventData: unknown[]) {
  try {
    emitter.emit(eventName, ...eventData);
  } catch (e) {
    throw new Error('事件处理器发生异常', { cause: e });
  }
}

export class FetchController {
  private task: null | ReturnType<typeof setTimeout> = null;
  private started = false;
  private lastRangeIndex = 0;
  private lastRangeCheckTime = 0;
  private lastRange: ScheduleTimeRange | undefined;
  private lastPromise: Promise<void> | undefined;
  readonly events = new EventEmitter2();

  private constructor(
    private readonly scheduleByRanges: ScheduleTimeRange[],
    private readonly fetchDataHandler: FetchDataHandler,
    private readonly platformIntervalLimit: Record<string, number>,
    private readonly logger: Logger
  ) {}

  static validateConfig(config: FetchControllerConfig) {
    validateConfig(config, SOURCE_TYPE_MAP);
  }

  static create(config: FetchControllerConfig, fetchDataHandler: FetchDataHandler, logger: Logger, persistCookieIds?: CookieIdsPersister) {
    validateConfig(config, SOURCE_TYPE_MAP);

    logger.debug(`正在创建蹲饼器，原始配置：${JSON.stringify(config)}`);
    const insertGroupInfoToRanges = (
      targetRanges: ScheduleTimeRange[],
      timeRange: TimeRange | undefined,
      groupConfig: FetchControllerConfig['groups'][0],
      datasource: DataSource[],
      interval: number
    ) => {
      const group = new DataSourceGroup(
        groupConfig.name!,
        SOURCE_TYPE_MAP[groupConfig.type].typeInfo,
        logger.with({ defaultModule: 'source-group' }),
        datasource
      );
      const fetcher = new CookieFetcher(group, logger.with({ defaultModule: 'fetcher' }));
      let timeRanges: TimeRange[];
      if (timeRange) {
        timeRanges = [timeRange];
      } else {
        timeRanges = targetRanges.map((it) => ({ start: it.start, end: it.end }));
      }
      const schedule = new FetcherSchedule(timeRanges, fetcher, interval);
      for (const range of targetRanges) {
        range.schedules.push(schedule);
      }
    };

    const buildDataSourceList = (type: string, list: Record<string, unknown>[], logger: Logger) => {
      const ctor = SOURCE_TYPE_MAP[type].ctor;
      return list.map((it) => {
        return new ctor({ ...it, logger: logger.with({ defaultModule: 'source' }), persistCookieIds } as never);
      });
    };

    const scheduleByRanges: ScheduleTimeRange[] = [{ start: 0, end: 2400, schedules: [] }];
    // NOTE 下面整段for和配置验证validatePlatformFrequency中的逻辑基本一致 区别只是这里真正生成了蹲饼计划，配置验证时就只有验证
    for (const group of config.groups) {
      const groupInterval = group.interval || config.default_interval;
      const datasource = buildDataSourceList(group.type, group.datasource, logger);
      if (group.interval_by_time_range) {
        const includedRanges = new Set<number>();
        for (const groupRange of group.interval_by_time_range) {
          const start = resolveTimeStr(groupRange.time_range[0]);
          const end = resolveTimeStr(groupRange.time_range[1]);
          const targetRanges = updateRanges(scheduleByRanges, start, end, (r) => ({ ...r, schedules: [...r.schedules] }));
          targetRanges.forEach((it) => includedRanges.add(it.start));
          if (groupRange.interval === 0) {
            // 间隔设为0视为关闭蹲饼 只拆分时间范围 不增加分组信息
            continue;
          }
          const rangeInterval = groupRange.interval || groupInterval;
          insertGroupInfoToRanges(targetRanges, { start, end }, group, datasource, rangeInterval);
        }
        // 把没配置的时间范围也填上频率
        const notIncludedRanges = scheduleByRanges.filter((it) => !includedRanges.has(it.start));
        insertGroupInfoToRanges(notIncludedRanges, undefined, group, datasource, groupInterval);
      } else {
        // 没有设置时间范围就是覆盖所有时间范围
        insertGroupInfoToRanges(scheduleByRanges, { start: 0, end: 2400 }, group, datasource, groupInterval);
      }
    }

    if (scheduleByRanges.reduce((prev, range) => prev + range.schedules.length, 0) === 0) {
      logger.warn(`${'当前无任何蹲饼计划，请确认配置符合预期！\n'.repeat(3)}当前配置：${JSON.stringify(config)}`);
    }

    const platformIntervalLimit: Record<string, number> = {};
    if (config.platform) {
      for (const [platform, { min_request_interval }] of Object.entries(config.platform)) {
        platformIntervalLimit[platform] = min_request_interval;
      }
    }
    const scheduleForLog = scheduleByRanges.map((it) => ({
      range: timeRangeToString(it),
      schedules: it.schedules.map((it) => it.getHealthInfo()),
    }));
    logger.debug(`蹲饼器创建成功，蹲饼计划：${JSON.stringify(scheduleForLog)}`);
    return new FetchController(scheduleByRanges, fetchDataHandler, platformIntervalLimit, logger.with({ defaultModule: 'controller' }));
  }

  getHealthInfo() {
    return {
      running: this.isRunning(),
      range: this.lastRange ? timeRangeToString(this.lastRange) : undefined,
      rangeCheckTime: this.lastRangeCheckTime,
      schedule: this.lastRange ? this.lastRange.schedules.map((it) => it.getHealthInfo()) : [],
    };
  }

  isRunning() {
    return this.started;
  }

  start(): boolean {
    if (this.started) return false;
    this.started = true;
    wrapEventEmit(this.events, 'start');
    this.runCycle();
    return true;
  }

  async stop(): Promise<boolean> {
    if (!this.started) return false;
    if (this.task) clearTimeout(this.task);
    if (this.lastPromise) await this.lastPromise;
    if (this.lastRange) {
      const sourceShutdownPromiseList = this.lastRange.schedules
        .flatMap((it) => it.fetcher.group.getSourceList())
        .map((it) => it.gracefulShutdown());
      await Promise.allSettled(sourceShutdownPromiseList);
    }
    this.started = false;
    wrapEventEmit(this.events, 'stop');
    return true;
  }

  private runCycle() {
    this.lastPromise = this.tryFetchAll();
    if (this.started) {
      const currentRange = this.lastRange!;
      const now = Date.now();
      const rangeEndTime = (targetRange: ScheduleTimeRange, refTime: number) => {
        // 根据参考时间来生成实际时间，避免出现极端情况下日期错误
        if (targetRange.end !== 2400) {
          return DateTime.fromMillis(refTime)
            .set({ hour: Math.floor(currentRange.end / 100), minute: currentRange.end % 100, second: 0, millisecond: 0 })
            .toMillis();
        } else {
          return DateTime.fromMillis(refTime).plus({ day: 1 }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toMillis();
        }
      };
      // 获取当前时间范围中最近一个需要蹲饼的数据源的蹲饼计划时间
      let nextFetch;
      if (currentRange.schedules.length > 0) {
        nextFetch = Number.MAX_SAFE_INTEGER;
        let waitFetchingNextTime = false;
        let fetchSchedule: FetcherSchedule[] = [];
        const waitTime = 500;
        for (const schedule of currentRange.schedules) {
          let time = schedule.nextFetchTime;
          let flag = false;
          if (time <= now) {
            // 这种情况意味着该下一次蹲饼了但是它上一次请求还没完，因此固定等待时间等请求完
            time = now + waitTime;
            flag = true;
          }
          if (time < nextFetch) {
            waitFetchingNextTime = flag;
            nextFetch = time;
            fetchSchedule = [schedule];
          } else if (time === nextFetch) {
            // 仅当waitFetchingNextTime为true的时候重设，使得多个计划出现时只要不是所有计划都是请求时间过长就不会认为是waitFetchingNextTime
            if (waitFetchingNextTime) waitFetchingNextTime = flag;
            fetchSchedule.push(schedule);
          }
        }
        const logNextFetch = (argNextFetch: number, reason: string) => {
          this.logger.trace(
            `下次蹲饼时间：${argNextFetch}，原因：${reason}，时间范围：${timeRangeToString(currentRange)}，相关计划：${JSON.stringify(
              fetchSchedule.map((it) => it.getHealthInfo())
            )}`
          );
        };
        const nextFetchTime = DateTime.fromMillis(nextFetch);
        const nowTime = DateTime.fromMillis(now);
        if (nextFetch >= now) {
          const timeInterval = Interval.fromDateTimes(nowTime, nextFetchTime);
          // 如果间隔计算失败则使用通常计算逻辑，避免间隔计算失败导致直接被算为1天
          if (!timeInterval.isValid || timeInterval.length('day') < 1) {
            const timeNumNow = nowTime.hour * 100 + nowTime.minute;
            const timeNumNext = nextFetchTime.hour * 100 + nextFetchTime.minute;
            // 如果当前时间范围中最近一个需要蹲饼的数据源的蹲饼计划超出了时间范围的结束时间，则意味着这个时间范围已经蹲完了，所以直接延时到这个时间范围的结束时间
            // timeNumNext < timeNumNow是专门针对跨天的判断，出现这种情况表示跨天了，由于时间范围限制不能跨天所以时间范围必然结束。
            if (timeNumNext >= currentRange.end || timeNumNext < timeNumNow) {
              nextFetch = rangeEndTime(currentRange, this.lastRangeCheckTime);
              logNextFetch(nextFetch, '本时间范围内蹲饼计划已完成');
            } else {
              logNextFetch(nextFetch, waitFetchingNextTime ? '等待网络请求' : '时间范围内正常循环');
            }
          } else {
            // 如果超过一天的话时间范围的判断可能会有异常，直接设为时间范围的结束时间
            nextFetch = rangeEndTime(currentRange, this.lastRangeCheckTime);
            logNextFetch(nextFetch, '下次蹲饼计划时间超过一天');
          }
        } else {
          nextFetch = now + waitTime;
          logNextFetch(nextFetch, `下次蹲饼计划时间小于当前时间：${nextFetch - waitTime} < ${now}，视为异常情况，强制等待${waitTime}毫秒`);
        }
      } else {
        // 无蹲饼计划，延时到下一个时间范围
        nextFetch = rangeEndTime(currentRange, this.lastRangeCheckTime);
        this.logger.trace(`下次蹲饼时间：${nextFetch}，原因：无蹲饼计划，时间范围：${timeRangeToString(currentRange)}`);
      }
      this.task = setTimeout(() => {
        this.runCycle();
      }, nextFetch - now);
    }
  }

  private async tryFetchAll() {
    const range = this.tryUpdateCurrentRange();
    if (!range.schedules || range.schedules.length === 0) {
      // 无蹲饼计划，直接返回
      return;
    }
    const fetchScheduleList: FetcherSchedule[] = [];
    const promiseList: Promise<FetchData>[] = [];
    for (const schedule of range.schedules) {
      // tryFetch内部会自己判断时间是否符合 这里不用关心
      const promise = schedule.tryFetch();
      if (promise) {
        const eventData = {
          source: schedule.fetcher.group.currentSource,
          group: schedule.groupName,
        };
        promiseList.push(
          promise.then(
            (fetchData) => {
              if (fetchData.success) {
                wrapEventEmit(this.events, 'fetch', { success: true, data: fetchData, ...eventData });
              } else {
                wrapEventEmit(this.events, 'fetch', { success: false, error: fetchData.error, data: fetchData, ...eventData });
              }
              return fetchData;
            },
            (err) => {
              wrapEventEmit(this.events, 'fetch', { success: false, error: err as Error, ...eventData });
              throw err;
            }
          )
        );
        fetchScheduleList.push(schedule);
      }
    }
    const promiseResults = await Promise.allSettled(promiseList);
    for (let i = 0; i < promiseResults.length; i++) {
      const promiseResult = promiseResults[i];
      const schedule = fetchScheduleList[i];
      if (promiseResult.status === 'fulfilled') {
        try {
          this.fetchDataHandler(promiseResult.value, schedule.platform, schedule.groupName);
        } catch (e) {
          this.logger.warn({ error: e as Error }, `蹲饼处理器处理[${schedule.groupName}]的蹲饼结果时发生异常`);
        }
      } else {
        this.logger.warn({ error: promiseResult.reason as Error }, `[${schedule.groupName}]蹲饼失败`);
      }
    }
  }

  /**
   * 根据当前时间确定现在所处的时间范围，如果时间范围更新的话会自动进行相关的处理(此方法的后半部分)
   */
  private tryUpdateCurrentRange() {
    const now = DateTime.now();
    this.lastRangeCheckTime = now.toMillis();
    const time = now.hour * 100 + now.minute;
    let newRange: ScheduleTimeRange | undefined;
    for (let i = this.lastRangeIndex; i < this.scheduleByRanges.length; i++) {
      const range = this.scheduleByRanges[i];
      if (time >= range.start && time < range.end) {
        this.lastRangeIndex = i;
        newRange = range;
        break;
      }
    }
    for (let i = 0; i < this.lastRangeIndex; i++) {
      const range = this.scheduleByRanges[i];
      if (time >= range.start && time < range.end) {
        this.lastRangeIndex = i;
        newRange = range;
        break;
      }
    }
    if (!newRange) {
      // 理论上不可能运行到这里，上面两个for实质上遍历了整个range数组，如果运行到这里的话应该只能是解析配置创建蹲饼控制器的时候就出问题了
      throw new Error(`解析当前时间所处时间范围异常`);
    }

    // 切换range的时候重设偏移时间以平滑请求间隔，并使用平台上次请求时间来保证不会突破请求速率
    if (newRange !== this.lastRange) {
      wrapEventEmit(
        this.events,
        'changeTimeRange',
        this.lastRange ? { start: this.lastRange.start, end: this.lastRange.end } : undefined,
        this.lastRange ? timeRangeToString(this.lastRange) : undefined,
        { start: newRange.start, end: newRange.end },
        timeRangeToString(newRange)
      );
      // 平滑蹲饼请求的发送时间，把多个请求同时发送改为隔一段时间发一个
      const platformFetchTimeOffset: Record<string, number> = {};
      for (const schedule of newRange.schedules) {
        const offset = platformFetchTimeOffset[schedule.platform] || now.toMillis() - schedule.intervalTime;
        schedule.setLastFetchTime(offset);
        const addOffset = this.platformIntervalLimit[schedule.platform] || 0;
        platformFetchTimeOffset[schedule.platform] = offset + addOffset;
      }
      this.lastRange = newRange;
    }
    return newRange;
  }
}
