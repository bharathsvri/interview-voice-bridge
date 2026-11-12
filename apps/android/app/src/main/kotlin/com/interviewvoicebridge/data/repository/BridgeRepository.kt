package com.interviewvoicebridge.data.repository

import com.interviewvoicebridge.data.local.AppDatabase
import com.interviewvoicebridge.data.local.TranscriptEntity
import com.interviewvoicebridge.data.remote.*
import com.interviewvoicebridge.domain.model.ConnectionStatus
import com.interviewvoicebridge.domain.model.TranscriptItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class BridgeRepository(
    private val database: AppDatabase,
    private val webSocketManager: WebSocketManager = WebSocketManager()
) {

    private var baseUrl: String = "http://10.0.2.2:5000/" // Android Emulator localhost or local IP
    private var apiService: ApiService

    init {
        apiService = createApiService(baseUrl)
    }

    private fun createApiService(url: String): ApiService {
        return Retrofit.Builder()
            .baseUrl(url)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    fun updateServerUrl(url: String) {
        val sanitized = if (url.endsWith("/")) url else "$url/"
        baseUrl = sanitized
        apiService = createApiService(sanitized)
    }

    val connectionStatus: StateFlow<ConnectionStatus> = webSocketManager.connectionStatus
    val incomingTranscripts: kotlinx.coroutines.flow.SharedFlow<TranscriptItem> = webSocketManager.transcriptionEvents

    fun getStoredTranscripts(sessionId: String): Flow<List<TranscriptItem>> {
        return database.transcriptDao().getSegmentsBySession(sessionId).map { list ->
            list.map { entity ->
                TranscriptItem(
                    id = entity.id,
                    sessionId = entity.sessionId,
                    sequenceNumber = entity.sequenceNumber,
                    text = entity.text,
                    isFinal = entity.isFinal,
                    timestamp = entity.timestamp,
                    confidence = entity.confidence,
                    language = entity.language
                )
            }
        }
    }

    suspend fun saveTranscript(item: TranscriptItem) {
        database.transcriptDao().insertSegment(
            TranscriptEntity(
                id = item.id,
                sessionId = item.sessionId,
                sequenceNumber = item.sequenceNumber,
                text = item.text,
                isFinal = item.isFinal,
                timestamp = item.timestamp,
                confidence = item.confidence,
                language = item.language
            )
        )
    }

    suspend fun login(email: String, pass: String, deviceId: String): Result<AuthResponseDto> {
        return try {
            val res = apiService.login(LoginRequestDto(email, pass, deviceId))
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.error?.message ?: "Login failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun approvePairing(token: String, code: String, deviceId: String): Result<ApprovePairingResponseDto> {
        return try {
            val res = apiService.approvePairing(
                "Bearer $token",
                ApprovePairingRequestDto(pairingCode = code, approvingDeviceId = deviceId)
            )
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.error?.message ?: "Pairing failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDevices(token: String): Result<List<DeviceDto>> {
        return try {
            val res = apiService.getDevices("Bearer $token")
            if (res.isSuccessful && res.body()?.data != null) {
                Result.success(res.body()!!.data!!)
            } else {
                Result.failure(Exception(res.body()?.error?.message ?: "Fetch devices failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun connectWebSocket(token: String, deviceId: String) {
        val wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://") + "ws"
        webSocketManager.connect(wsUrl, token, deviceId)
    }

    fun subscribeSession(sessionId: String) {
        webSocketManager.subscribeToSession(sessionId)
    }

    fun disconnectWebSocket() {
        webSocketManager.disconnect()
    }

    suspend fun clearTranscripts() {
        database.transcriptDao().clearAll()
    }
}
