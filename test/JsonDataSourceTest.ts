import { DataContentJson, DataContentType, DataItem, DataSourceTypeInfo, JsonDataSource } from '../src';
import { createTestLogger } from './utils/TestLogger';
import { Pointer } from 'rfc6902/pointer';

const logger = createTestLogger('test');
const typeInfo = new DataSourceTypeInfo('test', 'test', 1);

class MockJsonDataSource extends JsonDataSource {
  constructor(monitorPointers: Pointer[]) {
    super(typeInfo, 'test', { logger: logger }, monitorPointers);
  }

  public createContentIfChanged(newValue: unknown): DataContentJson | undefined {
    return super.createContentIfChanged(newValue);
  }

  protected fetchOnce(): Promise<DataItem[]> {
    return Promise.resolve([]);
  }
}

describe('Json数据源测试', () => {
  test('检测Json更新', () => {
    const source = new MockJsonDataSource([Pointer.fromJSON('/a'), Pointer.fromJSON('/b')]);
    expect(source.createContentIfChanged({ a: 1 })).toStrictEqual(undefined);
    expect(source.createContentIfChanged({ a: 2, b: 1 })).toStrictEqual({
      type: DataContentType.JSON,
      oldValue: { a: 1, b: undefined },
      newValue: { a: 2, b: 1 },
      patch: [
        { op: 'add', path: '/b', value: 1 },
        { op: 'replace', path: '/a', value: 2 },
      ],
      changedPaths: ['/b', '/a'],
    });
    expect(source.createContentIfChanged({ a: 2, b: 1, c: 1 })).toStrictEqual(undefined);
    expect(source.createContentIfChanged({ a: 2, b: 2, c: 1 })).toStrictEqual({
      type: DataContentType.JSON,
      oldValue: { a: 2, b: 1 },
      newValue: { a: 2, b: 2 },
      patch: [{ op: 'replace', path: '/b', value: 2 }],
      changedPaths: ['/b'],
    });
  });
});
