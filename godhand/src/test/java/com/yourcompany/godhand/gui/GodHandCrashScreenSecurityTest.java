package com.yourcompany.godhand.gui;

import org.junit.jupiter.api.Test;
import java.lang.reflect.Field;
import static org.junit.jupiter.api.Assertions.assertFalse;

public class GodHandCrashScreenSecurityTest {

    @Test
    void testStackTraceFieldRemoved() {
        boolean hasStackTraceField = false;

        Field[] fields = GodHandCrashScreen.class.getDeclaredFields();
        for (Field field : fields) {
            if ("stackTrace".equals(field.getName())) {
                hasStackTraceField = true;
                break;
            }
        }

        assertFalse(hasStackTraceField, "The 'stackTrace' field should be removed to prevent information disclosure.");
    }
}
