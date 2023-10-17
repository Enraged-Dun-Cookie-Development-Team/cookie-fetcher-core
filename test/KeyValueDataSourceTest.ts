import { DataContentKeyValue, DataContentType, DataItem, DataSourceTypeInfo, KeyValueDataSource, PrimitiveWithEmpty } from '../src';
import { createTestLogger } from './utils/TestLogger';

const logger = createTestLogger('test');
const typeInfo = new DataSourceTypeInfo('test', 'test', 1);

class MockKeyValueDataSource extends KeyValueDataSource {
  constructor(monitorKeys: string[]) {
    super(typeInfo, 'test', { logger: logger }, monitorKeys);
  }

  public createContentIfChanged(
    newValues: Record<string, PrimitiveWithEmpty>,
    ignoreMissingKey: boolean = true
  ): DataContentKeyValue | undefined {
    return super.createContentIfChanged(newValues, ignoreMissingKey);
  }

  protected fetchOnce(): Promise<DataItem[]> {
    return Promise.resolve([]);
  }
}

describe('KeyValue数据源测试', () => {
  test('检测Key更新', () => {
    const source = new MockKeyValueDataSource(['a', 'b']);
    expect(source.createContentIfChanged({ a: 'a1', b: 'b1' })).toStrictEqual(undefined);
    expect(source.createContentIfChanged({ a: 'a1', b: 'b1' })).toStrictEqual(undefined);
    expect(source.createContentIfChanged({ a: 'a2', b: 'b1' })).toStrictEqual({
      type: DataContentType.KV,
      oldValue: { a: 'a1', b: 'b1' },
      newValue: { a: 'a2', b: 'b1' },
      changedKeys: ['a'],
    });
    expect(source.createContentIfChanged({ a: 'a2', b: 'b2' })).toStrictEqual({
      type: DataContentType.KV,
      oldValue: { a: 'a2', b: 'b1' },
      newValue: { a: 'a2', b: 'b2' },
      changedKeys: ['b'],
    });
    expect(source.createContentIfChanged({ a: 'a2', b: 'b2', c: 1 })).toStrictEqual(undefined);
  });
});
