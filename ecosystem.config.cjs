/**
 * PM2 进程管理配置
 *
 * 日志系统配置说明：
 * - merge_logs: false - 分模块管理日志文件
 * - out_file: PM2托管的stdout输出
 * - error_file: PM2托管的stderr输出
 * - 业务日志通过logger.js独立写入logs/目录
 *
 * pm2-logrotate 配置（需先安装）：
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 10M
 *   pm2 set pm2-logrotate:retain 7
 *   pm2 set pm2-logrotate:compress true
 */
module.exports = {
  apps: [
    {
      name: 'taskflow',
      script: 'server/src/bootstrap/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        PORT: 8344,
        LOG_LEVEL: 'info',
        LOG_SLOW_MS: 1200,
        LOG_DIR: './logs',
      },

      // 日志配置
      // out_file 设为 /dev/null：终端格式化输出（含 ANSI 颜色码）不写文件
      // 业务日志由 logger.js 独立写入 logs/taskflow.log（结构化 JSON）
      merge_logs: false,
      out_file: '/dev/null',
      error_file: '/dev/null',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // 日志轮转由 pm2-logrotate 模块管理
      // 安装后自动生效，无需在此配置
    },
  ],
};