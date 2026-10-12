# TaskFlow（任务搭子）

> 现代化的企业级任务协同、团队排期与钉钉深度集成平台。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![React Version](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org)

TaskFlow 是一套专为团队日常协同与督办场景打造的高效任务管理系统。系统深度整合钉钉生态，提供直观的看板、排期甘特图、全员负荷驾驶舱与细粒度权限管控，帮助团队建立“件件有着落、事事有回音”的数字协作流程。

---

## 🌟 核心特性

- **多维视图协同**：支持经典列表、看板拖拽、日历概览、甘特排期与团队驾驶舱多视图无缝切换。
- **钉钉生态深度集成**（当前重点支持）：
  - **无缝免登**：支持钉钉移动端与 PC 端工作台一键免登，体验原生级顺滑。
  - **扫码登录**：支持在常规桌面浏览器通过钉钉扫码快速登录。
  - **智能卡片通知**：基于单聊机器人推送 Markdown 结构化卡片与 ActionCard，支持任务指派、状态流转、变更聚合与催办提醒。
  - **组织架构同步**：支持定时自动同步企业部门与员工通讯录，免除手动维护成本。
- **细粒度权限治理**：内置完善的 RBAC 角色体系，支持多组织空间、团队角色与全局管理，提供精准的数据范围（全部 / 部门 / 个人）隔离与敏感操作审计。
- **轻量可靠的工程架构**：
  - 基于本地高性能 SQLite（`better-sqlite3`），内置 Knex 自动化版本迁移，开箱即用，无需配置繁重的外部数据库。
  - 生产环境支持 Express 单端口全栈托管前端构建包，无需额外复杂的 Nginx 转发配置。

---

## 🌐 办公生态适配与社区共创

TaskFlow 采用模块化解耦架构，认证认证（Auth）、组织同步（Sync）与消息推送（Notification/Robot）底层均已抽象为适配器（Adapter）模式。

| 办公生态 | 适配状态 | 核心能力 |
| :--- | :---: | :--- |
| **钉钉 (DingTalk)** | ✅ **已深度适配** | 客户端免登、扫码登录、单聊机器人通知、ActionCard 落地页、通讯录定时同步 |
| **企业微信 (WeCom)** | 🚧 **诚邀共创** | 企微自建应用免登、扫码登录、应用推送、通讯录同步（架构已预留，期待社区参与） |
| **飞书 (Feishu / Lark)** | 🚧 **诚邀共创** | 飞书网页免登、扫码登录、互动卡片消息（Interactive Cards）、飞书组织架构同步 |

> 💡 **特别说明与共创倡议**：  
> 本项目目前**优先完成了钉钉生态的完整适配与落地**，尚未支持企业微信和飞书。  
> 我们非常渴望与社区开发者一起完善多平台协同生态！如果您对企业微信或飞书开发有经验，欢迎提交 [Issue](https://github.com/Jolly-J/TaskFlow/issues) 或发起 [Pull Request](https://github.com/Jolly-J/TaskFlow/pulls)，共同打造更加开放、好用的全平台任务管理器！

---

## 🛠️ 技术栈

### 前端 (Client)
- **核心框架**：React 19 + TypeScript 5.9 + Vite 8
- **样式与组件**：Tailwind CSS 4 + shadcn/Radix UI + Ant Design + Lucide Icons
- **状态管理**：Zustand
- **富文本能力**：TipTap 富文本编辑器

### 后端 (Server)
- **运行时框架**：Node.js + Express 5 (CommonJS)
- **数据持久化**：SQLite (`better-sqlite3`)
- **数据库迁移**：Knex
- **定时调度**：node-cron
- **外部集成**：钉钉开放平台 OpenAPI

---

## 🚀 快速上手（本地开发）

### 1. 环境准备
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. 获取代码与安装依赖

```bash
# 克隆代码库
git clone https://github.com/Jolly-J/TaskFlow.git
cd TaskFlow

# 安装依赖
npm install
npm --prefix client install
npm --prefix server install
```

### 3. 配置环境变量

复制前后端环境变量模板：

```bash
# 后端环境变量
cp server/.env.example server/.env

# 前端环境变量
cp client/.env.example client/.env
```

根据本地需求配置 `server/.env`（详见 `server/.env.example` 中的注释说明）：
- `JWT_SECRET`：设置随机密钥。
- `INITIAL_SUPER_ADMIN_IDS`：设置系统初始超级管理员的用户 ID（逗号分隔）。
- 钉钉相关配置（可选，如需联调钉钉接口按需填写）。

### 4. 启动开发服务

```bash
npm run dev
```

启动后：
- 前端开发界面：`http://localhost:8821`
- 后端 API 服务：`http://localhost:8344`

---

## 📖 生产部署与钉钉配置

本项目提供了开箱即用的 PM2 进程守护配置，并针对**钉钉微应用与企业开放平台配置**编写了保姆级指南：

👉 **[查看完整生产部署与钉钉配置指南 (DEPLOY.md)](DEPLOY.md)**

该指南包含：
1. 生产环境单端口托管与构建打包全流程；
2. 钉钉企业内部应用创建与免登配置；
3. 钉钉单聊推送机器人（RobotCode）与消息卡片落地配置；
4. 钉钉通讯录权限申请与定时自动增量同步配置。

---

## 🤝 参与贡献 (Contributing)

我们非常欢迎任何形式的社区贡献！

1. **Fork** 本仓库并创建特性分支（`git checkout -b feature/wecom-adapter`）。
2. 提交您的修改，并保持代码整洁与注释清晰。
3. 确保前端类型检查通过：`npm --prefix client run typecheck`。
4. 发起 **Pull Request**，并在描述中说明改动原因和效果。

### 重点共创方向：
- [ ] 企业微信自建应用免登与应用消息适配
- [ ] 飞书网页免登与消息互动卡片适配
- [ ] 移动端 H5 / 小程序端轻量交互体验优化
- [ ] 跨平台日历订阅（iCal / CalDAV）

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。
