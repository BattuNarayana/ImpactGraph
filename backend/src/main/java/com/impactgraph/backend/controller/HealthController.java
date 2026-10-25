package com.impactgraph.backend.controller;

import com.impactgraph.backend.dto.response.ApiResponse;
import com.impactgraph.backend.dto.response.HealthResponse;
import com.impactgraph.backend.service.HealthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private final HealthService healthService;

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping("/api/health")
    public ApiResponse<HealthResponse> health() {
        return healthService.getHealthStatus();
    }
}