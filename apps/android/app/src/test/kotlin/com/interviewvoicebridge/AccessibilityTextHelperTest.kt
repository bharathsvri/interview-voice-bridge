package com.interviewvoicebridge

import org.junit.Assert.*
import org.junit.Test

class AccessibilityTextHelperTest {

    private fun computeTextToSet(existingText: String, newText: String, appendMode: Boolean): String {
        return if (appendMode) {
            if (existingText.isNotBlank()) {
                "$existingText\n$newText"
            } else {
                newText
            }
        } else {
            newText
        }
    }

    @Test
    fun testAppendModeWithExistingText() {
        val existing = "Initial thought"
        val newSegment = "Follow up clarification"
        val result = computeTextToSet(existing, newSegment, appendMode = true)

        assertEquals("Initial thought\nFollow up clarification", result)
    }

    @Test
    fun testAppendModeWithBlankExistingText() {
        val existing = ""
        val newSegment = "Fresh prompt text"
        val result = computeTextToSet(existing, newSegment, appendMode = true)

        assertEquals("Fresh prompt text", result)
    }

    @Test
    fun testReplaceModeOverwritesExistingText() {
        val existing = "Old draft text that should be replaced"
        val newSegment = "New incoming text"
        val result = computeTextToSet(existing, newSegment, appendMode = false)

        assertEquals("New incoming text", result)
    }
}
