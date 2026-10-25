
package com.impactgraph.backend.controller;

import com.impactgraph.backend.dto.response.DependencyGraph;
import com.impactgraph.backend.entity.Project;
import com.impactgraph.backend.scanner.JavaSourceScanner;
import com.impactgraph.backend.scanner.JavaSourceScanner.ClassInfo;
import com.impactgraph.backend.service.DependencyGraphService;
import com.impactgraph.backend.service.ProjectService;
import com.impactgraph.backend.service.GithubRepositoryService;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:3000")
public class ScanController {

    private final JavaSourceScanner scanner;
    private final ProjectService projectService;
    private final DependencyGraphService graphService;
    private final GithubRepositoryService gitHubRepositoryService;

    public ScanController(
            JavaSourceScanner scanner,
            ProjectService projectService,
            DependencyGraphService graphService,
            GithubRepositoryService gitHubRepositoryService) {

        this.scanner = scanner;
        this.projectService = projectService;
        this.graphService = graphService;
        this.gitHubRepositoryService = gitHubRepositoryService;
    }

    // Request body for GitHub repository import
    public record GitHubImportRequest(String repositoryUrl) {}
    public record GitHubImportResponse(
            Long projectId,
            String projectName,
            DependencyGraph graph
    ) {}
    // Import a public GitHub repository and generate its graph

    @PostMapping("/github-import")
    public GitHubImportResponse importGitHubRepository(
            @RequestBody GitHubImportRequest request)
            throws IOException {

        try {
            Path repositoryPath =
                    gitHubRepositoryService.cloneRepository(
                            request.repositoryUrl());

            Project project = projectService.createFromGitHub(
                    request.repositoryUrl(),
                    repositoryPath.toString());

            DependencyGraph graph = graphService.scanAndSave(
                    project.getId(),
                    project.getProjectPath());

            return new GitHubImportResponse(
                    project.getId(),
                    project.getProjectName(),
                    graph);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Repository import was interrupted.");

        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    e.getMessage());

        } catch (IOException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Could not import repository: " + e.getMessage());
        }
    }


    // Scan an existing project
    @PostMapping("/{id}/scan")
    public List<ClassInfo> scanProject(@PathVariable Long id)
            throws IOException {

        Project project = projectService.getById(id);

        return scanner.scanProject(project.getProjectPath());
    }

    // Scan and save the dependency graph
    @PostMapping("/{id}/graph")
    public DependencyGraph scanAndSaveGraph(@PathVariable Long id)
            throws IOException {

        Project project = projectService.getById(id);

        return graphService.scanAndSave(
                id,
                project.getProjectPath());
    }

    // Get the saved dependency graph
    @GetMapping("/{id}/graph")
    public DependencyGraph getSavedGraph(@PathVariable Long id) {

        projectService.getById(id);

        return graphService.getSavedGraph(id);
    }

    // Find classes impacted by a change
    @GetMapping("/{id}/impact")
    public List<String> getImpactedClasses(
            @PathVariable Long id,
            @RequestParam String className) {

        projectService.getById(id);

        return graphService.findImpactedClasses(id, className);
    }

    // Get graph statistics
    @GetMapping("/{id}/summary")
    public Map<String, Object> getGraphSummary(
            @PathVariable Long id) {

        projectService.getById(id);

        return graphService.getGraphSummary(id);
    }
}
