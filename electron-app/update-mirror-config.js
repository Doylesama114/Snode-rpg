/**
 * 国内镜像（阿里云 OSS）— 与 GitHub Variables ALIYUN_OSS_PUBLIC_BASE_URL 保持一致。
 * 发版后由 .github/workflows/release.yml mirror-oss job 同步 releases/latest/latest.json
 */
module.exports = {
  OSS_PUBLIC_BASE: 'https://snode-rpg-releases.oss-cn-chengdu.aliyuncs.com',
  OSS_LATEST_JSON: 'https://snode-rpg-releases.oss-cn-chengdu.aliyuncs.com/releases/latest/latest.json',
  GITHUB_LATEST_API: 'https://api.github.com/repos/Doylesama114/Snode-rpg/releases/latest',
  // v1.0.8101: Mac 更新清单（不依赖 api.github.com，避免国内不可达与限流）
  MAC_MANIFEST_OSS: 'https://snode-rpg-releases.oss-cn-chengdu.aliyuncs.com/releases/latest/mac.json',
  MAC_MANIFEST_GITHUB: 'https://github.com/Doylesama114/Snode-rpg/releases/latest/download/mac.json',
  GITHUB_RELEASE_PAGE: 'https://github.com/Doylesama114/Snode-rpg/releases/latest',
};
