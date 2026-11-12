package com.interviewvoicebridge.domain.model

data class TranscriptItem(
    val id: String,
    val sessionId: String,
    val sequenceNumber: Int,
    val text: String,
    val isFinal: Boolean,
    val timestamp: Long,
    val confidence: Float = 1.0f,
    val language: String = "en"
)

data class PairedDevice(
    val id: String,
    val name: String,
    val isOnline: Boolean,
    val pairedDeviceId: String?
)

enum class ConnectionStatus {
    DISCONNECTED,
    CONNECTING,
    CONNECTED
}

enum class AccessibilityStatus {
    DISABLED,
    ENABLED_SEARCHING,
    INPUT_DETECTED,
    POPULATING
}
