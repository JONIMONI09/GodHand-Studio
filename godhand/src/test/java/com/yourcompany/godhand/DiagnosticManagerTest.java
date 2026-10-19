package com.yourcompany.godhand;

import net.minecraft.SharedConstants;
import net.minecraft.Bootstrap;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Assumptions;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * DiagnosticManager tests testing logging outputs.
 * Uses SharedConstants and Bootstrap initialization to enable Minecraft Text components in headless environment.
 */
public class DiagnosticManagerTest {

    private GodHandConfig config;

    @BeforeAll
    public static void setupMinecraft() {
        try {
            net.minecraft.SharedConstants.createGameVersion();
            net.minecraft.Bootstrap.initialize();

            // Validate if Mockito can mock entities without crashing in this environment
            org.mockito.Mockito.mock(net.minecraft.entity.mob.MobEntity.class, org.mockito.Mockito.withSettings().withoutAnnotations());
        } catch (java.lang.VerifyError | java.lang.InternalError | java.lang.NoClassDefFoundError | java.lang.ExceptionInInitializerError e) {
            org.junit.jupiter.api.Assumptions.assumeTrue(false, "Skipping tests due to Fabric/Mockito incompatibility on this JVM");
        } catch (Throwable t) {
             if (t instanceof org.opentest4j.TestAbortedException) throw (org.opentest4j.TestAbortedException)t;
             System.err.println("Minecraft Bootstrap failed: " + t.getMessage());
             org.junit.jupiter.api.Assumptions.assumeTrue(false, "Skipping tests because Bootstrap failed");
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        try {
            Class<?> clientClass = Class.forName("net.minecraft.client.MinecraftClient");
            Field instanceField = clientClass.getDeclaredField("instance");
            instanceField.setAccessible(true);
            instanceField.set(null, null);
        } catch (Throwable t) {
            // Ignore if MinecraftClient doesn't exist or isn't accessible
        }

        config = GodHandConfig.getInstance();

        Field historyField = DiagnosticManager.class.getDeclaredField("LOG_HISTORY");
        historyField.setAccessible(true);
        ((List<?>) historyField.get(null)).clear();
    }

    @Test
    void testLogInfoDiagnosticEnabled() throws Exception {
        config.godMode.diagnosticModeEnabled = true;

        DiagnosticManager.log(DiagnosticManager.LogLevel.INFO, "Test Info Message");

        List<?> history = getLogHistory();
        boolean found = false;
        for (Object item : history) {
            if (item.toString().contains("Test Info Message")) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Should have appended info message to log history");
    }

    @Test
    void testLogWarnDiagnosticDisabled() throws Exception {
        config.godMode.diagnosticModeEnabled = false;

        DiagnosticManager.log(DiagnosticManager.LogLevel.WARN, "Test Warn Message Hidden");

        List<?> history = getLogHistory();
        boolean found = false;
        for (Object item : history) {
            if (item.toString().contains("Test Warn Message Hidden")) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Log should be in history even if not sent to chat");
    }

    @Test
    void testLogCriticalAlwaysSent() throws Exception {
        config.godMode.diagnosticModeEnabled = false;

        DiagnosticManager.log(DiagnosticManager.LogLevel.CRITICAL, "Test Critical Message");

        List<?> history = getLogHistory();
        boolean found = false;
        for (Object item : history) {
            if (item.toString().contains("Test Critical Message")) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Should have appended critical message to log history");
    }

    @Test
    void testCriticalWithException() throws Exception {
        config.godMode.diagnosticModeEnabled = false;

        Exception e = new RuntimeException("Test Exception");
        DiagnosticManager.critical("Test Critical Error", e);

        List<?> history = getLogHistory();
        boolean found = false;
        for (Object item : history) {
            if (item.toString().contains("Test Critical Error: Test Exception")) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Should have appended critical error with exception message to log history");
    }

    @Test
    void testCriticalWithoutException() throws Exception {
        config.godMode.diagnosticModeEnabled = false;

        DiagnosticManager.critical("Test Critical Error No Exception", null);

        List<?> history = getLogHistory();
        boolean found = false;
        for (Object item : history) {
            if (item.toString().contains("Test Critical Error No Exception")) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Should have appended critical error without exception to log history");
    }

    @Test
    void testMaxLogLines() throws Exception {
        for (int i = 0; i < 300; i++) {
            DiagnosticManager.log("Message " + i);
        }

        List<?> history = getLogHistory();
        assertEquals(255, history.size(), "History should be capped at 255 items");
        boolean containsNewest = false;
        for (Object item : history) {
            if (item.toString().contains("Message 299")) {
                containsNewest = true;
                break;
            }
        }
        assertTrue(containsNewest, "History should retain the newest message");
    }

    @Test
    @SuppressWarnings("deprecation")
    void testCheckMethodSuccess() throws Exception {
        config.godMode.diagnosticModeEnabled = true;

        DiagnosticManager.check(true, "Success Condition", "Failure Condition");

        List<?> history = getLogHistory();
        boolean foundSuccess = false;
        boolean foundFailure = false;
        for (Object item : history) {
             if (item.toString().contains("Success Condition")) {
                 foundSuccess = true;
             }
             if (item.toString().contains("Failure Condition")) {
                 foundFailure = true;
             }
        }
        assertTrue(foundSuccess, "Should have appended success condition to log history");
        assertTrue(!foundFailure, "Should not have appended failure condition");
    }

    @Test
    @SuppressWarnings("deprecation")
    void testCheckMethodFailure() throws Exception {
        config.godMode.diagnosticModeEnabled = true;

        DiagnosticManager.check(false, "Success Condition", "Failure Condition");

        List<?> history = getLogHistory();
        boolean foundSuccess = false;
        boolean foundFailure = false;
        for (Object item : history) {
             if (item.toString().contains("Success Condition")) {
                 foundSuccess = true;
             }
             if (item.toString().contains("Failure Condition")) {
                 foundFailure = true;
             }
        }
        assertTrue(!foundSuccess, "Should not have appended success condition");
        assertTrue(foundFailure, "Should have appended failure condition to log history");
    }

    private List<?> getLogHistory() throws Exception {
        Field historyField = DiagnosticManager.class.getDeclaredField("LOG_HISTORY");
        historyField.setAccessible(true);
        return (List<?>) historyField.get(null);
    }
}
