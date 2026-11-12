package com.interviewvoicebridge.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TranscriptDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSegment(segment: TranscriptEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSegments(segments: List<TranscriptEntity>)

    @Query("SELECT * FROM transcript_segments WHERE sessionId = :sessionId ORDER BY sequenceNumber ASC")
    fun getSegmentsBySession(sessionId: String): Flow<List<TranscriptEntity>>

    @Query("SELECT * FROM transcript_segments WHERE isFinal = 1 ORDER BY timestamp DESC")
    fun getAllFinalSegments(): Flow<List<TranscriptEntity>>

    @Query("DELETE FROM transcript_segments WHERE sessionId = :sessionId")
    suspend fun deleteSegmentsBySession(sessionId: String)

    @Query("DELETE FROM transcript_segments")
    suspend fun clearAll()
}
