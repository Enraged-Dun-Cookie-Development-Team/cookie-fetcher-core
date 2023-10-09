import { DataSource, DataSourceTypeInfo } from './DataSource';
import { createPatch } from 'rfc6902';
import { DataContentJson } from '../fetch/FetchResult';
import { DataSourceConfig } from './DataSourceConfig';

const DEFAULT_KEY = 'default';

export abstract class JsonDataSource extends DataSource {
  private readonly jsonValues: Record<string, unknown> = {};

  /**
   * @see DataSource#constructor
   */
  protected constructor(type: DataSourceTypeInfo, dataId: string, config: DataSourceConfig) {
    super(type, dataId, config);
  }

  protected set(name: string, value: unknown): void;
  protected set(value: unknown): void;
  protected set(_key: unknown, _value?: unknown) {
    const { key, value } = this.extraKV(_key, _value);
    this.jsonValues[key] = value;
  }

  protected hasKey(name = DEFAULT_KEY) {
    return !!this.jsonValues[name];
  }

  protected diff(name: string, value: unknown): void;
  protected diff(value: unknown): void;
  protected diff(_key: unknown, _value?: unknown) {
    const { key, value } = this.extraKV(_key, _value);
    const oldValue = this.jsonValues[key];
    return createPatch(oldValue, value);
  }

  protected createContent<T = unknown>(oldValue: T, newValue: T): DataContentJson {
    const patch = createPatch(oldValue, newValue);
    const paths = patch.map((it) => it.path);
    return {
      type: 'json',
      oldValue: oldValue,
      newValue: newValue,
      patch: patch,
      changePaths: paths,
    };
  }

  private extraKV(name: unknown, value?: unknown) {
    if (typeof value === 'undefined' || typeof name !== 'string') {
      return { key: DEFAULT_KEY, value: name };
    } else {
      return { key: name, value: value };
    }
  }
}
