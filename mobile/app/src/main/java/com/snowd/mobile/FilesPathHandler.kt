package com.snowd.mobile

import android.net.Uri
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileInputStream

class FilesPathHandler(private val baseDir: File) : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebViewAssetLoader.Response {
        val decoded = try { Uri.decode(path) } catch (e: Exception) { path }
        val candidates = if (decoded != null && decoded != path) listOf(path, decoded) else listOf(path)
        for (p in candidates) {
            val file = File(baseDir, p.removePrefix("/"))
            if (file.isFile) {
                val mime = mimeFor(file.name)
                val encoding = if (mime.startsWith("text/") || mime == "application/json" || mime.startsWith("application/javascript")) {
                    "UTF-8"
                } else {
                    null
                }
                return WebViewAssetLoader.Response(FileInputStream(file), 200, "OK", mime, encoding)
            }
        }
        return WebViewAssetLoader.Response("Not found", 404)
    }

    private fun mimeFor(name: String): String {
        val ext = name.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "html", "htm" -> "text/html; charset=UTF-8"
            "js", "mjs" -> "application/javascript; charset=UTF-8"
            "css" -> "text/css; charset=UTF-8"
            "json" -> "application/json; charset=UTF-8"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "svg" -> "image/svg+xml"
            "ico" -> "image/x-icon"
            "ogg" -> "audio/ogg"
            "wav" -> "audio/wav"
            "mp3" -> "audio/mpeg"
            "m4a" -> "audio/mp4"
            "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            "xls" -> "application/vnd.ms-excel"
            "pdf" -> "application/pdf"
            "zip" -> "application/zip"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "ttf" -> "font/ttf"
            else -> "application/octet-stream"
        }
    }
}
