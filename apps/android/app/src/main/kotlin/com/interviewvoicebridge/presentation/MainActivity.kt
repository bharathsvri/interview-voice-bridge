package com.interviewvoicebridge.presentation

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.interviewvoicebridge.BridgeApplication
import com.interviewvoicebridge.data.local.AppDatabase
import com.interviewvoicebridge.data.repository.BridgeRepository
import com.interviewvoicebridge.presentation.ui.*
import com.interviewvoicebridge.presentation.viewmodel.MainViewModel
import com.interviewvoicebridge.services.TranscriptionForegroundService

class MainActivity : ComponentActivity() {

    private lateinit var repository: BridgeRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val database = AppDatabase.getInstance(applicationContext)
        repository = BridgeRepository(database)

        // Start Foreground Service for uninterrupted background streaming
        val serviceIntent = Intent(this, TranscriptionForegroundService::class.java).apply {
            action = TranscriptionForegroundService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val viewModel: MainViewModel = remember { MainViewModel(repository) }
                    var currentRoute by remember { mutableStateOf("home") }

                    when (currentRoute) {
                        "home" -> HomeScreen(
                            viewModel = viewModel,
                            onNavigateToPairing = { currentRoute = "pairing" },
                            onNavigateToLive = { currentRoute = "live" },
                            onNavigateToSettings = { currentRoute = "settings" }
                        )
                        "pairing" -> PairingScreen(
                            viewModel = viewModel,
                            onBack = { currentRoute = "home" }
                        )
                        "live" -> LiveTranscriptionScreen(
                            viewModel = viewModel,
                            onBack = { currentRoute = "home" }
                        )
                        "settings" -> SettingsScreen(
                            viewModel = viewModel,
                            onBack = { currentRoute = "home" }
                        )
                    }
                }
            }
        }
    }
}
