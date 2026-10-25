package com.impactgraph.backend.service;

import com.impactgraph.backend.dto.response.ApiResponse;
import com.impactgraph.backend.dto.response.HealthResponse;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class HealthService {

    public ApiResponse<HealthResponse> getHealthStatus() {

        HealthResponse healthResponse = new HealthResponse(
                "UP",
                "ImpactGraph Backend",
                "1.0.0",
                LocalDateTime.now()
        );

        return new ApiResponse<>(
                true,
                "Health Check Successful",
                healthResponse
        );
    }
}