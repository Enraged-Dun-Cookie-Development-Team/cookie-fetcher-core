import { DataSource, DataSourceTypeInfo } from './DataSource';
import { DataContentKeyValue } from '../fetch/FetchResult';
import { DataSourceConfig } from './DataSourceConfig';

const DEFAULT_KEY = 'default';

export abstract class KeyValueDataSource extends DataSource {
  private readonly values: Record<string, unknown> = {};

  /**
   * @see DataSource#constructor
   */
  protected constructor(type: DataSourceTypeInfo, dataId: string, config: DataSourceConfig) {
    super(type, dataId, config);
  }

  protected setValue(name: string, value: unknown): void;
  protected setValue(value: unknown): void;
  protected setValue(_key: unknown, _value?: unknown) {
    const { key, value } = this.extraKV(_key, _value);
    this.values[key] = value;
  }

  protected getValue<T = unknown>(key = DEFAULT_KEY) {
    return this.values[key] as T;
  }

  protected hasKey(name = DEFAULT_KEY) {
    return !!this.values[name];
  }

  protected createContent<T = unknown>(key: string, newValue: T): DataContentKeyValue<T> {
    return {
      type: 'kv',
      key: key,
      oldValue: this.values[key] as T,
      newValue: newValue,
    };
  }

  protected checkIfValueChange(key: string, newValue: string) {
    let content: DataContentKeyValue<string> | undefined;
    if (newValue && this.hasKey(key)) {
      if (newValue !== this.getValue(key)) {
        content = this.createContent(key, newValue);
      }
    }
    this.setValue('key', newValue);
    return content;
  }

  private extraKV(name: unknown, value?: unknown) {
    if (typeof value === 'undefined' || typeof name !== 'string') {
      return { key: DEFAULT_KEY, value: name };
    } else {
      return { key: name, value: value };
    }
  }
}
