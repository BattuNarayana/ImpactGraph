package com.impactgraph.backend.repository;

import com.impactgraph.backend.entity.DependencyNode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DependencyNodeRepository
        extends JpaRepository<DependencyNode, Long> {

    List<DependencyNode> findByProjectId(Long projectId);
}