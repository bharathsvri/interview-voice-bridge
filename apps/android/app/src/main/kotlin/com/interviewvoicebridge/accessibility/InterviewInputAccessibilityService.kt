package com.interviewvoicebridge.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.interviewvoicebridge.domain.model.AccessibilityStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class InterviewInputAccessibilityService : AccessibilityService() {

    companion object {
        private const val CHATGPT_PACKAGE = "com.openai.chatgpt"

        @Volatile
        var isServiceConnected: Boolean = false
            private set

        @Volatile
        var isInputPopulationEnabled: Boolean = true

        @Volatile
        var appendMode: Boolean = true

        private val _serviceStatus = MutableStateFlow(AccessibilityStatus.DISABLED)
        val serviceStatus: StateFlow<AccessibilityStatus> = _serviceStatus

        private var instance: InterviewInputAccessibilityService? = null

        // Global function to trigger text insertion from repository/viewmodel
        fun populateText(text: String, segmentId: String): Boolean {
            val service = instance ?: return false
            if (!isInputPopulationEnabled) return false
            return service.handlePopulateRequest(text, segmentId)
        }
    }

    private var lastPopulatedSegmentId: String? = null
    private var lastPopulatedTextHash: Int = 0

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        isServiceConnected = true
        _serviceStatus.value = AccessibilityStatus.ENABLED_SEARCHING
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return
        if (packageName.contains("chatgpt", ignoreCase = true) || packageName == CHATGPT_PACKAGE) {
            val rootNode = rootInActiveWindow ?: return
            val inputNode = findEditableInputNode(rootNode)
            if (inputNode != null) {
                _serviceStatus.value = AccessibilityStatus.INPUT_DETECTED
                inputNode.recycle()
            } else {
                _serviceStatus.value = AccessibilityStatus.ENABLED_SEARCHING
            }
            rootNode.recycle()
        }
    }

    override fun onInterrupt() {
        _serviceStatus.value = AccessibilityStatus.DISABLED
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceConnected = false
        instance = null
        _serviceStatus.value = AccessibilityStatus.DISABLED
    }

    private fun handlePopulateRequest(newText: String, segmentId: String): Boolean {
        // Prevent duplicate insertion
        if (segmentId == lastPopulatedSegmentId || newText.hashCode() == lastPopulatedTextHash) {
            return false
        }

        val rootNode = rootInActiveWindow ?: return false
        val inputNode = findEditableInputNode(rootNode)

        if (inputNode == null) {
            rootNode.recycle()
            return false
        }

        try {
            _serviceStatus.value = AccessibilityStatus.POPULATING

            val finalTextToSet: String = if (appendMode) {
                val existingText = inputNode.text?.toString() ?: ""
                if (existingText.isNotBlank()) {
                    "$existingText\n$newText"
                } else {
                    newText
                }
            } else {
                newText
            }

            val arguments = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, finalTextToSet)
            }

            val success = inputNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)

            if (success) {
                lastPopulatedSegmentId = segmentId
                lastPopulatedTextHash = newText.hashCode()
                _serviceStatus.value = AccessibilityStatus.INPUT_DETECTED
            }

            // SAFETY ENFORCEMENT:
            // Under NO circumstance is ACTION_CLICK performed on any send/submit button.
            // The user must manually review and decide to submit the message.

            return success
        } finally {
            inputNode.recycle()
            rootNode.recycle()
        }
    }

    private fun findEditableInputNode(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        // BFS / DFS traversal to locate editable text input
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()

            if (isCandidateInputField(current)) {
                // Recycle remaining nodes in queue
                while (queue.isNotEmpty()) {
                    queue.removeFirst().recycle()
                }
                return current
            }

            for (i in 0 until current.childCount) {
                val child = current.getChild(i)
                if (child != null) {
                    queue.add(child)
                }
            }
        }
        return null
    }

    private fun isCandidateInputField(node: AccessibilityNodeInfo): Boolean {
        val isEditable = node.isEditable
        val className = node.className?.toString() ?: ""
        val isEditText = className.contains("EditText", ignoreCase = true)

        return isEditable || isEditText
    }
}
