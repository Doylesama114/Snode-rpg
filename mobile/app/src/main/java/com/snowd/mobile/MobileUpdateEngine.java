package com.snowd.mobile;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Resource transactions, independent of Android so failure paths run on the JVM. */
public final class MobileUpdateEngine {
    public interface Source { InputStream open(String url) throws IOException; }
    public interface Progress { void report(int percent, String message); }
    private static final Object TRANSACTION_LOCK = new Object();
    private String pinnedDirectory;
    private final File root;
    private final Source source;
    private final Progress progress;
    private static final String[] REQUIRED = {
        "index.html", "斯诺德跑团/启动台.html", "poker-game/index.html"
    };
    public MobileUpdateEngine(File root, Source source, Progress progress) {
        this.root = root; this.source = source; this.progress = progress;
    }
    public static boolean validVersion(String v) { return v != null && v.matches("\\d+\\.\\d+\\.\\d+"); }
    public static int compareVersions(String a, String b) {
        String[] aa = a.split("\\."), bb = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int n = new java.math.BigInteger(aa[i]).compareTo(new java.math.BigInteger(bb[i]));
            if (n != 0) return n;
        }
        return 0;
    }
    private File directory(JSONObject meta) throws IOException {
        String version = meta.optString("version");
        if (!validVersion(version)) throw new IOException("资源版本无效");
        String dir = meta.optString("directory", version);
        if (!dir.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-f0-9-]+)?")) throw new IOException("资源目录无效");
        return safeFile(new File(root, "packages"), dir);
    }
    public synchronized JSONObject readInstalled() {
        for (String name : new String[]{"version.json", "version.json.previous"}) {
            File f = new File(root, name);
            try {
                if (f.isFile()) {
                    JSONObject meta = new JSONObject(readText(new FileInputStream(f)));
                    if (healthy(meta)) return meta;
                }
            } catch (Exception ignored) {}
        }
        return null;
    }
    public boolean healthy(JSONObject meta) {
        try {
            File d = directory(meta);
            for (String rel : REQUIRED) if (!safeFile(d, rel).isFile()) return false;
            File receipt = new File(d, ".snode-receipt.json");
            // Existing releases have no receipt; retain them as an offline fallback.
            if (!receipt.isFile()) return !meta.has("directory");
            JSONObject entries = new JSONObject(readText(new FileInputStream(receipt)));
            if (entries.length() < REQUIRED.length) return false;
            for (String rel : REQUIRED) if (!entries.has(rel)) return false;
            Iterator<String> it = entries.keys();
            while (it.hasNext()) {
                String rel = it.next(); File f = safeFile(d, rel);
                JSONObject item = entries.getJSONObject(rel);
                if (!f.isFile() || f.length() != item.getLong("size")) return false;
                if (item.has("sha256") && !sha256(f).equals(item.getString("sha256"))) return false;
            }
            return true;
        } catch (Exception e) { return false; }
    }
    public JSONObject fetchManifest(String url) throws Exception {
        JSONObject j = new JSONObject(readText(source.open(url)));
        validateManifest(j);
        return j;
    }
    public static void validateManifest(JSONObject j) throws Exception {
        if (!validVersion(j.optString("version"))) throw new IOException("更新清单版本无效");
        JSONObject pkgs = j.getJSONObject("packages");
        for (String key : new String[]{"core", "poker"}) {
            JSONObject p = pkgs.getJSONObject(key);
            if (!p.optString("sha256").matches("[a-fA-F0-9]{64}") || p.optLong("size") <= 0 ||
                    p.optLong("size") > 150L * 1024 * 1024) throw new IOException("资源包校验信息无效: " + key);
            urls(p);
        }
    }
    private static List<String> urls(JSONObject p) throws Exception {
        List<String> out = new ArrayList<>();
        out.add(p.getString("url"));
        JSONArray backups = p.optJSONArray("fallbackUrls");
        if (backups != null) for (int i = 0; i < backups.length(); i++) out.add(backups.getString(i));
        for (String u : out) if (!u.startsWith("https://") && !u.matches("asset://bootstrap/[a-z]+-[0-9.]+\\.zip"))
            throw new IOException("不支持的资源地址");
        return out;
    }
    public void protectLoadedDirectory(String directory) { pinnedDirectory = directory; }
    public JSONObject install(JSONObject remote) throws Exception {
        synchronized (TRANSACTION_LOCK) { return installLocked(remote); }
    }
    private JSONObject installLocked(JSONObject remote) throws Exception {
        validateManifest(remote);
        JSONObject old = readInstalled();
        String version = remote.getString("version");
        if (old != null) {
            int order = compareVersions(old.getString("version"), version);
            if (order > 0 || (order == 0 && old.has("directory"))) return old;
            // Same-version legacy installs have no integrity receipt: rebuild from verified packages.
        }
        File pkgs = new File(root, "packages");
        if (!pkgs.mkdirs() && !pkgs.isDirectory()) throw new IOException("无法创建资源目录");
        String dirName = version + "-" + UUID.randomUUID();
        File target = safeFile(pkgs, dirName);
        File stage = safeFile(pkgs, ".staging-" + UUID.randomUUID());
        File downloads = new File(root, "downloads");
        downloads.mkdirs(); stage.mkdirs();
        boolean committed = false;
        try {
            JSONObject receipt = new JSONObject();
            for (String key : new String[]{"core", "poker"}) {
                File zip = new File(downloads, key + "-" + UUID.randomUUID() + ".zip");
                try {
                    JSONObject p = remote.getJSONObject("packages").getJSONObject(key);
                    download(p, zip, key);
                    extract(zip, stage, receipt);
                } finally { zip.delete(); }
            }
            for (String rel : REQUIRED) if (!safeFile(stage, rel).isFile())
                throw new IOException("资源包缺少入口: " + rel);
            writeSynced(new File(stage, ".snode-receipt.json"), receipt.toString());
            if (!stage.renameTo(target)) throw new IOException("无法切换资源目录");
            JSONObject meta = new JSONObject(remote.toString());
            meta.put("directory", dirName);
            if (!healthy(meta)) throw new IOException("解压资源不完整");
            commitMetadata(meta);
            committed = true;
            // Keep the previous resource directory until a later successful installation.
            String oldDir = old == null ? "" : old.optString("directory", old.optString("version"));
            File[] siblings = pkgs.listFiles();
            if (siblings != null) for (File d : siblings)
                if (d.isDirectory() && !d.getName().equals(dirName) && !d.getName().equals(oldDir) && !d.getName().equals(pinnedDirectory))
                    removeTree(d, pkgs);
            return meta;
        } finally {
            removeTree(stage, pkgs);
            if (!committed) removeTree(target, pkgs);
        }
    }
    private void download(JSONObject pkg, File dest, String key) throws Exception {
        Exception last = null;
        for (String url : urls(pkg)) {
            try {
                progress.report(0, "正在下载" + (key.equals("core") ? "核心" : "卡牌") + "资源包");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long count = 0, size = pkg.getLong("size");
                try (InputStream in = source.open(url); FileOutputStream out = new FileOutputStream(dest)) {
                    byte[] buf = new byte[65536]; int n; int lastPct = -1;
                    while ((n = in.read(buf)) != -1) {
                        count += n;
                        if (count > size) throw new IOException("资源包长度超过更新清单");
                        out.write(buf, 0, n); digest.update(buf, 0, n);
                        int pct = (int)(count * 100 / size);
                        if (pct != lastPct) { progress.report(pct, "正在下载" + key + "资源包"); lastPct = pct; }
                    }
                    out.getFD().sync();
                }
                if (count != size) throw new IOException("资源包下载不完整");
                if (!hex(digest.digest()).equalsIgnoreCase(pkg.getString("sha256")))
                    throw new IOException("资源包 SHA-256 校验失败");
                return;
            } catch (Exception e) { last = e; dest.delete(); }
        }
        throw new IOException("全部资源下载地址失败: " + (last == null ? key : last.getMessage()), last);
    }
    private static void extract(File zipFile, File stage, JSONObject receipt) throws Exception {
        try (ZipFile zip = new ZipFile(zipFile)) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            long total = 0; int count = 0;
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (++count > 10000) throw new IOException("资源文件过多");
                String rel = entry.getName();
                File f = safeFile(stage, rel);
                if (rel.startsWith(".") || receipt.has(rel)) throw new IOException("重复或保留资源路径");
                if (entry.isDirectory()) { f.mkdirs(); continue; }
                f.getParentFile().mkdirs();
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream in = zip.getInputStream(entry); FileOutputStream out = new FileOutputStream(f)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) != -1) {
                        total += n;
                        if (total > 250L * 1024 * 1024) throw new IOException("解压资源超过限制");
                        out.write(buf, 0, n); digest.update(buf, 0, n);
                    }
                }
                JSONObject item = new JSONObject().put("size", f.length());
                // Startup validates every file length and critical executable/text assets by hash.
                if (rel.endsWith(".html") || rel.endsWith(".js") || rel.endsWith(".css") || rel.endsWith(".json"))
                    item.put("sha256", hex(digest.digest()));
                receipt.put(rel, item);
            }
        }
    }
    private void commitMetadata(JSONObject meta) throws Exception {
        File pending = new File(root, "version.json.pending"), active = new File(root, "version.json"),
                previous = new File(root, "version.json.previous");
        writeSynced(pending, meta.toString());
        JSONObject old = readInstalled();
        if (old != null) writeSynced(previous, old.toString());
        // POSIX rename replaces atomically on Android; never delete the active pointer first.
        if (!pending.renameTo(active)) throw new IOException("无法保存资源版本，旧版仍保留");
    }
    private static void writeSynced(File f, String text) throws IOException {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(text.getBytes("UTF-8")); out.getFD().sync();
        }
    }
    private static File safeFile(File parent, String rel) throws IOException {
        if (rel.isEmpty() || rel.startsWith("/") || rel.contains("\\") || rel.contains(":"))
            throw new IOException("资源路径非法");
        File f = new File(parent, rel).getCanonicalFile();
        String prefix = parent.getCanonicalPath() + File.separator;
        if (!f.getPath().startsWith(prefix)) throw new IOException("资源路径越界");
        return f;
    }
    private static void removeTree(File d, File parent) throws IOException {
        if (!d.exists()) return;
        if (!d.getCanonicalPath().startsWith(parent.getCanonicalPath() + File.separator))
            throw new IOException("清理路径越界");
        File[] children = d.listFiles();
        if (children != null) for (File c : children) removeTree(c, parent);
        d.delete();
    }
    public static String readText(InputStream input) throws IOException {
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) != -1) {
                if (out.size() + n > 2 * 1024 * 1024) throw new IOException("更新清单过大");
                out.write(buf, 0, n);
            }
            return out.toString("UTF-8");
        }
    }
    private static String sha256(File f) throws Exception {
        MessageDigest d = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) != -1) d.update(buf, 0, n);
        }
        return hex(d.digest());
    }
    private static String hex(byte[] bytes) {
        StringBuilder s = new StringBuilder();
        for (byte b : bytes) s.append(String.format(Locale.ROOT, "%02x", b & 255));
        return s.toString();
    }
}
