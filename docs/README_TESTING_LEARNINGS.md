# Testing Learnings

- When testing Fabric/Minecraft classes that rely on early bootstrap routines (e.g., `Text.literal()`, Registries), `Mockito` often fails to stub or mock them correctly without `SharedConstants.createGameVersion()` and `Bootstrap.initialize()`.
- To avoid test flakiness due to missing `MinecraftClient` instantiation, tests can use reflection to safely nullify the static `instance` field rather than injecting incomplete mocks.
- `useJUnitPlatform()` must be explicitly configured in `build.gradle` for the `test` task, otherwise Gradle might not find or run the JUnit 5 tests.
