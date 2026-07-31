package com.snowd.mobile

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

class SnowdBridge(private val activity: Activity) {

    @JavascriptInterface
    fun isAvailable(): Boolean = true

    @JavascriptInterface
    fun saveFile(base64: String, fileName: String): String {
        return try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                }
                val uri = activity.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("insert failed")
                activity.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    ?: throw IllegalStateException("stream failed")
                activity.runOnUiThread {
                    Toast.makeText(activity, "\u5df2\u4fdd\u5b58\u5230\u4e0b\u8f7d\u76ee\u5f55", Toast.LENGTH_LONG).show()
                }
                "saved"
            } else {
                val dir = File(
                    activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: activity.filesDir,
                    "downloads"
                )
                dir.mkdirs()
                val f = File(dir, fileName)
                f.writeBytes(bytes)
                val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", f)
                val share = Intent(Intent.ACTION_SEND).apply {
                    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(Intent.createChooser(share, "export"))
                "saved"
            }
        } catch (e: Exception) {
            "error:" + (e.message ?: "unknown")
        }
    }

    @JavascriptInterface
    fun openExternal(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        } catch (e: Exception) {
            // ignore
        }
    }

    @JavascriptInterface
    fun openDownloads(): String {
        val target = if (Build.VERSION.SDK_INT >= 29) {
            "content://com.android.externalstorage.documents/document/primary%3ADownload"
        } else {
            "content://com.android.externalstorage.documents/document/primary%3AAndroid%2Fdata%2Fcom.snowd.mobile%2Ffiles%2FDownload%2Fdownloads"
        }
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse(target)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(intent)
            "ok"
        } catch (e: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    type = "vnd.android.document/root"
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(intent)
                "ok"
            } catch (e2: Exception) {
                "error:" + (e2.message ?: "unknown")
            }
        }
    }

    @JavascriptInterface
    fun getAppInfo(): String {
        return JSONObject().apply {
            put("appVersion", BuildConfig.VERSION_NAME)
            put("updateBase", BuildConfig.UPDATE_BASE_URL)
        }.toString()
    }
}
