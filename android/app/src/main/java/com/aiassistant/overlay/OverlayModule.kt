package com.aiassistant.overlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * JS-facing native module. Owns overlay permission handling and the lifecycle
 * of [OverlayService]. Emits "OverlayEvent" to JS for bubble taps, quick
 * actions, and clipboard changes.
 */
class OverlayModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    // --- Permission ---

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        promise.resolve(canDrawOverlays())
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        if (canDrawOverlays()) {
            promise.resolve(true)
            return
        }
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactContext.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
        // The Settings screen is async; resolve with the current state. JS
        // re-checks hasOverlayPermission() when it next needs to start.
        promise.resolve(false)
    }

    private fun canDrawOverlays(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            Settings.canDrawOverlays(reactContext)
        else true

    // --- Service lifecycle ---

    @ReactMethod
    fun startBubble(promise: Promise) {
        if (!canDrawOverlays()) {
            promise.reject("NO_PERMISSION", "Overlay permission not granted")
            return
        }
        val intent = Intent(reactContext, OverlayService::class.java)
            .setAction(OverlayService.ACTION_START)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun stopBubble(promise: Promise) {
        reactContext.stopService(Intent(reactContext, OverlayService::class.java))
        promise.resolve(true)
    }

    @ReactMethod
    fun isBubbleRunning(promise: Promise) {
        promise.resolve(OverlayService.isRunning)
    }

    @ReactMethod
    fun setClipboardWatch(enabled: Boolean, promise: Promise) {
        val intent = Intent(reactContext, OverlayService::class.java)
            .setAction(OverlayService.ACTION_SET_CLIPBOARD_WATCH)
            .putExtra(OverlayService.EXTRA_ENABLED, enabled)
        reactContext.startService(intent)
        promise.resolve(null)
    }

    // Required for NativeEventEmitter on the JS side.
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    companion object {
        const val NAME = "OverlayModule"

        /** Emits an event to JS. Safe to call from the service. */
        fun emit(context: Context, payload: WritableMap) {
            val reactContext = (context.applicationContext as? com.facebook.react.ReactApplication)
                ?.reactNativeHost
                ?.reactInstanceManager
                ?.currentReactContext as? ReactApplicationContext
                ?: return
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("OverlayEvent", payload)
        }
    }
}
