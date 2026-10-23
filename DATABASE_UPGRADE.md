# 数据库升级与备份恢复指南

本文说明安全迁移入口、数据库与附件的配套备份、恢复路径检查及隔离回归方式。执行正式升级前，请先安排维护窗口并验证备份。

## 升级入口与禁止事项

- 服务启动的 `initDb()` 与 `npm --prefix server run db:migrate` 共用安全迁移运行器。
- 保持历史 migration 名称、内容和 `knex_migrations` 账本不变，仅执行尚未记录的迁移。本次只新增活动团队任务的顺序索引，不删行、不重建表。
- **不要把 `knexfile.js` 的 `disableTransactions` 简单改为 false。** SQLite 在事务中忽略 `PRAGMA foreign_keys=OFF`，旧 `DROP TABLE tasks` 可能触发关联评论、附件的级联删除。
- 运行器固定同一连接，事务开始前关闭外键，在显式事务中执行整批待迁移和账本写入，检查外键、完整性后统一提交；异常统一回滚，最后恢复外键并释放连接。历史脚本中的 PRAGMA 不改变这个事务边界。
- 不直接使用 `knex migrate:latest` 绕过入口；`db:rollback` 不是备份恢复。旧回滚脚本可能删 pending 附件、替换团队字段或删除整批结构，不能用来恢复评论/文件。
- 升级前已有外键异常、双库冲突或中断留下的 `_new` 表时，停止并人工核对副本，不清账本、不删除临时表强行重跑。
- 默认旧库 `root/taskflow.db` 在任一驱动打开新库前处理。目标库和旧库同时存在时停止，要求显式选择；指定 `DB_PATH` 时不会自动搬动其他库。隔离测试不要指向正式数据路径。

## 备份与恢复

升级前暂停业务写入及附件清理，完整备份数据库和文件。`npm run db:backup` 现在输出一个新目录，包含 SQLite 一致性快照、两类普通附件、富文本图片、宣传承载页及 SHA-256 清单；有物理路径但文件缺失、文件在复制中变化时明确失败。只有存在完整 `manifest.json` 的目录才可恢复。数据库文件本身不包含物理附件。

该命令不自动停止服务。维护窗口是保证数据库快照与文件集合一致的必要条件；无法仅靠 SQLite 在线备份保证并发附件删除/覆盖时的一致性。不要在备份期间继续写入或运行清理。

恢复工具只写全新目录，先检查清单与库内全部非空物理路径一一对应、拒绝重复/未知项/路径穿越/符号链接，再以固定 64KiB 缓冲校验文件哈希。复制数据库与附件后，把恢复库中的绝对 `physical_path` 重定位到新目录，最后校验全部附件均位于恢复目录、外键和完整性。校验完成前只产生暂存数据库，全部通过才发布恢复目录内的 taskflow.db；它不会覆盖原库：

```bash
node -e 'const {restoreBundle}=require("./server/src/db/backupBundle"); console.log(restoreBundle(process.argv[1], process.argv[2]));' /备份目录 /全新恢复目录
```

恢复后先在隔离环境核对评论正文、附件关联、文件哈希和下载；人工核对后才配置正式 `DB_PATH` 并安排切换。富文本图片和宣传页使用相对 URL，迁移目录时还须人工安排对应资源目录的挂载；普通附件已自动重定位。

启动时的清理只删除超过 24 小时且 `comment_id IS NULL` 的评论暂存附件及文件。已绑定附件不会因创建时间较旧而被清理。

## 权限与响应边界

- 团队 list/board/calendar 均在 DAO 统一校验读取权限；非成员不能枚举整个团队。owner/admin/superadmin 仍保留全队读取语义。归档团队任务读取保持本接口原行为，成员资料标志仍为 false。
- self 成员逐节点判断相关性；可见父任务不再自动开放不相关子孙，也不把父级附件访问权限继承到子任务。与本人相关的独立后代仍可通过列表或详情访问。
- 附件写入要求任务存在、未删除、未取消且当前用户可见/相关或为管理员，分享只读访问不能写。删除仍要求上传者，并重新校验任务写权限。两类附件直接下载与详情统一要求相关人或管理员；普通 all 范围成员不能凭 ID 下载不相关任务的附件，回收站保持删除者读取语义。
- 评论附件只允许同任务、本人上传、尚未关联的附件 ID 绑定；一组中任意不合法项使整个评论写事务回滚，不能按已知 ID 重绑已有附件。
- URL 已知任务的上传先授权，再流式落盘；multipart body 中的 taskId 先限额解析后授权才写盘，拒绝没有文件残留。单文件 10MiB；单文件总请求 11MiB，批量最多 5 个文件、总请求 51MiB；最多两个内存解析请求并行，超过返回 429；字段最多 10 个、每个 64KiB、parts 最多 16。新任务暂存附件入口保持可用。
- 列表仍返回全量字段和全量数组，未增加 LIMIT 或删除 description/participants/breadcrumbs/counts/permission flags。前端本地分页、导出、驾驶舱、甘特图和打印契约不变。权限收紧是有意行为差异。
- 请求内按 400 个 ID 分块取人员与聚合计数，补拉筛选集合之外和已删祖先；每团队权限标志只补充一次，没有新增跨请求权限缓存。我的任务先用 SQL 收窄候选，再按原关系规则计算 summary 和筛选。
- 前端共享集合使用请求序号与 AbortController；团队/我的任务/回收站、视图、筛选与页面卸载都会作废过时请求，过时成功和失败均不能覆盖新数据或 loading，被取消请求不显示迟到错误提示。

## 性能回归

性能测试使用真实 better-sqlite3 驱动和合成任务，在相同 schema 上比较基线与批量查询实现，检查响应字段、排序、summary、缺失人员、去重参与者、集合外祖先及大批量 ID。索引另外检查 EXPLAIN，避免把排序收益与批量查询收益混为一谈。

测试会输出 SQL 次数、首次和暖运行耗时、响应大小及进程内存采样。耗时受环境与 GC 影响，不代表线上承诺；内存采样也不等于单请求峰值。通过条件以响应一致性和确定性检查为准，不使用不稳定的毫秒阈值。

## 隔离回归检查

```bash
node --test server/test/task-read-performance.test.js server/src/modules/dashboard/dashboard.team-scope.test.js
node --test server/test/task-access.test.js
node --test server/test/task-http-benchmark.test.js
node --test server/test/backup-bundle.test.js server/test/database-upgrade-safety.test.js
npm --prefix client run test:run
npm --prefix client run typecheck
npm --prefix client run build
npm --prefix client run lint
git diff --check
```

HTTP 测试只监听临时 loopback 随机端口，受限环境需要允许本地监听。启动测试实际调用 `initDb()` 和 `app.startServer()`，但 HTTP、通知、环境读取和定时器由 harness 隔离。每个附件的物理路径都在临时目录，仅设置 DB_PATH 不算隔离。

迁移测试分别覆盖 20260416000002 附件手写重建、20260829000001 tasks 手写重建及 20260829000002 父外键触发的 Knex _knex_temp_alter 重建，在各自实际 CREATE/COPY/DROP/RENAME/账本写入后注入异常；逐行比较 tasks/comments/两类附件和账本，验证文件哈希、无 `_new` 遗留、foreign_key_check/integrity_check、失败后重试与重复执行。另分别在 tasks 手写和 Knex 自动重建的 DROP、账本写入后 SIGKILL 合成子进程，重开库核对回滚。备份恢复到另一临时目录后验证下载和启动清理保留已绑定文件；漏项/重复/未知记录/路径穿越/符号链接恢复均明确失败，源文件哈希不变；正常恢复后清理只删除恢复目录中的过期暂存附件。16MiB 文件哈希测试禁止 readFileSync，确认每次读取最多 64KiB。
