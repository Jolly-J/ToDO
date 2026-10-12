/**
 * 钉钉服务 — 基础能力
 *
 * 1. 企业 access_token 缓存
 * 2. 扫码登录换票
 * 3. 免登换票
 * 4. 用户信息获取
 * 5. unionid → userid 映射
 *
 * 所有钉钉配置从环境变量读取
 */

const logger = require('../../utils/logger');
const { loadEnv } = require('../../bootstrap/env');
const userIdentityDao = require('../../db/userIdentityDao');
const crypto = require('node:crypto');

loadEnv();

// ──────────────────────────────────────────
// 配置
// ──────────────────────────────────────────

function pickEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function maskValue(value) {
  if (!value) {
    return 'unset';
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function extractProviderSubError(providerMessage) {
  const message = String(providerMessage || '');
  const subcode = message.match(/subcode=([^,\]]+)/)?.[1] || null;
  const submsg = message.match(/submsg=([^,\]]+)/)?.[1] || null;
  return { subcode, submsg };
}

function createDingtalkProviderError(message, data = {}) {
  const error = new Error(message);
  const providerMessage = data.errmsg || data.message || null;
  const { subcode, submsg } = extractProviderSubError(providerMessage);

  if (data.errcode !== undefined) {
    error.providerCode = String(data.errcode);
  }
  if (providerMessage) {
    error.providerMessage = providerMessage;
  }
  if (subcode) {
    error.providerSubCode = subcode;
  }
  if (submsg) {
    error.providerSubMessage = submsg;
  }

  return error;
}

function getDingtalkConfig() {
  const clientId = pickEnv('DINGTALK_CLIENT_ID');
  const clientSecret = pickEnv('DINGTALK_CLIENT_SECRET');
  const robotCode = pickEnv('DINGTALK_ROBOT_CODE', 'DINGTALK_CHATBOT_CODE', 'DINGTALK_CLIENT_ID');
  const internalAppKey = pickEnv(
    'DINGTALK_INTERNAL_APP_KEY',
    'DINGTALK_APP_KEY',
    'DINGTALK_SUITE_KEY',
    'DINGTALK_OLD_APP_KEY',
    'DINGTALK_CLIENT_ID'
  );
  const internalAppSecret = pickEnv(
    'DINGTALK_INTERNAL_APP_SECRET',
    'DINGTALK_APP_SECRET',
    'DINGTALK_SUITE_SECRET',
    'DINGTALK_OLD_APP_SECRET',
    'DINGTALK_CLIENT_SECRET'
  );
  const explicitQrClientId = pickEnv('DINGTALK_QR_CLIENT_ID');
  const explicitQrClientSecret = pickEnv('DINGTALK_QR_CLIENT_SECRET');
  const qrClientId = explicitQrClientId || clientId;
  const qrClientSecret = explicitQrClientSecret || clientSecret;

  return {
    appKey: internalAppKey,
    appSecret: internalAppSecret,
    internalAppKey,
    internalAppSecret,
    clientId,
    clientSecret,
    robotCode,
    qrClientId,
    qrClientSecret,
    qrConfigMode: explicitQrClientId && explicitQrClientSecret ? 'explicit' : 'fallback-to-internal',
    corpId: pickEnv('DINGTALK_CORP_ID'),
    agentId: pickEnv('DINGTALK_AGENT_ID'),
    // 旧版
    oldAppKey: pickEnv('DINGTALK_OLD_APP_KEY'),
    oldAppSecret: pickEnv('DINGTALK_OLD_APP_SECRET'),
  };
}

const configSnapshot = getDingtalkConfig();
logger.debug('钉钉配置加载', {
  action: 'dingtalk.config',
  qrConfigMode: configSnapshot.qrConfigMode,
  hasQrClientId: Boolean(configSnapshot.qrClientId),
  hasInternalAppKey: Boolean(configSnapshot.internalAppKey),
});

if (!configSnapshot.qrClientId || !configSnapshot.qrClientSecret) {
  logger.warn('钉钉扫码配置缺失', {
    action: 'dingtalk.config',
    qrConfigMode: 'missing',
  });
} else {
  logger.debug('钉钉扫码配置就绪', {
    action: 'dingtalk.config',
    mode: configSnapshot.qrConfigMode,
  });
}

if (!configSnapshot.internalAppKey || !configSnapshot.internalAppSecret) {
  logger.debug('钉钉内部应用键缺失', {
    action: 'dingtalk.config',
  });
}

// ──────────────────────────────────────────
// access_token 缓存
// ──────────────────────────────────────────

let tokenCache = {
  token: null,
  expiresAt: 0,
};

let jsapiTicketCache = {
  ticket: null,
  expiresAt: 0,
};

/**
 * 获取企业 access_token (带缓存)
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const config = getDingtalkConfig();

  if (!config.internalAppKey || !config.internalAppSecret) {
    throw new Error('钉钉内部应用 Client ID/Client Secret 未配置');
  }

  const response = await fetch('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appKey: config.internalAppKey,
      appSecret: config.internalAppSecret,
    }),
  });

  const data = await response.json();

  if (!data.accessToken) {
    logger.error('获取钉钉应用令牌失败', {
      action: 'dingtalk.auth.access_token',
      errcode: data.errcode,
      errmsg: data.errmsg || data.message,
    });
    throw new Error('获取钉钉 access_token 失败');
  }

  tokenCache = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expireIn - 300) * 1000, // 提前 5 分钟刷新
  };

  logger.debug('获取钉钉应用令牌成功', {
    action: 'dingtalk.auth.access_token',
    expiresIn: data.expireIn,
  });

  return tokenCache.token;
}

function normalizeJsapiUrl(rawUrl) {
  const parsedUrl = new URL(rawUrl);
  parsedUrl.hash = '';
  return parsedUrl.toString();
}

function createJsapiSignature({ ticket, nonceStr, timestamp, url }) {
  const plain = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(plain, 'utf8').digest('hex');
}

async function getJsapiTicket() {
  if (jsapiTicketCache.ticket && Date.now() < jsapiTicketCache.expiresAt) {
    return jsapiTicketCache.ticket;
  }

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://oapi.dingtalk.com/get_jsapi_ticket?access_token=${encodeURIComponent(accessToken)}`
  );
  const data = await response.json();

  if (data.errcode !== 0 || !data.ticket) {
    logger.error('获取钉钉 JSAPI ticket 失败', {
      action: 'dingtalk.jsapi.ticket',
      errcode: data.errcode,
      errmsg: data.errmsg || data.message,
    });
    throw new Error('获取钉钉 JSAPI ticket 失败');
  }

  const expiresIn = Number(data.expires_in || 7200);
  jsapiTicketCache = {
    ticket: data.ticket,
    expiresAt: Date.now() + Math.max(expiresIn - 300, 60) * 1000,
  };

  logger.info('获取钉钉 JSAPI ticket 成功', {
    action: 'dingtalk.jsapi.ticket',
    expiresIn,
  });

  return jsapiTicketCache.ticket;
}

async function getJsapiSignature(rawUrl, options = {}) {
  if (!rawUrl) {
    throw new Error('缺少签名 URL');
  }

  const config = getDingtalkConfig();
  if (!config.corpId) {
    throw new Error('DINGTALK_CORP_ID 未配置');
  }
  if (!config.agentId) {
    throw new Error('DINGTALK_AGENT_ID 未配置');
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeJsapiUrl(rawUrl);
  } catch {
    throw new Error('签名 URL 不合法');
  }

  const timestamp = Number(options.timestamp || Math.floor(Date.now() / 1000));
  const nonceStr = String(options.nonceStr || crypto.randomBytes(8).toString('hex'));
  const ticket = await getJsapiTicket();
  const signature = createJsapiSignature({
    ticket,
    nonceStr,
    timestamp,
    url: normalizedUrl,
  });

  return {
    corpId: config.corpId,
    agentId: config.agentId,
    nonceStr,
    timeStamp: timestamp,
    signature,
    url: normalizedUrl,
  };
}

/**
 * 扫码登录 — 用 authCode 获取用户 accessToken
 * @param {string} authCode
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function getUserTokenByCode(authCode) {
  logger.debug('开始换取扫码登录用户令牌', {
    action: 'dingtalk.auth.qr.token',
    hasAuthCode: Boolean(authCode),
  });
  const config = getDingtalkConfig();

  if (!config.qrClientId || !config.qrClientSecret) {
    throw new Error('钉钉扫码 Client ID/Client Secret 未配置，请设置 DINGTALK_CLIENT_ID 与 DINGTALK_CLIENT_SECRET');
  }

  const response = await fetch('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: config.qrClientId,
      clientSecret: config.qrClientSecret,
      code: authCode,
      grantType: 'authorization_code',
    }),
  });

  const data = await response.json();

  if (!data.accessToken) {
    logger.error('换取扫码登录用户令牌失败', {
      action: 'dingtalk.auth.qr.token',
      errcode: data.errcode,
      errmsg: data.errmsg || data.message,
    });
    throw new Error('钉钉用户 token 获取失败');
  }

  logger.debug('换取扫码登录用户令牌成功', {
    action: 'dingtalk.auth.qr.token',
  });

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

/**
 * 获取用户个人信息 (新版 API)
 * @param {string} userAccessToken
 * @returns {Promise<{ nick: string, unionId: string, openId: string, avatarUrl: string }>}
 */
async function getUserInfoByToken(userAccessToken) {
  logger.debug('开始获取扫码登录用户信息', {
    action: 'dingtalk.auth.qr.profile',
    hasUserAccessToken: Boolean(userAccessToken),
  });
  const response = await fetch('https://api.dingtalk.com/v1.0/contact/users/me', {
    method: 'GET',
    headers: {
      'x-acs-dingtalk-access-token': userAccessToken,
    },
  });

  const data = await response.json();

  if (!data.unionId) {
    logger.error('获取扫码登录用户信息失败', {
      action: 'dingtalk.auth.qr.profile',
      errcode: data.errcode,
      errmsg: data.errmsg || data.message,
    });
    throw new Error('获取钉钉用户信息失败');
  }

  logger.debug('获取扫码登录用户信息成功', {
    action: 'dingtalk.auth.qr.profile',
    hasUnionId: Boolean(data.unionId),
    hasOpenId: Boolean(data.openId),
  });

  return data;
}

/**
 * unionid → userid 映射
 * @param {string} unionid
 * @returns {Promise<string>} userid
 */
async function getUserIdByUnionId(unionid) {
  logger.debug('开始根据 unionId 换取 userId', {
    action: 'dingtalk.auth.qr.userid',
    hasUnionId: Boolean(unionid),
  });

  const localIdentity = userIdentityDao.findByUnionId('dingtalk', unionid);
  if (localIdentity?.provider_userid || localIdentity?.user_id) {
    const providerUserId = localIdentity.provider_userid || localIdentity.user_id;
    logger.debug('命中本地身份映射，跳过远端 userId 查询', {
      action: 'dingtalk.auth.qr.userid',
      userid: providerUserId,
    });
    return providerUserId;
  }

  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/user/getbyunionid?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unionid }),
    }
  );

  const data = await response.json();

  if (data.errcode !== 0 || !data.result?.userid) {
    logger.error('根据 unionId 换取 userId 失败', {
      action: 'dingtalk.auth.qr.userid',
      unionid,
      errcode: data.errcode,
      errmsg: data.errmsg,
    });
    const config = getDingtalkConfig();
    const details = [
      'unionid 换 userid 失败',
      data.errcode !== undefined ? `errcode=${data.errcode}` : null,
      data.errmsg ? `errmsg=${data.errmsg}` : null,
      config.qrClientId && config.internalAppKey && config.qrClientId !== config.internalAppKey
        ? '扫码登录配置与内部应用配置不一致'
        : null,
    ].filter(Boolean).join(' | ');

    const error = new Error(details);
    error.code = 'DINGTALK_UNIONID_USERID_LOOKUP_FAILED';
    error.providerCode = data.errcode !== undefined ? String(data.errcode) : null;
    error.providerMessage = data.errmsg || null;
    throw error;
  }

  logger.debug('根据 unionId 换取 userId 成功', {
    action: 'dingtalk.auth.qr.userid',
    userid: data.result.userid,
  });

  return data.result.userid;
}

/**
 * 钉钉内免登 — 用 authCode 获取 userid
 * @param {string} authCode
 * @returns {Promise<string>} userid
 */
async function getUserIdByCode(authCode) {
  logger.debug('开始根据免登 authCode 换取 userId', {
    action: 'dingtalk.auth.auto.userid',
    hasAuthCode: Boolean(authCode),
  });
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authCode }),
    }
  );

  const data = await response.json();

  if (data.errcode !== 0 || !data.result?.userid) {
    logger.error('根据免登 authCode 换取 userId 失败', {
      action: 'dingtalk.auth.auto.userid',
      errcode: data.errcode,
      errmsg: data.errmsg,
    });
    throw new Error('免登获取 userid 失败');
  }

  logger.debug('根据免登 authCode 换取 userId 成功', {
    action: 'dingtalk.auth.auto.userid',
    userid: data.result.userid,
  });

  return data.result.userid;
}

/**
 * 获取用户详细信息 (旧版 API)
 * @param {string} userid
 * @returns {Promise<object>}
 */
async function getUserDetailById(userid, options = {}) {
  const { logFailure = true } = options;

  logger.debug('[用户] 开始获取用户详情', {
    action: 'dingtalk.user.detail',
    userid,
  });
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid, language: 'zh_CN' }),
    }
  );

  const data = await response.json();

  if (data.errcode !== 0 || !data.result) {
    const error = createDingtalkProviderError('获取用户详情失败', data);
    if (logFailure) {
      logger.error('获取用户详情失败', {
        action: 'dingtalk.user.detail',
        userid,
        errcode: data.errcode,
        errmsg: data.errmsg,
        subcode: error.providerSubCode,
        submsg: error.providerSubMessage,
      });
    }
    throw error;
  }

  logger.debug('[用户] 获取用户详情成功', {
    action: 'dingtalk.user.detail',
    userid,
    hasUnionId: Boolean(data.result?.unionid),
  });

  return data.result;
}

/**
 * 获取部门列表
 * @param {string} [parentId='1']
 * @returns {Promise<object[]>}
 */
async function getDepartmentList(parentId = '1') {
  logger.info('[同步] 开始获取部门列表', {
    action: 'dingtalk.department.list',
    parentId,
  });
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/department/listsub?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dept_id: Number(parentId), language: 'zh_CN' }),
    }
  );

  const data = await response.json();

  if (data.errcode !== 0) {
    logger.error('获取部门列表失败', {
      action: 'dingtalk.department.list',
      parentId,
      errcode: data.errcode,
      errmsg: data.errmsg,
    });
    const error = new Error(`获取部门列表失败: ${data.errmsg || '未知错误'} (${data.errcode ?? 'unknown'})`);
    error.providerCode = String(data.errcode ?? '');
    error.providerMessage = data.errmsg || '';
    error.parentId = parentId;
    throw error;
  }

  logger.info('[同步] 获取部门列表成功', {
    action: 'dingtalk.department.list',
    parentId,
    count: Array.isArray(data.result) ? data.result.length : 0,
  });

  return data.result || [];
}

/**
 * 获取部门用户列表 (分页)
 * @param {string} departmentId
 * @param {number} [cursor=0]
 * @param {number} [size=100]
 * @returns {Promise<{ list: object[], hasMore: boolean, nextCursor: number }>}
 */
async function getDepartmentUsers(departmentId, cursor = 0, size = 100) {
  logger.info('[同步] 开始获取部门用户列表', {
    action: 'dingtalk.department.users',
    departmentId,
    cursor,
    size,
  });
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/user/listsimple?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dept_id: Number(departmentId),
        cursor,
        size,
      }),
    }
  );

  const data = await response.json();

  if (data.errcode !== 0) {
    logger.error('获取部门用户列表失败', {
      action: 'dingtalk.department.users',
      departmentId,
      cursor,
      size,
      errcode: data.errcode,
      errmsg: data.errmsg,
    });
    const error = new Error(`获取部门用户列表失败: ${data.errmsg || '未知错误'} (${data.errcode ?? 'unknown'})`);
    error.providerCode = String(data.errcode ?? '');
    error.providerMessage = data.errmsg || '';
    error.departmentId = String(departmentId);
    error.cursor = cursor;
    throw error;
  }

  logger.info('[同步] 获取部门用户列表成功', {
    action: 'dingtalk.department.users',
    departmentId,
    cursor,
    hasMore: Boolean(data.result?.has_more),
    count: Array.isArray(data.result?.list) ? data.result.list.length : 0,
  });

  return {
    list: data.result?.list || [],
    hasMore: data.result?.has_more || false,
    nextCursor: data.result?.next_cursor || 0,
  };
}

module.exports = {
  getDingtalkConfig,
  getAccessToken,
  getUserTokenByCode,
  getUserInfoByToken,
  getUserIdByUnionId,
  getUserIdByCode,
  getJsapiSignature,
  getUserDetailById,
  getDepartmentList,
  getDepartmentUsers,
};
