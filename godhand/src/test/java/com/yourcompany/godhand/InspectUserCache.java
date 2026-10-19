package com.yourcompany.godhand;
import net.minecraft.util.UserCache;
import java.lang.reflect.Method;

public class InspectUserCache {
    public static void main(String[] args) {
        for (Method method : UserCache.class.getDeclaredMethods()) {
            System.out.println(method.toString());
        }
    }
}
