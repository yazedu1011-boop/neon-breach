# Empaquetado nativo de Neon Breach

La aplicación conserva una única build web en `dist/` y la reutiliza en dos contenedores:

- **Windows:** Tauri 2 genera instaladores `.exe` mediante NSIS y `.msi`.
- **Android:** Capacitor genera el proyecto Android y permite producir `.apk` y `.aab`.

## Configuración inicial

Desde la raíz del proyecto:

```bash
pnpm native:setup -- --install
pnpm native:setup -- --android
```

El primer comando instala las dependencias de Tauri y Capacitor y escribe las configuraciones. El segundo inicializa el directorio `android/`; requiere Android Studio/SDK.

También se puede ejecutar solo la generación de archivos:

```bash
pnpm native:setup
pnpm native:check
```

## Windows

Requisitos: Rust, Cargo y WebView2. En Windows:

```powershell
pnpm native:setup -- --install
pnpm desktop:dev
pnpm desktop:build
```

Los artefactos aparecen en `src-tauri/target/release/bundle/`.

## Android

Requisitos: JDK 17+, Android SDK, Platform Tools y variables `ANDROID_HOME` o `ANDROID_SDK_ROOT`.

```bash
pnpm native:setup -- --install
pnpm native:setup -- --android
pnpm android:build:debug
pnpm android:build:release
```

El APK de debug se genera normalmente en `android/app/build/outputs/apk/debug/`. El AAB de release se genera en `android/app/build/outputs/bundle/release/` y debe firmarse con un keystore real antes de distribuirlo.

El wrapper `scripts/native/android-build.mjs` selecciona automáticamente `gradlew` en Unix o `gradlew.bat` en Windows.

`.xapk` no es el formato nativo de Gradle ni el formato recomendado para Google Play. Si una tienda concreta lo exige, debe crearse después a partir del APK/AAB con su herramienta de distribución.

## GitHub Actions

`.github/workflows/native-builds.yml` compila automáticamente un instalador Windows Tauri, un APK Android debug y ejecuta las pruebas del servidor cada vez que se actualiza `main`. Los resultados aparecen como artefactos de la ejecución de GitHub Actions. La firma de release para publicar en Google Play o distribuir un instalador firmado requiere añadir secretos propios del proyecto; el workflow no contiene claves privadas.

## Notas del proyecto

- `webDir` y `frontendDist` apuntan a `dist/`.
- El servidor de desarrollo Tauri usa Vite en `http://localhost:3000`.
- Los modelos y audios se resuelven desde Manus Storage en producción y tienen fallback local para Preview.
- No se han añadido permisos Android sensibles ni APIs de inspección de procesos.
- La firma de Windows y Android debe hacerse con certificados/keystore del propietario del juego.
