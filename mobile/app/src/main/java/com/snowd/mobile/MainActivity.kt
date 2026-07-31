package com.snowd.mobile

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var overlay: View
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val reqFileChooser = 1001
    private lateinit var progressBar: ProgressBar
    private lateinit var statusText: TextView
    private lateinit var retryBtn: Button
    private var currentVersion: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webView)
        overlay = findViewById(R.id.updateOverlay)
        progressBar = findViewById(R.id.progressBar)
        statusText = findViewById(R.id.statusText)
        retryBtn = findViewById(R.id.retryBtn)

        WebView.setWebContentsDebuggingEnabled(true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.addJavascriptInterface(SnowdBridge(this), "mobileBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: android.webkit.WebChromeClient.FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = fileChooserParams?.createIntent()?.apply {
                    type = "*/*"
                } ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
                return try {
                    startActivityForResult(intent, reqFileChooser)
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    filePathCallback?.onReceiveValue(null)
                    false
                }
            }
        }

        retryBtn.setOnClickListener { startUpdateFlow() }
        startUpdateFlow()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == reqFileChooser) {
            val cb = filePathCallback
            filePathCallback = null
            if (cb != null) {
                var results: Array<Uri>? = null
                if (resultCode == Activity.RESULT_OK && data != null) {
                    val uri = data.data
                    results = if (uri != null) {
                        arrayOf(uri)
                    } else if (data.clipData != null && data.clipData!!.itemCount > 0) {
                        Array(data.clipData!!.itemCount) { data.clipData!!.getItemAt(it).uri }
                    } else {
                        null
                    }
                }
                cb.onReceiveValue(results)
            }
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    private fun startUpdateFlow() {
        retryBtn.visibility = View.GONE
        overlay.visibility = View.VISIBLE
        progressBar.progress = 0
        statusText.setText(R.string.update_checking)
        UpdateManager(
            applicationContext,
            onProgress = { pct, msg ->
                progressBar.progress = pct
                statusText.text = msg
            },
            onReady = { version -> loadApp(version) },
            onError = { msg ->
                statusText.text = getString(R.string.update_error) + " (" + msg + ")"
                retryBtn.visibility = View.VISIBLE
            }
        ).start()
    }

    private fun loadApp(version: String) {
        currentVersion = version
        val baseDir = File(File(filesDir, "mobile/packages"), version)
        val handler = FilesPathHandler(baseDir)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                return if (url.host == "appassets.androidplatform.net") {
                    handler.handle(url.path ?: "/")
                } else {
                    null
                }
            }

            @Deprecated("Deprecated in Java")
            override fun shouldInterceptRequest(view: WebView, url: String): WebResourceResponse? {
                val u = Uri.parse(url)
                return if (u.host == "appassets.androidplatform.net") {
                    handler.handle(u.path ?: "/")
                } else {
                    null
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith("https://appassets.androidplatform.net/")) return false
                if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
                    SnowdBridge(this@MainActivity).openExternal(url)
                    return true
                }
                return false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                overlay.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    overlay.visibility = View.VISIBLE
                    statusText.text = getString(R.string.update_error) + " (load)"
                    retryBtn.visibility = View.VISIBLE
                }
            }
        }
        val indexFile = File(baseDir, "index.html")
        if (indexFile.isFile()) {
            val html = indexFile.readText(Charsets.UTF_8)
            android.util.Log.d("SnodeApp", "loadData html len=" + html.length + " head=" + html.take(80))
            webView.loadDataWithBaseURL(
                "https://appassets.androidplatform.net/",
                html,
                "text/html",
                "UTF-8",
                null
            )
        } else {
            android.util.Log.e("SnodeApp", "index.html missing at " + baseDir.absolutePath)
            webView.loadUrl("https://appassets.androidplatform.net/index.html")
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
