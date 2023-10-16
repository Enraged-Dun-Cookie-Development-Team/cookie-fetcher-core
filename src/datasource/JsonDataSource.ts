import { DataSource, DataSourceTypeInfo } from './DataSource';
import { createPatch } from 'rfc6902';
import { Pointer } from 'rfc6902/pointer';
import { DataSourceConfig } from './DataSourceConfig';
import { DataContentJson, DataContentType } from './DataContent';

/**
 * Json数据源
 */
// noinspection JSUnusedGlobalSymbols
export abstract class JsonDataSource<T = unknown> extends DataSource {
  protected oldValue: T | undefined;
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
    private readonly monitorPointers: Pointer[]
  ) {
    super(type, dataId, config);
  }

  protected createContentIfChanged(newValue: T): DataContentJson | undefined {
    if (!this.inited) {
      this.oldValue = newValue;
      this.inited = true;
      return;
    }
    try {
      const patch = createPatch(this.oldValue, newValue);
      if (patch.length === 0) return;
      let changed = false;
      for (const pointer of this.monitorPointers) {
        const subPatch = createPatch(pointer.get(this.oldValue), pointer.get(newValue));
        if (subPatch.length > 0) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      const paths = patch.map((it) => it.path);
      return {
        type: DataContentType.JSON,
        oldValue: this.oldValue,
        newValue: newValue,
        patch: patch,
        changePaths: paths,
      };
    } finally {
      this.oldValue = newValue;
    }
  }
}
