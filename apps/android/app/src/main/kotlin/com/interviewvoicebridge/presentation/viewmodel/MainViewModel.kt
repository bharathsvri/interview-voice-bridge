package com.interviewvoicebridge.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.interviewvoicebridge.accessibility.InterviewInputAccessibilityService
import com.interviewvoicebridge.data.repository.BridgeRepository
import com.interviewvoicebridge.domain.model.AccessibilityStatus
import com.interviewvoicebridge.domain.model.ConnectionStatus
import com.interviewvoicebridge.domain.model.TranscriptItem
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class MainViewModel(
    private val repository: BridgeRepository
) : ViewModel() {

    val connectionStatus: StateFlow<ConnectionStatus> = repository.connectionStatus
    val accessibilityStatus: StateFlow<AccessibilityStatus> = InterviewInputAccessibilityService.serviceStatus

    private val _interimTranscript = MutableStateFlow("")
    val interimTranscript: StateFlow<String> = _interimTranscript

    private val _transcriptHistory = MutableStateFlow<List<TranscriptItem>>(emptyList())
    val transcriptHistory: StateFlow<List<TranscriptItem>> = _transcriptHistory

    private val _isReceiving = MutableStateFlow(true)
    val isReceiving: StateFlow<Boolean> = _isReceiving

    private val _isInputPopulationEnabled = MutableStateFlow(true)
    val isInputPopulationEnabled: StateFlow<Boolean> = _isInputPopulationEnabled

    private val _appendMode = MutableStateFlow(true)
    val appendMode: StateFlow<Boolean> = _appendMode

    private val _pairingMessage = MutableStateFlow<String?>(null)
    val pairingMessage: StateFlow<String?> = _pairingMessage

    private val _pairedComputerName = MutableStateFlow<String?>("Computer Desktop")
    val pairedComputerName: StateFlow<String?> = _pairedComputerName

    private var authToken: String = ""
    val deviceId: String = "android-device-" + (1000..9999).random()

    init {
        // Collect incoming live transcript events from WebSocket
        viewModelScope.launch {
            repository.incomingTranscripts.collect { item ->
                if (!_isReceiving.value) return@collect

                if (item.isFinal) {
                    _interimTranscript.value = ""
                    // Avoid duplicate insertion into list
                    if (_transcriptHistory.value.none { it.id == item.id || (it.text == item.text && it.sequenceNumber == item.sequenceNumber) }) {
                        _transcriptHistory.value = _transcriptHistory.value + item
                        repository.saveTranscript(item)

                        // Automatically populate ChatGPT input field if accessibility is enabled
                        if (_isInputPopulationEnabled.value) {
                            InterviewInputAccessibilityService.populateText(item.text, item.id)
                        }
                    }
                } else {
                    _interimTranscript.value = item.text
                }
            }
        }
    }

    fun setServerUrl(url: String) {
        repository.updateServerUrl(url)
    }

    fun setAuthToken(token: String) {
        authToken = token
    }

    fun startReceiving() {
        _isReceiving.value = true
        if (authToken.isNotBlank()) {
            repository.connectWebSocket(authToken, deviceId)
        }
    }

    fun stopReceiving() {
        _isReceiving.value = false
        repository.disconnectWebSocket()
    }

    fun toggleInputPopulation(enabled: Boolean) {
        _isInputPopulationEnabled.value = enabled
        InterviewInputAccessibilityService.isInputPopulationEnabled = enabled
    }

    fun toggleAppendMode(append: Boolean) {
        _appendMode.value = append
        InterviewInputAccessibilityService.appendMode = append
    }

    fun approvePairing(pairingCode: String, onComplete: (Boolean) -> Unit) {
        viewModelScope.launch {
            val result = repository.approvePairing(authToken, pairingCode, deviceId)
            if (result.isSuccess) {
                _pairingMessage.value = "Successfully paired with computer!"
                repository.connectWebSocket(authToken, deviceId)
                onComplete(true)
            } else {
                _pairingMessage.value = "Pairing failed: " + (result.exceptionOrNull()?.message ?: "Unknown error")
                onComplete(false)
            }
        }
    }

    fun clearTranscripts() {
        _interimTranscript.value = ""
        _transcriptHistory.value = emptyList()
        viewModelScope.launch {
            repository.clearTranscripts()
        }
    }
}
