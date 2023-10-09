import { FetchControllerConfig, FetchControllerConfigSchema, MIN_INTERVAL, TimeStr } from './FetchControllerConfig';
import { JsonValidator } from '@enraged-dun-cookie-development-team/common/json';
import { TimeRange, timeRangeToString } from './FetcherSchedule';
import { DataSourceRegisterInfo } from './DataSourceRegisterInfo';

/**
 * 确保分组名唯一，自动帮未命名的分组加上名字
 */
function validateGroupName(config: FetchControllerConfig) {
  const map: Record<string, number> = {};
  for (let i = 0; i < config.groups.length; i++) {
    const group = config.groups[i];
    if (!group.name) {
      group.name = `第${i + 1}组`;
    }
    if (map[group.name]) {
      throw new Error(`配置不合法：第${map[group.name]}组和第${i + 1}组的分组名重复`);
    }
    map[group.name] = i + 1;
  }
}

/**
 * 确保出现的数据源类型都是已经注册了的，且每个分组内的数据源类型必须相同，且数据源的参数满足要求
 */
function validateDataSourceTypes(config: FetchControllerConfig, sourceTypeMap: Record<string, DataSourceRegisterInfo>) {
  for (let i = 0; i < config.groups.length; i++) {
    const group = config.groups[i];
    const info = sourceTypeMap[group.type];
    if (!info) {
      throw new Error(`配置不合法：数据源类型${group.type}不存在`);
    }
    for (let j = 0; j < group.datasource.length; j++) {
      const arg = group.datasource[j];
      const schema = info.configSchema;
      if (schema) {
        if (!JsonValidator.validate(schema, arg || {})) {
          throw new Error(
            `配置不合法：分组[${group.name!}]的第${j + 1}个数据源的参数不合法(${group.type})：${JsonValidator.errorMessagesToString()}`
          );
        }
      }
    }
  }
}

/**
 * 确保相同分组中的timeRange不冲突
 */
function validateTimeRanges(config: FetchControllerConfig) {
  const fails: string[] = [];
  for (const group of config.groups) {
    if (group.interval_by_time_range) {
      const existRanges: [number, number][] = [];
      for (const { time_range } of group.interval_by_time_range) {
        const start = resolveTimeStr(time_range[0]);
        const end = resolveTimeStr(time_range[1]);
        if (start >= end) {
          throw new Error(`配置不合法：分组[${group.name!}]中的时间范围不合法，第一个时间必须小于第二个时间：${time_range.toString()}`);
        }
        for (const range of existRanges) {
          const flag1 = start <= range[0] && end > range[0]; // 左边冲突(例：10:00-11:00和09:30-10:30)
          const flag2 = start >= range[0] && end <= range[1]; // 中间冲突(例：10:00-11:00和10:15-10:45)
          const flag3 = start < range[1] && end >= range[1]; // 右边冲突(例：10:00-11:00和10:30-11:30)
          if (flag1 || flag2 || flag3) {
            fails.push(group.name!);
            break;
          }
        }
        existRanges.push([start, end]);
      }
    }
  }
  if (fails.length > 0) {
    throw new Error(`配置不合法：分组${fails.toString()}中的时间范围配置冲突`);
  }
}

interface TimeRangeForFrequency extends TimeRange {
  allRate: number;
  groups: [string, number, number][];
}

/**
 * 对四位数时间(形如hhmm)计算end - start的分钟数
 */
function calcDuration(start: number, end: number) {
  const h = Math.floor((end - start) / 100);
  const m = (end - start) % 100;
  return h * 60 + m;
}

/**
 * 确认没有出现过大或过小的蹲饼间隔
 */
function validateCommonFrequency(config: FetchControllerConfig, sourceTypeMap: Record<string, DataSourceRegisterInfo>) {
  if (config.default_interval <= 0) {
    throw new Error(`配置不合法：默认间隔小于等于0`);
  }
  for (const group of config.groups) {
    const typeInfo = sourceTypeMap[group.type].typeInfo;
    const groupInterval = group.interval || config.default_interval;
    const reqCount = typeInfo.reqCountEachFetch;
    if (group.interval_by_time_range) {
      if (groupInterval <= 0) {
        throw new Error(`配置不合法：分组[${group.name!}]的间隔小于等于0`);
      }
      for (const groupRange of group.interval_by_time_range) {
        const start = resolveTimeStr(groupRange.time_range[0]);
        const end = resolveTimeStr(groupRange.time_range[1]);
        const rangeInterval = groupRange.interval || groupInterval;
        const rangeStr = `时间范围${groupRange.time_range[0]}-${groupRange.time_range[1]}`;
        if (rangeInterval < 0) {
          throw new Error(`配置不合法：分组[${group.name!}]在${rangeStr}内的间隔小于0`);
        }
        // 蹲饼间隔超过时间范围(例如在5分钟内进行间隔1小时的蹲饼？)
        const duration = calcDuration(start, end) * 60 * 1000;
        if (rangeInterval > duration) {
          throw new Error(
            `配置不合法：分组[${group.name!}]在${rangeStr}共计${duration}ms内进行间隔为${rangeInterval}ms的蹲饼，是认真的吗？`
          );
        }
        if (rangeInterval < MIN_INTERVAL * reqCount) {
          throw new Error(`配置不合法：分组[${group.name!}]在${rangeStr}内的等效间隔${rangeInterval / reqCount}ms过短(<500ms)`);
        }
      }
    } else {
      if (groupInterval < 0) {
        throw new Error(`配置不合法：分组[${group.name!}]的间隔小于0`);
      }
      if (groupInterval < MIN_INTERVAL * reqCount) {
        throw new Error(`配置不合法：分组[${group.name!}]的等效间隔${groupInterval / reqCount}ms过短(<500ms)`);
      }
    }
  }
}

/**
 * 确保整个蹲饼周期不出现频率超过平台限制的情况
 */
function validatePlatformFrequency(config: FetchControllerConfig, sourceTypeMap: Record<string, DataSourceRegisterInfo>) {
  if (!config.platform) {
    return;
  }
  const insertGroupInfoToRanges = (
    targetRanges: TimeRangeForFrequency[],
    min_request_interval: number,
    interval: number,
    groupName: string
  ) => {
    const rate = min_request_interval / interval;
    for (const range of targetRanges) {
      range.allRate += rate;
      // 因为事先验证了range不会重复，所以可以直接在这个循环里push分组名，不用担心分组名会重复push
      range.groups.push([groupName, interval, rate]);
    }
  };
  const failPlatforms: string[] = [];
  for (const [platformId, { min_request_interval }] of Object.entries(config.platform)) {
    // 限制了每组数据源的类型都需要相同，所以不需要考虑组内数据源不同可能造成的问题
    // 时间范围 0000 ~ 2400 区间左闭右开
    // 占用间隔比例 = 限制间隔 / 设置间隔
    // 遍历groups确定每个时段的平均间隔，逐一判断是否超出间隔 给出限制平均间隔的值、当前平均间隔、所有相关的组
    const ranges: TimeRangeForFrequency[] = [{ start: 0, end: 2400, allRate: 0, groups: [] }];
    for (const group of config.groups) {
      const typeInfo = sourceTypeMap[group.type].typeInfo;
      if (typeInfo.platform !== platformId) {
        continue;
      }
      const groupInterval = group.interval || config.default_interval;
      const reqCount = typeInfo.reqCountEachFetch;
      if (group.interval_by_time_range) {
        // 因为计算过程中保证了时间范围是不会重叠的，所以只记录start就行
        const includedRanges = new Set<number>();
        for (const groupRange of group.interval_by_time_range) {
          const start = resolveTimeStr(groupRange.time_range[0]);
          const end = resolveTimeStr(groupRange.time_range[1]);
          const targetRanges = updateRanges(ranges, start, end, (r) => ({ ...r, groups: [...r.groups] }));
          targetRanges.forEach((it) => includedRanges.add(it.start));
          if (groupRange.interval === 0) {
            // 间隔设为0视为关闭蹲饼 只拆分时间范围 不增加分组信息
            continue;
          }
          const rangeInterval = groupRange.interval || groupInterval;
          insertGroupInfoToRanges(targetRanges, min_request_interval, rangeInterval / reqCount, group.name!);
        }
        // 把没配置的时间范围也填上频率
        const notIncludedRanges = ranges.filter((it) => !includedRanges.has(it.start));
        insertGroupInfoToRanges(notIncludedRanges, min_request_interval, groupInterval / reqCount, group.name!);
      } else {
        // 没有设置时间范围就是覆盖所有时间范围
        insertGroupInfoToRanges(ranges, min_request_interval, groupInterval / reqCount, group.name!);
      }
    }

    const failRanges = ranges.filter((it) => it.allRate > 1);
    if (failRanges.length > 0) {
      const rangeErrMsg: string[] = [];
      for (const range of failRanges) {
        range.groups.sort((a, b) => b[2] - a[2]);
        const groupsInfo = range.groups.map((it) => `[${it[0]}, ${it[1]}ms, 占用${(it[2] * 100).toFixed(0)}%]`).join(',\n');
        const interval = (min_request_interval / range.allRate).toFixed(0);
        const msg = `时间范围${timeRangeToString(range)}的平均间隔为${interval}ms，详细占用情况：\n${groupsInfo}`;
        rangeErrMsg.push(msg);
      }
      failPlatforms.push(`平台${platformId}频率超限，最小间隔${min_request_interval}ms。详情：\n${rangeErrMsg.join('\n======\n')}。`);
    }
  }
  if (failPlatforms.length > 0) {
    throw new Error('配置不合法：' + failPlatforms.join('\n'));
  }
}

/**
 * 把形如hh:mm的字符串转换成四位数，四个位分别对应hhmm(实际值相当于hh * 100 + mm)
 */
export function resolveTimeStr(timeStr: TimeStr): number {
  return parseInt(timeStr.replace(':', ''), 10);
}

/**
 * 返回参数start/end包含的所有range，最后一个参数是用来deepClone的(deep程度由调用方决定，通常用于数组拷贝)
 */
export function updateRanges<T extends TimeRange>(
  ranges: T[],
  start: number,
  end: number,
  copyHandler: (r: T) => T = (r) => ({ ...r })
): T[] {
  let left = 0;
  let right = ranges.length - 1;
  let leftFlag = false;
  let rightFlag = false;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (!leftFlag && start >= range.start && start < range.end) {
      left = i;
      leftFlag = true;
    }
    if (!rightFlag && end > range.start && end <= range.end) {
      right = i;
      rightFlag = true;
    }
    if (leftFlag && rightFlag) {
      break;
    }
  }
  if (left === right) {
    let replaceItems: T[];
    let returnRangeIdx: number;
    if (start === 0) {
      if (ranges[right].end === end) {
        return [ranges[right]];
      }
      replaceItems = [
        { ...copyHandler(ranges[right]), start: start, end: end },
        { ...copyHandler(ranges[right]), start: end },
      ];
      returnRangeIdx = right;
    } else if (end === 2400) {
      if (ranges[right].start === start) {
        return [ranges[right]];
      }
      replaceItems = [
        { ...copyHandler(ranges[right]), end: start },
        { ...copyHandler(ranges[right]), start: start, end: end },
      ];
      returnRangeIdx = right + 1;
    } else {
      replaceItems = [
        { ...copyHandler(ranges[right]), end: start },
        { ...copyHandler(ranges[right]), start: start, end: end },
        { ...copyHandler(ranges[right]), start: end },
      ];
      returnRangeIdx = right + 1;
    }
    ranges.splice(right, 1, ...replaceItems);
    return [ranges[returnRangeIdx]];
  } else {
    if (ranges[right].start === start && ranges[right].end === end) {
      return [ranges[right]];
    }
    // 先改后面的再改前面的，因为后面的修改之后不影响前面的索引号
    ranges.splice(right, 1, { ...copyHandler(ranges[right]), end: end }, { ...copyHandler(ranges[right]), start: end });
    ranges.splice(left, 1, { ...copyHandler(ranges[left]), end: start }, { ...copyHandler(ranges[left]), start: start });
    // 在left后面插入了一个，所以left + 1；right是在前面插入的，索引不变，但是因为前面+1了所以right还要再+1，然后因为第二个参数是excluded的所以再+1
    return ranges.slice(left + 1, right + 1 + 1);
  }
}

/**
 * 校验配置有效性
 */
export function validateConfig(config: FetchControllerConfig, sourceTypeMap: Record<string, DataSourceRegisterInfo>) {
  if (!JsonValidator.validate(FetchControllerConfigSchema, config)) {
    throw new Error(`配置不合法：${JsonValidator.errorMessagesToString()}`);
  }
  validateGroupName(config);
  validateDataSourceTypes(config, sourceTypeMap);
  validateTimeRanges(config);
  validateCommonFrequency(config, sourceTypeMap);
  validatePlatformFrequency(config, sourceTypeMap);
}
