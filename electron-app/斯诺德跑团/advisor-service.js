// Public mobile/web service address; API credentials stay on the server.
(function (root) {
  var config = { version: 1, baseUrl: 'https://snode-advisor-qsjpoimdzj.cn-chengdu.fcapp.run' };
  if (typeof module === 'object' && module.exports) module.exports = config;
  if (root) root.SnowdAdvisorService = config;
})(typeof window === 'object' ? window : null);
