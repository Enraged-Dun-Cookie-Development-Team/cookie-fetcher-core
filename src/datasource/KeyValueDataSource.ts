import { DataSource, DataSourceTypeInfo } from './DataSource';
import { DataSourceConfig } from './DataSourceConfig';
import { DataContentKeyValue, DataContentType, PrimitiveWithEmpty } from './DataItem';

/**
 * KV数据源
 */
// noinspection JSUnusedGlobalSymbols
export abstract class KeyValueDataSource extends DataSource {
  protected values: Record<string, PrimitiveWithEmpty> = {};
  /**
   * 暂时只在首次检查新值时初始化
   */
  protected inited = false;

  /**
   * @see DataSource#constructor
   */
  protected constructor(
    type: DataSourceTypeInfo,
    dataId: string,
    config: DataSourceConfig,
    private readonly monitorKeys: string[]
  ) {
    super(type, dataId, config);
  }

  /**
   * @param checkValues 要检查的值
   * @param ignoreMissingKey 是否忽略newValues中未提供的值，方便只更新部分值，默认为true。如果此参数为false则newValues中未出现的key也会视为更新(相当于新值是undefined)
   */
  protected createContentIfChanged(
    checkValues: Record<string, PrimitiveWithEmpty>,
    ignoreMissingKey = true
  ): DataContentKeyValue | undefined {
    let newValues: Record<string, PrimitiveWithEmpty> = {};
    for (const key of this.monitorKeys) {
      if (checkValues.hasOwnProperty(key)) {
        newValues[key] = checkValues[key];
      }
    }
    if (!this.inited) {
      this.values = newValues;
      this.inited = true;
      return;
    }
    try {
      const changed: string[] = [];
      for (const key of this.monitorKeys) {
        if (newValues.hasOwnProperty(key)) {
          if (newValues[key] !== this.values[key]) {
            changed.push(key);
          }
        } else if (!ignoreMissingKey) {
          changed.push(key);
        }
      }
      if (changed.length === 0) return;
      if (ignoreMissingKey) {
        // 由于newValues允许只提供部分值，这里进行一次浅拷贝合并
        newValues = Object.assign(Object.assign({}, this.values), newValues);
      } else {
        for (const key of this.monitorKeys) {
          if (!newValues.hasOwnProperty(key)) {
            newValues[key] = undefined;
          }
        }
      }
      return {
        type: DataContentType.KV,
        oldValue: this.values,
        newValue: newValues,
        changedKeys: changed,
      };
    } finally {
      this.values = newValues;
    }
  }
}
