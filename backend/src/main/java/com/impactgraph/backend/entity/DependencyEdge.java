package com.impactgraph.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "dependency_edges")
public class DependencyEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;

    @Column(length = 500)
    private String sourceClass;

    @Column(length = 500)
    private String targetClass;

    public DependencyEdge() {
    }

    public DependencyEdge(
            Long projectId,
            String sourceClass,
            String targetClass) {
        this.projectId = projectId;
        this.sourceClass = sourceClass;
        this.targetClass = targetClass;
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getSourceClass() {
        return sourceClass;
    }

    public String getTargetClass() {
        return targetClass;
    }
}