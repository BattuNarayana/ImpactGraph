package com.impactgraph.backend.dto.response;

import java.time.LocalDateTime;

public class HealthResponse {

    private String status;
    private String application;
    private String version;
    private LocalDateTime timestamp;

    public HealthResponse() {
    }

    public HealthResponse(String status, String application, String version, LocalDateTime timestamp) {
        this.status = status;
        this.application = application;
        this.version = version;
        this.timestamp = timestamp;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getApplication() {
        return application;
    }

    public void setApplication(String application) {
        this.application = application;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}