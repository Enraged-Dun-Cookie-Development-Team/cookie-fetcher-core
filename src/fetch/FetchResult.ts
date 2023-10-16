import { DataItem } from '../datasource/DataContent';

export class FetchResult {
  /**
   * @param allCookies 本次蹲到的所有饼(包括旧饼)，要求从新到旧排序
   * @param newCookies 本次蹲到的新饼，要求从新到旧排序
   */
  constructor(
    readonly allCookies: DataItem[],
    readonly newCookies: DataItem[]
  ) {}

  /**
   * JSON序列化时只输出简要的数量信息
   */
  toJSON() {
    return `FetchResult[all=${this.allCookies.length},new=${this.newCookies.length}]`;
  }
}
