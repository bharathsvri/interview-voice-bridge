package com.interviewvoicebridge.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transcript_segments")
data class TranscriptEntity(
    @PrimaryKey
    val id: String,
    val sessionId: String,
    val sequenceNumber: Int,
    val text: String,
    val isFinal: Boolean,
    val timestamp: Long,
    val confidence: Float,
    val language: String
)
