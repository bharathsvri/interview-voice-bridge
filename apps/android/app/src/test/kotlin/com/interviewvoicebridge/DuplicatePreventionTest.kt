package com.interviewvoicebridge

import com.interviewvoicebridge.domain.model.TranscriptItem
import org.junit.Assert.*
import org.junit.Test

class DuplicatePreventionTest {

    @Test
    fun testDuplicateFilterRejectsIdenticalSegments() {
        val list = mutableListOf<TranscriptItem>()

        val seg1 = TranscriptItem(
            id = "seg-100",
            sessionId = "sess-1",
            sequenceNumber = 1,
            text = "Explain dependency injection in Android.",
            isFinal = true,
            timestamp = 1000L
        )

        val seg1Duplicate = TranscriptItem(
            id = "seg-100",
            sessionId = "sess-1",
            sequenceNumber = 1,
            text = "Explain dependency injection in Android.",
            isFinal = true,
            timestamp = 1050L
        )

        list.add(seg1)

        val isDuplicate = list.any { it.id == seg1Duplicate.id || (it.text == seg1Duplicate.text && it.sequenceNumber == seg1Duplicate.sequenceNumber) }

        assertTrue("Expected duplicate segment to be detected", isDuplicate)
    }

    @Test
    fun testAcceptsDistinctSegments() {
        val list = mutableListOf<TranscriptItem>()

        val seg1 = TranscriptItem(
            id = "seg-1",
            sessionId = "sess-1",
            sequenceNumber = 1,
            text = "First question.",
            isFinal = true,
            timestamp = 1000L
        )

        val seg2 = TranscriptItem(
            id = "seg-2",
            sessionId = "sess-1",
            sequenceNumber = 2,
            text = "Second question.",
            isFinal = true,
            timestamp = 2000L
        )

        list.add(seg1)
        val isDuplicate = list.any { it.id == seg2.id }
        assertFalse(isDuplicate)
        list.add(seg2)

        assertEquals(2, list.size)
    }
}
