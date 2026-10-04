package com.snowd.mobile;

import org.json.JSONObject;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import static org.junit.Assert.*;

public class MobileUpdateEngineTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();
    private final Map<String, byte[]> network = new HashMap<>();
    private MobileUpdateEngine engine;
    private File root;
    @Before public void setup() throws Exception {
        root = temp.newFolder("mobile");
        engine = new MobileUpdateEngine(root, url -> {
            byte[] bytes = network.get(url);
            if (bytes == null) throw new IOException("HTTP 403 UserDisable");
            return new ByteArrayInputStream(bytes);
        }, (pct, msg) -> {});
    }
    private byte[] zip(Map<String, String> files) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            for (Map.Entry<String, String> f : files.entrySet()) {
                out.putNextEntry(new ZipEntry(f.getKey()));
                out.write(f.getValue().getBytes(StandardCharsets.UTF_8)); out.closeEntry();
            }
        }
        return bytes.toByteArray();
    }
    private String sha(byte[] bytes) throws Exception {
        StringBuilder out = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes))
            out.append(String.format(Locale.ROOT, "%02x", b & 255));
        return out.toString();
    }
    private JSONObject manifest(String version) throws Exception {
        byte[] core = zip(new LinkedHashMap<String, String>() {{
            put("index.html", "redirect");
            put("斯诺德跑团/启动台.html", "version " + version);
            put("斯诺德跑团/user_preferences.js", "settings " + version);
            put("斯诺德跑团/panel.css", "style " + version);
        }});
        byte[] poker = zip(Collections.singletonMap("poker-game/index.html", "cards"));
        JSONObject pkgs = new JSONObject();
        for (String key : new String[]{"core", "poker"}) {
            byte[] bytes = key.equals("core") ? core : poker;
            String url = "https://primary/" + version + "/" + key + ".zip";
            network.put(url, bytes);
            pkgs.put(key, new JSONObject().put("url", url).put("size", bytes.length).put("sha256", sha(bytes)));
        }
        return new JSONObject().put("version", version).put("packages", pkgs);
    }
    private void fails(JSONObject j) {
        try { engine.install(j); fail("Installation must fail"); } catch (Exception expected) {}
    }
    @Test public void bootstrapWorksWithoutNetwork() throws Exception {
        JSONObject j = manifest("1.0.8042");
        for (String key : new String[]{"core","poker"}) {
            JSONObject p = j.getJSONObject("packages").getJSONObject(key);
            String asset = "asset://bootstrap/" + key + "-1.0.8042.zip";
            network.put(asset, network.remove(p.getString("url"))); p.put("url", asset);
        }
        assertTrue(engine.healthy(engine.install(j)));
        assertEquals("1.0.8042", engine.readInstalled().getString("version"));
    }
    @Test public void updateAndRestartKeepPlayerStorageAndPreviousResources() throws Exception {
        File player = new File(temp.getRoot(), "webview-localStorage");
        Files.write(player.toPath(), "player saved data".getBytes(StandardCharsets.UTF_8));
        JSONObject old = engine.install(manifest("1.0.8040"));
        JSONObject next = engine.install(manifest("1.0.8042"));
        assertEquals("1.0.8042", engine.readInstalled().getString("version"));
        assertTrue(engine.healthy(old)); assertTrue(engine.healthy(next));
        assertEquals("player saved data", new String(Files.readAllBytes(player.toPath()), StandardCharsets.UTF_8));
    }
    @Test public void userDisabledPrimaryFallsBackToGitHubPackage() throws Exception {
        JSONObject j = manifest("1.0.8042");
        JSONObject p = j.getJSONObject("packages").getJSONObject("core");
        String github = "https://github.com/backup/core.zip";
        network.put(github, network.remove(p.getString("url")));
        p.put("fallbackUrls", new org.json.JSONArray().put(github));
        assertTrue(engine.healthy(engine.install(j)));
    }
    @Test public void corruptPrimaryCanUseVerifiedBackup() throws Exception {
        JSONObject j = manifest("1.0.8042");
        JSONObject p = j.getJSONObject("packages").getJSONObject("core");
        String backup = "https://backup/core.zip";
        network.put(backup, network.get(p.getString("url")));
        byte[] bad = network.get(p.getString("url")).clone(); bad[bad.length-1] ^= 1;
        network.put(p.getString("url"), bad);
        p.put("fallbackUrls", new org.json.JSONArray().put(backup));
        assertTrue(engine.healthy(engine.install(j)));
    }
    @Test public void truncatedDownloadDoesNotReplaceActiveVersion() throws Exception {
        JSONObject old = engine.install(manifest("1.0.8040")), next = manifest("1.0.8042");
        JSONObject p = next.getJSONObject("packages").getJSONObject("core");
        network.put(p.getString("url"), new byte[7]); fails(next);
        assertEquals(old.getString("directory"), engine.readInstalled().getString("directory"));
        assertTrue(engine.healthy(old));
    }
    @Test public void wrongHashDoesNotReplaceActiveVersion() throws Exception {
        engine.install(manifest("1.0.8040"));
        JSONObject next = manifest("1.0.8042");
        next.getJSONObject("packages").getJSONObject("core").put("sha256", String.join("", Collections.nCopies(64, "0")));
        fails(next); assertEquals("1.0.8040", engine.readInstalled().getString("version"));
    }
    @Test public void missingPokerNeverCommitsPartialCore() throws Exception {
        engine.install(manifest("1.0.8040")); JSONObject next = manifest("1.0.8042");
        JSONObject p = next.getJSONObject("packages").getJSONObject("poker");
        byte[] empty = zip(Collections.singletonMap("poker-game/missing.html", "not entry"));
        network.put(p.getString("url"), empty); p.put("size", empty.length).put("sha256", sha(empty));
        fails(next); assertEquals("1.0.8040", engine.readInstalled().getString("version"));
    }
    @Test public void missingOrSameLengthCorruptScriptRequiresRepair() throws Exception {
        JSONObject j = manifest("1.0.8042"), active = engine.install(j);
        File script = new File(root, "packages/" + active.getString("directory") + "/斯诺德跑团/user_preferences.js");
        byte[] bytes = Files.readAllBytes(script.toPath()); bytes[0] ^= 1; Files.write(script.toPath(), bytes);
        assertFalse(engine.healthy(active)); assertNull(engine.readInstalled());
        JSONObject repaired = engine.install(j);
        assertTrue(engine.healthy(repaired)); assertNotEquals(active.getString("directory"), repaired.getString("directory"));
    }
    @Test public void postponedReloadKeepsTheDirectoryStillUsedByWebView() throws Exception {
        JSONObject showing = engine.install(manifest("1.0.8040"));
        engine.protectLoadedDirectory(showing.getString("directory"));
        engine.install(manifest("1.0.8041"));
        engine.install(manifest("1.0.8042"));
        assertTrue(engine.healthy(showing));
        assertEquals("1.0.8042", engine.readInstalled().getString("version"));
    }
    @Test public void corruptPointerRecoversPreviousVerifiedVersion() throws Exception {
        engine.install(manifest("1.0.8040")); engine.install(manifest("1.0.8042"));
        Files.write(new File(root, "version.json").toPath(), "{broken".getBytes(StandardCharsets.UTF_8));
        assertEquals("1.0.8040", engine.readInstalled().getString("version"));
    }
    @Test public void staleRemoteCannotDowngradeBundledOrInstalledVersion() throws Exception {
        JSONObject installed = engine.install(manifest("1.0.8042"));
        assertEquals(installed.getString("directory"), engine.install(manifest("1.0.8041")).getString("directory"));
    }
    @Test public void unsafeZipCannotWriteOutsideStaging() throws Exception {
        JSONObject next = manifest("1.0.8042");
        JSONObject p = next.getJSONObject("packages").getJSONObject("core");
        byte[] evil = zip(Collections.singletonMap("../../escaped.txt", "escaped"));
        network.put(p.getString("url"), evil); p.put("size", evil.length).put("sha256", sha(evil));
        fails(next); assertFalse(new File(root, "escaped.txt").exists());
        assertNull(engine.readInstalled());
    }
    @Test public void manifestMustDeclareBothVerifiedPackagesAndSafeVersion() throws Exception {
        JSONObject bad = manifest("1.0.8042"); bad.getJSONObject("packages").remove("poker"); fails(bad);
        bad = manifest("1.0.8042"); bad.put("version", "../8042"); fails(bad);
        assertNull(engine.readInstalled());
    }
    @Test public void sameVersionLegacyInstallIsRebuiltWithACompleteReceipt() throws Exception {
        File d = new File(root, "packages/1.0.8042");
        for (String rel : new String[]{"index.html","斯诺德跑团/启动台.html","poker-game/index.html"}) {
            File f = new File(d, rel); f.getParentFile().mkdirs();
            Files.write(f.toPath(), "legacy".getBytes(StandardCharsets.UTF_8));
        }
        Files.write(new File(root,"version.json").toPath(), "{\"version\":\"1.0.8042\"}".getBytes(StandardCharsets.UTF_8));
        assertNotNull(engine.readInstalled());
        JSONObject rebuilt = engine.install(manifest("1.0.8042"));
        assertTrue(rebuilt.has("directory")); assertTrue(engine.healthy(rebuilt));
        assertTrue(new File(root, "packages/" + rebuilt.getString("directory") + "/斯诺德跑团/user_preferences.js").isFile());
    }
    @Test public void legacyCacheWithMissingPokerIsNotConsideredUsable() throws Exception {
        File d = new File(root, "packages/1.0.8041/斯诺德跑团"); assertTrue(d.mkdirs());
        Files.write(new File(d,"启动台.html").toPath(), "old".getBytes(StandardCharsets.UTF_8));
        Files.write(new File(d.getParentFile(),"index.html").toPath(), "old".getBytes(StandardCharsets.UTF_8));
        Files.write(new File(root,"version.json").toPath(), "{\"version\":\"1.0.8041\"}".getBytes(StandardCharsets.UTF_8));
        assertNull(engine.readInstalled());
    }
}
