package com.aiassistant.overlay

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.aiassistant.MainActivity
import com.aiassistant.R
import com.facebook.react.bridge.Arguments

/**
 * Foreground service that renders the floating assistant bubble using
 * WindowManager + TYPE_APPLICATION_OVERLAY. Keeps the bubble alive across apps
 * while staying battery-friendly (no polling; clipboard is event-driven).
 */
class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private var bubble: FloatingBubbleView? = null

    private var clipboardWatchEnabled = true
    private val clipboardManager by lazy {
        getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    }
    private val clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
        if (!clipboardWatchEnabled) return@OnPrimaryClipChangedListener
        val clip = clipboardManager.primaryClip ?: return@OnPrimaryClipChangedListener
        if (clip.itemCount == 0) return@OnPrimaryClipChangedListener
        val text = clip.getItemAt(0).coerceToText(this).toString()
        if (text.isNotBlank()) {
            // Surface quick actions on the bubble; text is held only transiently.
            bubble?.showQuickActions(text)
        }
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        clipboardManager.addPrimaryClipChangedListener(clipboardListener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SET_CLIPBOARD_WATCH ->
                clipboardWatchEnabled = intent.getBooleanExtra(EXTRA_ENABLED, true)
            else -> {
                startForeground(NOTIF_ID, buildNotification())
                if (bubble == null) addBubble()
                isRunning = true
            }
        }
        return START_STICKY
    }

    private fun addBubble() {
        val type =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 24
            y = 240
        }

        bubble = FloatingBubbleView(
            context = this,
            windowManager = windowManager,
            layoutParams = params,
            callbacks = object : FloatingBubbleView.Callbacks {
                override fun onTapped() = emitBubbleTapped()
                override fun onQuickAction(action: String, text: String) =
                    emitQuickAction(action, text)
                override fun onOpenApp() = openApp()
                override fun onClose() = closeBubble()
            }
        )
        windowManager.addView(bubble, params)
    }

    // --- Event emission to JS ---

    private fun emitBubbleTapped() {
        val map = Arguments.createMap().apply { putString("type", "bubbleTapped") }
        OverlayModule.emit(this, map)
        openApp()
    }

    /** Close button on the bubble: notify JS (so Settings syncs) then stop. */
    private fun closeBubble() {
        val map = Arguments.createMap().apply { putString("type", "bubbleClosed") }
        OverlayModule.emit(this, map)
        stopSelf()
    }

    private fun emitQuickAction(action: String, text: String) {
        val map = Arguments.createMap().apply {
            putString("type", "quickAction")
            putString("action", action)
            putString("text", text)
        }
        OverlayModule.emit(this, map)
        openApp()
    }

    private fun openApp() {
        val intent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(intent)
    }

    // --- Foreground notification ---

    private fun buildNotification(): android.app.Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "AI Assistant bubble",
                NotificationManager.IMPORTANCE_MIN
            ).apply { setShowBadge(false) }
            (getSystemService(NotificationManager::class.java)).createNotificationChannel(channel)
        }
        val tap = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AI Assistant active")
            .setContentText("Tap the bubble to improve or share text.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(tap)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        clipboardManager.removePrimaryClipChangedListener(clipboardListener)
        bubble?.let { runCatching { windowManager.removeView(it) } }
        bubble = null
        isRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START = "com.aiassistant.overlay.START"
        const val ACTION_SET_CLIPBOARD_WATCH = "com.aiassistant.overlay.SET_CLIPBOARD_WATCH"
        const val EXTRA_ENABLED = "enabled"
        private const val CHANNEL_ID = "ai_assistant_overlay"
        private const val NOTIF_ID = 1001

        @Volatile
        var isRunning: Boolean = false
            private set
    }
}
