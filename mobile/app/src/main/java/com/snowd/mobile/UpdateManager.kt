package com.snowd.mobile

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipFile

class UpdateManager(
    private val context: Context,
    private val onProgress: (Int, String) -> Unit,
    private val onReady: (String) -> Unit,
    private val onError: (String) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())
    private val manifestUrl: String = BuildConfig.UPDATE_BASE_URL.trimEnd('/') + "/mobile/version.json"
    private val rootDir: File = File(context.filesDir, "mobile")
    private val metaFile: File = File(rootDir, "version.json")
    private val packagesRoot: File = File(rootDir, "packages")
    private val downloadDir: File = File(rootDir, "downloads")

    fun start() {
        downloadDir.mkdirs()
        Thread { runUpdate() }.start()
    }

    private fun runUpdate() {
        val remote = fetchManifest()
        if (remote == null) {
            val local = readMeta()
            if (local != null && packagesExist(local.optString("version"))) {
                postReady(local.optString("version"))
            } else {
                postError("network unavailable")
            }
            return
        }
        val version = remote.optString("version", "")
        if (version.isEmpty()) {
            postError("bad manifest")
            return
        }
        val local = readMeta()
        if (local != null && local.optString("version") == version && packagesExist(version)) {
            postReady(version)
            return
        }
        val targetDir = File(packagesRoot, version)
        try {
            if (targetDir.exists()) targetDir.deleteRecursively()
            targetDir.mkdirs()
            val pkgs = remote.optJSONObject("packages")
            val core = pkgs?.optJSONObject("core")
            val poker = pkgs?.optJSONObject("poker")
            downloadAndExtract(core, targetDir, "\u6b63\u5728\u4e0b\u8f7d\u6838\u5fc3\u8d44\u6e90\u5305")
            downloadAndExtract(poker, targetDir, "\u6b63\u5728\u4e0b\u8f7d\u5361\u724c\u8d44\u6e90\u5305")
            check(File(targetDir, "index.html").isFile) { "missing index.html" }
            check(File(targetDir, "\u65af\u8bfa\u5fb7\u8dd1\u56e2/\u542f\u52a8\u53f0.html").isFile) { "missing launcher" }
            check(File(targetDir, "poker-game/index.html").isFile) { "missing poker" }
            writeMeta(remote.toString())
            packagesRoot.listFiles()?.forEach { d ->
                if (d.isDirectory && d.name != version) d.deleteRecursively()
            }
            postReady(version)
        } catch (e: Exception) {
            if (targetDir.exists()) targetDir.deleteRecursively()
            val localV = local?.optString("version")
            if (localV != null && packagesExist(localV)) {
                postReady(localV)
            } else {
                postError(e.message ?: "update failed")
            }
        }
    }

    private fun downloadAndExtract(pkg: JSONObject?, targetDir: File, stageMsg: String) {
        if (pkg == null) return
        val url = pkg.optString("url", "")
        if (url.isEmpty()) return
        val sha = pkg.optString("sha256", "").lowercase()
        val size = pkg.optLong("size", 0L)
        val zipFile = File(downloadDir, "pkg_" + System.currentTimeMillis() + ".zip")
        try {
            postProgress(0, stageMsg)
            download(url, zipFile, sha, size, stageMsg)
            postProgress(100, "\u6b63\u5728\u89e3\u538b\u8d44\u6e90\u5305")
            unzip(zipFile, targetDir)
        } finally {
            if (zipFile.exists()) zipFile.delete()
        }
    }

    private fun download(url: String, dest: File, expectedSha: String, expectedSize: Long, stageMsg: String) {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 20000
            conn.readTimeout = 30000
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("User-Agent", "SnodeMobile/1.0")
            conn.connect()
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP " + code)
            val total = if (conn.contentLength > 0) conn.contentLength.toLong() else expectedSize
            val digest = MessageDigest.getInstance("SHA-256")
            dest.outputStream().use { out ->
                conn.inputStream.use { ins ->
                    val buf = ByteArray(64 * 1024)
                    var read = 0L
                    while (true) {
                        val n = ins.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        digest.update(buf, 0, n)
                        read += n
                        if (total > 0) {
                            postProgress((read * 100 / total).toInt().coerceIn(0, 100), stageMsg)
                        }
                    }
                }
            }
            if (dest.length() == 0L) throw IOException("empty download")
            if (expectedSha.isNotEmpty()) {
                val actual = digest.digest().joinToString("") { "%02x".format(it) }
                if (actual != expectedSha) throw IOException("sha256 mismatch")
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun unzip(zipFile: File, targetDir: File) {
        ZipFile(zipFile).use { zip ->
            val entries = zip.entries()
            while (entries.hasMoreElements()) {
                val e = entries.nextElement()
                val name = e.name
                if (name.isEmpty() || name.contains("..") || name.startsWith("/") || name.contains("\\")) continue
                val outFile = File(targetDir, name)
                if (e.isDirectory) {
                    outFile.mkdirs()
                    continue
                }
                outFile.parentFile?.mkdirs()
                zip.getInputStream(e).use { ins ->
                    outFile.outputStream().use { out -> ins.copyTo(out) }
                }
            }
        }
    }

    private fun fetchManifest(): JSONObject? {
        return try {
            val conn = URL(manifestUrl).openConnection() as HttpURLConnection
            try {
                conn.connectTimeout = 20000
                conn.readTimeout = 30000
                conn.instanceFollowRedirects = true
                conn.setRequestProperty("User-Agent", "SnodeMobile/1.0")
                conn.connect()
                if (conn.responseCode !in 200..299) return null
                val text = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                JSONObject(text)
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun readMeta(): JSONObject? {
        return try {
            if (metaFile.exists()) JSONObject(metaFile.readText()) else null
        } catch (e: Exception) {
            null
        }
    }

    private fun writeMeta(text: String) {
        rootDir.mkdirs()
        metaFile.writeText(text)
    }

    private fun packagesExist(version: String): Boolean {
        if (version.isEmpty()) return false
        val d = File(packagesRoot, version)
        return File(d, "index.html").isFile && File(d, "\u65af\u8bfa\u5fb7\u8dd1\u56e2/\u542f\u52a8\u53f0.html").isFile
    }

    private fun postProgress(pct: Int, msg: String) {
        handler.post { onProgress(pct, msg) }
    }

    private fun postReady(version: String) {
        handler.post { onReady(version) }
    }

    private fun postError(msg: String) {
        handler.post { onError(msg) }
    }
}
