
package com.impactgraph.backend.scanner;

import com.github.javaparser.JavaParser;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.ConstructorDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.ObjectCreationExpr;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

@Component
public class JavaSourceScanner {

    public List<ClassInfo> scanProject(String projectPath)
            throws IOException {

        Path root = Path.of(projectPath);

        if (!Files.isDirectory(root)) {
            throw new IllegalArgumentException(
                    "Project directory does not exist: " + projectPath);
        }

        List<ClassInfo> results = new ArrayList<>();

        ParserConfiguration config = new ParserConfiguration()
                .setLanguageLevel(
                        ParserConfiguration.LanguageLevel.JAVA_21);

        JavaParser parser = new JavaParser(config);

        try (Stream<Path> files = Files.walk(root)) {

            for (Path file : files
                    .filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".java"))
                    .toList()) {

                CompilationUnit cu = parser.parse(file)
                        .getResult()
                        .orElseThrow();

                String packageName = cu.getPackageDeclaration()
                        .map(p -> p.getNameAsString())
                        .orElse("");

                for (ClassOrInterfaceDeclaration cls :
                        cu.findAll(ClassOrInterfaceDeclaration.class)) {

                    String className = packageName.isEmpty()
                            ? cls.getNameAsString()
                            : packageName + "." + cls.getNameAsString();

                    Set<String> dependencies = new HashSet<>();

                    // Detect object creation: new SomeClass()
                    cls.findAll(ObjectCreationExpr.class)
                            .forEach(expr -> dependencies.add(
                                    expr.getType().getNameAsString()));

                    // Detect field types
                    cls.findAll(FieldDeclaration.class)
                            .forEach(field ->
                                    field.getVariables().forEach(variable ->
                                            dependencies.add(
                                                    variable.getType()
                                                            .asString())));

                    // Detect constructor parameter types
                    cls.findAll(ConstructorDeclaration.class)
                            .forEach(constructor ->
                                    constructor.getParameters()
                                            .forEach(parameter ->
                                                    dependencies.add(
                                                            parameter.getType()
                                                                    .asString())));

                    // Detect method parameter types
                    cls.findAll(MethodDeclaration.class)
                            .forEach(method ->
                                    method.getParameters()
                                            .forEach(parameter ->
                                                    dependencies.add(
                                                            parameter.getType()
                                                                    .asString())));

                    // Remove self-dependency
                    dependencies.remove(cls.getNameAsString());

                    results.add(new ClassInfo(
                            className,
                            file.toString(),
                            new ArrayList<>(dependencies)));
                }
            }
        }

        return results;
    }

    public record ClassInfo(
            String className,
            String filePath,
            List<String> dependencies) {
    }
}
