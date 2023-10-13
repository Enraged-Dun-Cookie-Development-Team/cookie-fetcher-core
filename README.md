# Cookie-Fetcher

配置格式参考接口定义[FetchControllerConfig](./src/fetch/FetchControllerConfig.ts)和模板文件[config.template.json5](./config.template.json5)

---

### 项目须知

为了规避风险，本仓库不包含实际的各平台请求逻辑，请参考[TestDataSource](./test/utils/TestDataSource.ts)自行实现各平台的请求逻辑

---

### 使用示例

验证配置：

```typescript
import { FetchController } from '@enraged-dun-cookie-development-team/cookie-fetcher-core';

registerDataSourceType(...); // 注册蹲饼数据源
const conifg = ...; // 蹲饼配置对象
try {
  FetchController.validateConfig(conifg);
  console.log('配置有效');
} catch (e) {
  console.log('配置无效：');
  console.log(e.message);
}
```

创建蹲饼器：

```typescript
// 有需要的时候再详写这个示例吧
// 调用该方法创建，然后对返回值调用start开始蹲饼，调用stop停止蹲饼
FetchController.create(config: FetchControllerConfig, fetchDataHandler: FetchDataHandler, logger: Logger, persistCookieIds?: CookieIdsPersister)
```
