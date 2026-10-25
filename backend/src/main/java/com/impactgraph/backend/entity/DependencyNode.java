package com.impactgraph.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "dependency_nodes")
public class DependencyNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;

    private String className;

    @Column(length = 2000)
    private String filePath;

    public DependencyNode() {
    }

    public DependencyNode(
            Long projectId,
            String className,
            String filePath) {
        this.projectId = projectId;
        this.className = className;
        this.filePath = filePath;
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getClassName() {
        return className;
    }

    public String getFilePath() {
        return filePath;
    }
}