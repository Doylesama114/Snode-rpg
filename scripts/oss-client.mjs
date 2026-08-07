/**
 * 极简 OSS V1 签名客户端（无第三方依赖）：
 *   - ossPutJson：上传 JSON 对象
 *   - ossList：按前缀列出对象
 *   - ossGet：下载对象文本
 * 服务端（FC 反馈写入）与本地拉取脚本共用。
 */
import crypto from 'crypto';

function encPath(key) {
  return key.split('/').map((seg) => encodeURIComponent(seg)).join('/');
}

function signString(method, bucket, key, headers) {
  const contentType = headers['Content-Type'] || '';
  const md5 = headers['Content-MD5'] || '';
  const date = headers['Date'] || '';
  const resource = `/${bucket}/${key}`;
  return `${method}\n${md5}\n${contentType}\n${date}\n${resource}`;
}

function buildAuth(method, bucket, key, headers, creds) {
  const s = signString(method, bucket, key, headers);
  const sig = crypto.createHmac('sha1', creds.secret).update(s).digest('base64');
  return `OSS ${creds.id}:${sig}`;
}

function endpointBase(bucket, endpoint) {
  const ep = String(endpoint || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${bucket}.${ep}`;
}

export function getOssCreds(env = process.env) {
  return {
    id: env.ALIYUN_OSS_ACCESS_KEY_ID || '',
    secret: env.ALIYUN_OSS_ACCESS_KEY_SECRET || '',
    bucket: env.ALIYUN_OSS_BUCKET || '',
    endpoint: env.ALIYUN_OSS_ENDPOINT || 'oss-cn-chengdu.aliyuncs.com',
  };
}

export async function ossPutJson(key, body, opts = {}) {
  const creds = opts.creds || getOssCreds();
  if (!creds.id || !creds.secret || !creds.bucket) {
    throw new Error('OSS credentials not configured');
  }
  const data = JSON.stringify(body);
  const date = new Date().toUTCString();
  const headers = {
    'Content-Type': 'application/json',
    'Content-MD5': '',
    Date: date,
  };
  const auth = buildAuth('PUT', creds.bucket, key, headers, creds);
  const res = await fetch(`${endpointBase(creds.bucket, creds.endpoint)}/${encPath(key)}`, {
    method: 'PUT',
    headers: {
      ...headers,
      Authorization: auth,
      'Content-Length': String(Buffer.byteLength(data, 'utf8')),
    },
    body: data,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OSS PUT ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

export async function ossList(prefix, opts = {}) {
  const creds = opts.creds || getOssCreds();
  if (!creds.id || !creds.secret || !creds.bucket) {
    throw new Error('OSS credentials not configured');
  }
  const date = new Date().toUTCString();
  const query = `list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
  const headers = { Date: date, 'Content-Type': '' };
  const resource = `/${creds.bucket}/?${query}`;
  const sig = crypto.createHmac('sha1', creds.secret)
    .update(`GET\n\n\n${date}\n${resource}`)
    .digest('base64');
  const res = await fetch(`${endpointBase(creds.bucket, creds.endpoint)}/?${query}`, {
    headers: { ...headers, Authorization: `OSS ${creds.id}:${sig}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OSS LIST ${res.status}: ${text.slice(0, 300)}`);
  }
  const xml = await res.text();
  const keys = [];
  const re = /<Key>([\s\S]*?)<\/Key>/g;
  let m;
  while ((m = re.exec(xml))) keys.push(m[1]);
  return keys.filter((k) => k.endsWith('.json'));
}

export async function ossGet(key, opts = {}) {
  const creds = opts.creds || getOssCreds();
  if (!creds.id || !creds.secret || !creds.bucket) {
    throw new Error('OSS credentials not configured');
  }
  const date = new Date().toUTCString();
  const headers = { Date: date };
  const sig = crypto.createHmac('sha1', creds.secret)
    .update(`GET\n\n\n${date}\n/${creds.bucket}/${key}`)
    .digest('base64');
  const res = await fetch(`${endpointBase(creds.bucket, creds.endpoint)}/${encPath(key)}`, {
    headers: { ...headers, Authorization: `OSS ${creds.id}:${sig}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OSS GET ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.text();
}
