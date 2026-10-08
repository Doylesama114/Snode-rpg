plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val verName: String = (project.findProperty("versionName") as String?) ?: "1.0.8047"
val verCode: Int = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: verName.split(".").lastOrNull()?.toIntOrNull() ?: 1
val updateBase: String = (project.findProperty("updateBase") as String?) ?: "https://snode-rpg-releases.oss-cn-chengdu.aliyuncs.com"

android {
    namespace = "com.snowd.mobile"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.snowd.mobile"
        minSdk = 24
        targetSdk = 34
        versionCode = verCode
        versionName = verName
        buildConfigField("String", "UPDATE_BASE_URL", "\"$updateBase\"")
    }

    signingConfigs {
        val ksPath = project.findProperty("keystorePath") as String?
        if (ksPath != null) {
            create("release") {
                storeFile = rootProject.file(ksPath)
                storePassword = project.findProperty("keystorePass") as String?
                keyAlias = project.findProperty("keyAlias") as String?
                keyPassword = project.findProperty("keyPass") as String?
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val rel = signingConfigs.findByName("release")
            if (rel != null) {
                signingConfig = rel
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}


// Ship a complete, verified offline bootstrap with the APK. No player data is included.
val bootstrapDir = layout.buildDirectory.dir("generated/bootstrapAssets")
val bootstrapVersion = verName
val prepareBootstrap by tasks.registering(Sync::class) {
    from(rootProject.file("../dist_mobile")) {
        include("core-$bootstrapVersion.zip", "poker-$bootstrapVersion.zip", "version.json")
    }
    into(bootstrapDir.map { it.dir("bootstrap") })
    doFirst {
        for (name in listOf("core-$bootstrapVersion.zip", "poker-$bootstrapVersion.zip", "version.json")) {
            check(rootProject.file("../dist_mobile/$name").isFile) { "Missing bootstrap: $name; run build-mobile-packages first" }
        }
    }
}
android.sourceSets.getByName("main").assets.srcDir(bootstrapDir)
if (!project.hasProperty("skipBootstrap")) tasks.named("preBuild").configure { dependsOn(prepareBootstrap) }
dependencies {
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
