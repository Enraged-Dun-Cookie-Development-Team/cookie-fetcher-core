import { CookieFetcher } from './CookieFetcher';

export interface TimeRange {
  start: number;
  end: number;
}

const pad = (num: number) => (num > 9 ? num : `0${num}`);

export function timeRangeToString(timeRange: TimeRange) {
  const startHour = pad(Math.floor(timeRange.start / 100));
  const startMinute = pad(timeRange.start % 100);
  const endHour = pad(Math.floor(timeRange.end / 100));
  const endMinute = pad(timeRange.end % 100);
  return `${startHour}:${startMinute}-${endHour}:${endMinute}`;
}

/**
 * 用于控制蹲饼器的蹲饼间隔时间
 */
export class FetcherSchedule {
  private _lastFetchTime = -1;
  private fetching = false;

  /**
   * @param fetcher 蹲饼器
   * @param timeRanges 时间范围
   * @param intervalTime 蹲饼间隔时间
   */
  constructor(readonly timeRanges: TimeRange[], readonly fetcher: CookieFetcher, readonly intervalTime: number) {}

  getHealthInfo() {
    return {
      fetching: this.fetching,
      group: this.groupName,
      interval: this.intervalTime,
      lastFetchTime: this.lastFetchTime,
    };
  }

  get groupName() {
    return this.fetcher.groupName;
  }

  get platform() {
    return this.fetcher.group.sourceType.platform;
  }

  get nextFetchTime() {
    return this._lastFetchTime + this.intervalTime;
  }

  get lastFetchTime() {
    return this._lastFetchTime;
  }

  setLastFetchTime(timestamp: number) {
    this._lastFetchTime = timestamp;
  }

  get canFetch() {
    return Date.now() >= this.nextFetchTime;
  }

  get isFetching() {
    return this.fetching;
  }

  tryFetch() {
    if (this.canFetch && !this.fetching) {
      this.setLastFetchTime(Date.now());
      this.fetching = true;
      return this.fetcher.fetchOnce().finally(() => {
        this.fetching = false;
      });
    }
  }
}
