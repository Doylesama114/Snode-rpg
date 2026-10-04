package com.snowd.mobile

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.FilterInputStream
import java.io.InputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class UpdateManager(
    private val context: Context,
    private val onProgress: (Int, String) -> Unit,
    private val onReady: (String, String, String?) -> Unit,
    private val onError: (String) -> Unit,
    private val onLocalReady: (String, String) -> Unit,
    private val loadedDirectory: String?
) {
    private val handler = Handler(Looper.getMainLooper())
    private val root = java.io.File(context.filesDir, "mobile")
    private val engine = MobileUpdateEngine(root, { url -> openSource(url) }, { pct, msg ->
        handler.post { onProgress(pct, msg) }
    })

    fun start() { engine.protectLoadedDirectory(loadedDirectory); Thread { runUpdate() }.start() }

    private fun openSource(url: String): InputStream {
        if (url.startsWith("asset://bootstrap/")) return context.assets.open(url.removePrefix("asset://"))
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 6000
            conn.readTimeout = 15000
            conn.instanceFollowRedirects = true
            conn.useCaches = false
            conn.setRequestProperty("User-Agent", "SnodeMobile/" + BuildConfig.VERSION_NAME)
            conn.setRequestProperty("Cache-Control", "no-cache")
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP $code")
            return object : FilterInputStream(conn.inputStream) {
                override fun close() { try { super.close() } finally { conn.disconnect() } }
            }
        } catch (e: Exception) { conn.disconnect(); throw e }
    }

    private fun runUpdate() {
        var installed = engine.readInstalled()
        var warning: String? = null
        try {
            val bundled = JSONObject(MobileUpdateEngine.readText(context.assets.open("bootstrap/version.json")))
            for (key in arrayOf("core", "poker")) {
                val pkg = bundled.getJSONObject("packages").getJSONObject(key)
                pkg.put("url", "asset://bootstrap/$key-" + bundled.getString("version") + ".zip")
                pkg.remove("fallbackUrls")
            }
            installed = engine.install(bundled)
        } catch (e: Exception) {
            warning = "内置资源初始化失败：" + (e.message ?: "未知错误")
        }
        installed?.takeIf { engine.healthy(it) }?.let { local ->
            val v = local.getString("version")
            val dir = local.optString("directory", v)
            handler.post { onLocalReady(v, dir) }
        }
        val candidates = mutableListOf<JSONObject>()
        val endpoints = arrayOf(
            BuildConfig.UPDATE_BASE_URL.trimEnd('/') + "/mobile/version.json",
            "https://doylesama114.github.io/Snode-rpg/mobile/version.json",
            "https://github.com/Doylesama114/Snode-rpg/releases/latest/download/mobile-version.json"
        )
        val failures = mutableListOf<String>()
        for (url in endpoints) {
            try {
                val candidate = engine.fetchManifest(url)
                candidates.add(candidate)
            } catch (e: Exception) { failures.add(e.message ?: "网络不可用") }
        }
        var updated = false
        for (candidate in candidates.sortedWith(Comparator { a, b ->
            MobileUpdateEngine.compareVersions(b.getString("version"), a.getString("version"))
        })) {
            try { installed = engine.install(candidate); warning = null; updated = true; break }
            catch (e: Exception) { failures.add(e.message ?: "下载失败") }
        }
        if (!updated) {
            warning = "资源更新未完成，继续使用已验证的本地版本。" + failures.distinct().joinToString(" / ")
        }
        val ready = installed ?: engine.readInstalled()
        if (ready != null && engine.healthy(ready)) {
            val v = ready.getString("version")
            val dir = ready.optString("directory", v)
            handler.post { onReady(v, dir, warning) }
        } else {
            handler.post { onError(warning ?: "没有可用资源，请重试或覆盖安装新版 APK") }
        }
    }
}
