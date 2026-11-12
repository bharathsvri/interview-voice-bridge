package com.interviewvoicebridge.data.remote

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.interviewvoicebridge.domain.model.ConnectionStatus
import com.interviewvoicebridge.domain.model.TranscriptItem
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import java.util.concurrent.TimeUnit

class WebSocketManager(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(25, TimeUnit.SECONDS)
        .build(),
    private val gson: Gson = Gson()
) {

    private var webSocket: WebSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _connectionStatus = MutableStateFlow(ConnectionStatus.DISCONNECTED)
    val connectionStatus: StateFlow<ConnectionStatus> = _connectionStatus

    private val _transcriptionEvents = MutableSharedFlow<TranscriptItem>(extraBufferCapacity = 64)
    val transcriptionEvents: SharedFlow<TranscriptItem> = _transcriptionEvents

    private var currentUrl: String = ""
    private var currentToken: String = ""
    private var currentDeviceId: String = ""
    private var isExplicitlyClosed = false

    fun connect(wsUrl: String, token: String, deviceId: String) {
        currentUrl = wsUrl
        currentToken = token
        currentDeviceId = deviceId
        isExplicitlyClosed = false
        startSocket()
    }

    private fun startSocket() {
        if (webSocket != null) {
            webSocket?.close(1000, "Reconnecting")
        }

        _connectionStatus.value = ConnectionStatus.CONNECTING

        val fullUrl = "$currentUrl?token=$currentToken&deviceId=$currentDeviceId&deviceType=android"
        val request = Request.Builder().url(fullUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _connectionStatus.value = ConnectionStatus.CONNECTED
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connectionStatus.value = ConnectionStatus.DISCONNECTED
                if (!isExplicitlyClosed) {
                    scheduleReconnect()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connectionStatus.value = ConnectionStatus.DISCONNECTED
                if (!isExplicitlyClosed) {
                    scheduleReconnect()
                }
            }
        })
    }

    private fun handleIncomingMessage(text: String) {
        try {
            val json = gson.fromJson(text, JsonObject::class.java)
            val eventType = json.get("eventType")?.asString ?: return
            val payload = json.getAsJsonObject("payload") ?: return

            when (eventType) {
                "transcription:interim", "transcription:final" -> {
                    val isFinal = eventType == "transcription:final"
                    val segmentText = payload.get("text")?.asString ?: ""
                    val sessionId = payload.get("sessionId")?.asString ?: ""
                    val segmentId = payload.get("segmentId")?.asString ?: System.currentTimeMillis().toString()
                    val seq = payload.get("sequenceNumber")?.asInt ?: 1
                    val ts = payload.get("timestamp")?.asLong ?: System.currentTimeMillis()
                    val conf = payload.get("confidence")?.asFloat ?: 1.0f

                    val item = TranscriptItem(
                        id = segmentId,
                        sessionId = sessionId,
                        sequenceNumber = seq,
                        text = segmentText,
                        isFinal = isFinal,
                        timestamp = ts,
                        confidence = conf
                    )

                    scope.launch {
                        _transcriptionEvents.emit(item)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun scheduleReconnect() {
        scope.launch {
            delay(3000)
            if (!isExplicitlyClosed) {
                startSocket()
            }
        }
    }

    fun subscribeToSession(sessionId: String) {
        val msg = JsonObject().apply {
            addProperty("eventId", System.currentTimeMillis().toString())
            addProperty("sessionId", sessionId)
            addProperty("deviceId", currentDeviceId)
            addProperty("timestamp", System.currentTimeMillis())
            addProperty("eventType", "android:transcription:subscribe")
            add("payload", JsonObject().apply { addProperty("sessionId", sessionId) })
        }
        webSocket?.send(msg.toString())
    }

    fun disconnect() {
        isExplicitlyClosed = true
        webSocket?.close(1000, "User disconnect")
        webSocket = null
        _connectionStatus.value = ConnectionStatus.DISCONNECTED
    }
}
