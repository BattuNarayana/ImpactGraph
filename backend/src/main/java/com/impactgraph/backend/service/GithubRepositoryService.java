
package com.impactgraph.backend.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class GithubRepositoryService {

    private final Path repositoryRoot =
            Paths.get("data", "github-repositories")
                    .toAbsolutePath()
                    .normalize();

    public Path cloneRepository(String repositoryUrl)
            throws IOException, InterruptedException {

        if (repositoryUrl == null) {
            throw new IllegalArgumentException(
                    "Please enter a GitHub repository URL."
            );
        }

        String url = repositoryUrl.trim()
                .replaceAll("/+$", "");

        if (url.endsWith(".git")) {
            url = url.substring(0, url.length() - 4);
        }

        if (!url.matches(
                "https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")) {
            throw new IllegalArgumentException(
                    "Enter a valid URL like https://github.com/owner/repo"
            );
        }

        String[] parts = url.split("/");
        String owner = parts[parts.length - 2];
        String repo = parts[parts.length - 1];

        Files.createDirectories(repositoryRoot);

        Path destination = repositoryRoot
                .resolve(owner + "-" + repo)
                .normalize();

        if (!destination.startsWith(repositoryRoot)) {
            throw new IllegalArgumentException("Invalid repository path.");
        }

        if (Files.exists(destination)) {
            throw new IllegalArgumentException(
                    "Repository already exists locally. Use another repository URL."
            );
        }

        Process process = new ProcessBuilder(
                "git",
                "clone",
                "--depth", "1",
                "https://github.com/" + owner + "/" + repo + ".git",
                destination.toString()
        )
                .redirectErrorStream(true)
                .start();

        String output = new String(
                process.getInputStream().readAllBytes()
        );

        int exitCode = process.waitFor();

        if (exitCode != 0) {
            throw new IOException(
                    "Git clone failed. Check the public repository URL. "
                            + output
            );
        }

        return destination;
    }
}
