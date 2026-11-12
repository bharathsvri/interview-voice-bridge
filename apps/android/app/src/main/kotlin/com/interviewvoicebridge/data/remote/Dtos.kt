package com.interviewvoicebridge.data.remote

import com.google.gson.annotations.SerializedName

data class ApiResponseDto<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T?,
    @SerializedName("error") val error: ApiErrorDto?,
    @SerializedName("requestId") val requestId: String?,
    @SerializedName("timestamp") val timestamp: String?
)

data class ApiErrorDto(
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String
)

data class LoginRequestDto(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("deviceId") val deviceId: String? = null
)

data class AuthResponseDto(
    @SerializedName("user") val user: UserDto,
    @SerializedName("tokens") val tokens: TokensDto
)

data class UserDto(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String
)

data class TokensDto(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String,
    @SerializedName("expiresIn") val expiresIn: Long
)

data class ApprovePairingRequestDto(
    @SerializedName("pairingCode") val pairingCode: String,
    @SerializedName("approvingDeviceId") val approvingDeviceId: String,
    @SerializedName("name") val name: String = "Android Phone",
    @SerializedName("deviceType") val deviceType: String = "android"
)

data class ApprovePairingResponseDto(
    @SerializedName("pairingId") val pairingId: String,
    @SerializedName("initiatingDeviceId") val initiatingDeviceId: String,
    @SerializedName("pairedDeviceId") val pairedDeviceId: String,
    @SerializedName("status") val status: String
)

data class DeviceDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("deviceType") val deviceType: String,
    @SerializedName("pairedDeviceId") val pairedDeviceId: String?,
    @SerializedName("isOnline") val isOnline: Boolean,
    @SerializedName("lastActiveAt") val lastActiveAt: String?
)

data class WebSocketEnvelopeDto(
    @SerializedName("eventId") val eventId: String,
    @SerializedName("sessionId") val sessionId: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("eventType") val eventType: String,
    @SerializedName("payload") val payload: Any?
)
