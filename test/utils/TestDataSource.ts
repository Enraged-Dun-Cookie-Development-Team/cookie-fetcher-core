import { DataItem, DataSource, DataSourceConfig, DataSourceTypeInfo } from '../../src';
import { DataSourceRegisterInfo } from '../../src/fetch/DataSourceRegisterInfo';
import { Static, Type } from '@sinclair/typebox';

const typeInfo = new DataSourceTypeInfo('bilibili', 'test', 1);

const configSchema = Type.Object({
  uid: Type.String(),
});

export type TestDataSourceConfig = DataSourceConfig & Static<typeof configSchema>;

export class TestDataSource extends DataSource {
  constructor(config: TestDataSourceConfig) {
    super(typeInfo, config.uid, config);
  }

  protected async fetchOnce(): Promise<DataItem[]> {
    this.sendGet('https://localhost/test');
    return [
      this.createDataItem({
        type: 'common',
        id: Math.random().toString(),
        rawContent: Math.random().toString(),
      }),
    ];
  }
}

export const testDataSourceRegisterInfo: DataSourceRegisterInfo = {
  id: typeInfo.id,
  ctor: TestDataSource,
  typeInfo,
  configSchema,
};
