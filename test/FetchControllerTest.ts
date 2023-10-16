import { FetchController, FetchControllerConfig, FetchData, FetchDataHandler, registerDataSourceType, ScheduleTimeRange } from '../src';
import { createTestLogger } from './utils/TestLogger';
import { jest } from '@jest/globals';
import { Http } from '@enraged-dun-cookie-development-team/common/request';
import { FixedOffsetZone, Settings as DateTimeSettings } from 'luxon';
import { testDataSourceRegisterInfo } from './utils/TestDataSource';

registerDataSourceType(testDataSourceRegisterInfo);
const logger = createTestLogger('test');

describe('蹲饼器测试', () => {
  test('检测非法配置', () => {
    expect(() => FetchController.validateConfig({} as never)).toThrow(
      new Error("配置不合法：'/' must have required property 'default_interval','/' must have required property 'groups'")
    );
    expect(() => FetchController.validateConfig({ default_interval: 100, groups: [] })).toThrow(
      new Error("配置不合法：'/default_interval' must be >= 500")
    );
    expect(() => FetchController.validateConfig({ default_interval: 700, groups: [{ datasource: [] }] } as never)).toThrow(
      new Error("配置不合法：'/groups/0' must have required property 'type','/groups/0/datasource' must NOT have fewer than 1 items")
    );
    expect(() => FetchController.validateConfig({ default_interval: 700, groups: [{ type: 'bilibili:test', datasource: [{}] }] })).toThrow(
      new Error("配置不合法：分组[第1组]的第1个数据源的参数不合法(bilibili:test)：'/' must have required property 'uid'")
    );
    expect(() =>
      FetchController.validateConfig({
        default_interval: 500,
        groups: [
          {
            type: 'bilibili:test',
            datasource: [{ uid: '1' }],
            interval_by_time_range: [
              { time_range: ['15:30', '16:30'], interval: 500 },
              { time_range: ['16:00', '17:00'], interval: 500 },
            ],
          },
        ],
      })
    ).toThrow(new Error('配置不合法：分组第1组中的时间范围配置冲突'));
    expect(() =>
      FetchController.validateConfig({
        default_interval: 1000,
        groups: [
          {
            type: 'bilibili:test',
            datasource: [{ uid: '1' }],
            interval_by_time_range: [{ time_range: ['15:30', '16:30'], interval: 2 }],
          },
        ],
      })
    ).toThrow(new Error('配置不合法：分组[第1组]在时间范围15:30-16:30内的等效间隔2ms过短(<500ms)'));
    expect(() =>
      FetchController.validateConfig({
        default_interval: 1000,
        groups: [
          {
            type: 'bilibili:test',
            datasource: [{ uid: '1' }],
            interval_by_time_range: [{ time_range: ['15:30', '16:30'], interval: 9999999 }],
          },
        ],
      })
    ).toThrow(new Error('配置不合法：分组[第1组]在时间范围15:30-16:30共计3600000ms内进行间隔为9999999ms的蹲饼，是认真的吗？'));
    expect(() =>
      FetchController.validateConfig({
        default_interval: 900,
        groups: [
          {
            type: 'bilibili:test',
            datasource: [{ uid: '1' }],
            interval_by_time_range: [{ time_range: ['16:15', '16:45'], interval: 800 }],
          },
          {
            type: 'bilibili:test',
            datasource: [{ uid: '2' }],
            interval: 850,
            interval_by_time_range: [
              { time_range: ['00:00', '16:00'], interval: 0 },
              { time_range: ['16:30', '17:00'], interval: 700 },
            ],
          },
        ],
        platform: { bilibili: { min_request_interval: 500 } },
      })
    ).toThrow(
      new Error(
        '配置不合法：平台bilibili频率超限，最小间隔500ms。详情：\n' +
          '时间范围16:00-16:15的平均间隔为437ms，详细占用情况：\n[第2组, 850ms, 占用59%],\n[第1组, 900ms, 占用56%]\n======\n' +
          '时间范围16:15-16:30的平均间隔为412ms，详细占用情况：\n[第1组, 800ms, 占用63%],\n[第2组, 850ms, 占用59%]\n======\n' +
          '时间范围16:30-16:45的平均间隔为373ms，详细占用情况：\n[第2组, 700ms, 占用71%],\n[第1组, 800ms, 占用63%]\n======\n' +
          '时间范围16:45-17:00的平均间隔为394ms，详细占用情况：\n[第2组, 700ms, 占用71%],\n[第1组, 900ms, 占用56%]\n======\n' +
          '时间范围17:00-24:00的平均间隔为437ms，详细占用情况：\n[第2组, 850ms, 占用59%],\n[第1组, 900ms, 占用56%]。'
      )
    );
  });

  test('蹲饼循环', async () => {
    type FetchInfo = { time: number; platform: string; name: string };
    const repeatFetchInfo = (fetchInfo: FetchInfo, interval: number, until: number) => {
      const list: FetchInfo[] = [];
      for (let i = fetchInfo.time; i < until; ) {
        list.push({ ...fetchInfo, time: i });
        i += interval;
      }
      return list;
    };
    const fetchResultLog = { fetchInfos: [] as FetchInfo[] };
    const fetchDataHandler: FetchDataHandler = (fetchData: FetchData, platform: string, groupName: string) => {
      fetchResultLog.fetchInfos.push({ time: fetchData.endTime, platform: platform, name: groupName });
    };

    const config: FetchControllerConfig = {
      default_interval: 120_000,
      groups: [
        {
          type: 'bilibili:test',
          datasource: [{ uid: '1' }],
          interval: 60_000,
          interval_by_time_range: [
            {
              time_range: ['00:00', '02:00'],
              interval: 180_000,
            },
            {
              time_range: ['16:00', '17:30'],
              interval: 30_000,
            },
            {
              time_range: ['22:00', '24:00'],
              interval: 200_000,
            },
          ],
        },
      ],
      platform: {
        bilibili: {
          min_request_interval: 10_000,
        },
      },
    };
    type _FetchController = { [k in keyof FetchController]: FetchController[k] } & {
      scheduleByRanges: ScheduleTimeRange[];
      lastPromise: Promise<void>;
    };
    jest.useFakeTimers({ now: 0 });
    DateTimeSettings.defaultZone = FixedOffsetZone.instance(0);
    const controller = FetchController.create(config, fetchDataHandler, logger) as unknown as _FetchController;
    // hack掉http请求，避免单元测试变成压测
    const fnGet = jest.spyOn(Http, 'get').mockImplementation((reqUrl) => {
      const url = reqUrl.toString();
      if (url === 'https://localhost/test') {
        return Promise.resolve('a,b,c,d,e,f,g');
      }
      return Promise.resolve('not match mock data');
    });
    const oldLevel = logger.level;
    logger.level = -1;
    controller.start();
    await controller.lastPromise;
    // 蹲饼循环正确时应当蹲饼的次数，蹲饼次数公式参考上面的config书写，乘2是因为要循环两天，+1是因为多蹲一次才能达到跳出循环的条件
    // 需要注意的是controller.start()会立刻进行一轮蹲饼，所以实际上第一轮蹲饼不是在while循环内进行的，进入while的时候已经是第二轮蹲饼了
    const correctFetchCount = 1 + 2 * ((2 * 3600) / 180 + (14 * 3600) / 60 + (1.5 * 3600) / 30 + (4.5 * 3600) / 60 + (2 * 3600) / 200);
    let roundCounter = 1; // 因为start之后已经进行了第一轮蹲饼，所以这里用1初始化
    // 循环两天
    while (Date.now() < 86400_000 * 2) {
      roundCounter++;
      if (roundCounter >= correctFetchCount * 2) {
        // 由于使用fakeTimer会导致jest的timeout功能失效，所以需要手动计数。这里在循环次数达到正确蹲饼次数两倍时直接报错
        // 由于这里是蹲饼轮次，达到正常的2倍已经很离谱了
        throw new Error('循环次数过多，可能出现无限循环');
      }
      jest.advanceTimersToNextTimer();
      await controller.lastPromise;
    }
    await controller.stop();
    logger.level = oldLevel;
    DateTimeSettings.defaultZone = 'system';
    jest.useRealTimers();

    // 这里检查蹲饼次数是否等于循环次数，用于确定setTimeout的延时是正确的
    expect(roundCounter).toBe(correctFetchCount);
    // 这里检查http请求次数，用于确定蹲饼次数符合要求
    expect(fnGet).toHaveBeenCalledTimes(correctFetchCount);
    fnGet.mockRestore();

    const list = [
      ...repeatFetchInfo({ time: 0, platform: 'bilibili', name: '第1组' }, 180_000, 7200_000),
      ...repeatFetchInfo({ time: 7200_000, platform: 'bilibili', name: '第1组' }, 60_000, 57600_000),
      ...repeatFetchInfo({ time: 57600_000, platform: 'bilibili', name: '第1组' }, 30_000, 63000_000),
      ...repeatFetchInfo({ time: 63000_000, platform: 'bilibili', name: '第1组' }, 60_000, 79200_000),
      ...repeatFetchInfo({ time: 79200_000, platform: 'bilibili', name: '第1组' }, 200_000, 86400_000),
      ...repeatFetchInfo({ time: 86400_000, platform: 'bilibili', name: '第1组' }, 180_000, 86400_000 + 7200_000),
      ...repeatFetchInfo({ time: 86400_000 + 7200_000, platform: 'bilibili', name: '第1组' }, 60_000, 86400_000 + 57600_000),
      ...repeatFetchInfo({ time: 86400_000 + 57600_000, platform: 'bilibili', name: '第1组' }, 30_000, 86400_000 + 63000_000),
      ...repeatFetchInfo({ time: 86400_000 + 63000_000, platform: 'bilibili', name: '第1组' }, 60_000, 86400_000 + 79200_000),
      ...repeatFetchInfo({ time: 86400_000 + 79200_000, platform: 'bilibili', name: '第1组' }, 200_000, 86400_000 + 86400_000 + 1),
    ];
    expect(fetchResultLog.fetchInfos).toStrictEqual(list);
  });
});
