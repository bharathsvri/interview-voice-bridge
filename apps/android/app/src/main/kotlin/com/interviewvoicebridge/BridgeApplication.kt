package com.interviewvoicebridge

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class BridgeApplication : Application() {

    companion object {
        const val CHANNEL_ID = "interview_bridge_channel"
        lateinit var instance: BridgeApplication
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Transcription Service"
            val descriptionText = "Real-time speech transcription stream notification"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }
}
