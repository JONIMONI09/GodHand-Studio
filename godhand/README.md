# GodHand Mod 🖐️⚡

GodHand is an administrative and utility Minecraft mod featuring enhanced capabilities, custom combat mechanics, and companion AI, built on Fabric 1.20.1.

## Known Issues and Solutions

### Game Crash Due to JNA Incompatibility (Common on PojavLauncher / Custom Runtimes)

**Log Error Description:**
```
java.lang.Error: There is an incompatible JNA native library installed on this system
Expected: 6.1.6
Found:    7.0.2
```

**Resolution:**
This crash is caused by an incompatible version of the `Java Native Access` (JNA) library installed in the host Java runtime environment.

To resolve this issue, add the following JVM flag to the launch arguments in your Minecraft launcher:

```
-Djna.nosys=true
```

This instructs the JVM to use the bundled JNA library instead of the host system's native library, avoiding the crash.
