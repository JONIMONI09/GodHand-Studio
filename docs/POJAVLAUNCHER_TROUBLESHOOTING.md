**Describe the bug**
Minecraft crashes on startup when using PojavLauncher on Android. The crash log shows a `ModResolutionException` caused by a `FileNotFoundException` with a `(Permission denied)` error for both the GodHand mod JAR and the Fabric API JAR.

**To Reproduce**
1. Install PojavLauncher on an Android device.
2. Install Fabric for 1.20.1.
3. Place `godhand-1.0.0.jar` and `fabric-api-....jar` in the `mods` folder.
4. Launch the game.

**Expected behavior**
The game should start normally.

**Actual behavior**
The game crashes during the mod loading phase.

**Log Output**
```
[10:44:02] [main/ERROR]: Incompatible mods found!
net.fabricmc.loader.impl.FormattedException: net.fabricmc.loader.impl.discovery.ModResolutionException: Mod discovery failed!
...
Caused by: java.io.FileNotFoundException: /storage/emulated/0/Android/data/net.kdt.pojavlaunch/files/.minecraft/mods/godhand-1.0.0.jar (Permission denied)
...
Caused by: java.io.FileNotFoundException: /storage/emulated/0/Android/data/net.kdt.pojavlaunch/files/.minecraft/mods/fabric-api-0.83.1+1.20.1.jar (Permission denied)
```

**Root Cause & Solution**
This is not a bug in the mod's code but an Android file permission issue. PojavLauncher lacks the necessary permissions to read files in its data directory.

**Solution:**
1. Go to **Android Settings** > **Apps** > **PojavLauncher**.
2. Go to **Permissions**.
3. Grant the **"Files and media"** or **"Storage"** permission.
4. Restart the game.
