package com.interviewvoicebridge.data.remote

import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @POST("api/v1/auth/login")
    suspend fun login(@Body body: LoginRequestDto): Response<ApiResponseDto<AuthResponseDto>>

    @POST("api/v1/devices/pair/approve")
    suspend fun approvePairing(
        @Header("Authorization") token: String,
        @Body body: ApprovePairingRequestDto
    ): Response<ApiResponseDto<ApprovePairingResponseDto>>

    @GET("api/v1/devices")
    suspend fun getDevices(
        @Header("Authorization") token: String
    ): Response<ApiResponseDto<List<DeviceDto>>>

    @DELETE("api/v1/devices/{deviceId}")
    suspend fun deleteDevice(
        @Header("Authorization") token: String,
        @Path("deviceId") deviceId: String
    ): Response<ApiResponseDto<Map<String, String>>>
}
