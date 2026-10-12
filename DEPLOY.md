# TaskFlow 生产部署与平台集成指南

本文档介绍 TaskFlow（任务搭子）的生产环境部署流程，并重点针对**钉钉开放平台**的深度集成配置提供详细的实操指南。

---

## 一、系统架构与运行拓扑

TaskFlow 采用极简轻量的全栈架构设计，大幅降低私有化自部署门槛：

- **单端口全栈托管**：生产环境下由后端 Express 服务直接静态托管前端 React 构建产物（`client/dist`），前后端统一在 `8344` 端口（可自定义），无需复杂的前置 Nginx 即可直接提供服务。
- **本地嵌入式数据库**：使用高性能 SQLite（`better-sqlite3`），服务启动时自动执行 Knex 增量迁移，免除 MySQL/PostgreSQL 等外部数据库集群维护成本。
- **进程守护**：配套 PM2 进程配置（`ecosystem.config.cjs`），支持多核管理、平滑热更新与异常自动重启。

---

## 二、生产部署实操步骤

### 1. 环境准备
- **操作系统**：Linux（推荐 Ubuntu 20.04+ / Debian 11+ / CentOS 8+）或 macOS
- **Node.js**：>= 18.0.0
- **包管理器**：npm >= 9.0.0
- **PM2**：全局安装 `npm install -g pm2`

### 2. 源码获取与前端构建

在本地或 CI/CD 构建机中执行：

```bash
# 克隆代码
git clone https://github.com/your-username/TaskFlow.git
cd TaskFlow

# 安装依赖并构建前端静态资源
npm install
npm --prefix client install
npm --prefix client run build
```

构建成功后产物将生成在 `client/dist/` 目录下。

### 3. 上传到服务器

将必要源码与构建产物上传至服务器部署路径（例如 `/www/wwwroot/taskflow`），注意排除 `node_modules` 与开发数据：

```bash
rsync -avz --exclude='node_modules' \
           --exclude='client/node_modules' \
           --exclude='server/data' \
           --exclude='logs' \
           --exclude='.git' \
           ./ root@<服务器IP>:/www/wwwroot/taskflow/
```

### 4. 服务端目录与依赖初始化

SSH 登录服务器：

```bash
cd /www/wwwroot/taskflow

# 创建运行所需的数据与日志目录
mkdir -p logs
mkdir -p server/data/attachments
mkdir -p server/data/broadcast-pages

# 仅安装生产依赖
npm install --omit=dev
cd server && npm install --omit=dev && cd ..
```

### 5. 配置生产环境变量

复制环境配置文件模板：

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

编辑 `server/.env`，配置基础运行参数与高强度安全密钥：

```env
PORT=8344
SERVER_PORT=8344

# 必须生成随机高强度密钥（服务启动会强制校验）
JWT_SECRET=your-random-strong-jwt-secret-at-least-32-chars

# 通知跳转链接加密密钥（至少32位）
NOTIFICATION_LINK_SECRET=your-random-strong-link-crypto-secret-key

# 对外可访问的完整公网地址（用于钉钉机器人卡片与通知落地页跳转）
APP_BASE_URL=https://todo.your-domain.com

# 初始超级管理员 ID（根据钉钉 UserID 配置，支持逗号分隔多个）
INITIAL_SUPER_ADMIN_IDS=18654950401090001
```

> **密钥生成提示**：可在终端运行 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 快速生成安全随机密钥。

### 6. PM2 守护启动与开机自启

```bash
# 启动应用
npm run up

# 检查进程状态
npm run status

# 设置开机自启
pm2 save
pm2 startup
```

---

## 三、钉钉开放平台深度配置指南

TaskFlow 目前针对**钉钉生态**进行了全链路深度适配，包含客户端内免登、浏览器扫码登录、工作台应用、单聊机器人通知以及组织人员自动同步。

### 1. 创建企业内部应用
1. 登录 [钉钉开放平台](https://open-dev.dingtalk.com/)。
2. 进入 **应用开发 -> 企业内部开发 -> 创建应用**。
3. 填入应用名称（如 `任务搭子`）、应用图标与描述，完成创建。
4. 进入应用详情页的 **凭证与基础信息**：
   - 记录 `AppKey`（填入 `DINGTALK_INTERNAL_APP_KEY`）。
   - 记录 `AppSecret`（填入 `DINGTALK_INTERNAL_APP_SECRET`）。
   - 在页面右上角或首页记录企业的 `CorpId`（填入 `DINGTALK_CORP_ID` 及前端的 `VITE_DINGTALK_CORP_ID`）。

### 2. 配置工作台微应用与免登
1. 进入应用详情页的 **开发配置 -> 应用首页地址**。
2. 填写应用首页地址为系统的访问 URL（例如：`https://todo.your-domain.com`）。
3. 配置 **PC端首页地址**（同样填写系统 URL）。
4. 在 **开发配置 -> 安全中心 -> 重定向 URL 白名单** 中，添加您的域名（如 `https://todo.your-domain.com`）。
5. 员工在钉钉手机端或电脑端工作台点击应用时，系统将通过 `dd.runtime.permission.requestAuthCode` 自动换取临时免登码并完成登录。

### 3. 配置浏览器扫码登录
如果需要在外部浏览器中使用钉钉扫码登录：
1. 在钉钉开放平台进入 **应用开发 -> 钉钉应用 / 移动接入应用** 或使用当前应用的扫码登录能力。
2. 获取扫码登录专用的 `Client ID`（即 AppKey）与 `Client Secret`（即 AppSecret）。
3. 分别填入后端 `DINGTALK_QR_CLIENT_ID`、`DINGTALK_QR_CLIENT_SECRET` 以及前端 `VITE_DINGTALK_QR_CLIENT_ID`。

### 4. 配置单聊机器人（任务提醒与通知卡片）
为了实现任务指派、状态变更、临期督办的单聊卡片推送：
1. 在当前企业内部应用的 **应用能力** 中，点击 **添加应用能力**，选择 **机器人**。
2. 开启机器人功能，配置机器人名称与头像。
3. 记录机器人的 **消息编码 (RobotCode)**，填入后端的 `DINGTALK_ROBOT_CODE`。
4. 机器人支持富文本 Markdown 卡片和沉浸式 ActionCard，员工可在单聊卡片中直接查看任务摘要并一键进入详情。

### 5. 开启组织架构与人员自动同步
1. 在应用详情页的 **权限管理** 中，申请以下通讯录权限：
   - **通讯录只读权限**（`Contact.User.Read`）
   - **成员信息读权限**
   - **部门信息读权限**
2. 在 `server/.env` 中开启自动同步任务：
   ```env
   DINGTALK_AUTO_SYNC_ENABLED=true
   # 每天上午 09:36 自动执行增量同步
   DINGTALK_SYNC_CRON=36 9 * * *
   ```
3. 系统将定时拉取部门层级与人员列表并更新至本地 SQLite，实现企业员工名单开箱即用。

---

## 四、生态共创与未来规划（企业微信 / 飞书）

目前 TaskFlow **仅深度适配了钉钉生态**，尚未实现对企业微信（WeCom）与飞书（Feishu/Lark）的对接。

项目的架构设计中已将认证（Auth）、组织同步（Sync）与消息投递（Notification/Robot）抽离为可扩展的 Adapter 模式。我们非常期待并欢迎社区开发者参与共创：

- 🤝 **企业微信适配**：企微自建应用免登、扫码登录、企微群/应用消息通知、企微通讯录同步。
- 🤝 **飞书适配**：飞书网页免登、飞书互动卡片消息（Interactive Cards）、飞书通讯录同步。

欢迎提交 Issue 与 Pull Request！

---

## 五、常用运维命令速查

```bash
# 查看服务运行状态
npm run status

# 查看实时结构化日志
npm run logs

# 重启后台服务（代码更新后）
npm run restart

# 停止后台服务
npm run down

# 数据库安全备份
npm run db:backup
```
