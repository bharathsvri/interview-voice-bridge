package com.interviewvoicebridge.presentation.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.interviewvoicebridge.domain.model.AccessibilityStatus
import com.interviewvoicebridge.domain.model.ConnectionStatus
import com.interviewvoicebridge.presentation.viewmodel.MainViewModel

@Composable
fun HomeScreen(
    viewModel: MainViewModel,
    onNavigateToPairing: () -> Unit,
    onNavigateToLive: () -> Unit,
    onNavigateToSettings: () -> Unit
) {
    val connectionStatus by viewModel.connectionStatus.collectAsState()
    val accessibilityStatus by viewModel.accessibilityStatus.collectAsState()
    val isReceiving by viewModel.isReceiving.collectAsState()
    val pairedComputerName by viewModel.pairedComputerName.collectAsState()

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text("Interview Voice Bridge", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Status Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Connection Status", fontSize = 16.sp, fontWeight = FontWeight.Bold)

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val statusColor = when (connectionStatus) {
                            ConnectionStatus.CONNECTED -> Color(0xFF10B981)
                            ConnectionStatus.CONNECTING -> Color(0xFFF59E0B)
                            ConnectionStatus.DISCONNECTED -> Color(0xFFEF4444)
                        }
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(statusColor)
                        )
                        Text("Backend: $connectionStatus", fontSize = 14.sp)
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Computer, contentDescription = null, modifier = Modifier.size(16.dp))
                        Text("Computer: ${pairedComputerName ?: "Not Paired"}", fontSize = 14.sp)
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Accessibility, contentDescription = null, modifier = Modifier.size(16.dp))
                        Text("ChatGPT Accessibility: $accessibilityStatus", fontSize = 14.sp)
                    }
                }
            }

            // Quick Actions
            Button(
                onClick = onNavigateToLive,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(Icons.Default.RecordVoiceOver, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open Live Transcription", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }

            OutlinedButton(
                onClick = onNavigateToPairing,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Pair with Computer", fontSize = 15.sp)
            }

            // Stream Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (!isReceiving) {
                    FilledTonalButton(
                        onClick = { viewModel.startReceiving() },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Start Receiving")
                    }
                } else {
                    Button(
                        onClick = { viewModel.stopReceiving() },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Stop Receiving")
                    }
                }
            }
        }
    }
}
