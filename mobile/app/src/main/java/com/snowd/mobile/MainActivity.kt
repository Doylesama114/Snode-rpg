package com.snowd.mobile

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
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
import androidx.webkit.WebViewAssetLoader
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var overlay: View
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

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.addJavascriptInterface(SnowdBridge(this), "mobileBridge")

        retryBtn.setOnClickListener { startUpdateFlow() }
        startUpdateFlow()
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
        val loader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/", FilesPathHandler(baseDir))
            .build()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return loader.shouldInterceptRequest(request.url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldInterceptRequest(view: WebView, url: String): WebResourceResponse? {
                return loader.shouldInterceptRequest(Uri.parse(url))
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
        webView.loadUrl("https://appassets.androidplatform.net/index.html")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
