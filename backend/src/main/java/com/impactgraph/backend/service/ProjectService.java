package com.impactgraph.backend.service;

import com.impactgraph.backend.entity.Project;
import com.impactgraph.backend.repository.ProjectRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProjectService {

    private final ProjectRepository repository;

    public ProjectService(ProjectRepository repository) {
        this.repository = repository;
    }

    public Project create(Project project) {
        return repository.save(project);
    }

    public List<Project> getAll() {
        return repository.findAll();
    }

    public Project getById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found: " + id));
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Project not found: " + id);
        }
        repository.deleteById(id);
    }

    public Project createFromGitHub(
            String repositoryUrl,
            String repositoryPath) {

        Project project = new Project();

        String repoName = repositoryUrl
                .replaceAll("/+$", "")
                .substring(repositoryUrl.replaceAll("/+$", "").lastIndexOf('/') + 1)
                .replace(".git", "");

        project.setProjectName(repoName);
        project.setDescription("Imported from GitHub: " + repositoryUrl);
        project.setLanguage("Java");
        project.setProjectPath(repositoryPath);

        return repository.save(project);
    }

}