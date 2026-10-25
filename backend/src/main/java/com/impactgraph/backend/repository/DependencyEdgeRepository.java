package com.impactgraph.backend.repository;

import com.impactgraph.backend.entity.DependencyEdge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DependencyEdgeRepository
        extends JpaRepository<DependencyEdge, Long> {

    List<DependencyEdge> findByProjectId(Long projectId);
}