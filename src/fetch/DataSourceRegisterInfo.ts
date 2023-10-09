import { DataSource, DataSourceTypeInfo } from '../datasource/DataSource';
import { Schema } from 'ajv';

export type DataSourceRegisterInfo = {
  /**
   * 数据源类型ID
   */
  id: string;
  /**
   * 数据源类型信息
   */
  typeInfo: DataSourceTypeInfo;
  /**
   * 用于创建数据源的构造函数
   * @param config 数据源配置(使用never类型是因为避免子类型会增加未知的配置项，无法使用具体类型，never可兼容任意类型)
   * @return 创建好的数据源对象
   */
  ctor: new (config: never) => DataSource;
  /**
   * 数据源配置的格式，用于验证配置，只需要包含数据源自身的个性化配置参数，若不需要参数可不提供该项
   */
  configSchema?: Schema;
};
