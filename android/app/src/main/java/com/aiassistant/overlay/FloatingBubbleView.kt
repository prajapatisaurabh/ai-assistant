package com.aiassistant.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * The floating bubble UI. Composed entirely in code so it needs no XML/assets.
 *
 * - Draggable anywhere on screen (snaps nothing; respects FLAG_LAYOUT_NO_LIMITS).
 * - Tap (without drag) collapses/expands an action panel.
 * - Quick-action chips appear when fresh clipboard text is detected.
 */
@SuppressLint("ViewConstructor", "ClickableViewAccessibility")
class FloatingBubbleView(
    context: Context,
    private val windowManager: WindowManager,
    private val layoutParams: WindowManager.LayoutParams,
    private val callbacks: Callbacks
) : FrameLayout(context) {

    interface Callbacks {
        fun onTapped()
        fun onQuickAction(action: String, text: String)
        fun onOpenApp()
        fun onClose()
    }

    private val density = context.resources.displayMetrics.density
    private fun dp(v: Int) = (v * density).toInt()

    private val bubble: TextView
    private val panel: LinearLayout
    private var expanded = false
    private var pendingClipboardText: String? = null

    init {
        // --- The circular bubble ---
        bubble = TextView(context).apply {
            text = "AI"
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                colors = intArrayOf(Color.parseColor("#4F46E5"), Color.parseColor("#06B6D4"))
                orientation = GradientDrawable.Orientation.TL_BR
            }
            elevation = dp(8).toFloat()
            val size = dp(56)
            layoutParams = LayoutParams(size, size)
        }

        // --- The expandable action panel (hidden by default) ---
        panel = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#1B1C22"))
            }
            elevation = dp(8).toFloat()
            setPadding(dp(8), dp(8), dp(8), dp(8))
            layoutParams = LayoutParams(dp(200), LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(64)
            }
            addView(actionRow("✨ Improve Text", "improve"))
            addView(actionRow("📝 Summarize", "summarize"))
            addView(actionRow("📣 Create Social Post", "social"))
            addView(actionRow("💬 Open Assistant", "open"))
            addView(divider())
            addView(actionRow("✕ Close Assistant", "close"))
        }

        addView(panel)
        addView(bubble)

        bubble.setOnTouchListener(DragTapListener())
    }

    private fun actionRow(label: String, action: String): TextView =
        TextView(context).apply {
            text = label
            // Tint the destructive "Close" row red; others white.
            setTextColor(if (action == "close") Color.parseColor("#FF6B6B") else Color.WHITE)
            textSize = 14f
            setPadding(dp(14), dp(12), dp(14), dp(12))
            isClickable = true
            setOnClickListener {
                when (action) {
                    "open" -> callbacks.onOpenApp()
                    "close" -> {
                        callbacks.onClose()
                        return@setOnClickListener // view is being torn down
                    }
                    else -> {
                        val text = pendingClipboardText
                        if (text != null) {
                            callbacks.onQuickAction(action, text)
                        } else {
                            callbacks.onTapped()
                        }
                    }
                }
                collapse()
            }
        }

    /** Thin separator line used inside the action panel. */
    private fun divider(): View =
        View(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(1)).apply {
                topMargin = dp(4)
                bottomMargin = dp(4)
            }
            setBackgroundColor(Color.parseColor("#33FFFFFF"))
        }

    /** Called by the service when fresh clipboard text is available. */
    fun showQuickActions(text: String) {
        pendingClipboardText = text
        if (!expanded) toggle()
    }

    private fun toggle() = if (expanded) collapse() else expand()

    private fun expand() {
        expanded = true
        panel.visibility = View.VISIBLE
    }

    private fun collapse() {
        expanded = false
        panel.visibility = View.GONE
    }

    /** Distinguishes a tap from a drag and moves the window during a drag. */
    private inner class DragTapListener : OnTouchListener {
        private var initialX = 0
        private var initialY = 0
        private var touchX = 0f
        private var touchY = 0f
        private var moved = false
        private val touchSlop = dp(8)

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (abs(dx) > touchSlop || abs(dy) > touchSlop) moved = true
                    layoutParams.x = initialX + dx
                    layoutParams.y = initialY + dy
                    windowManager.updateViewLayout(this@FloatingBubbleView, layoutParams)
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    // A tap (no drag) collapses/expands the action panel.
                    if (!moved) toggle()
                    return true
                }
            }
            return false
        }
    }
}
