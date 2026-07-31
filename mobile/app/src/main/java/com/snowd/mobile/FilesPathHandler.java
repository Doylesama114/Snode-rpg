package com.snowd.mobile;

import android.net.Uri;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class FilesPathHandler implements WebViewAssetLoader.PathHandler {

    private final File baseDir;

    public FilesPathHandler(File baseDir) {
        this.baseDir = baseDir;
    }

    @Override
    public WebResourceResponse handle(String path) {
        String decoded = null;
        try {
            decoded = Uri.decode(path);
        } catch (Exception ignored) {
        }
        String[] candidates = (decoded != null && !decoded.equals(path))
                ? new String[]{path, decoded}
                : new String[]{path};
        for (String p : candidates) {
            String rel = p.startsWith("/") ? p.substring(1) : p;
            File file = new File(baseDir, rel);
            if (file.isFile()) {
                String mime = mimeFor(file.getName());
                String encoding = (mime.startsWith("text/") || mime.equals("application/json")
                        || mime.startsWith("application/javascript")) ? "UTF-8" : null;
                try {
                    return new WebResourceResponse(mime, encoding, new FileInputStream(file));
                } catch (IOException e) {
                    return error(500, "IO error");
                }
            }
        }
        return error(404, "Not found");
    }

    private static WebResourceResponse error(int code, String msg) {
        byte[] body = msg.getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse("text/plain", "UTF-8", code, msg, null,
                new ByteArrayInputStream(body));
    }

    private static String mimeFor(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        int dot = lower.lastIndexOf('.');
        String ext = dot >= 0 ? lower.substring(dot + 1) : "";
        switch (ext) {
            case "html": case "htm": return "text/html; charset=UTF-8";
            case "js": case "mjs": return "application/javascript; charset=UTF-8";
            case "css": return "text/css; charset=UTF-8";
            case "json": return "application/json; charset=UTF-8";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "gif": return "image/gif";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            case "ico": return "image/x-icon";
            case "ogg": return "audio/ogg";
            case "wav": return "audio/wav";
            case "mp3": return "audio/mpeg";
            case "m4a": return "audio/mp4";
            case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "xls": return "application/vnd.ms-excel";
            case "pdf": return "application/pdf";
            case "zip": return "application/zip";
            case "woff": return "font/woff";
            case "woff2": return "font/woff2";
            case "ttf": return "font/ttf";
            default: return "application/octet-stream";
        }
    }
}
