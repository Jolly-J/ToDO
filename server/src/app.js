/**
 * Express 应用装配入口
 *
 * 负责组装全局中间件、业务路由、前端静态托管和错误处理。
 */
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');

const { createConfig, resolvePort } = require('./config');
const logger = require('./utils/logger');
const { requestContext } = require('./middlewares/requestContext');
const { createRequestLogger } = require('./middlewares/requestLogger');
const { errorHandler } = require('./middlewares/errorHandler');
const { registerApiRoutes } = require('./routes');
const { startCleanupScheduler } = require('./utils/cleanup');

function resolveFrontendCacheControl(filePath, distDir) {
  const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/');

  if (relativePath === 'version.json') {
    return 'no-store';
  }

  if (relativePath === 'index.html') {
    return 'no-cache';
  }

  if (relativePath.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }

  return 'no-cache';
}

function setFrontendCacheHeaders(res, filePath, distDir) {
  res.setHeader('Cache-Control', resolveFrontendCacheControl(filePath, distDir));
}

function registerRichTextImageHosting(app) {
  const serverDir = path.resolve(__dirname, '..');
  const imageDir = path.join(serverDir, 'data', 'rich-text-images');

  app.use('/uploads/rich-text-images', express.static(imageDir, {
    index: false,
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
}

function registerFrontendHosting(app, config) {
  if (!config.isProduction) {
    return;
  }

  const distDir = config.frontendDistDir;
  const indexFile = path.join(distDir, 'index.html');
  const hasDist = fs.existsSync(distDir) && fs.existsSync(indexFile);

  if (hasDist) {
    app.use(express.static(distDir, {
      index: false,
      maxAge: 0,
      setHeaders: (res, filePath) => setFrontendCacheHeaders(res, filePath, distDir),
    }));
    logger.info('启用前端静态托管', {
      action: 'system.frontend',
      distDir,
    });
  } else {
    logger.warn('前端静态目录不存在，仅提供 API 服务', {
      action: 'system.frontend',
      distDir,
    });
  }

  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    if (!hasDist) {
      return res.status(503).json({
        code: 503,
        message: '前端静态资源未部署',
        data: null,
      });
    }

    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(indexFile, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

function createApp(overrides = {}) {
  const config = {
    ...createConfig(),
    ...overrides,
  };

  logger.setLogLevel(config.logLevel);

  const app = express();

  app.disable('x-powered-by');

  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContext);
  app.use(createRequestLogger({ slowMs: config.logSlowMs }));

  registerRichTextImageHosting(app);
  registerApiRoutes(app);
  registerFrontendHosting(app, config);

  app.use(errorHandler);

  return app;
}

function startServer(port) {
  const config = createConfig();
  const listenPort = resolvePort(port ?? config.port);
  const app = createApp(config);

  // 启动孤立附件清理定时任务
  startCleanupScheduler();

  return new Promise((resolve) => {
    const server = app.listen(listenPort, '0.0.0.0', () => {
      logger.debug('服务启动成功', {
        action: 'system.start',
        app: config.appName,
        env: config.nodeEnv,
        port: listenPort,
        host: '0.0.0.0',
      });
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  resolvePort,
  startServer,
};
