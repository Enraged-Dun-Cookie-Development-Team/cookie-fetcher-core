import { DataSource, DataSourceTypeInfo } from './DataSource';
import { Logger } from '@enraged-dun-cookie-development-team/common/logger';

/**
 * 数据源组
 */
export class DataSourceGroup {
  /**
   * 数据源列表
   */
  private sourceList: DataSource[] = [];
  /**
   * 内部索引
   */
  private index = -1;

  /**
   * @param name 分组名
   * @param sourceType 数据源类型
   * @param logger 日志器
   * @param initSourceList 初始化时直接添加数据源，可以省事不用一个个add
   */
  constructor(
    readonly name: string,
    readonly sourceType: DataSourceTypeInfo,
    private readonly logger: Logger,
    initSourceList: DataSource[] = []
  ) {
    this.sourceList.push(...initSourceList);
  }

  get currentIndex() {
    return this.index;
  }

  getSourceList() {
    return [...this.sourceList];
  }

  /**
   * 添加数据源
   * @param source 要添加的数据源
   */
  add(source: DataSource) {
    if (source.type !== this.sourceType) {
      this.logger.warn(
        `[${source.id.typeId}]类型的数据源[${source.id.dataId}]` + `被尝试加入到[${this.sourceType.id}]类型的蹲饼分组中，已禁止本次加入`
      );
      return;
    }
    this.sourceList.push(source);
  }

  /**
   * 获取数据源数量
   */
  get count() {
    return this.sourceList.length;
  }

  get currentSource() {
    return this.sourceList[this.index];
  }

  /**
   * 获取下一个数据源，会在数据源列表中自动循环获取
   */
  next() {
    if (this.shouldReset()) {
      this.index = 0;
    } else {
      this.index++;
    }
    return this.sourceList[this.index];
  }

  private shouldReset() {
    return this.index < 0 || this.index >= this.count - 1;
  }
}
