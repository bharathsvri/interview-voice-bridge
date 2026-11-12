package com.interviewvoicebridge.presentation.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.interviewvoicebridge.presentation.viewmodel.MainViewModel

@Composable
fun PairingScreen(
    viewModel: MainViewModel,
    onBack: () -> Unit
) {
    var pairingCodeInput by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    val pairingMessage by viewModel.pairingMessage.collectAsState()

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text("Device Pairing") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Icon(
                Icons.Default.QrCode,
                contentDescription = null,
                modifier = Modifier.size(72.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Text(
                "Enter 6-Digit Pairing Code",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                "Locate the 6-digit code or QR code on your computer desktop application dashboard.",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            OutlinedTextField(
                value = pairingCodeInput,
                onValueChange = { if (it.length <= 6) pairingCodeInput = it },
                label = { Text("6-Digit Code") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )

            if (pairingMessage != null) {
                Text(
                    text = pairingMessage!!,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Button(
                onClick = {
                    isLoading = true
                    viewModel.approvePairing(pairingCodeInput) { success ->
                        isLoading = false
                        if (success) {
                            onBack()
                        }
                    }
                },
                enabled = pairingCodeInput.length == 6 && !isLoading,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text("Approve & Connect Device")
                }
            }
        }
    }
}
